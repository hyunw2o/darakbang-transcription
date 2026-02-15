from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks, Header
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
import mimetypes
import re
import urllib.request
import urllib.error
import urllib.parse

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

app = FastAPI(title="말로그24 API")

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
        "message": "설교·회의·의료 특화 녹취 API",
        "version": "3.1",
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
task_owner = {}

# 모델 캐시
_model_cache = {"model": None, "cached_at": 0}
MODEL_CACHE_TTL = 3600
AUTH_TIMEOUT = 20
ALLOWED_RECORD_CATEGORIES = {
    "meeting_keywords",
    "clinical_notes",
    "sermon_core_summary",
}
ALLOWED_OAUTH_PROVIDERS = {"google", "kakao"}
TRANSCRIPTION_SCOPE_VALIDATED = False
AUDIO_MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
    ".mp4": "audio/mp4",
}
STRUCTURED_SUMMARY_HEADERS = {
    "요약",
    "주요 내용",
    "논의 안건",
    "결정 사항",
    "후속 조치",
    "Summary",
    "Key Points",
    "Agenda Items",
    "Decisions",
    "Action Items",
}
KO_RESPONSE_PREFIXES = (
    "네",
    "예",
    "네네",
    "아 네",
    "알겠습니다",
    "좋습니다",
    "맞습니다",
    "맞아요",
    "그렇군요",
)
EN_RESPONSE_PREFIXES = (
    "yes",
    "yeah",
    "yep",
    "okay",
    "ok",
    "right",
    "sure",
    "agreed",
    "i see",
    "got it",
    "understood",
    "sounds good",
)


def _extract_auth_error_message(raw_text: str) -> str:
    try:
        payload = json.loads(raw_text)
        return (
            payload.get("msg")
            or payload.get("error_description")
            or payload.get("error")
            or payload.get("message")
            or raw_text
        )
    except Exception:
        return raw_text or "인증 서버 오류"


def _supabase_auth_request(path: str, method: str = "POST", payload: dict | None = None, token: str | None = None) -> dict:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase 인증 환경이 설정되지 않았습니다.")

    base_url = SUPABASE_URL.rstrip("/")
    target_path = path.lstrip("/")
    url = f"{base_url}/auth/v1/{target_path}"

    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, headers=headers, data=body, method=method)

    try:
        with urllib.request.urlopen(request, timeout=AUTH_TIMEOUT) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        error_raw = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=e.code, detail=_extract_auth_error_message(error_raw))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase 인증 요청 실패: {str(e)}")


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise HTTPException(status_code=401, detail="Authorization 헤더 형식이 올바르지 않습니다.")
    return parts[1].strip()


def _get_current_user(authorization: str | None) -> dict:
    token = _extract_bearer_token(authorization)
    user = _supabase_auth_request("user", method="GET", token=token)
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="유효하지 않은 사용자 토큰입니다.")
    return user


def _validate_redirect_url(redirect_to: str) -> str:
    normalized = (redirect_to or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="redirect_to 값이 필요합니다.")

    parsed = urllib.parse.urlparse(normalized)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=400, detail="redirect_to URL 형식이 올바르지 않습니다.")
    return normalized


def _ensure_transcriptions_user_scope_ready() -> None:
    global TRANSCRIPTION_SCOPE_VALIDATED
    if TRANSCRIPTION_SCOPE_VALIDATED:
        return

    try:
        supabase.table("transcriptions").select("user_id").limit(1).execute()
        TRANSCRIPTION_SCOPE_VALIDATED = True
    except Exception as e:
        error_text = str(e).lower()
        if "user_id" in error_text and ("column" in error_text or "does not exist" in error_text):
            raise HTTPException(
                status_code=500,
                detail="Supabase 설정 필요: backend/sql/transcriptions_user_scope.sql 을 먼저 실행하세요.",
            )
        raise


def _resolve_audio_mime_type(file_path: str) -> str:
    extension = pathlib.Path(file_path).suffix.lower()
    mapped = AUDIO_MIME_TYPES.get(extension)
    if mapped:
        return mapped

    guessed, _ = mimetypes.guess_type(file_path)
    return guessed or "audio/mpeg"


