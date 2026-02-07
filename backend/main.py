from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import os
import uuid
import json
import asyncio
import random
from datetime import datetime
from glob import glob
from dotenv import load_dotenv
import tempfile
import pathlib

# 다락방 용어 임포트
from church_terms import (
    get_gemini_prompt,
    correct_text,
    get_claude_context,
    get_summary_prompt,
    ALL_CHURCH_TERMS,
    DARAKBANG_CORE,
    print_terms_summary
)

load_dotenv()

app = FastAPI(title="다락방 설교 녹취 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

# Gemini 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY is not set in environment variables.")
    # Fallback removed for security. Please set GEMINI_API_KEY in your environment (e.g., Railway).
    
genai.configure(api_key=GEMINI_API_KEY)

# app = FastAPI(title="다락방 설교 녹취 API (Gemini)")  <-- Removed duplicate instantiation

# 시작 시 용어 로딩 확인
@app.on_event("startup")
async def startup_event():
    print_terms_summary()

@app.get("/")
async def root():
    return {
        "message": "설교 및 회의 녹취 API",
        "version": "2.0",
        "church": "설교 및 회의 특화",
        "darakbang_terms": len(DARAKBANG_CORE),
        "total_terms": len(ALL_CHURCH_TERMS),
        "features": [
            "교회 설교 용어 특화",
            "일상 회의 및 의료 언어 특화"
        ]
    }

# 저장소 설정
TRANSCRIPTS_DIR = "transcripts"
os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)

# 인메모리 상태 추적 (간단한 캐싱용, 실제 데이터는 파일에 저장)
task_status = {}

@app.get("/api/terms")
async def get_terms():
    """다락방 용어 확인 (디버깅용)"""
    return {
        "gemini_context": get_gemini_prompt(),
        "darakbang_core": DARAKBANG_CORE[:30]
    }

async def process_transcription(task_id: str, temp_file_path: str, language: str, correct: bool):
    """백그라운드에서 실행되는 변환 로직 (Gemini 2.0 Flash 사용)"""
    try:
        task_status[task_id] = "processing"
        
        # 1. 오디오 파일 업로드 (Gemini File API)
        print(f"[{task_id}] Uploading to Gemini...")
        audio_file = genai.upload_file(temp_file_path)
        
        # 2. Gemini 모델 설정 (Flash가 빠르고 STT에 최적)
        target_model = "gemini-2.0-flash"
        model = genai.GenerativeModel(target_model)
        
        # 3. 프롬프트 구성 (단일 단계 처리)
        prompt = get_gemini_prompt()
        
        print(f"[{task_id}] Generating content...")
        
        response = None
        max_retries = 5 # 최대 5회 재시도 (약 5-6분 대기)
        
        for attempt in range(max_retries):
            try:
                response = model.generate_content(
                    [prompt, audio_file],
                    request_options={"timeout": 600} # 10분 타임아웃
                )
                break
            except Exception as e:
                # 429 Quota Exceeded 또는 ResourceExhausted 에러 처리
                if ("429" in str(e) or "ResourceExhausted" in str(e) or "quota" in str(e).lower()) and attempt < max_retries - 1:
                    # 지수 백오프: 10s, 20s, 40s, 80s... + 랜덤 지터
                    wait_time = (2 ** attempt) * 10 + random.uniform(0, 5)
                    print(f"[{task_id}] Quota exceeded (429). Retrying in {wait_time:.1f}s... (Attempt {attempt+1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                else:
                    raise e
        
        raw_text = response.text
        
        # 임시 파일 및 Gemini 파일 삭제 정리
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        try:
            audio_file.delete()
        except:
            pass
            
        print(f"[{task_id}] Transcription done. Length: {len(raw_text)}")
        
        # 4. 후처리 (간단한 교정)
        # Gemini가 이미 문맥을 반영했을 것이므로, rules-based correction만 가볍게 수행
        corrected_text = correct_text(raw_text)

        # 5. 결과 저장
        result_data = {
            "task_id": task_id,
            "status": "completed",
            "created_at": datetime.now().isoformat(),
            "language": language,
            "raw_text": raw_text,
            "corrected_text": corrected_text,
            "characters": len(corrected_text),
            "darakbang_optimized": True,
            "engine": "gemini-2.0-flash"
        }
        
        with open(os.path.join(TRANSCRIPTS_DIR, f"{task_id}.json"), "w", encoding="utf-8") as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)
            
        task_status[task_id] = "completed"
        
    except Exception as e:
        print(f"Transcription error: {e}")
        task_status[task_id] = "error"
        error_data = {
            "task_id": task_id,
            "status": "error",
            "error": str(e),
            "created_at": datetime.now().isoformat()
        }
        with open(os.path.join(TRANSCRIPTS_DIR, f"{task_id}.json"), "w", encoding="utf-8") as f:
            json.dump(error_data, f, ensure_ascii=False, indent=2)

@app.post("/api/transcribe")
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("ko"),
    correct: bool = Form(True),
):
    """
    다락방 설교 음성 → 텍스트 변환 (백그라운드 처리)
    """
    try:
        contents = await file.read()
        if len(contents) > 100 * 1024 * 1024: # 100MB 제한
            raise HTTPException(status_code=400, detail="파일 크기는 100MB 이하")
        
        # 임시 파일 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_file.write(contents)
            temp_file_path = temp_file.name
            
        task_id = str(uuid.uuid4())
        task_status[task_id] = "queued"
        
        # 백그라운드 작업 등록
        background_tasks.add_task(
            process_transcription,
            task_id,
            temp_file_path,
            language,
            correct
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "status": "queued",
            "message": "변환 작업이 시작되었습니다."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"오류: {str(e)}")

@app.get("/api/status/{task_id}")
async def get_task_status(task_id: str):
    """작업 상태 조회"""
    # 1. 메모리 확인
    if task_id in task_status:
        status = task_status[task_id]
        if status == "processing" or status == "queued":
            return {"task_id": task_id, "status": status}
            
    # 2. 파일 확인 (완료/에러 된 경우)
    file_path = os.path.join(TRANSCRIPTS_DIR, f"{task_id}.json")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
        
    return {"task_id": task_id, "status": "not_found"}

@app.get("/api/history")
async def get_history():
    """변환 기록 목록 조회"""
    files = glob(os.path.join(TRANSCRIPTS_DIR, "*.json"))
    history = []
    
    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # 리스트에는 요약 정보만 포함
                history.append({
                    "task_id": data.get("task_id"),
                    "status": data.get("status"),
                    "created_at": data.get("created_at"),
                    "characters": data.get("characters", 0),
                    "summary_preview": (data.get("corrected_text") or "")[:50] + "..."
                })
        except:
            continue
            
    # 최신순 정렬
    history.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return history

@app.post("/api/summarize")
async def summarize_sermon(
    text: str = Form(...),
    summary_type: str = Form("short")
):
    """
    다락방 설교 요약 (Gemini)
    """
    try:
        model = genai.GenerativeModel(model_name="gemini-2.0-flash")

        prompt = get_summary_prompt(summary_type)
        full_prompt = f"""{prompt}

설교 내용:
{text}"""

        response = model.generate_content(full_prompt)
        summary = response.text
        
        return {
            "success": True,
            "summary": summary,
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
        "apis": {
            "gemini": bool(GEMINI_API_KEY)
        }
    }
