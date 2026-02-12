from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from openai import OpenAI
import os
import uuid
import json
import asyncio
import random
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
import tempfile
import pathlib
import time
import math

# 다락방 용어 임포트
from church_terms import (
    get_gemini_prompt,
    get_gemini_content_prompt,
    get_gemini_correction_prompt,
    get_correction_prompt_by_type,
    correct_text,
    get_claude_context,
    get_summary_prompt,
    ALL_CHURCH_TERMS,
    DARAKBANG_CORE,
    COMMON_MISTAKES,
    print_terms_summary
)

load_dotenv()

app = FastAPI(title="말록24 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY is not set.")
genai.configure(api_key=GEMINI_API_KEY)

# OpenAI (Whisper) 설정
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY is not set. Whisper STT unavailable, falling back to Gemini.")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Whisper 파일 크기 제한 (25MB)
WHISPER_MAX_SIZE = 24 * 1024 * 1024  # 약간 여유

# 시작 시 용어 로딩 확인
@app.on_event("startup")
async def startup_event():
    print_terms_summary()
    if openai_client:
        print("OpenAI Whisper: Ready")
    else:
        print("OpenAI Whisper: Not configured (Gemini fallback)")
    try:
        if GEMINI_API_KEY:
            print("Checking available Gemini models...")
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    print(f" - {m.name}")
    except Exception as e:
        print(f"Failed to list models: {e}")

@app.get("/")
async def root():
    return {
        "message": "설교 및 회의 녹취 API",
        "version": "3.0",
        "engine": "Whisper STT + Gemini 교정" if openai_client else "Gemini (단일)",
        "darakbang_terms": len(DARAKBANG_CORE),
        "total_terms": len(ALL_CHURCH_TERMS),
    }

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL or SUPABASE_KEY not set.")
supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")

# 인메모리 상태 추적
task_status = {}

# 모델 캐시
_model_cache = {"model": None, "cached_at": 0}
MODEL_CACHE_TTL = 3600

def get_optimal_model():
    """Gemini 모델 동적 선택"""
    if _model_cache["model"] and (time.time() - _model_cache["cached_at"]) < MODEL_CACHE_TTL:
        return _model_cache["model"]
    try:
        if not GEMINI_API_KEY:
            return "gemini-2.5-flash"
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
        selected = None
        priority = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]
        for target in priority:
            for model_id in available_models:
                if model_id == f"models/{target}" or model_id == f"models/{target}-001":
                    selected = model_id
                    break
            if selected:
                break
        if not selected and available_models:
            selected = available_models[0]
        if selected:
            _model_cache["model"] = selected
            _model_cache["cached_at"] = time.time()
            print(f"Model cached: {selected}")
            return selected
    except Exception as e:
        print(f"Model selection error: {e}")
    return "gemini-2.5-flash"


def split_audio_file(file_path: str) -> list[str]:
    """
    25MB 초과 파일을 청크로 분할.
    ffmpeg으로 10분 단위 분할 (Whisper 제한 대응)
    """
    file_size = os.path.getsize(file_path)
    if file_size <= WHISPER_MAX_SIZE:
        return [file_path]

    from pydub import AudioSegment

    print(f"File size {file_size / 1024 / 1024:.1f}MB > 24MB, splitting...")

    # 파일 확장자 확인
    ext = pathlib.Path(file_path).suffix.lower()
    format_map = {'.mp3': 'mp3', '.wav': 'wav', '.m4a': 'mp4', '.ogg': 'ogg', '.flac': 'flac', '.webm': 'webm'}
    fmt = format_map.get(ext, 'mp3')

    audio = AudioSegment.from_file(file_path, format=fmt)
    duration_ms = len(audio)

    # 10분 단위로 분할 (겹침 2초)
    chunk_duration = 10 * 60 * 1000  # 10분
    overlap = 2000  # 2초 겹침 (문장 끊김 방지)

    chunks = []
    start = 0
    chunk_idx = 0

    while start < duration_ms:
        end = min(start + chunk_duration, duration_ms)
        chunk = audio[start:end]

        chunk_path = f"{file_path}_chunk{chunk_idx}.mp3"
        chunk.export(chunk_path, format="mp3", bitrate="64k")
        chunks.append(chunk_path)
        print(f"  Chunk {chunk_idx}: {start/1000:.0f}s ~ {end/1000:.0f}s ({os.path.getsize(chunk_path)/1024/1024:.1f}MB)")

        chunk_idx += 1
        start = end - overlap if end < duration_ms else end

    return chunks