def _get_record_category_label(category: str, language: str = "ko") -> str:
    labels = {
        "meeting_keywords": {"ko": "회의 중요 키워드", "en": "Meeting Keywords"},
        "clinical_notes": {"ko": "진료 도움 기록", "en": "Clinical Notes"},
        "sermon_core_summary": {"ko": "설교 핵심 요약", "en": "Sermon Core Summary"},
    }
    return labels.get(category, {}).get(language, category)


def _build_record_draft_prompt(category: str, language: str = "ko") -> str:
    if language == "en":
        prompt_map = {
            "meeting_keywords": (
                "Extract high-impact meeting keywords and action points.\n"
                "Format:\n"
                "1) Top Keywords (5-10)\n"
                "2) Key Decisions\n"
                "3) Next Actions (owner and due if available)\n"
                "Keep it concise and practical."
            ),
            "clinical_notes": (
                "Summarize clinically helpful notes from the transcript.\n"
                "Format:\n"
                "1) Main Symptoms/Concerns\n"
                "2) Medication/Test/Follow-up Mentions\n"
                "3) Risk Flags or Clarifications Needed\n"
                "Do not give diagnosis. Keep neutral and factual."
            ),
            "sermon_core_summary": (
                "Create a core sermon summary for ministry records.\n"
                "Format:\n"
                "1) Core Message (1-2 lines)\n"
                "2) Key Scriptures or Themes\n"
                "3) Practical Application\n"
                "4) Prayer Focus"
            ),
        }
    else:
        prompt_map = {
            "meeting_keywords": (
                "회의 내용에서 실무적으로 중요한 키워드와 액션 아이템을 추출하세요.\n"
                "형식:\n"
                "1) 핵심 키워드(5~10개)\n"
                "2) 주요 결정 사항\n"
                "3) 후속 조치(담당자/기한이 있으면 포함)\n"
                "간결하고 실행 중심으로 작성하세요."
            ),
            "clinical_notes": (
                "대화에서 진료에 도움이 될 핵심 기록을 정리하세요.\n"
                "형식:\n"
                "1) 주요 증상/호소 내용\n"
                "2) 약물·검사·추적 관찰 관련 언급\n"
                "3) 확인이 필요한 위험 신호/추가 질문\n"
                "진단을 단정하지 말고 사실 중심으로 정리하세요."
            ),
            "sermon_core_summary": (
                "설교 핵심 요약을 목회 기록용으로 정리하세요.\n"
                "형식:\n"
                "1) 핵심 메시지(1~2문장)\n"
                "2) 주요 본문/주제\n"
                "3) 삶의 적용\n"
                "4) 기도제목"
            ),
        }

    return prompt_map.get(category, prompt_map["meeting_keywords"])


def _split_transcript_body_and_tail(text: str) -> tuple[list[str], list[str]]:
    lines = (text or "").splitlines()
    body_lines: list[str] = []
    tail_lines: list[str] = []
    in_tail = False

    for line in lines:
        stripped = line.strip()
        if not in_tail and stripped in STRUCTURED_SUMMARY_HEADERS:
            in_tail = True
        if in_tail:
            tail_lines.append(line)
        else:
            body_lines.append(line)

    return body_lines, tail_lines


