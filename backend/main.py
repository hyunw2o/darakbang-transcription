from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from collections import defaultdict, deque

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

def _parse_csv_env(name: str, default: list[str]) -> list[str]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://malloc24.vercel.app",
    "https://www.malloc24.vercel.app",
    "https://mallog24.vercel.app",
    "https://www.mallog24.vercel.app",
]
DEFAULT_OAUTH_REDIRECT_HOSTS = [
    "localhost",
    "127.0.0.1",
    "malloc24.vercel.app",
    "www.malloc24.vercel.app",
    "mallog24.vercel.app",
    "www.mallog24.vercel.app",
]

CORS_ALLOW_ORIGINS = _parse_csv_env("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ORIGINS)
CORS_ALLOW_ORIGIN_REGEX = (os.getenv("CORS_ALLOW_ORIGIN_REGEX") or "").strip() or None
ALLOWED_OAUTH_REDIRECT_HOSTS = {
    host.lower() for host in _parse_csv_env("OAUTH_REDIRECT_ALLOW_HOSTS", DEFAULT_OAUTH_REDIRECT_HOSTS)
}

RATE_LIMIT_WINDOW_SECONDS = max(1, int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")))
RATE_LIMIT_GENERAL = max(1, int(os.getenv("RATE_LIMIT_GENERAL", "180")))
RATE_LIMIT_AUTH = max(1, int(os.getenv("RATE_LIMIT_AUTH", "30")))
RATE_LIMIT_TRANSCRIBE = max(1, int(os.getenv("RATE_LIMIT_TRANSCRIBE", "10")))

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
MAX_TEXT_INPUT_CHARS = int(os.getenv("MAX_TEXT_INPUT_CHARS", "120000"))
MAX_RECORD_CONTENT_CHARS = int(os.getenv("MAX_RECORD_CONTENT_CHARS", "80000"))
EXPOSE_TERMS_ENDPOINT = (os.getenv("EXPOSE_TERMS_ENDPOINT", "false").strip().lower() == "true")

ALLOWED_LANGUAGES = {"ko", "en"}
ALLOWED_TRANSCRIPTION_TYPES = {"sermon", "phonecall", "conversation"}

app = FastAPI(title="말로그24 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS if not CORS_ALLOW_ORIGIN_REGEX else [],
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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
supabase: Client | None = None
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL or SUPABASE_KEY not set.")
else:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")

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
ALLOWED_AUDIO_CONTENT_TYPES = {
    "application/octet-stream",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/flac",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
    "audio/x-m4a",
    "video/mp4",
}
KO_DAILY_CONTEXT_TERMS = (
    "안녕하세요, 여보세요, 잠시만요, 다시 말씀해 주세요, 확인 부탁드립니다, 전달 부탁드립니다, "
    "일정 조율, 비용 문의, 계약 검토, 담당자 연결, 자료 공유, 회의록, 후속 조치"
)
KO_DOMAIN_CONTEXT_TERMS = (
    "경제학(인플레이션, 기준금리, 환율, 공급망, 총수요), "
    "법(판례, 조문, 약관, 손해배상, 위약금, 합의서), "
    "정치(국회, 법안, 예산안, 외교, 여론조사), "
    "IT(API, SDK, CI/CD, 클라우드, Docker, Kubernetes, 데이터베이스, 보안), "
    "환경(탄소중립, 온실가스, 재생에너지, ESG, 배출권), "
    "의료(진단, 처방, 약물, CT, MRI, 부작용), "
    "인문학(철학, 윤리, 문해력, 서사, 해석), "
    "교육(교육과정, 평가, 학습목표, 피드백), "
    "경영/재무(KPI, ROI, 손익계산서, 현금흐름, 영업이익)"
)
EN_DAILY_CONTEXT_TERMS = (
    "hello, hi, hold on, could you repeat that, please confirm, please share, "
    "schedule coordination, cost inquiry, contract review, owner assignment, follow-up action"
)
EN_DOMAIN_CONTEXT_TERMS = (
    "economics(inflation, interest rate, exchange rate, supply chain, aggregate demand), "
    "law(case law, statute, clause, damages, penalty, settlement), "
    "politics(parliament, bill, budget proposal, diplomacy, polling), "
    "IT(API, SDK, CI/CD, cloud, Docker, Kubernetes, database, cybersecurity), "
    "environment(carbon neutrality, greenhouse gas, renewable energy, ESG, emissions trading), "
    "medicine(diagnosis, prescription, dosage, CT, MRI, side effects), "
    "humanities(philosophy, ethics, literacy, narrative, interpretation), "
    "education(curriculum, assessment, learning objective, feedback), "
    "business/finance(KPI, ROI, P&L, cash flow, operating profit)"
)
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
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_request_counters: dict[str, deque[float]] = defaultdict(deque)


def _normalize_content_type(content_type: str | None) -> str:
    if not content_type:
        return ""

    normalized = content_type.split(";", 1)[0].strip().lower()
    aliases = {
        "audio/x-wav": "audio/wav",
        "audio/wave": "audio/wav",
        "audio/mp3": "audio/mpeg",
        "audio/x-m4a": "audio/mp4",
        "video/mp4": "audio/mp4",
    }
    return aliases.get(normalized, normalized)


def _pick_extension_for_mime(mime_type: str | None) -> str | None:
    if not mime_type:
        return None
    for ext, mapped in AUDIO_MIME_TYPES.items():
        if mapped == mime_type:
            return ext
    return None


def _detect_audio_mime_type_from_signature(content: bytes) -> str | None:
    if not content:
        return None

    header = content[:64]
    if header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
        return "audio/mpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WAVE":
        return "audio/wav"
    if content.startswith(b"fLaC"):
        return "audio/flac"
    if content.startswith(b"OggS"):
        return "audio/ogg"
    if content.startswith(b"\x1A\x45\xDF\xA3"):
        return "audio/webm"
    if len(content) >= 12 and content[4:8] == b"ftyp":
        return "audio/mp4"

    return None


def _validate_uploaded_audio_payload(file: UploadFile, contents: bytes) -> tuple[str, str]:
    if not contents:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

    signature_mime = _detect_audio_mime_type_from_signature(contents[:4096])
    declared_content_type = _normalize_content_type(file.content_type)
    file_name = file.filename or ""
    extension = pathlib.Path(file_name).suffix.lower()

    if extension not in AUDIO_MIME_TYPES:
        inferred_extension = _pick_extension_for_mime(signature_mime)
        if inferred_extension:
            extension = inferred_extension
        else:
            raise HTTPException(
                status_code=400,
                detail="지원하지 않는 파일 형식입니다. mp3/wav/m4a/ogg/flac/webm/mp4만 업로드 가능합니다.",
            )

    expected_mime = AUDIO_MIME_TYPES[extension]
    if declared_content_type and declared_content_type not in ALLOWED_AUDIO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="지원하지 않는 Content-Type입니다.")
    if (
        declared_content_type
        and declared_content_type != "application/octet-stream"
        and declared_content_type != expected_mime
    ):
        raise HTTPException(status_code=400, detail="파일 확장자와 Content-Type이 일치하지 않습니다.")
    if signature_mime and signature_mime != expected_mime:
        raise HTTPException(status_code=400, detail="파일 확장자와 실제 파일 형식이 일치하지 않습니다.")

    return extension, signature_mime or expected_mime


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _resolve_rate_limit_bucket(path: str, client_ip: str) -> tuple[str, int]:
    if path == "/api/transcribe":
        return f"transcribe:{client_ip}", RATE_LIMIT_TRANSCRIBE
    if path.startswith("/api/auth/"):
        return f"auth:{client_ip}", RATE_LIMIT_AUTH
    return f"general:{client_ip}", RATE_LIMIT_GENERAL


def _check_rate_limit(bucket_key: str, limit: int) -> tuple[bool, int]:
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    bucket = _request_counters[bucket_key]

    while bucket and bucket[0] <= window_start:
        bucket.popleft()

    if len(bucket) >= limit:
        retry_after = RATE_LIMIT_WINDOW_SECONDS
        if bucket:
            retry_after = max(1, int(math.ceil(RATE_LIMIT_WINDOW_SECONDS - (now - bucket[0]))))
        return True, retry_after

    bucket.append(now)
    return False, 0


def _apply_security_headers(response, scheme: str) -> None:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Cache-Control", "no-store")
    if scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/"):
        bucket_key, limit = _resolve_rate_limit_bucket(path, _get_client_ip(request))
        blocked, retry_after = _check_rate_limit(bucket_key, limit)
        if blocked:
            response = JSONResponse(
                status_code=429,
                content={"detail": "요청이 너무 많습니다. 잠시 후 다시 시도하세요."},
            )
            response.headers["Retry-After"] = str(retry_after)
            _apply_security_headers(response, request.url.scheme)
            return response

    response = await call_next(request)
    _apply_security_headers(response, request.url.scheme)
    return response


def _is_allowed_redirect_host(hostname: str | None) -> bool:
    if not hostname:
        return False
    host = hostname.lower()

    for allowed in ALLOWED_OAUTH_REDIRECT_HOSTS:
        normalized = allowed.strip().lower()
        if not normalized:
            continue
        if normalized.startswith("."):
            if host.endswith(normalized):
                return True
        elif host == normalized:
            return True
    return False


def _get_supabase_client() -> Client:
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase DB 환경이 설정되지 않았습니다.")
    return supabase


def _normalize_email_or_raise(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not EMAIL_REGEX.match(normalized):
        raise HTTPException(status_code=400, detail="이메일 형식이 올바르지 않습니다.")
    return normalized


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
    if not _is_allowed_redirect_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="허용되지 않은 redirect_to 도메인입니다.")
    return normalized


def _ensure_transcriptions_user_scope_ready() -> None:
    global TRANSCRIPTION_SCOPE_VALIDATED
    if TRANSCRIPTION_SCOPE_VALIDATED:
        return

    try:
        _get_supabase_client().table("transcriptions").select("user_id").limit(1).execute()
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


def _prepare_audio_for_whisper(audio, transcription_type: str):
    """
    Whisper 인식용 오디오 전처리:
    - 무손실 PCM(16kHz mono)로 통일
    - 저역/고역 노이즈를 얕게 컷
    - 동적 범위 압축 + 정규화로 빠른 발화 가독성 개선
    """
    from pydub import effects

    prepared = audio.set_channels(1).set_frame_rate(16000).set_sample_width(2)
    prepared = prepared.high_pass_filter(80).low_pass_filter(7600)

    # 설교/강의는 배경음(반주, 잔향) 영향이 잦아 저역 컷을 조금 더 강하게 적용
    if transcription_type == "sermon":
        prepared = prepared.high_pass_filter(100)

    prepared = effects.compress_dynamic_range(
        prepared,
        threshold=-24.0,
        ratio=3.0,
        attack=5,
        release=90,
    )
    prepared = effects.normalize(prepared, headroom=0.8)
    return prepared


def split_audio_file(file_path: str, transcription_type: str = "sermon") -> list[tuple[str, float]]:
    """
    Whisper 전처리 + 청크 분할.
    모든 입력을 16kHz mono WAV로 변환해 재압축 손실을 줄이고,
    8분 단위로 분할해 25MB 제한을 안정적으로 회피한다.
    반환값: [(chunk_path, duration_sec), ...]
    """
    from pydub import AudioSegment

    # 파일 확장자 확인
    ext = pathlib.Path(file_path).suffix.lower()
    format_map = {".mp3": "mp3", ".wav": "wav", ".m4a": "mp4", ".ogg": "ogg", ".flac": "flac", ".webm": "webm"}
    fmt = format_map.get(ext, "mp3")

    try:
        audio = AudioSegment.from_file(file_path, format=fmt)
        audio = _prepare_audio_for_whisper(audio, transcription_type)
    except Exception as exc:
        print(f"Audio preprocessing failed, using original file: {exc}")
        return [(file_path, 0.0)]

    duration_ms = len(audio)
    chunk_duration = 8 * 60 * 1000  # 8분 (16k mono WAV 기준 약 15MB)
    overlap = 2000  # 2초 겹침 (문장 끊김 방지)

    chunks: list[tuple[str, float]] = []
    start = 0
    chunk_idx = 0

    while start < duration_ms:
        end = min(start + chunk_duration, duration_ms)
        chunk = audio[start:end]
        chunk_path = f"{file_path}_chunk{chunk_idx}.wav"
        chunk.export(chunk_path, format="wav")

        chunk_seconds = len(chunk) / 1000.0
        chunk_size_mb = os.path.getsize(chunk_path) / 1024 / 1024
        print(f"  Chunk {chunk_idx}: {start/1000:.0f}s ~ {end/1000:.0f}s ({chunk_size_mb:.1f}MB)")

        # 안전장치: 혹시라도 제한을 넘으면 원본으로 폴백
        if os.path.getsize(chunk_path) > WHISPER_MAX_SIZE:
            print(f"  Chunk {chunk_idx} exceeds Whisper size limit, fallback to original file")
            os.unlink(chunk_path)
            return [(file_path, 0.0)]

        chunks.append((chunk_path, chunk_seconds))
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
                "Troas Church, Harvester Mission Church, HMC, HMIS, HMVS, RRTS, RVIS, RTS, RSTS, RVS, RPS, RLS, RGS, "
                "Mission Home, Prenatal Mission Home, Prayer Journal"
            )
        elif transcription_type == "phonecall":
            whisper_prompt = (
                "This is a phone call recording with two speakers. "
                "Audio quality may be low. Infer unclear words from context. "
                "hypertension, diabetes, epilepsy, seizure, stroke, pneumonia, asthma, arthritis, "
                "acetaminophen, ibuprofen, metformin, amoxicillin, omeprazole, insulin, "
                "levetiracetam, carbamazepine, valproate, lamotrigine, phenytoin, topiramate, "
                "blood pressure, blood sugar, CT, MRI, EEG, ECG, prescription, dosage, side effects, "
                f"{EN_DAILY_CONTEXT_TERMS}, {EN_DOMAIN_CONTEXT_TERMS}"
            )
        else:
            whisper_prompt = (
                "This is a meeting or conversation recording with multiple speakers. "
                "Audio may have echo or overlapping voices. Infer unclear words from context. "
                "hypertension, diabetes, epilepsy, seizure, stroke, pneumonia, asthma, arthritis, "
                "acetaminophen, ibuprofen, metformin, amoxicillin, omeprazole, insulin, "
                "levetiracetam, carbamazepine, valproate, lamotrigine, phenytoin, topiramate, "
                "blood pressure, CT, MRI, EEG, prescription, dosage, side effects, "
                "KPI, ROI, OKR, project, milestone, sprint, deadline, budget, revenue, profit margin, "
                f"{EN_DAILY_CONTEXT_TERMS}, {EN_DOMAIN_CONTEXT_TERMS}"
            )
    else:
        # ===== 한국어 프롬프트 =====
        if transcription_type == "sermon":
            whisper_prompt = "다락방, 렘넌트, 237, 5000종족, 7망대, 7여정, 7이정표, CVDIP, 류광수, 이주현, 드로아교회, 하베스터선교교회, 미션홈, 태중 미션홈, 기도수첩, HMC, HMIS, HMVS, RRTS, RVIS, RTS, RSTS, RVS, RPS, RLS, RGS, 앗수르, 네피림, 바벨탑, 앉은뱅이, 뉴에이지, 프리메이슨, REA, TCK, CCK, NCK, 성회, 전도대회, 수련회, 보좌화, 생활화, 개인화, 제자화, 세계화, Heavenly, Thronely, Eternally, 록펠러, 카네기, 워너메이커, 존 워너메이커, 쉬버, 마틴 루터, 올해(연도), 오래(기간), 결재(승인), 결제(지불), 낫다(회복), 낳다(출산), 낮다(높이 반대), 안/않, 되/돼, 웬/왠지, 드로에게 교회/드로우게 교회=드로아교회, 베드로에게는(조사)=유지, 초고속 발화(120BPM+), 랩처럼 빠른 단독 화자, 음절 경계 복원, 조사/어미 유지"
        elif transcription_type == "phonecall":
            whisper_prompt = (
                "전화 통화 녹음입니다. 두 명의 화자가 대화합니다. "
                "음질이 낮거나 불명확한 부분은 문맥에 맞게 추정하세요. "
                "한 화자가 매우 빠르게(대략 120BPM 이상, 랩처럼) 말해도 음절 경계를 문맥으로 복원하고 누락 없이 기록하세요. "
                "'올해/오래, 결재/결제, 낫다/낳다/낮다, 안/않, 되/돼, 웬/왠(특히 왠지)'는 문맥으로 구분하세요. "
                "고혈압, 당뇨병, 심근경색, 갑상선, 위염, 폐렴, 천식, 관절염, 디스크, 우울증, 불면증, "
                "뇌전증, 간질, 발작, 항경련제, 레비티라세탐, 카바마제핀, 발프로산, 라모트리진, "
                "타이레놀, 아세트아미노펜, 이부프로펜, 메트포르민, 아목시실린, 오메프라졸, 인슐린, "
                "혈압, 혈당, CT, MRI, EEG, 내시경, 혈액검사, 심전도, 처방, 복용, 부작용, 합병증, 앉은뱅이, "
                f"{KO_DAILY_CONTEXT_TERMS}, {KO_DOMAIN_CONTEXT_TERMS}"
            )
        else:
            whisper_prompt = (
                "회의 또는 대화 녹음입니다. 여러 참석자가 있습니다. "
                "음질이 낮거나 겹치는 목소리가 있을 수 있으며, 문맥에 맞게 추정하세요. "
                "특정 화자가 매우 빠르게(대략 120BPM 이상, 랩처럼) 말해도 음절 경계를 문맥으로 복원하고 누락 없이 기록하세요. "
                "'올해/오래, 결재/결제, 낫다/낳다/낮다, 안/않, 되/돼, 웬/왠(특히 왠지)'는 문맥으로 구분하세요. "
                "고혈압, 당뇨병, 심근경색, 갑상선, 위염, 폐렴, 천식, 관절염, 디스크, 우울증, 불면증, "
                "뇌전증, 간질, 발작, 항경련제, 레비티라세탐, 카바마제핀, 발프로산, 라모트리진, "
                "타이레놀, 아세트아미노펜, 이부프로펜, 메트포르민, 아목시실린, 오메프라졸, 인슐린, "
                "혈압, 혈당, CT, MRI, EEG, 내시경, 혈액검사, 심전도, 처방, 복용, 부작용, 합병증, 앉은뱅이, "
                "KPI, ROI, OKR, 프로젝트, 마일스톤, 스프린트, 데드라인, 예산, 매출, 영업이익, "
                f"{KO_DAILY_CONTEXT_TERMS}, {KO_DOMAIN_CONTEXT_TERMS}"
            )

    chunks = split_audio_file(file_path, transcription_type)
    all_text = []

    rapid_retry_prompt = (
        "초고속 발화 또는 랩처럼 빠른 한국어 발화가 포함될 수 있습니다. "
        "붙어 들리는 음절도 단어 경계를 복원하여 누락 없이 전부 기록하세요."
        if language == "ko"
        else
        "This audio may include very fast rap-like delivery. "
        "Recover word boundaries from merged syllables and transcribe every audible word."
    )

    for i, (chunk_path, chunk_duration_sec) in enumerate(chunks):
        print(f"  Whisper transcribing chunk {i+1}/{len(chunks)}...")

        with open(chunk_path, "rb") as audio_file:
            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                prompt=whisper_prompt,
                response_format="text",
            )

        chunk_text = response.strip()

        # 빠른 발화/랩 구간에서 지나치게 짧게 인식된 경우 보수적으로 1회 재시도
        if chunk_duration_sec >= 45 and len(chunk_text) < 25:
            print(f"  Chunk {i+1}: sparse transcript detected, retrying with rapid-speech prompt...")
            with open(chunk_path, "rb") as audio_file:
                retry_response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language=language,
                    prompt=f"{whisper_prompt} {rapid_retry_prompt}",
                    response_format="text",
                )
            retry_text = retry_response.strip()
            if len(retry_text) > len(chunk_text):
                chunk_text = retry_text

        all_text.append(chunk_text)

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
    source_mime_type: str = "",
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

            mime_type = source_mime_type or _resolve_audio_mime_type(temp_file_path)
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

        _get_supabase_client().table("transcriptions").insert({
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
            _get_supabase_client().table("transcriptions").insert({
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

        normalized_language = (language or "ko").strip().lower()
        if normalized_language not in ALLOWED_LANGUAGES:
            raise HTTPException(status_code=400, detail="지원하지 않는 언어입니다. ko 또는 en만 가능합니다.")

        normalized_transcription_type = (transcription_type or "sermon").strip().lower()
        if normalized_transcription_type not in ALLOWED_TRANSCRIPTION_TYPES:
            raise HTTPException(status_code=400, detail="지원하지 않는 녹취 유형입니다.")

        contents = await file.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            size_mb = int(MAX_UPLOAD_BYTES / 1024 / 1024)
            raise HTTPException(status_code=400, detail=f"파일 크기는 {size_mb}MB 이하")

        original_ext, source_mime_type = _validate_uploaded_audio_payload(file, contents)

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
            normalized_language,
            correct,
            normalized_transcription_type,
            source_mime_type,
        )

        type_labels = {"sermon": "설교 녹취", "phonecall": "통화 기록", "conversation": "대화/회의 기록"}

        return {
            "success": True,
            "task_id": task_id,
            "status": "queued",
            "message": f"{type_labels.get(normalized_transcription_type, '녹취')} 변환 작업이 시작되었습니다.",
            "engine": "whisper+gemini" if openai_client else "gemini-only",
            "transcription_type": normalized_transcription_type,
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
        _get_supabase_client().table("transcriptions")
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
    if not EXPOSE_TERMS_ENDPOINT:
        raise HTTPException(status_code=404, detail="Not Found")
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
        _get_supabase_client().table("transcriptions")
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
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="비밀번호 길이가 너무 깁니다.")

    normalized_email = _normalize_email_or_raise(email)
    payload = {
        "email": normalized_email,
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
    normalized_email = _normalize_email_or_raise(email)
    data = _supabase_auth_request(
        "token?grant_type=password",
        payload={"email": normalized_email, "password": password},
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
    authorization: str | None = Header(default=None),
):
    """기록본 초안 생성 (회의 키워드/진료 도움 기록/설교 핵심 요약)"""
    _get_current_user(authorization)
    normalized_category = category.strip()
    normalized_language = (language or "ko").strip().lower()
    normalized_text = text.strip()

    if normalized_category not in ALLOWED_RECORD_CATEGORIES:
        raise HTTPException(status_code=400, detail="지원하지 않는 기록 카테고리입니다.")
    if normalized_language not in ALLOWED_LANGUAGES:
        raise HTTPException(status_code=400, detail="지원하지 않는 언어입니다. ko 또는 en만 가능합니다.")
    if not normalized_text:
        raise HTTPException(status_code=400, detail="원문 텍스트가 비어 있습니다.")
    if len(normalized_text) > MAX_TEXT_INPUT_CHARS:
        raise HTTPException(status_code=400, detail=f"원문 텍스트는 {MAX_TEXT_INPUT_CHARS}자 이하여야 합니다.")

    prompt = _build_record_draft_prompt(normalized_category, normalized_language)
    target_model = get_optimal_model()
    model = genai.GenerativeModel(model_name=target_model)

    full_prompt = f"""{prompt}

[원문]
{normalized_text}
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
        "category_label": _get_record_category_label(normalized_category, normalized_language),
        "title": _get_record_category_label(normalized_category, normalized_language),
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
    if len(normalized_content) > MAX_RECORD_CONTENT_CHARS:
        raise HTTPException(status_code=400, detail=f"기록 내용은 {MAX_RECORD_CONTENT_CHARS}자 이하여야 합니다.")

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
        response = _get_supabase_client().table("saved_records").insert(insert_row).execute()
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
    normalized_category = category.strip()
    if normalized_category and normalized_category not in ALLOWED_RECORD_CATEGORIES:
        raise HTTPException(status_code=400, detail="지원하지 않는 기록 카테고리입니다.")

    try:
        query = (
            _get_supabase_client().table("saved_records")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
        )
        if normalized_category:
            query = query.eq("category", normalized_category)
        response = query.execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"saved_records 조회 실패: {str(e)}")

    return response.data or []


@app.post("/api/summarize")
async def summarize_sermon(
    text: str = Form(...),
    summary_type: str = Form("short"),
    authorization: str | None = Header(default=None),
):
    """다락방 설교 요약 (Gemini)"""
    try:
        _get_current_user(authorization)
        normalized_text = text.strip()
        if not normalized_text:
            raise HTTPException(status_code=400, detail="요약할 텍스트가 비어 있습니다.")
        if len(normalized_text) > MAX_TEXT_INPUT_CHARS:
            raise HTTPException(status_code=400, detail=f"요약 입력은 {MAX_TEXT_INPUT_CHARS}자 이하여야 합니다.")

        target_model = get_optimal_model()
        model = genai.GenerativeModel(model_name=target_model)

        prompt = get_summary_prompt(summary_type)
        full_prompt = f"""{prompt}

설교 내용:
{normalized_text}"""

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