def whisper_transcribe(file_path: str, language: str = "ko", transcription_type: str = "sermon") -> str:
    """
    OpenAI Whisper API로 오디오 → 텍스트 변환.
    25MB 초과 시 자동 분할 처리.
    """
    # Whisper prompt: 언어별 + 유형별 컨텍스트 힌트
    # 음질이 낮을 때 올바른 단어를 추정하는 데 도움이 되는 역할
    if language == "en":
        # ===== 영어 프롬프트 =====
        if transcription_type == "sermon":
            whisper_prompt = (
                "This is a sermon or lecture recording. "
                "Infer unclear words from context. "
                "Bible, Scripture, Gospel, salvation, grace, faith, prayer, blessing, congregation, "
                "sermon, worship, fellowship, testimony, discipleship, ministry, mission"
            )
        elif transcription_type == "phonecall":
            whisper_prompt = (
                "This is a phone call recording with two speakers. "
                "Audio quality may be low. Infer unclear words from context. "
                "hypertension, diabetes, epilepsy, seizure, stroke, pneumonia, asthma, arthritis, "
                "acetaminophen, ibuprofen, metformin, amoxicillin, omeprazole, insulin, "
                "levetiracetam, carbamazepine, valproate, lamotrigine, phenytoin, topiramate, "
                "blood pressure, blood sugar, CT, MRI, EEG, ECG, prescription, dosage, side effects"
            )
        else:
            whisper_prompt = (
                "This is a meeting or conversation recording with multiple speakers. "
                "Audio may have echo or overlapping voices. Infer unclear words from context. "
                "hypertension, diabetes, epilepsy, seizure, stroke, pneumonia, asthma, arthritis, "
                "acetaminophen, ibuprofen, metformin, amoxicillin, omeprazole, insulin, "
                "levetiracetam, carbamazepine, valproate, lamotrigine, phenytoin, topiramate, "
                "blood pressure, CT, MRI, EEG, prescription, dosage, side effects, "
                "KPI, ROI, OKR, project, milestone, sprint, deadline, budget, revenue, profit margin"
            )
    else:
        # ===== 한국어 프롬프트 =====
        if transcription_type == "sermon":
            whisper_prompt = "다락방, 렘넌트, 237, 5000종족, 7망대, 7여정, 7이정표, CVDIP, 류광수, 이주현, 드로아교회, 앗수르, 네피림, 바벨탑, 뉴에이지, 프리메이슨, REA, RRTS, TCK, CCK, NCK, 성회, 전도대회, 수련회, 보좌화, 생활화, 개인화, 제자화, 세계화, Heavenly, Thronely, Eternally, 록펠러, 카네기, 워너메이커, 존 워너메이커, 쉬버, 마틴 루터"
        elif transcription_type == "phonecall":
            whisper_prompt = (
                "전화 통화 녹음입니다. 두 명의 화자가 대화합니다. "
                "음질이 낮거나 불명확한 부분은 문맥에 맞게 추정하세요. "
                "고혈압, 당뇨병, 심근경색, 갑상선, 위염, 폐렴, 천식, 관절염, 디스크, 우울증, 불면증, "
                "뇌전증, 간질, 발작, 항경련제, 레비티라세탐, 카바마제핀, 발프로산, 라모트리진, "
                "타이레놀, 아세트아미노펜, 이부프로펜, 메트포르민, 아목시실린, 오메프라졸, 인슐린, "
                "혈압, 혈당, CT, MRI, EEG, 내시경, 혈액검사, 심전도, 처방, 복용, 부작용, 합병증"
            )
        else:
            whisper_prompt = (
                "회의 또는 대화 녹음입니다. 여러 참석자가 있습니다. "
                "음질이 낮거나 겹치는 목소리가 있을 수 있으며, 문맥에 맞게 추정하세요. "
                "고혈압, 당뇨병, 심근경색, 갑상선, 위염, 폐렴, 천식, 관절염, 디스크, 우울증, 불면증, "
                "뇌전증, 간질, 발작, 항경련제, 레비티라세탐, 카바마제핀, 발프로산, 라모트리진, "
                "타이레놀, 아세트아미노펜, 이부프로펜, 메트포르민, 아목시실린, 오메프라졸, 인슐린, "
                "혈압, 혈당, CT, MRI, EEG, 내시경, 혈액검사, 심전도, 처방, 복용, 부작용, 합병증, "
                "KPI, ROI, OKR, 프로젝트, 마일스톤, 스프린트, 데드라인, 예산, 매출, 영업이익"
            )

    chunks = split_audio_file(file_path)
    all_text = []

    for i, chunk_path in enumerate(chunks):
        print(f"  Whisper transcribing chunk {i+1}/{len(chunks)}...")

        with open(chunk_path, "rb") as audio_file:
            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                prompt=whisper_prompt,
                response_format="text",
            )

        all_text.append(response.strip())

        # 청크 파일 삭제 (원본 제외)
        if chunk_path != file_path:
            os.unlink(chunk_path)

    return "\n\n".join(all_text)