def _parse_speaker_line(line: str) -> dict | None:
    match = re.match(
        r"^(화자|참석자|speaker|participant)\s*([A-Za-z0-9]+)(?:\s*\(([^)]*)\))?\s*[:：]\s*(.*)$",
        line.strip(),
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    return {
        "speaker_kind": match.group(1),
        "speaker_id": match.group(2),
        "speaker_alias": (match.group(3) or "").strip(),
        "content": (match.group(4) or "").strip(),
    }


def _default_speaker_label(transcription_type: str, language: str, turn_index: int) -> str:
    if transcription_type == "phonecall":
        token = "Speaker" if language == "en" else "화자"
        return f"{token} {'A' if turn_index % 2 == 0 else 'B'}"

    token = "Participant" if language == "en" else "참석자"
    return f"{token} {1 if turn_index % 2 == 0 else 2}"


def _flip_phonecall_label(label: str, language: str) -> str:
    token = "Speaker" if language == "en" else "화자"
    current = "A"
    if re.search(r"\bB\b", label, flags=re.IGNORECASE):
        current = "B"
    elif re.search(r"\bA\b", label, flags=re.IGNORECASE):
        current = "A"
    return f"{token} {'A' if current == 'B' else 'B'}"


def _looks_like_short_response(content: str, language: str) -> bool:
    stripped = content.strip()
    if not stripped:
        return False

    if language == "en":
        lowered = stripped.lower()
        return any(lowered.startswith(prefix) for prefix in EN_RESPONSE_PREFIXES)

    return any(stripped.startswith(prefix) for prefix in KO_RESPONSE_PREFIXES)


def _normalize_speaker_label(
    parsed: dict,
    transcription_type: str,
    language: str,
    label_map: dict[str, int | str],
) -> str:
    speaker_id = (parsed.get("speaker_id") or "").strip()
    alias = parsed.get("speaker_alias") or ""

    if transcription_type == "phonecall":
        token = "Speaker" if language == "en" else "화자"
        canonical = "A"
        if speaker_id.isdigit():
            canonical = "A" if int(speaker_id) <= 1 else "B"
        else:
            upper = speaker_id.upper() or "A"
            if upper in {"A", "B"}:
                canonical = upper
            else:
                if upper not in label_map:
                    label_map[upper] = "A" if len(label_map) % 2 == 0 else "B"
                canonical = str(label_map[upper])

        base = f"{token} {canonical}"
        if alias:
            return f"{base} ({alias})" if language == "en" else f"{base}({alias})"
        return base

    token = "Participant" if language == "en" else "참석자"
    if speaker_id.isdigit():
        number = max(1, int(speaker_id))
    else:
        upper = speaker_id.upper() or "A"
        if len(upper) == 1 and "A" <= upper <= "Z":
            number = ord(upper) - ord("A") + 1
        else:
            if upper not in label_map:
                label_map[upper] = len(label_map) + 1
            number = int(label_map[upper])

    base = f"{token} {number}"
    if alias:
        return f"{base} ({alias})" if language == "en" else f"{base}({alias})"
    return base


def _enforce_speaker_separation(text: str, transcription_type: str, language: str) -> str:
    if transcription_type not in {"phonecall", "conversation"}:
        return text

    body_lines, tail_lines = _split_transcript_body_and_tail(text)
    existing_label_count = sum(1 for line in body_lines if _parse_speaker_line(line))
    if not body_lines:
        return text

    utterances: list[list[str]] = []
    turn_index = 0
    current_label = ""
    previous_had_question = False
    label_map: dict[str, int | str] = {}

    for line in body_lines:
        stripped = line.strip()
        if not stripped:
            continue

        parsed = _parse_speaker_line(stripped)
        if parsed:
            label = _normalize_speaker_label(parsed, transcription_type, language, label_map)
            content = parsed["content"]
            current_label = label
        else:
            content = stripped
            if existing_label_count == 0:
                label = _default_speaker_label(transcription_type, language, turn_index)
                if transcription_type == "phonecall" and turn_index > 0:
                    previous_label = utterances[-1][0]
                    if previous_had_question or _looks_like_short_response(content, language):
                        label = _flip_phonecall_label(previous_label, language)
                current_label = label
            else:
                if not current_label:
                    current_label = _default_speaker_label(transcription_type, language, turn_index)
                label = current_label
                if transcription_type == "phonecall" and (previous_had_question or _looks_like_short_response(content, language)):
                    label = _flip_phonecall_label(current_label, language)
                    current_label = label

        if not content:
            previous_had_question = False
            continue

        if utterances and utterances[-1][0] == label:
            utterances[-1][1] = f"{utterances[-1][1]} {content}".strip()
        else:
            utterances.append([label, content])
            turn_index += 1

        previous_had_question = content.endswith("?") or content.endswith("？")

    if not utterances:
        return text

    body_text = "\n\n".join(f"{label}: {content}" for label, content in utterances).strip()
    tail_text = "\n".join(tail_lines).strip()
    if tail_text:
        return f"{body_text}\n\n{tail_text}".strip()
    return body_text

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
                "sermon, worship, fellowship, testimony, discipleship, ministry, mission, "
                "Droa Church, Harvester Mission Church, HMC, HMIS, HMVS, RRTS, RVIS, RTS, RSTS, RVS, RPS, RLS, RGS"
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
            whisper_prompt = "다락방, 렘넌트, 237, 5000종족, 7망대, 7여정, 7이정표, CVDIP, 류광수, 이주현, 드로아교회, 하베스터선교교회, HMC, HMIS, HMVS, RRTS, RVIS, RTS, RSTS, RVS, RPS, RLS, RGS, 앗수르, 네피림, 바벨탑, 뉴에이지, 프리메이슨, REA, TCK, CCK, NCK, 성회, 전도대회, 수련회, 보좌화, 생활화, 개인화, 제자화, 세계화, Heavenly, Thronely, Eternally, 록펠러, 카네기, 워너메이커, 존 워너메이커, 쉬버, 마틴 루터"
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


async def process_transcription(
    task_id: str,
    user_id: str,
    temp_file_path: str,
    language: str,
    correct: bool,
    transcription_type: str = "sermon",
):
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
            corrected_text = _enforce_speaker_separation(corrected_text, transcription_type, language)

            engine = "whisper+gemini"

        else:
            # ===== 폴백: Gemini 단일 방식 (기존) =====
            print(f"[{task_id}] Fallback: Gemini-only mode")

            mime_type = _resolve_audio_mime_type(temp_file_path)
            audio_file = genai.upload_file(temp_file_path, mime_type=mime_type)
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
            corrected_text = _enforce_speaker_separation(corrected_text, transcription_type, language)
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
            "user_id": user_id,
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
        task_owner.pop(task_id, None)

    except Exception as e:
        print(f"Transcription error: {e}")
        import traceback
        traceback.print_exc()
        task_status[task_id] = "error"
        try:
            supabase.table("transcriptions").insert({
                "task_id": task_id,
                "user_id": user_id,
                "status": "error",
                "error": str(e),
                "created_at": datetime.now().isoformat(),
                "transcription_type": transcription_type,
            }).execute()
        except Exception as db_err:
            print(f"Failed to write error to Supabase: {db_err}")
        finally:
            task_owner.pop(task_id, None)


@app.post("/api/transcribe")
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("ko"),
    correct: bool = Form(True),
    transcription_type: str = Form("sermon"),
    authorization: str | None = Header(default=None),
):
    """음성 → 텍스트 변환 (Whisper + Gemini 2단계). 유형: sermon/phonecall/conversation"""
    try:
        # 파일 변환은 로그인 사용자만 허용
        _ensure_transcriptions_user_scope_ready()
        user = _get_current_user(authorization)
        user_id = user["id"]
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
        task_owner[task_id] = user_id

        background_tasks.add_task(
            process_transcription,
            task_id,
            user_id,
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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"오류: {str(e)}")