async def gemini_correct_and_structure(raw_text: str, task_id: str, transcription_type: str = "sermon", language: str = "ko") -> str:
    """
    Gemini로 텍스트 교정 + 구조화 (2단계).
    유형별 + 언어별 프롬프트 선택.
    """
    target_model = get_optimal_model()
    print(f"[{task_id}] Gemini correction model: {target_model}, type: {transcription_type}, lang: {language}")

    correction_prompt = get_correction_prompt_by_type(transcription_type, language)

    model = genai.GenerativeModel(
        target_model,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=65536,
        )
    )

    label = "Original Text" if language == "en" else "원본 텍스트"
    full_prompt = f"""{correction_prompt}

[{label}]
{raw_text}"""

    response = None
    max_retries = 5

    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                full_prompt,
                request_options={"timeout": 600}
            )
            break
        except Exception as e:
            if ("429" in str(e) or "ResourceExhausted" in str(e) or "quota" in str(e).lower()) and attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 10 + random.uniform(0, 5)
                print(f"[{task_id}] Quota exceeded (429). Retrying in {wait_time:.1f}s... (Attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_time)
            else:
                raise e

    return response.text


async def process_transcription(task_id: str, temp_file_path: str, language: str, correct: bool, transcription_type: str = "sermon"):
    """백그라운드 변환 로직: Whisper STT → Gemini 교정"""
    try:
        task_status[task_id] = "processing"

        if openai_client:
            # ===== 2단계 방식: Whisper + Gemini =====

            # 1단계: Whisper로 완전 녹취
            print(f"[{task_id}] Step 1: Whisper STT...")
            raw_text = whisper_transcribe(temp_file_path, language, transcription_type)
            print(f"[{task_id}] Whisper done. Raw length: {len(raw_text)} chars")

            # 임시 파일 삭제
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

            # 2단계: Gemini로 교정 + 구조화
            print(f"[{task_id}] Step 2: Gemini correction...")
            corrected_text = await gemini_correct_and_structure(raw_text, task_id, transcription_type, language)
            print(f"[{task_id}] Gemini done. Corrected length: {len(corrected_text)} chars")

            # 3단계: 규칙 기반 후처리
            corrected_text = correct_text(corrected_text, transcription_type, language)

            engine = "whisper+gemini"

        else:
            # ===== 폴백: Gemini 단일 방식 (기존) =====
            print(f"[{task_id}] Fallback: Gemini-only mode")

            audio_file = genai.upload_file(temp_file_path)
            target_model = get_optimal_model()
            model = genai.GenerativeModel(
                target_model,
                system_instruction=get_gemini_prompt(),
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=65536,
                )
            )
            content_prompt = get_gemini_content_prompt()

            response = None
            max_retries = 5
            for attempt in range(max_retries):
                try:
                    response = model.generate_content(
                        [content_prompt, audio_file],
                        request_options={"timeout": 600}
                    )
                    break
                except Exception as e:
                    if ("429" in str(e) or "ResourceExhausted" in str(e) or "quota" in str(e).lower()) and attempt < max_retries - 1:
                        wait_time = (2 ** attempt) * 10 + random.uniform(0, 5)
                        await asyncio.sleep(wait_time)
                    else:
                        raise e

            raw_text = response.text
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            try:
                audio_file.delete()
            except:
                pass

            corrected_text = correct_text(raw_text, transcription_type, language)
            engine = "gemini-only"

        # 결과 저장
        result_data = {
            "task_id": task_id,
            "status": "completed",
            "created_at": datetime.now().isoformat(),
            "language": language,
            "raw_text": raw_text,
            "corrected_text": corrected_text,
            "characters": len(corrected_text),
            "darakbang_optimized": transcription_type == "sermon",
            "engine": engine,
            "transcription_type": transcription_type,
        }

        supabase.table("transcriptions").insert({
            "task_id": task_id,
            "status": "completed",
            "created_at": result_data["created_at"],
            "language": language,
            "raw_text": raw_text,
            "corrected_text": corrected_text,
            "characters": len(corrected_text),
            "darakbang_optimized": transcription_type == "sermon",
            "engine": engine,
            "transcription_type": transcription_type,
        }).execute()

        task_status[task_id] = "completed"

    except Exception as e:
        print(f"Transcription error: {e}")
        import traceback
        traceback.print_exc()
        task_status[task_id] = "error"
        try:
            supabase.table("transcriptions").insert({
                "task_id": task_id,
                "status": "error",
                "error": str(e),
                "created_at": datetime.now().isoformat(),
                "transcription_type": transcription_type,
            }).execute()
        except Exception as db_err:
            print(f"Failed to write error to Supabase: {db_err}")