@app.get("/api/status/{task_id}")
async def get_task_status(
    task_id: str,
    authorization: str | None = Header(default=None),
):
    """작업 상태 조회"""
    _ensure_transcriptions_user_scope_ready()
    user = _get_current_user(authorization)
    user_id = user["id"]

    if task_id in task_status:
        status = task_status[task_id]
        owner_id = task_owner.get(task_id)
        if owner_id is not None and owner_id != user_id:
            return {"task_id": task_id, "status": "not_found"}
        if status == "processing" or status == "queued":
            return {"task_id": task_id, "status": status}

    response = (
        supabase.table("transcriptions")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
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
async def get_history(authorization: str | None = Header(default=None)):
    """변환 기록 목록 조회"""
    _ensure_transcriptions_user_scope_ready()
    user = _get_current_user(authorization)
    user_id = user["id"]

    response = (
        supabase.table("transcriptions")
        .select("task_id, status, created_at, characters, engine, corrected_text, transcription_type")
        .eq("user_id", user_id)
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


@app.post("/api/auth/signup")
async def signup(
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(""),
):
    """Supabase Auth 회원가입"""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")

    payload = {
        "email": email.strip().lower(),
        "password": password,
    }
    if full_name.strip():
        payload["data"] = {"full_name": full_name.strip()}

    data = _supabase_auth_request("signup", payload=payload)
    session = data.get("session") or {}
    access_token = data.get("access_token") or session.get("access_token")
    refresh_token = data.get("refresh_token") or session.get("refresh_token")

    return {
        "success": True,
        "message": "회원가입이 완료되었습니다. 이메일 인증 설정 여부에 따라 추가 인증이 필요할 수 있습니다.",
        "user": data.get("user"),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


@app.post("/api/auth/login")
async def login(
    email: str = Form(...),
    password: str = Form(...),
):
    """Supabase Auth 로그인"""
    data = _supabase_auth_request(
        "token?grant_type=password",
        payload={"email": email.strip().lower(), "password": password},
    )
    return {
        "success": True,
        "user": data.get("user"),
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
        "token_type": data.get("token_type", "bearer"),
    }


@app.get("/api/auth/oauth-url")
async def get_oauth_url(
    provider: str,
    redirect_to: str,
):
    """Supabase OAuth 로그인 URL 생성"""
    normalized_provider = provider.strip().lower()
    if normalized_provider not in ALLOWED_OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail="지원하지 않는 소셜 로그인 공급자입니다.")
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Supabase 인증 환경이 설정되지 않았습니다.")

    validated_redirect_url = _validate_redirect_url(redirect_to)
    query = urllib.parse.urlencode({
        "provider": normalized_provider,
        "redirect_to": validated_redirect_url,
    })
    auth_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/authorize?{query}"
    return {
        "success": True,
        "provider": normalized_provider,
        "auth_url": auth_url,
    }


@app.get("/api/auth/me")
async def me(authorization: str | None = Header(default=None)):
    """현재 로그인 사용자 조회"""
    user = _get_current_user(authorization)
    return {
        "success": True,
        "user": user,
    }


@app.post("/api/records/draft")
async def generate_record_draft(
    text: str = Form(...),
    category: str = Form(...),
    language: str = Form("ko"),
):
    """기록본 초안 생성 (회의 키워드/진료 도움 기록/설교 핵심 요약)"""
    normalized_category = category.strip()
    if normalized_category not in ALLOWED_RECORD_CATEGORIES:
        raise HTTPException(status_code=400, detail="지원하지 않는 기록 카테고리입니다.")
    if not text.strip():
        raise HTTPException(status_code=400, detail="원문 텍스트가 비어 있습니다.")

    prompt = _build_record_draft_prompt(normalized_category, language)
    target_model = get_optimal_model()
    model = genai.GenerativeModel(model_name=target_model)

    full_prompt = f"""{prompt}

[원문]
{text}
"""

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
                print(f"[records-draft] Quota exceeded (429). Retrying in {wait_time:.1f}s...")
                await asyncio.sleep(wait_time)
            else:
                raise HTTPException(status_code=500, detail=f"기록본 초안 생성 실패: {str(e)}")

    return {
        "success": True,
        "category": normalized_category,
        "category_label": _get_record_category_label(normalized_category, language),
        "title": _get_record_category_label(normalized_category, language),
        "content": response.text if response else "",
    }


@app.post("/api/records")
async def save_record(
    category: str = Form(...),
    content: str = Form(...),
    title: str = Form(""),
    task_id: str = Form(""),
    source_type: str = Form(""),
    authorization: str | None = Header(default=None),
):
    """로그인 사용자별 기록본 저장"""
    user = _get_current_user(authorization)
    normalized_category = category.strip()
    normalized_content = content.strip()

    if normalized_category not in ALLOWED_RECORD_CATEGORIES:
        raise HTTPException(status_code=400, detail="지원하지 않는 기록 카테고리입니다.")
    if not normalized_content:
        raise HTTPException(status_code=400, detail="저장할 기록 내용이 비어 있습니다.")

    insert_row = {
        "user_id": user["id"],
        "category": normalized_category,
        "title": (title.strip() or _get_record_category_label(normalized_category, "ko")),
        "content": normalized_content,
        "task_id": task_id.strip() or None,
        "source_type": source_type.strip() or None,
        "created_at": datetime.now().isoformat(),
    }

    try:
        response = supabase.table("saved_records").insert(insert_row).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"saved_records 저장 실패: {str(e)}")

    return {
        "success": True,
        "record": response.data[0] if response.data else insert_row,
    }


@app.get("/api/records")
async def get_records(
    category: str = "",
    authorization: str | None = Header(default=None),
):
    """로그인 사용자별 저장 기록 조회"""
    user = _get_current_user(authorization)

    try:
        query = (
            supabase.table("saved_records")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
        )
        if category:
            query = query.eq("category", category)
        response = query.execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"saved_records 조회 실패: {str(e)}")

    return response.data or []


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