@app.post("/api/transcribe")
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("ko"),
    correct: bool = Form(True),
    transcription_type: str = Form("sermon"),
):
    """음성 → 텍스트 변환 (Whisper + Gemini 2단계). 유형: sermon/phonecall/conversation"""
    try:
        contents = await file.read()
        if len(contents) > 100 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="파일 크기는 100MB 이하")

        # 원본 확장자 유지
        original_ext = pathlib.Path(file.filename).suffix.lower() if file.filename else ".mp3"
        if original_ext not in ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.webm', '.mp4']:
            original_ext = ".mp3"

        with tempfile.NamedTemporaryFile(delete=False, suffix=original_ext) as temp_file:
            temp_file.write(contents)
            temp_file_path = temp_file.name

        task_id = str(uuid.uuid4())
        task_status[task_id] = "queued"

        background_tasks.add_task(
            process_transcription,
            task_id,
            temp_file_path,
            language,
            correct,
            transcription_type
        )

        type_labels = {"sermon": "설교 녹취", "phonecall": "통화 기록", "conversation": "대화/회의 기록"}

        return {
            "success": True,
            "task_id": task_id,
            "status": "queued",
            "message": f"{type_labels.get(transcription_type, '녹취')} 변환 작업이 시작되었습니다.",
            "engine": "whisper+gemini" if openai_client else "gemini-only",
            "transcription_type": transcription_type,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"오류: {str(e)}")


@app.get("/api/status/{task_id}")
async def get_task_status(task_id: str):
    """작업 상태 조회"""
    if task_id in task_status:
        status = task_status[task_id]
        if status == "processing" or status == "queued":
            return {"task_id": task_id, "status": status}

    response = supabase.table("transcriptions").select("*").eq("task_id", task_id).execute()
    if response.data:
        row = response.data[0]
        if row["status"] == "completed":
            return {
                "task_id": row["task_id"],
                "status": row["status"],
                "created_at": row["created_at"],
                "language": row["language"],
                "raw_text": row["raw_text"],
                "corrected_text": row["corrected_text"],
                "characters": row["characters"],
                "darakbang_optimized": row["darakbang_optimized"],
                "engine": row["engine"],
                "transcription_type": row.get("transcription_type", "sermon"),
            }
        else:
            return {
                "task_id": row["task_id"],
                "status": row["status"],
                "error": row["error"],
                "created_at": row["created_at"],
                "transcription_type": row.get("transcription_type", "sermon"),
            }

    return {"task_id": task_id, "status": "not_found"}


@app.get("/api/terms")
async def get_terms():
    """용어 확인 (디버깅용)"""
    return {
        "gemini_context": get_gemini_correction_prompt()[:500],
        "darakbang_core": DARAKBANG_CORE[:30],
        "common_mistakes_count": len(COMMON_MISTAKES),
    }


@app.get("/api/history")
async def get_history():
    """변환 기록 목록 조회"""
    response = (
        supabase.table("transcriptions")
        .select("task_id, status, created_at, characters, engine, corrected_text, transcription_type")
        .order("created_at", desc=True)
        .execute()
    )

    history = []
    for row in response.data:
        history.append({
            "task_id": row["task_id"],
            "status": row["status"],
            "created_at": row["created_at"],
            "characters": row.get("characters") or 0,
            "engine": row.get("engine") or "unknown",
            "summary_preview": ((row.get("corrected_text") or "")[:50] + "..."),
            "transcription_type": row.get("transcription_type", "sermon"),
        })

    return history


@app.post("/api/summarize")
async def summarize_sermon(
    text: str = Form(...),
    summary_type: str = Form("short")
):
    """다락방 설교 요약 (Gemini)"""
    try:
        target_model = get_optimal_model()
        model = genai.GenerativeModel(model_name=target_model)

        prompt = get_summary_prompt(summary_type)
        full_prompt = f"""{prompt}

설교 내용:
{text}"""

        response = None
        max_retries = 5

        for attempt in range(max_retries):
            try:
                response = model.generate_content(
                    full_prompt,
                    request_options={"timeout": 120}
                )
                break
            except Exception as e:
                if ("429" in str(e) or "ResourceExhausted" in str(e) or "quota" in str(e).lower()) and attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 10 + random.uniform(0, 5)
                    print(f"[summarize] Quota exceeded (429). Retrying in {wait_time:.1f}s...")
                    await asyncio.sleep(wait_time)
                else:
                    raise e

        return {
            "success": True,
            "summary": response.text,
            "summary_type": summary_type
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "church_type": "다락방 전도운동",
        "terms_loaded": len(ALL_CHURCH_TERMS),
        "darakbang_terms": len(DARAKBANG_CORE),
        "engine": "whisper+gemini" if openai_client else "gemini-only",
        "apis": {
            "gemini": bool(GEMINI_API_KEY),
            "openai_whisper": bool(OPENAI_API_KEY),
        }
    }
