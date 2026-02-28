from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
import google.generativeai as genai
from openai import OpenAI
import httpx
import os
import uuid
import json
import base64
import hashlib
import asyncio
import random
import gc
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from dotenv import load_dotenv
from supabase import create_client, Client
import tempfile
import pathlib
import time
import math
import mimetypes
import re
import wave
import urllib.parse
import subprocess
import shutil
import resource
from collections import defaultdict, deque

try:
    from mutagen import File as MutagenFile
except Exception:
    MutagenFile = None

try:
    import stripe
except Exception:
    stripe = None

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


def _parse_csv_env_union(name: str, default: list[str]) -> list[str]:
    parsed = _parse_csv_env(name, [])
    if not parsed:
        return default
    merged: list[str] = []
    seen: set[str] = set()
    for item in [*default, *parsed]:
        key = item.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(item.strip())
    return merged


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://malloc24.vercel.app",
    "https://www.malloc24.vercel.app",
    "https://mallog24.vercel.app",
    "https://www.mallog24.vercel.app",
    "https://mallog24.com",
    "https://www.mallog24.com",
    "https://ours.mallog24.com",
]
DEFAULT_OAUTH_REDIRECT_HOSTS = [
    "localhost",
    "127.0.0.1",
    "malloc24.vercel.app",
    "www.malloc24.vercel.app",
    "mallog24.vercel.app",
    "www.mallog24.vercel.app",
    "mallog24.com",
    "www.mallog24.com",
    "ours.mallog24.com",
]
DEFAULT_OAUTH_REDIRECT_SCHEMES = [
    "http",
    "https",
    "mallog24",
    "exp",
]

CORS_ALLOW_ORIGINS = _parse_csv_env_union("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ORIGINS)
CORS_ALLOW_ORIGIN_REGEX = (os.getenv("CORS_ALLOW_ORIGIN_REGEX") or "").strip() or None
ALLOWED_OAUTH_REDIRECT_HOSTS = {
    host.lower() for host in _parse_csv_env_union("OAUTH_REDIRECT_ALLOW_HOSTS", DEFAULT_OAUTH_REDIRECT_HOSTS)
}
ALLOWED_OAUTH_REDIRECT_SCHEMES = {
    scheme.lower() for scheme in _parse_csv_env_union("OAUTH_REDIRECT_ALLOW_SCHEMES", DEFAULT_OAUTH_REDIRECT_SCHEMES)
}

RATE_LIMIT_WINDOW_SECONDS = max(1, int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")))
RATE_LIMIT_GENERAL = max(1, int(os.getenv("RATE_LIMIT_GENERAL", "180")))
RATE_LIMIT_AUTH = max(1, int(os.getenv("RATE_LIMIT_AUTH", "30")))
RATE_LIMIT_TRANSCRIBE = max(1, int(os.getenv("RATE_LIMIT_TRANSCRIBE", "10")))

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
MAX_TEXT_INPUT_CHARS = int(os.getenv("MAX_TEXT_INPUT_CHARS", "120000"))
MAX_RECORD_CONTENT_CHARS = int(os.getenv("MAX_RECORD_CONTENT_CHARS", "80000"))
EXPOSE_TERMS_ENDPOINT = (os.getenv("EXPOSE_TERMS_ENDPOINT", "false").strip().lower() == "true")
LOG_GEMINI_MODELS_ON_STARTUP = (os.getenv("LOG_GEMINI_MODELS_ON_STARTUP", "false").strip().lower() == "true")

ALLOWED_LANGUAGES = {"ko", "en"}
ALLOWED_TRANSCRIPTION_TYPES = {"sermon", "phonecall", "conversation"}
ALLOWED_CORRECTION_MODES = {"strict", "normal", "raw"}
ALLOWED_CONTENT_STYLES = {"sermon", "lecture", "phonecall", "meeting", "forum", "debate"}

SERMON_CONTEXT_HINTS = (
    "설교", "말씀", "본문", "은혜", "복음", "기도", "예배", "목사", "아멘",
    "sermon", "scripture", "gospel", "pastor", "amen", "worship",
)
LECTURE_CONTEXT_HINTS = (
    "강의", "수업", "교안", "학습", "학기", "과제", "교육",
    "lecture", "class", "lesson", "curriculum", "assignment", "training",
)
FORUM_CONTEXT_HINTS = (
    "포럼", "패널", "발제", "질의응답", "q&a", "session", "forum", "panel",
)
DEBATE_CONTEXT_HINTS = (
    "토론", "논제", "쟁점", "찬성", "반대", "반박", "재반박",
    "debate", "motion", "proposition", "opposition", "rebuttal",
)
FREE_MONTHLY_LIMIT_SECONDS = max(1, int(os.getenv("FREE_MONTHLY_LIMIT_SECONDS", "36000")))
FREE_LIMIT_EXCEEDED_MESSAGE = "이번 달 무료 제공량(10시간)을 모두 사용했습니다. 요금제를 업그레이드해 주세요."
USAGE_TABLE_NAME = "user_usage_quotas"
USAGE_FREE_PLAN = "free"
USAGE_ADMIN_PLAN = "admin"
USAGE_TIMEZONE = (os.getenv("USAGE_TIMEZONE") or "Asia/Seoul").strip() or "Asia/Seoul"
ADMIN_BYPASS_USER_IDS = {
    value.lower() for value in _parse_csv_env("ADMIN_BYPASS_USER_IDS", []) if value
}
ADMIN_BYPASS_EMAILS = {
    value.lower() for value in _parse_csv_env("ADMIN_BYPASS_EMAILS", []) if value
}
BILLING_TABLE_NAME = "billing_subscriptions"
BILLING_REFUND_TABLE_NAME = "billing_refund_requests"
BILLING_PROVIDER = (os.getenv("BILLING_PROVIDER") or "portone").strip().lower()
SUPPORTED_BILLING_PROVIDERS = {"portone", "tosspayments", "stripe"}
STRIPE_SECRET_KEY = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
STRIPE_WEBHOOK_SECRET = (os.getenv("STRIPE_WEBHOOK_SECRET") or "").strip()
STRIPE_PRICE_ID_PRO = (os.getenv("STRIPE_PRICE_ID_PRO") or "").strip()
PORTONE_STORE_ID = (os.getenv("PORTONE_STORE_ID") or os.getenv("PORTONE_MID") or "").strip()
PORTONE_MID = (os.getenv("PORTONE_MID") or PORTONE_STORE_ID).strip()
PORTONE_CHANNEL_KEY = (os.getenv("PORTONE_CHANNEL_KEY") or "").strip()
PORTONE_API_SECRET = (os.getenv("PORTONE_API_SECRET") or "").strip()
PORTONE_WEBHOOK_SECRET = (os.getenv("PORTONE_WEBHOOK_SECRET") or "").strip()
PORTONE_API_BASE_URL = (os.getenv("PORTONE_API_BASE_URL") or "https://api.portone.io").strip().rstrip("/")
PAID_PLAN_AMOUNT_KRW = max(100, int(os.getenv("PAID_PLAN_AMOUNT_KRW", "8800")))
PAID_PLAN_PRODUCT_NAME_KO = (os.getenv("PAID_PLAN_PRODUCT_NAME_KO") or "mallog24 Pro 월간 구독").strip()
PAID_PLAN_PRODUCT_NAME_EN = (
    os.getenv("PAID_PLAN_PRODUCT_NAME_EN") or "mallog24 Pro Monthly Subscription"
).strip()
TOSS_CLIENT_KEY = (os.getenv("TOSS_CLIENT_KEY") or "").strip()
TOSS_SECRET_KEY = (os.getenv("TOSS_SECRET_KEY") or "").strip()
BILLING_SUCCESS_URL = (os.getenv("BILLING_SUCCESS_URL") or "").strip()
BILLING_CANCEL_URL = (os.getenv("BILLING_CANCEL_URL") or "").strip()
BILLING_PORTAL_RETURN_URL = (os.getenv("BILLING_PORTAL_RETURN_URL") or "").strip()
PAID_PLAN_TIER = (os.getenv("PAID_PLAN_TIER") or "pro").strip().lower() or "pro"
STRIPE_ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}
BILLING_REFUND_WINDOW_DAYS = min(
    30,
    max(1, int(os.getenv("BILLING_REFUND_WINDOW_DAYS", "7"))),
)
BILLING_TEST_MODE = os.getenv("BILLING_TEST_MODE", "false").strip().lower() == "true"
MOCK_CHECKOUT_SESSION_TTL_SECONDS = max(60, int(os.getenv("MOCK_CHECKOUT_SESSION_TTL_SECONDS", "1800")))
TASK_STATUS_TTL_SECONDS = max(300, int(os.getenv("TASK_STATUS_TTL_SECONDS", "3600")))
MAX_AUTH_USER_CACHE_SIZE = max(100, int(os.getenv("MAX_AUTH_USER_CACHE_SIZE", "2000")))
MAX_RATE_LIMIT_BUCKETS = max(100, int(os.getenv("MAX_RATE_LIMIT_BUCKETS", "2000")))
MAX_CONCURRENT_TRANSCRIPTIONS = max(1, int(os.getenv("MAX_CONCURRENT_TRANSCRIPTIONS", "1")))
AUTH_MAX_CONCURRENT_SESSIONS = max(0, int(os.getenv("AUTH_MAX_CONCURRENT_SESSIONS", "1")))
AUTH_SESSION_STALE_SECONDS = max(300, int(os.getenv("AUTH_SESSION_STALE_SECONDS", str(30 * 24 * 60 * 60))))
AUTH_CONCURRENT_LOGIN_REJECT_MESSAGE = (
    "다른 기기에서 로그인되어 현재 세션이 종료되었습니다. 다시 로그인해 주세요."
)
TASK_STUCK_TIMEOUT_SECONDS = max(900, int(os.getenv("TASK_STUCK_TIMEOUT_SECONDS", "7200")))
TASK_STUCK_ERROR_MESSAGE = (
    "처리 시간이 비정상적으로 길어 작업이 자동 종료되었습니다. 다시 시도해 주세요."
)
TRANSCRIPTION_ENGINE_MODE = (os.getenv("TRANSCRIPTION_ENGINE_MODE", "auto").strip().lower() or "auto")
ENABLE_MEMORY_STAGE_LOG = (os.getenv("ENABLE_MEMORY_STAGE_LOG", "false").strip().lower() == "true")
FORCE_GC_AFTER_TRANSCRIPTION = (os.getenv("FORCE_GC_AFTER_TRANSCRIPTION", "true").strip().lower() == "true")

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

# Whisper 파일 크기 제한 (25MB)
WHISPER_MAX_SIZE = 24 * 1024 * 1024  # 약간 여유
WHISPER_CHUNK_TIMEOUT_SECONDS = max(30, int(os.getenv("WHISPER_CHUNK_TIMEOUT_SECONDS", "240")))
WHISPER_CHUNK_MAX_RETRIES = max(1, int(os.getenv("WHISPER_CHUNK_MAX_RETRIES", "2")))
WHISPER_FALLBACK_TO_GEMINI_ON_ERROR = (
    os.getenv("WHISPER_FALLBACK_TO_GEMINI_ON_ERROR", "true").strip().lower() == "true"
)
WHISPER_MAX_PIPELINE_AUDIO_SECONDS = max(
    0,
    int(os.getenv("WHISPER_MAX_PIPELINE_AUDIO_SECONDS", "2400")),
)

# 외부 프로세스/LLM 타임아웃
FFMPEG_PROCESS_TIMEOUT_SECONDS = max(30, int(os.getenv("FFMPEG_PROCESS_TIMEOUT_SECONDS", "300")))
FFPROBE_PROCESS_TIMEOUT_SECONDS = max(10, int(os.getenv("FFPROBE_PROCESS_TIMEOUT_SECONDS", "30")))
GEMINI_REQUEST_TIMEOUT_SECONDS = max(60, int(os.getenv("GEMINI_REQUEST_TIMEOUT_SECONDS", "600")))
GEMINI_MAX_OUTPUT_TOKENS = max(4096, int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "32768")))

# OpenAI (Whisper) 설정
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY is not set. Whisper STT unavailable, falling back to Gemini.")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# 시작 시 용어 로딩 확인
@app.on_event("startup")
async def startup_event():
    _get_auth_http_client()
    print_terms_summary()
    if openai_client:
        print("OpenAI Whisper: Ready")
    else:
        print("OpenAI Whisper: Not configured (Gemini fallback)")
    try:
        billing_provider = _get_billing_provider_or_raise()
        billing_enabled = _is_billing_enabled()
        print(f"Billing provider: {billing_provider} ({'enabled' if billing_enabled else 'disabled'})")
    except Exception as billing_err:
        print(f"Billing provider configuration error: {billing_err}")
    if LOG_GEMINI_MODELS_ON_STARTUP:
        try:
            if GEMINI_API_KEY:
                print("Checking available Gemini models...")
                for m in genai.list_models():
                    if 'generateContent' in m.supported_generation_methods:
                        print(f" - {m.name}")
        except Exception as e:
            print(f"Failed to list models: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    global _auth_http_client
    if _auth_http_client is not None:
        await _auth_http_client.aclose()
        _auth_http_client = None

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
task_updated_at: dict[str, float] = {}
mock_checkout_sessions: dict[str, dict] = {}
portone_checkout_sessions: dict[str, dict] = {}
transcription_semaphore = asyncio.Semaphore(MAX_CONCURRENT_TRANSCRIPTIONS)
if TRANSCRIPTION_ENGINE_MODE not in {"auto", "whisper_gemini", "gemini_only"}:
    print(
        "Warning: TRANSCRIPTION_ENGINE_MODE is invalid. "
        "Use one of auto, whisper_gemini, gemini_only. Falling back to auto."
    )

# 모델 캐시
_model_cache = {"model": None, "cached_at": 0}
MODEL_CACHE_TTL = 3600
AUTH_TIMEOUT = max(1, int(os.getenv("AUTH_TIMEOUT", "20")))
AUTH_CONNECT_TIMEOUT = max(1, int(os.getenv("AUTH_CONNECT_TIMEOUT", "8")))
AUTH_USER_CACHE_TTL_SECONDS = max(0, int(os.getenv("AUTH_USER_CACHE_TTL_SECONDS", "20")))
ALLOWED_RECORD_CATEGORIES = {
    "meeting_keywords",
    "clinical_notes",
    "sermon_core_summary",
}
ALLOWED_OAUTH_PROVIDERS = {"google", "kakao"}
TRANSCRIPTION_SCOPE_VALIDATED = False
USAGE_SCOPE_VALIDATED = False
BILLING_SCOPE_VALIDATED = False
BILLING_REFUND_SCOPE_VALIDATED = False
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
_auth_user_cache: dict[str, dict] = {}
_auth_http_client: httpx.AsyncClient | None = None
_auth_active_sessions: dict[str, list[dict]] = defaultdict(list)
_auth_session_state_lock = threading.Lock()


def _cleanup_stale_task_states() -> None:
    if not task_updated_at:
        return
    now_ts = time.time()
    stale_ids = [
        task_id
        for task_id, updated_ts in task_updated_at.items()
        if now_ts - float(updated_ts or 0) > TASK_STATUS_TTL_SECONDS
    ]
    for task_id in stale_ids:
        task_status.pop(task_id, None)
        task_owner.pop(task_id, None)
        task_updated_at.pop(task_id, None)


def _set_task_runtime_state(task_id: str, status: str, owner_id: str | None = None) -> None:
    _cleanup_stale_task_states()
    task_status[task_id] = status
    if owner_id is not None:
        task_owner[task_id] = owner_id
    task_updated_at[task_id] = time.time()


def _touch_task_runtime_state(task_id: str) -> None:
    if task_id in task_status:
        task_updated_at[task_id] = time.time()


def _clear_task_runtime_state(task_id: str) -> None:
    task_status.pop(task_id, None)
    task_owner.pop(task_id, None)
    task_updated_at.pop(task_id, None)


def _cleanup_auth_user_cache() -> None:
    if not _auth_user_cache:
        return
    now_ts = time.time()
    stale_tokens = [
        token
        for token, payload in _auth_user_cache.items()
        if float((payload or {}).get("expires_at") or 0) <= now_ts
    ]
    for token in stale_tokens:
        _auth_user_cache.pop(token, None)

    if len(_auth_user_cache) <= MAX_AUTH_USER_CACHE_SIZE:
        return

    sortable = sorted(
        _auth_user_cache.items(),
        key=lambda item: float((item[1] or {}).get("expires_at") or 0),
    )
    overflow = len(_auth_user_cache) - MAX_AUTH_USER_CACHE_SIZE
    for token, _ in sortable[:overflow]:
        _auth_user_cache.pop(token, None)


def _decode_jwt_iat_unverified(token: str) -> int | None:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload = parts[1]
        padded = payload + ("=" * ((4 - len(payload) % 4) % 4))
        decoded_payload = base64.urlsafe_b64decode(padded.encode("utf-8"))
        decoded = json.loads(decoded_payload.decode("utf-8"))
        iat = decoded.get("iat")
        if isinstance(iat, int):
            return iat
        if isinstance(iat, float):
            return int(iat)
    except Exception:
        return None
    return None


def _hash_auth_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cleanup_stale_auth_sessions(now_ts: float | None = None) -> None:
    if not _auth_active_sessions:
        return
    reference_ts = now_ts or time.time()
    stale_cutoff = reference_ts - AUTH_SESSION_STALE_SECONDS
    expired_users: list[str] = []

    for user_id, sessions in list(_auth_active_sessions.items()):
        alive_sessions = [
            session
            for session in sessions
            if float((session or {}).get("last_seen_at") or 0) >= stale_cutoff
        ]
        if alive_sessions:
            _auth_active_sessions[user_id] = alive_sessions
        else:
            expired_users.append(user_id)

    for user_id in expired_users:
        _auth_active_sessions.pop(user_id, None)


def _enforce_concurrent_login_limit(token: str, user: dict, is_fresh_login: bool = False) -> None:
    if AUTH_MAX_CONCURRENT_SESSIONS <= 0:
        return

    user_id = str((user or {}).get("id") or "").strip()
    if not user_id:
        return

    now_ts = time.time()
    token_hash = _hash_auth_token(token)
    token_iat = _decode_jwt_iat_unverified(token) or 0

    with _auth_session_state_lock:
        _cleanup_stale_auth_sessions(now_ts)

        sessions = list(_auth_active_sessions.get(user_id) or [])
        found = False
        for session in sessions:
            if session.get("token_hash") != token_hash:
                continue
            session["last_seen_at"] = now_ts
            existing_iat = int(session.get("iat") or 0)
            if token_iat > existing_iat:
                session["iat"] = token_iat
            found = True
            break

        if not found:
            promoted_iat = token_iat
            if is_fresh_login and sessions:
                latest_iat = max(int(item.get("iat") or 0) for item in sessions)
                if promoted_iat <= latest_iat:
                    promoted_iat = latest_iat + 1
            sessions.append({
                "token_hash": token_hash,
                "iat": promoted_iat,
                "last_seen_at": now_ts,
            })

        sessions.sort(
            key=lambda item: (int(item.get("iat") or 0), float(item.get("last_seen_at") or 0)),
            reverse=True,
        )
        trimmed_sessions = sessions[:AUTH_MAX_CONCURRENT_SESSIONS]
        _auth_active_sessions[user_id] = trimmed_sessions

        is_active_token = any(item.get("token_hash") == token_hash for item in trimmed_sessions)
        if not is_active_token:
            raise HTTPException(status_code=401, detail=AUTH_CONCURRENT_LOGIN_REJECT_MESSAGE)


def _resolved_engine_mode() -> str:
    if TRANSCRIPTION_ENGINE_MODE in {"auto", "whisper_gemini", "gemini_only"}:
        return TRANSCRIPTION_ENGINE_MODE
    return "auto"


def _should_use_whisper_pipeline() -> bool:
    mode = _resolved_engine_mode()
    if mode == "gemini_only":
        return False
    if mode == "whisper_gemini":
        return openai_client is not None
    # auto
    return openai_client is not None


def _current_rss_mb() -> float:
    try:
        if os.path.exists("/proc/self/statm"):
            with open("/proc/self/statm", "r", encoding="utf-8") as fp:
                parts = (fp.read() or "").strip().split()
            if len(parts) >= 2:
                rss_pages = int(parts[1])
                page_size = os.sysconf("SC_PAGE_SIZE")
                return (rss_pages * page_size) / (1024 * 1024)
    except Exception:
        pass

    try:
        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux: KB, macOS: bytes
        if usage > 10_000_000:
            return usage / (1024 * 1024)
        return usage / 1024
    except Exception:
        return 0.0


def _log_stage_memory(task_id: str, stage: str) -> None:
    if not ENABLE_MEMORY_STAGE_LOG:
        return
    rss_mb = _current_rss_mb()
    print(f"[{task_id}] [mem] {stage}: {rss_mb:.1f}MB")


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

    if len(_request_counters) > MAX_RATE_LIMIT_BUCKETS:
        removable = []
        for key, values in _request_counters.items():
            if not values:
                removable.append(key)
                continue
            if values[-1] <= window_start:
                removable.append(key)
        for key in removable:
            _request_counters.pop(key, None)

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


def _get_auth_http_client() -> httpx.AsyncClient:
    global _auth_http_client
    if _auth_http_client is None:
        timeout = httpx.Timeout(
            timeout=AUTH_TIMEOUT,
            connect=AUTH_CONNECT_TIMEOUT,
            read=AUTH_TIMEOUT,
            write=AUTH_TIMEOUT,
            pool=AUTH_CONNECT_TIMEOUT,
        )
        limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
        _auth_http_client = httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=False)
    return _auth_http_client


async def _supabase_auth_request(path: str, method: str = "POST", payload: dict | None = None, token: str | None = None) -> dict:
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

    client = _get_auth_http_client()
    try:
        response = await client.request(
            method.upper(),
            url,
            headers=headers,
            json=payload if payload is not None else None,
        )
        raw = response.text or ""
        if response.status_code >= 400:
            raise HTTPException(
                status_code=response.status_code,
                detail=_extract_auth_error_message(raw),
            )
        return json.loads(raw) if raw else {}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Supabase 인증 요청 시간 초과")
    except HTTPException:
        raise
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Supabase 인증 네트워크 오류: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase 인증 요청 실패: {str(e)}")


def _decode_jwt_exp_unverified(token: str) -> int | None:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload = parts[1]
        padded = payload + ("=" * ((4 - len(payload) % 4) % 4))
        decoded_payload = base64.urlsafe_b64decode(padded.encode("utf-8"))
        decoded = json.loads(decoded_payload.decode("utf-8"))
        exp = decoded.get("exp")
        if isinstance(exp, int):
            return exp
        if isinstance(exp, float):
            return int(exp)
    except Exception:
        return None
    return None


def _get_cached_user_by_token(token: str) -> dict | None:
    if AUTH_USER_CACHE_TTL_SECONDS <= 0:
        return None
    _cleanup_auth_user_cache()
    cached = _auth_user_cache.get(token)
    if not cached:
        return None
    expires_at = float(cached.get("expires_at") or 0)
    if expires_at <= time.time():
        _auth_user_cache.pop(token, None)
        return None
    user = cached.get("user")
    if isinstance(user, dict) and user.get("id"):
        return user
    _auth_user_cache.pop(token, None)
    return None


def _cache_user_by_token(token: str, user: dict) -> None:
    if AUTH_USER_CACHE_TTL_SECONDS <= 0:
        return
    _cleanup_auth_user_cache()
    ttl = AUTH_USER_CACHE_TTL_SECONDS
    token_exp = _decode_jwt_exp_unverified(token)
    if token_exp:
        remaining = int(token_exp - time.time())
        if remaining <= 0:
            return
        ttl = min(ttl, remaining)
    if ttl <= 0:
        return
    _auth_user_cache[token] = {
        "user": user,
        "expires_at": time.time() + ttl,
    }


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다.")

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise HTTPException(status_code=401, detail="Authorization 헤더 형식이 올바르지 않습니다.")
    return parts[1].strip()


async def _get_current_user(authorization: str | None) -> dict:
    token = _extract_bearer_token(authorization)
    cached_user = _get_cached_user_by_token(token)
    if cached_user:
        try:
            _enforce_concurrent_login_limit(token, cached_user, is_fresh_login=False)
        except HTTPException:
            _auth_user_cache.pop(token, None)
            raise
        return cached_user
    user = await _supabase_auth_request("user", method="GET", token=token)
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="유효하지 않은 사용자 토큰입니다.")
    try:
        _enforce_concurrent_login_limit(token, user, is_fresh_login=False)
    except HTTPException:
        _auth_user_cache.pop(token, None)
        raise
    _cache_user_by_token(token, user)
    return user


def _validate_redirect_url(redirect_to: str) -> str:
    normalized = (redirect_to or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="redirect_to 값이 필요합니다.")

    parsed = urllib.parse.urlparse(normalized)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ALLOWED_OAUTH_REDIRECT_SCHEMES:
        raise HTTPException(status_code=400, detail="허용되지 않은 redirect_to 스킴입니다.")

    if scheme in ("http", "https"):
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="redirect_to URL 형식이 올바르지 않습니다.")
        if not _is_allowed_redirect_host(parsed.hostname):
            raise HTTPException(status_code=400, detail="허용되지 않은 redirect_to 도메인입니다.")
    else:
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="redirect_to 딥링크 형식이 올바르지 않습니다.")

    return normalized


def _get_billing_provider_or_raise() -> str:
    provider = BILLING_PROVIDER.strip().lower()
    if provider not in SUPPORTED_BILLING_PROVIDERS:
        raise HTTPException(
            status_code=500,
            detail=f"지원하지 않는 BILLING_PROVIDER 입니다: {provider}",
        )
    return provider


def _is_stripe_billing_enabled() -> bool:
    return bool(
        stripe is not None
        and _get_billing_provider_or_raise() == "stripe"
        and STRIPE_SECRET_KEY
        and STRIPE_PRICE_ID_PRO
    )


def _is_portone_billing_enabled() -> bool:
    return bool(
        _get_billing_provider_or_raise() == "portone"
        and PORTONE_STORE_ID
        and PORTONE_CHANNEL_KEY
        and PORTONE_API_SECRET
    )


def _is_tosspayments_billing_enabled() -> bool:
    return bool(
        _get_billing_provider_or_raise() == "tosspayments"
        and TOSS_CLIENT_KEY
        and TOSS_SECRET_KEY
    )


def _get_checkout_mode(provider: str | None = None) -> str:
    resolved_provider = provider or _get_billing_provider_or_raise()

    # Always honor explicit test mode first, even if live credentials are present.
    if BILLING_TEST_MODE:
        return "mock"

    if resolved_provider == "portone" and _is_portone_billing_enabled():
        return "live"
    if resolved_provider == "stripe" and stripe is not None and STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO:
        return "live"
    return "disabled"


def _is_billing_enabled() -> bool:
    provider = _get_billing_provider_or_raise()
    return _get_checkout_mode(provider) != "disabled"


def _require_stripe_billing_enabled() -> None:
    if stripe is None:
        raise HTTPException(
            status_code=500,
            detail="stripe 패키지가 설치되지 않았습니다. requirements.txt를 확인하세요.",
        )
    if _get_billing_provider_or_raise() != "stripe":
        raise HTTPException(status_code=503, detail="현재 결제 공급자 설정이 비활성화되어 있습니다.")
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID_PRO:
        raise HTTPException(
            status_code=503,
            detail="결제 기능 준비 중입니다. Stripe 키/가격 ID가 아직 설정되지 않았습니다.",
        )
    stripe.api_key = STRIPE_SECRET_KEY


def _build_redirect_url_from_request(request: Request, path: str) -> str:
    base = str(request.base_url).rstrip("/")
    target = "/" + path.lstrip("/")
    return f"{base}{target}"


def _resolve_checkout_redirect_urls(request: Request, payload: dict) -> tuple[str, str]:
    locale = str((payload or {}).get("locale") or "").strip().lower()
    is_en_locale = locale == "en"
    default_success_path = "/pricing-en?checkout=success" if is_en_locale else "/pricing?checkout=success"
    default_cancel_path = "/pricing-en?checkout=cancel" if is_en_locale else "/pricing?checkout=cancel"

    raw_success = (payload.get("success_url") if isinstance(payload, dict) else "") or BILLING_SUCCESS_URL
    raw_cancel = (payload.get("cancel_url") if isinstance(payload, dict) else "") or BILLING_CANCEL_URL

    success_url = _validate_redirect_url(raw_success) if raw_success else _build_redirect_url_from_request(request, default_success_path)
    cancel_url = _validate_redirect_url(raw_cancel) if raw_cancel else _build_redirect_url_from_request(request, default_cancel_path)

    if "{CHECKOUT_SESSION_ID}" not in success_url:
        separator = "&" if "?" in success_url else "?"
        success_url = f"{success_url}{separator}checkout_session_id={{CHECKOUT_SESSION_ID}}"

    return success_url, cancel_url


def _resolve_portal_return_url(request: Request, payload: dict) -> str:
    locale = str((payload or {}).get("locale") or "").strip().lower()
    is_en_locale = locale == "en"
    default_return_path = "/pricing-en" if is_en_locale else "/pricing"

    raw_return = (payload.get("return_url") if isinstance(payload, dict) else "") or BILLING_PORTAL_RETURN_URL
    if raw_return:
        return _validate_redirect_url(raw_return)
    return _build_redirect_url_from_request(request, default_return_path)


def _append_query_params(target_url: str, params: dict[str, str | int | None]) -> str:
    if not target_url:
        return target_url
    parsed = urllib.parse.urlparse(target_url)
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    for key, value in (params or {}).items():
        if value is None:
            continue
        query[str(key)] = [str(value)]
    encoded = urllib.parse.urlencode(query, doseq=True)
    return urllib.parse.urlunparse(parsed._replace(query=encoded))


def _to_int_safe(value, default: int = 0) -> int:
    try:
        if value is None:
            return default
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        normalized = str(value).replace(",", "").strip()
        if not normalized:
            return default
        return int(float(normalized))
    except Exception:
        return default


def _cleanup_expired_portone_checkout_sessions() -> None:
    now_ts = time.time()
    expired_ids = []
    for session_id, session in portone_checkout_sessions.items():
        created_ts = float(session.get("created_ts") or 0.0)
        if created_ts <= 0:
            expired_ids.append(session_id)
            continue
        if now_ts - created_ts > MOCK_CHECKOUT_SESSION_TTL_SECONDS:
            expired_ids.append(session_id)

    for session_id in expired_ids:
        portone_checkout_sessions.pop(session_id, None)


def _create_portone_checkout_session(
    user_id: str,
    email: str,
    success_url: str,
    cancel_url: str,
    locale: str,
    amount_krw: int,
    request: Request,
) -> dict:
    _cleanup_expired_portone_checkout_sessions()
    session_id = f"portone_{uuid.uuid4().hex}"
    payment_id = f"mallog24_{uuid.uuid4().hex[:26]}"
    now_ts = time.time()

    order_name = PAID_PLAN_PRODUCT_NAME_EN if locale == "en" else PAID_PLAN_PRODUCT_NAME_KO
    portone_checkout_sessions[session_id] = {
        "session_id": session_id,
        "payment_id": payment_id,
        "user_id": user_id,
        "email": email,
        "amount_krw": max(1, int(amount_krw)),
        "currency": "KRW",
        "order_name": order_name,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "locale": locale or "ko",
        "created_ts": now_ts,
    }

    checkout_url = _build_redirect_url_from_request(request, f"/api/billing/portone/checkout/{session_id}")
    return {
        "session_id": session_id,
        "payment_id": payment_id,
        "checkout_url": checkout_url,
        "expires_in_seconds": MOCK_CHECKOUT_SESSION_TTL_SECONDS,
    }


def _get_portone_checkout_session_or_raise(session_id: str) -> dict:
    _cleanup_expired_portone_checkout_sessions()
    session = portone_checkout_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="PortOne 결제 세션이 만료되었거나 존재하지 않습니다.")
    return session


def _normalize_portone_payment_payload(payload: dict | None) -> dict:
    source = payload or {}
    if not isinstance(source, dict):
        return {}
    if source.get("id") or source.get("status"):
        return source
    for key in ("payment", "data", "result"):
        candidate = source.get(key)
        if isinstance(candidate, dict) and (candidate.get("id") or candidate.get("status")):
            return candidate
    return {}


def _extract_portone_payment_status(payment: dict) -> str:
    return str((payment or {}).get("status") or "").strip().upper()


def _extract_portone_payment_currency(payment: dict) -> str:
    source = payment or {}
    direct = str(source.get("currency") or "").strip()
    if direct:
        return direct.upper()
    amount = source.get("amount")
    if isinstance(amount, dict):
        nested = str(amount.get("currency") or "").strip()
        if nested:
            return nested.upper()
    return ""


def _extract_portone_total_amount(payment: dict) -> int:
    source = payment or {}
    amount = source.get("amount")
    if isinstance(amount, dict):
        for key in ("total", "paid", "value"):
            resolved = _to_int_safe(amount.get(key), default=0)
            if resolved > 0:
                return resolved
    for key in ("totalAmount", "amount", "paidAmount"):
        resolved = _to_int_safe(source.get(key), default=0)
        if resolved > 0:
            return resolved
    return 0


def _extract_portone_customer_reference(payment: dict) -> str:
    source = payment or {}
    customer = source.get("customer")
    if isinstance(customer, dict):
        for key in ("id", "customerId", "email", "name"):
            value = str(customer.get(key) or "").strip()
            if value:
                return value
    for key in ("customerId", "customer_id", "customerEmail", "email"):
        value = str(source.get(key) or "").strip()
        if value:
            return value
    return ""


async def _fetch_portone_payment_by_id(payment_id: str) -> dict:
    normalized_payment_id = str(payment_id or "").strip()
    if not normalized_payment_id:
        raise HTTPException(status_code=400, detail="payment_id 값이 필요합니다.")
    if not PORTONE_API_SECRET:
        raise HTTPException(status_code=503, detail="PORTONE_API_SECRET 설정이 필요합니다.")

    endpoint = f"{PORTONE_API_BASE_URL}/payments/{urllib.parse.quote(normalized_payment_id)}"
    headers_candidates = [
        {"Authorization": f"PortOne {PORTONE_API_SECRET}"},
        {"Authorization": f"Bearer {PORTONE_API_SECRET}"},
    ]
    last_error_message = ""
    for headers in headers_candidates:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(endpoint, headers=headers)
        except Exception as e:
            last_error_message = str(e)
            continue

        if response.status_code in {401, 403}:
            last_error_message = f"unauthorized({response.status_code})"
            continue
        if response.status_code >= 400:
            body_text = (response.text or "").strip()
            detail_text = body_text[:200] if body_text else f"status={response.status_code}"
            raise HTTPException(status_code=502, detail=f"PortOne 결제 조회 실패: {detail_text}")

        try:
            payload = response.json()
        except Exception:
            raise HTTPException(status_code=502, detail="PortOne 결제 조회 응답(JSON)을 해석할 수 없습니다.")

        payment = _normalize_portone_payment_payload(payload)
        if not payment:
            raise HTTPException(status_code=502, detail="PortOne 결제 조회 응답에 유효한 결제 정보가 없습니다.")
        return payment

    raise HTTPException(
        status_code=502,
        detail=f"PortOne 결제 조회 인증에 실패했습니다. api_secret 또는 권한을 확인하세요. ({last_error_message or 'unauthorized'})",
    )


def _cleanup_expired_mock_checkout_sessions() -> None:
    now_ts = time.time()
    expired_ids = []
    for session_id, session in mock_checkout_sessions.items():
        created_ts = float(session.get("created_ts") or 0.0)
        if created_ts <= 0:
            expired_ids.append(session_id)
            continue
        if now_ts - created_ts > MOCK_CHECKOUT_SESSION_TTL_SECONDS:
            expired_ids.append(session_id)

    for session_id in expired_ids:
        mock_checkout_sessions.pop(session_id, None)


def _create_mock_checkout_session(
    user_id: str,
    email: str,
    provider: str,
    success_url: str,
    cancel_url: str,
    locale: str,
    request: Request,
) -> dict:
    _cleanup_expired_mock_checkout_sessions()
    session_id = f"mock_{uuid.uuid4().hex}"
    now_ts = time.time()

    mock_checkout_sessions[session_id] = {
        "session_id": session_id,
        "user_id": user_id,
        "email": email,
        "provider": provider,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "locale": locale or "ko",
        "created_ts": now_ts,
    }

    checkout_url = _build_redirect_url_from_request(request, f"/api/billing/mock/checkout/{session_id}")
    return {
        "session_id": session_id,
        "checkout_url": checkout_url,
        "expires_in_seconds": MOCK_CHECKOUT_SESSION_TTL_SECONDS,
    }


def _get_mock_checkout_session_or_raise(session_id: str) -> dict:
    _cleanup_expired_mock_checkout_sessions()
    session = mock_checkout_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="테스트 결제 세션이 만료되었거나 존재하지 않습니다.")
    return session


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


def _upsert_transcription_state(task_id: str, user_id: str, patch: dict) -> None:
    """transcriptions 상태를 안전하게 갱신/생성한다."""
    if not patch:
        return

    payload = dict(patch)
    payload.pop("task_id", None)
    payload.pop("user_id", None)
    if not payload:
        return

    try:
        client = _get_supabase_client()
        existing = (
            client.table("transcriptions")
            .select("task_id")
            .eq("task_id", task_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            (
                client.table("transcriptions")
                .update(payload)
                .eq("task_id", task_id)
                .eq("user_id", user_id)
                .execute()
            )
            return

        insert_payload = {
            "task_id": task_id,
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "status": "queued",
            "raw_text": "",
            "corrected_text": "",
            "characters": 0,
            "darakbang_optimized": False,
            **payload,
        }
        client.table("transcriptions").insert(insert_payload).execute()
    except Exception as e:
        print(f"Failed to upsert transcription state ({task_id}): {e}")


def _usage_now() -> datetime:
    try:
        return datetime.now(ZoneInfo(USAGE_TIMEZONE))
    except ZoneInfoNotFoundError:
        return datetime.utcnow()


def _current_usage_month_start() -> str:
    now = _usage_now()
    return f"{now.year:04d}-{now.month:02d}-01"


def _ensure_user_usage_scope_ready() -> None:
    global USAGE_SCOPE_VALIDATED
    if USAGE_SCOPE_VALIDATED:
        return

    try:
        _get_supabase_client().table(USAGE_TABLE_NAME).select("user_id").limit(1).execute()
        USAGE_SCOPE_VALIDATED = True
    except Exception as e:
        error_text = str(e).lower()
        if (
            USAGE_TABLE_NAME in error_text
            and (
                "does not exist" in error_text
                or "relation" in error_text
                or "schema cache" in error_text
                or "could not find the table" in error_text
                or "pgrst205" in error_text
            )
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Supabase 설정 필요: backend/sql/user_usage_quota.sql 을 실행한 뒤 "
                    "SQL Editor에서 `NOTIFY pgrst, 'reload schema';` 를 실행하세요."
                ),
            )
        raise


def _ensure_billing_scope_ready() -> None:
    global BILLING_SCOPE_VALIDATED
    if BILLING_SCOPE_VALIDATED:
        return

    try:
        _get_supabase_client().table(BILLING_TABLE_NAME).select("user_id").limit(1).execute()
        BILLING_SCOPE_VALIDATED = True
    except Exception as e:
        error_text = str(e).lower()
        if (
            BILLING_TABLE_NAME in error_text
            and (
                "does not exist" in error_text
                or "relation" in error_text
                or "schema cache" in error_text
                or "could not find the table" in error_text
                or "pgrst205" in error_text
            )
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Supabase 설정 필요: backend/sql/billing_subscriptions.sql 을 실행한 뒤 "
                    "SQL Editor에서 `NOTIFY pgrst, 'reload schema';` 를 실행하세요."
                ),
            )
        raise


def _ensure_billing_refund_scope_ready() -> None:
    global BILLING_REFUND_SCOPE_VALIDATED
    if BILLING_REFUND_SCOPE_VALIDATED:
        return

    try:
        _get_supabase_client().table(BILLING_REFUND_TABLE_NAME).select("id").limit(1).execute()
        BILLING_REFUND_SCOPE_VALIDATED = True
    except Exception as e:
        error_text = str(e).lower()
        if (
            BILLING_REFUND_TABLE_NAME in error_text
            and (
                "does not exist" in error_text
                or "relation" in error_text
                or "schema cache" in error_text
                or "could not find the table" in error_text
                or "pgrst205" in error_text
            )
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Supabase 설정 필요: backend/sql/billing_refund_requests.sql 을 실행한 뒤 "
                    "SQL Editor에서 `NOTIFY pgrst, 'reload schema';` 를 실행하세요."
                ),
            )
        raise


def _normalize_billing_row(row: dict, user_id: str | None = None) -> dict:
    return {
        "user_id": row.get("user_id") or user_id,
        "provider": str(row.get("provider") or "portone"),
        "customer_id": row.get("customer_id") or "",
        "subscription_id": row.get("subscription_id") or "",
        "price_id": row.get("price_id") or "",
        "status": str(row.get("status") or "inactive"),
        "plan_tier": str(row.get("plan_tier") or USAGE_FREE_PLAN),
        "current_period_end": row.get("current_period_end"),
        "cancel_at_period_end": bool(row.get("cancel_at_period_end") or False),
        "checkout_completed_at": row.get("checkout_completed_at"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _parse_iso_datetime(value: str | None) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    normalized = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo:
            return parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except Exception:
        return None


def _resolve_billing_reference_datetime(row: dict | None) -> datetime | None:
    row_data = row or {}
    return (
        _parse_iso_datetime(row_data.get("checkout_completed_at"))
        or _parse_iso_datetime(row_data.get("created_at"))
    )


def _has_task_exceeded_timeout(created_at_value: str | None) -> bool:
    created_dt = _parse_iso_datetime(created_at_value)
    if not created_dt:
        return False
    return (datetime.utcnow() - created_dt) > timedelta(seconds=TASK_STUCK_TIMEOUT_SECONDS)


def _is_refund_window_open(row: dict | None) -> bool:
    reference_dt = _resolve_billing_reference_datetime(row)
    if not reference_dt:
        return False
    return (datetime.utcnow() - reference_dt) <= timedelta(days=BILLING_REFUND_WINDOW_DAYS)


def _insert_refund_request(
    *,
    user_id: str,
    provider: str,
    subscription_id: str = "",
    payment_reference: str = "",
    reason: str = "",
    status: str = "requested",
    decision_note: str = "",
    refund_id: str = "",
    metadata: dict | None = None,
) -> dict | None:
    _ensure_billing_refund_scope_ready()

    payload = {
        "user_id": user_id,
        "provider": provider,
        "subscription_id": subscription_id or None,
        "payment_reference": payment_reference or None,
        "request_reason": (reason or "").strip()[:500] or None,
        "status": status,
        "decision_note": (decision_note or "").strip()[:1000] or None,
        "refund_id": refund_id or None,
        "metadata": metadata or {},
        "processed_at": datetime.utcnow().isoformat()
        if status in {"refunded", "rejected", "failed"}
        else None,
        "updated_at": datetime.utcnow().isoformat(),
    }
    response = _get_supabase_client().table(BILLING_REFUND_TABLE_NAME).insert(payload).execute()
    if response.data:
        return response.data[0]
    return None


def _fetch_billing_row_by_user_id(user_id: str) -> dict | None:
    response = (
        _get_supabase_client().table(BILLING_TABLE_NAME)
        .select(
            "user_id, provider, customer_id, subscription_id, price_id, status, plan_tier, "
            "current_period_end, cancel_at_period_end, checkout_completed_at, created_at, updated_at"
        )
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def _fetch_billing_row_by_subscription_id(subscription_id: str) -> dict | None:
    if not subscription_id:
        return None
    response = (
        _get_supabase_client().table(BILLING_TABLE_NAME)
        .select(
            "user_id, provider, customer_id, subscription_id, price_id, status, plan_tier, "
            "current_period_end, cancel_at_period_end, checkout_completed_at, created_at, updated_at"
        )
        .eq("subscription_id", subscription_id)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def _fetch_billing_row_by_customer_id(customer_id: str) -> dict | None:
    if not customer_id:
        return None
    response = (
        _get_supabase_client().table(BILLING_TABLE_NAME)
        .select(
            "user_id, provider, customer_id, subscription_id, price_id, status, plan_tier, "
            "current_period_end, cancel_at_period_end, checkout_completed_at, created_at, updated_at"
        )
        .eq("customer_id", customer_id)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def _upsert_billing_row(user_id: str, patch: dict) -> dict:
    _ensure_billing_scope_ready()
    payload = {
        "user_id": user_id,
        "provider": _get_billing_provider_or_raise(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    payload.update(patch or {})

    response = (
        _get_supabase_client().table(BILLING_TABLE_NAME)
        .upsert(payload, on_conflict="user_id")
        .execute()
    )
    if response.data:
        return response.data[0]

    fresh = _fetch_billing_row_by_user_id(user_id)
    if fresh:
        return fresh
    raise HTTPException(status_code=500, detail="결제 구독 상태를 저장하지 못했습니다.")


def _to_iso_datetime_from_unix(unix_ts: int | float | None) -> str | None:
    if not unix_ts:
        return None
    try:
        return datetime.utcfromtimestamp(int(unix_ts)).isoformat()
    except Exception:
        return None


def _to_bool_from_payload(value, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "t", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "f", "no", "n", "off"}:
        return False
    return default


def _extract_stripe_charge_id(invoice_obj: dict | None) -> str:
    invoice = invoice_obj or {}
    charge = invoice.get("charge")
    if isinstance(charge, dict):
        return str(charge.get("id") or "")
    return str(charge or "")


def _resolve_latest_paid_invoice_and_charge(
    subscription_id: str,
    customer_id: str,
) -> tuple[str, str, int]:
    try:
        if subscription_id:
            invoices = stripe.Invoice.list(subscription=subscription_id, limit=10)
        elif customer_id:
            invoices = stripe.Invoice.list(customer=customer_id, limit=10)
        else:
            return "", "", 0
    except Exception:
        return "", "", 0

    for invoice in (invoices.data or []):
        if not bool(invoice.get("paid")):
            continue
        charge_id = _extract_stripe_charge_id(invoice)
        if not charge_id:
            continue
        invoice_id = str(invoice.get("id") or "")
        amount_paid = int(invoice.get("amount_paid") or 0)
        return charge_id, invoice_id, amount_paid

    return "", "", 0


def _extract_primary_price_id(subscription_obj: dict) -> str:
    try:
        items = (subscription_obj or {}).get("items", {}).get("data", [])
        if not items:
            return ""
        return str(items[0].get("price", {}).get("id") or "")
    except Exception:
        return ""


def _resolve_plan_tier_from_subscription_status(status: str | None) -> str:
    normalized = (status or "").strip().lower()
    if normalized in STRIPE_ACTIVE_SUBSCRIPTION_STATUSES:
        return PAID_PLAN_TIER
    return USAGE_FREE_PLAN


def _is_admin_bypass_user(user: dict | None = None, user_id: str | None = None, email: str | None = None) -> bool:
    resolved_user_id = (user_id or (user or {}).get("id") or "").strip().lower()
    resolved_email = (email or (user or {}).get("email") or "").strip().lower()
    if resolved_user_id and resolved_user_id in ADMIN_BYPASS_USER_IDS:
        return True
    if resolved_email and resolved_email in ADMIN_BYPASS_EMAILS:
        return True
    return False


def _set_user_plan_tier(user_id: str, plan_tier: str) -> None:
    safe_plan = (plan_tier or USAGE_FREE_PLAN).strip().lower() or USAGE_FREE_PLAN
    row = _get_or_create_usage_row(user_id)
    if row["plan_tier"] == safe_plan:
        return
    _get_supabase_client().table(USAGE_TABLE_NAME).update({
        "plan_tier": safe_plan,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("user_id", user_id).execute()


def _resolve_or_create_stripe_customer(user: dict) -> str:
    _require_stripe_billing_enabled()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="사용자 정보가 유효하지 않습니다.")

    billing_row = _fetch_billing_row_by_user_id(user_id)
    existing_customer_id = (billing_row or {}).get("customer_id")
    if existing_customer_id:
        return existing_customer_id

    email = (user.get("email") or "").strip().lower()
    if email:
        try:
            customers = stripe.Customer.list(email=email, limit=1)
            if customers and customers.data:
                return customers.data[0].id
        except Exception:
            pass

    metadata = {"user_id": user_id, "app": "mallog24"}
    created = stripe.Customer.create(
        email=email or None,
        metadata=metadata,
    )
    return created.id


def _build_billing_status_payload(user: dict) -> dict:
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="사용자 정보가 유효하지 않습니다.")

    provider = _get_billing_provider_or_raise()
    checkout_mode = _get_checkout_mode(provider)
    checkout_supported = checkout_mode != "disabled"
    portal_supported = provider == "stripe" and checkout_mode == "live"

    usage_row = _get_or_create_usage_row(user_id)
    usage_snapshot = _build_usage_snapshot(
        usage_row,
        is_admin_bypass=_is_admin_bypass_user(user=user),
    )
    billing_row = _fetch_billing_row_by_user_id(user_id)
    normalized_billing = _normalize_billing_row(billing_row or {}, user_id=user_id)
    normalized_billing["provider"] = provider
    normalized_billing["payment_enabled"] = checkout_supported
    normalized_billing["checkout_mode"] = checkout_mode
    normalized_billing["checkout_supported"] = checkout_supported
    normalized_billing["portal_supported"] = portal_supported
    normalized_billing["usage"] = usage_snapshot
    normalized_billing["can_manage_subscription"] = bool(portal_supported and normalized_billing["customer_id"])
    return normalized_billing


def _normalize_usage_row(row: dict, user_id: str) -> dict:
    used_seconds = int(row.get("used_audio_seconds") or 0)
    used_seconds = max(0, used_seconds)
    plan_tier = str(row.get("plan_tier") or USAGE_FREE_PLAN).strip().lower() or USAGE_FREE_PLAN
    usage_month = str(row.get("usage_month") or _current_usage_month_start())[:10]

    return {
        "user_id": user_id,
        "plan_tier": plan_tier,
        "used_audio_seconds": used_seconds,
        "usage_month": usage_month,
    }


def _fetch_usage_row(user_id: str) -> dict | None:
    response = (
        _get_supabase_client().table(USAGE_TABLE_NAME)
        .select("user_id, plan_tier, used_audio_seconds, usage_month")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def _create_usage_row(user_id: str) -> None:
    current_month = _current_usage_month_start()
    try:
        _get_supabase_client().table(USAGE_TABLE_NAME).insert({
            "user_id": user_id,
            "plan_tier": USAGE_FREE_PLAN,
            "used_audio_seconds": 0,
            "usage_month": current_month,
            "updated_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception as e:
        # Concurrent inserts may race. Read-after-write resolves this safely.
        if "duplicate key" not in str(e).lower():
            raise


def _get_or_create_usage_row(user_id: str) -> dict:
    _ensure_user_usage_scope_ready()

    row = _fetch_usage_row(user_id)
    if not row:
        _create_usage_row(user_id)
        row = _fetch_usage_row(user_id)
        if not row:
            raise HTTPException(status_code=500, detail="사용량 정보를 생성하지 못했습니다.")

    normalized = _normalize_usage_row(row, user_id)
    current_month = _current_usage_month_start()

    if normalized["usage_month"] != current_month:
        response = (
            _get_supabase_client().table(USAGE_TABLE_NAME)
            .update({
                "used_audio_seconds": 0,
                "usage_month": current_month,
                "updated_at": datetime.utcnow().isoformat(),
            })
            .eq("user_id", user_id)
            .execute()
        )
        updated = response.data[0] if response.data else {
            **normalized,
            "used_audio_seconds": 0,
            "usage_month": current_month,
        }
        normalized = _normalize_usage_row(updated, user_id)

    return normalized


def _build_usage_snapshot(row: dict, is_admin_bypass: bool = False) -> dict:
    plan_tier = row["plan_tier"]
    used_seconds = int(row["used_audio_seconds"])

    if is_admin_bypass:
        return {
            "plan_tier": USAGE_ADMIN_PLAN,
            "used_audio_seconds": used_seconds,
            "monthly_limit_seconds": None,
            "remaining_seconds": None,
            "usage_percent": 0.0,
            "usage_month": row["usage_month"],
            "can_upload": True,
            "is_admin_bypass": True,
        }

    if plan_tier == USAGE_FREE_PLAN:
        limit_seconds = FREE_MONTHLY_LIMIT_SECONDS
        remaining_seconds = max(0, limit_seconds - used_seconds)
        usage_percent = min(100.0, round((used_seconds / limit_seconds) * 100, 2))
        return {
            "plan_tier": plan_tier,
            "used_audio_seconds": used_seconds,
            "monthly_limit_seconds": limit_seconds,
            "remaining_seconds": remaining_seconds,
            "usage_percent": usage_percent,
            "usage_month": row["usage_month"],
            "can_upload": remaining_seconds > 0,
            "is_admin_bypass": False,
        }

    return {
        "plan_tier": plan_tier,
        "used_audio_seconds": used_seconds,
        "monthly_limit_seconds": None,
        "remaining_seconds": None,
        "usage_percent": 0.0,
        "usage_month": row["usage_month"],
        "can_upload": True,
        "is_admin_bypass": False,
    }


def _enforce_upload_quota_or_raise(user: dict, upload_audio_seconds: int) -> dict:
    if upload_audio_seconds <= 0:
        raise HTTPException(status_code=400, detail="오디오 길이를 확인할 수 없습니다.")

    user_id = user["id"]
    row = _get_or_create_usage_row(user_id)
    snapshot = _build_usage_snapshot(
        row,
        is_admin_bypass=_is_admin_bypass_user(user=user),
    )

    if snapshot["plan_tier"] == USAGE_FREE_PLAN:
        projected = int(snapshot["used_audio_seconds"]) + upload_audio_seconds
        if projected > FREE_MONTHLY_LIMIT_SECONDS:
            raise HTTPException(status_code=403, detail=FREE_LIMIT_EXCEEDED_MESSAGE)

    return snapshot


def _increment_user_usage_seconds(user_id: str, upload_audio_seconds: int) -> None:
    if upload_audio_seconds <= 0:
        return

    row = _get_or_create_usage_row(user_id)
    next_used = int(row["used_audio_seconds"]) + upload_audio_seconds

    _get_supabase_client().table(USAGE_TABLE_NAME).update({
        "used_audio_seconds": next_used,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("user_id", user_id).execute()


def _extract_audio_duration_seconds(file_path: str) -> int:
    duration_seconds = 0.0

    if MutagenFile is not None:
        try:
            parsed = MutagenFile(file_path)
            info = getattr(parsed, "info", None)
            parsed_length = getattr(info, "length", 0) if info else 0
            if parsed_length:
                duration_seconds = float(parsed_length)
        except Exception:
            pass

    if duration_seconds <= 0:
        try:
            with wave.open(file_path, "rb") as wav_file:
                frames = wav_file.getnframes()
                frame_rate = wav_file.getframerate()
                if frames > 0 and frame_rate > 0:
                    duration_seconds = frames / float(frame_rate)
        except Exception:
            pass

    if duration_seconds <= 0:
        duration_seconds = _extract_duration_with_ffprobe(file_path)

    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="오디오 길이를 확인할 수 없는 파일입니다.")

    return max(1, int(math.ceil(duration_seconds)))


def _extract_duration_with_ffprobe(file_path: str) -> float:
    if not shutil.which("ffprobe"):
        return 0.0
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                file_path,
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=FFPROBE_PROCESS_TIMEOUT_SECONDS,
        )
        raw = (proc.stdout or "").strip()
        if not raw:
            return 0.0
        return max(0.0, float(raw))
    except Exception:
        return 0.0


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


def _contains_context_hint(text: str, hints: tuple[str, ...]) -> bool:
    normalized = (text or "").lower()
    if not normalized:
        return False
    return any(hint in normalized for hint in hints)


def _count_detected_speakers(text: str) -> int:
    speaker_keys: set[str] = set()
    for line in (text or "").splitlines():
        parsed = _parse_speaker_line(line)
        if not parsed:
            continue
        speaker_id = str(parsed.get("speaker_id") or "").strip().upper()
        speaker_alias = str(parsed.get("speaker_alias") or "").strip().lower()
        if speaker_id:
            speaker_keys.add(f"id:{speaker_id}")
        elif speaker_alias:
            speaker_keys.add(f"alias:{speaker_alias}")
    return len(speaker_keys)


def _infer_content_style(
    text: str,
    transcription_type: str = "conversation",
    language: str = "ko",
) -> str:
    normalized_type = (transcription_type or "conversation").strip().lower()
    if normalized_type not in ALLOWED_TRANSCRIPTION_TYPES:
        normalized_type = "conversation"
    normalized_text = text or ""
    speaker_count = _count_detected_speakers(normalized_text)
    lower_text = normalized_text.lower()

    if normalized_type == "phonecall":
        return "phonecall"

    if speaker_count <= 1:
        if _contains_context_hint(lower_text, SERMON_CONTEXT_HINTS):
            return "sermon"
        if _contains_context_hint(lower_text, LECTURE_CONTEXT_HINTS):
            return "lecture"
        return "sermon" if normalized_type == "sermon" else "lecture"

    if _contains_context_hint(lower_text, DEBATE_CONTEXT_HINTS):
        return "debate"
    if _contains_context_hint(lower_text, FORUM_CONTEXT_HINTS):
        return "forum"
    return "meeting"


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


def _layout_line_role(line: str) -> str:
    stripped = (line or "").strip()
    if not stripped:
        return "blank"
    if _parse_speaker_line(stripped):
        return "speaker"
    if stripped in STRUCTURED_SUMMARY_HEADERS or stripped in {"서론", "본론", "결론", "기도"}:
        return "heading"
    if re.match(r"^(?:[-*•]|(?:\d+)[\.\)])\s+", stripped):
        return "list"
    return "text"


def _normalize_transcript_line_breaks(text: str) -> str:
    """
    STT/LLM 출력에서 발생하는 과도한 소프트 줄바꿈을 정리한다.
    - 문장 중간 개행은 병합
    - 화자 라벨/섹션 헤더/목록 개행은 유지
    """
    if not text:
        return text

    normalized_source = text.replace("\r\n", "\n").replace("\r", "\n")
    output_lines: list[str] = []

    for raw_line in normalized_source.split("\n"):
        line = raw_line.strip()
        if not line:
            if output_lines and output_lines[-1] != "":
                output_lines.append("")
            continue

        current_role = _layout_line_role(line)
        if not output_lines:
            output_lines.append(line)
            continue
        if output_lines[-1] == "":
            output_lines.append(line)
            continue

        previous = output_lines[-1]
        previous_role = _layout_line_role(previous)

        # 새 블록 시작(화자/헤더/목록)은 개행 유지
        if current_role in {"speaker", "heading", "list"}:
            output_lines.append(line)
            continue

        # 헤더 다음 첫 줄은 문단 시작으로 유지
        if previous_role == "heading":
            output_lines.append(line)
            continue

        # 일반 텍스트/목록 이어쓰기/화자 라벨 뒤 줄바꿈은 병합
        output_lines[-1] = f"{previous} {line}".strip()

    while output_lines and output_lines[-1] == "":
        output_lines.pop()

    cleaned = "\n".join(output_lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned

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


def split_audio_file(file_path: str, transcription_type: str = "sermon") -> list[tuple[str, float]]:
    """
    Whisper 전처리 + 청크 분할 (메모리 최적화 버전).
    ffmpeg/ffprobe 기반으로 디스크 처리하여 대용량 오디오에서도
    Python 프로세스 메모리 사용량을 최소화한다.
    반환값: [(chunk_path, duration_sec), ...]
    """
    ffmpeg_bin = shutil.which("ffmpeg")
    ffprobe_bin = shutil.which("ffprobe")
    if not ffmpeg_bin or not ffprobe_bin:
        print("ffmpeg/ffprobe not found. Falling back to original file without preprocessing.")
        return [(file_path, _extract_duration_with_ffprobe(file_path))]

    # 1) Whisper 업로드용 저용량 mp3로 전처리
    prepared_path = f"{file_path}_whisper.mp3"
    highpass_freq = "100" if transcription_type == "sermon" else "80"
    filter_expr = f"highpass=f={highpass_freq},lowpass=f=7600"

    try:
        subprocess.run(
            [
                ffmpeg_bin,
                "-y",
                "-i",
                file_path,
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-af",
                filter_expr,
                "-b:a",
                "32k",
                prepared_path,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
            timeout=FFMPEG_PROCESS_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        print(f"ffmpeg preprocessing failed, using original file: {exc}")
        return [(file_path, _extract_duration_with_ffprobe(file_path))]

    prepared_size = os.path.getsize(prepared_path) if os.path.exists(prepared_path) else 0
    prepared_duration = _extract_duration_with_ffprobe(prepared_path)
    if prepared_size <= WHISPER_MAX_SIZE:
        return [(prepared_path, prepared_duration)]

    # 2) 8분 단위로 분할 (복사 기반 분할로 메모리 절약)
    chunk_pattern = f"{prepared_path}_chunk_%03d.mp3"
    try:
        subprocess.run(
            [
                ffmpeg_bin,
                "-y",
                "-i",
                prepared_path,
                "-f",
                "segment",
                "-segment_time",
                "480",
                "-reset_timestamps",
                "1",
                "-c",
                "copy",
                chunk_pattern,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
            timeout=FFMPEG_PROCESS_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        print(f"ffmpeg segmentation failed, using prepared file: {exc}")
        return [(prepared_path, prepared_duration)]

    chunk_paths = sorted(
        str(path_obj)
        for path_obj in pathlib.Path(prepared_path).parent.glob(f"{pathlib.Path(prepared_path).name}_chunk_*.mp3")
        if path_obj.is_file()
    )
    if not chunk_paths:
        return [(prepared_path, prepared_duration)]

    # 분할 성공 시 중간 파일 삭제
    try:
        os.unlink(prepared_path)
    except Exception:
        pass

    chunks: list[tuple[str, float]] = []
    for chunk_path in chunk_paths:
        chunk_size = os.path.getsize(chunk_path)
        if chunk_size > WHISPER_MAX_SIZE:
            # 극단 케이스: 여전히 제한 초과면 안전하게 단일 파일 폴백
            print(f"Chunk still exceeds Whisper limit ({chunk_path}). Falling back to original file.")
            for created in chunk_paths:
                try:
                    os.unlink(created)
                except Exception:
                    pass
            return [(file_path, _extract_duration_with_ffprobe(file_path))]

        chunk_duration = _extract_duration_with_ffprobe(chunk_path)
        chunks.append((chunk_path, chunk_duration))

    return chunks


def whisper_transcribe(
    file_path: str,
    language: str = "ko",
    transcription_type: str = "sermon",
    task_id: str | None = None,
) -> str:
    """
    OpenAI Whisper API로 오디오 → 텍스트 변환.
    25MB 초과 시 자동 분할 처리 + 청크 재시도/타임아웃 보호.
    """
    if openai_client is None:
        raise RuntimeError("Whisper client is not configured.")

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
            whisper_prompt = "다락방, 렘넌트, 237, 5000종족, 7망대, 7여정, 7이정표, CVDIP, 류광수, 이주현, 드로아교회, 하베스터선교교회, 미션홈, 태중 미션홈, 기도수첩, HMC, HMIS, HMVS, RRTS, RVIS, RTS, RSTS, RVS, RPS, RLS, RGS, 앗수르, 네피림, 바벨탑, 앉은뱅이, 뉴에이지, 프리메이슨, REA, 알리(무하마드 알리, 알리익스프레스), TCK, CCK, NCK, 성회, 전도대회, 수련회, 수련의, 노회, 노예, 유초등부, 유초동부, 교역자, 교육자, 부교역자, 부교육자, 신방, 심방, 쉬고와, 기도, 보좌화, 생활화, 개인화, 제자화, 세계화, Heavenly, Thronely, Eternally, 록펠러, 카네기, 워너메이커, 존 워너메이커, 쉬버, 마틴 루터, 올해(연도), 오래(기간), 결재(승인), 결제(지불), 낫다(회복), 낳다(출산), 낮다(높이 반대), 안/않, 되/돼, 웬/왠지, 드로에게 교회/드로우게 교회=드로아교회, 베드로에게는(조사)=유지, 알리/REA 문맥 구분(일반 인명·브랜드는 알리 유지, 약어 맥락에서만 REA), 수련의/수련회 문맥 구분(의료 인력 vs 교회 집회), 노회/노예 문맥 구분(교단 회의 vs 일반 의미), 교역자/교육자 문맥 구분(목회·사역 맥락=교역자, 학교·수업 맥락=교육자), 부교역자/부교육자 문맥 구분(목회 보직 맥락=부교역자), 신방/심방 문맥 구분(교회 방문 사역 맥락=심방), 쉬고와/기도 문맥 구분(예배·마무리 안내 맥락=기도), 초고속 발화(120BPM+), 랩처럼 빠른 단독 화자, 음절 경계 복원, 조사/어미 유지"
        elif transcription_type == "phonecall":
            whisper_prompt = (
                "전화 통화 녹음입니다. 두 명의 화자가 대화합니다. "
                "음질이 낮거나 불명확한 부분은 문맥에 맞게 추정하고, 발음 그대로가 아닌 문맥상 올바른 단어를 우선 선택하세요. "
                "한 화자가 매우 빠르게(대략 120BPM 이상, 랩처럼) 말해도 음절 경계를 문맥으로 복원하고 누락 없이 기록하세요. "
                "'올해/오래, 결재/결제, 낫다/낳다/낮다, 안/않, 되/돼, 웬/왠(특히 왠지), 수련의/수련회, 노회/노예, 유초등부/유초동부, 교역자/교육자, 부교역자/부교육자, 신방/심방, 쉬고와/기도'는 문맥으로 구분하세요. "
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
                "'올해/오래, 결재/결제, 낫다/낳다/낮다, 안/않, 되/돼, 웬/왠(특히 왠지), 수련의/수련회, 노회/노예, 유초등부/유초동부, 교역자/교육자, 부교역자/부교육자, 신방/심방, 쉬고와/기도'는 문맥으로 구분하세요. "
                "고혈압, 당뇨병, 심근경색, 갑상선, 위염, 폐렴, 천식, 관절염, 디스크, 우울증, 불면증, "
                "뇌전증, 간질, 발작, 항경련제, 레비티라세탐, 카바마제핀, 발프로산, 라모트리진, "
                "타이레놀, 아세트아미노펜, 이부프로펜, 메트포르민, 아목시실린, 오메프라졸, 인슐린, "
                "혈압, 혈당, CT, MRI, EEG, 내시경, 혈액검사, 심전도, 처방, 복용, 부작용, 합병증, 앉은뱅이, "
                "KPI, ROI, OKR, 프로젝트, 마일스톤, 스프린트, 데드라인, 예산, 매출, 영업이익, "
                f"{KO_DAILY_CONTEXT_TERMS}, {KO_DOMAIN_CONTEXT_TERMS}"
            )

    chunks = split_audio_file(file_path, transcription_type)
    all_text: list[str] = []

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
        if task_id:
            _touch_task_runtime_state(task_id)

        best_text = ""
        last_error: Exception | None = None

        for attempt in range(WHISPER_CHUNK_MAX_RETRIES):
            use_rapid_hint = attempt > 0
            prompt_text = f"{whisper_prompt} {rapid_retry_prompt}" if use_rapid_hint else whisper_prompt
            try:
                with open(chunk_path, "rb") as audio_file:
                    response = openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language=language,
                        prompt=prompt_text,
                        response_format="text",
                        timeout=WHISPER_CHUNK_TIMEOUT_SECONDS,
                    )

                chunk_text = (response or "").strip()
                if chunk_text:
                    if len(chunk_text) > len(best_text):
                        best_text = chunk_text
                else:
                    raise RuntimeError("Whisper returned empty text.")

                if chunk_duration_sec >= 45 and len(chunk_text) < 25 and attempt < WHISPER_CHUNK_MAX_RETRIES - 1:
                    print(f"  Chunk {i+1}: sparse transcript detected, retrying with rapid-speech hint...")
                    continue

                last_error = None
                break
            except Exception as exc:
                last_error = exc
                if attempt < WHISPER_CHUNK_MAX_RETRIES - 1:
                    wait_time = (2 ** attempt) + random.uniform(0.2, 1.0)
                    print(
                        f"  Chunk {i+1}: whisper attempt {attempt+1}/{WHISPER_CHUNK_MAX_RETRIES} failed "
                        f"({exc}). Retrying in {wait_time:.1f}s..."
                    )
                    time.sleep(wait_time)
                else:
                    break
            finally:
                if task_id:
                    _touch_task_runtime_state(task_id)

        if not best_text and last_error:
            raise RuntimeError(
                f"Whisper chunk {i+1}/{len(chunks)} failed after {WHISPER_CHUNK_MAX_RETRIES} attempts: {last_error}"
            ) from last_error
        if not best_text:
            raise RuntimeError(f"Whisper chunk {i+1}/{len(chunks)} returned no transcript.")

        all_text.append(best_text)

        # 청크 파일 삭제 (원본 제외)
        if chunk_path != file_path:
            os.unlink(chunk_path)

    return "\n\n".join(all_text)


async def gemini_correct_and_structure(
    raw_text: str,
    task_id: str,
    transcription_type: str = "sermon",
    language: str = "ko",
    correction_mode: str = "normal",
) -> str:
    """
    Gemini로 텍스트 교정 + 구조화 (2단계).
    유형별 + 언어별 프롬프트 선택.
    """
    target_model = get_optimal_model()
    print(f"[{task_id}] Gemini correction model: {target_model}, type: {transcription_type}, lang: {language}")

    correction_prompt = get_correction_prompt_by_type(transcription_type, language)
    normalized_mode = (correction_mode or "normal").strip().lower()
    if normalized_mode != "strict":
        if language == "en":
            correction_prompt += (
                "\n\n[Over-correction Guard]\n"
                "- Prefer preserving the original wording and tone.\n"
                "- Do not replace terms unless confidence is high from context.\n"
                "- If uncertain, keep the original token as-is."
            )
        else:
            correction_prompt += (
                "\n\n[과교정 방지 규칙]\n"
                "- 원문 어휘와 표현을 최대한 유지하라.\n"
                "- 문맥 확신이 낮은 단어는 임의로 다른 고유명사/전문용어로 치환하지 마라.\n"
                "- 확신이 없으면 원문 표기를 유지하라."
            )

    model = genai.GenerativeModel(
        target_model,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
        )
    )

    label = "Original Text" if language == "en" else "원본 텍스트"
    prompt_parts = [correction_prompt, f"[{label}]", raw_text]

    response = None
    max_retries = 5

    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                prompt_parts,
                request_options={"timeout": GEMINI_REQUEST_TIMEOUT_SECONDS}
            )
            break
        except Exception as e:
            if ("429" in str(e) or "ResourceExhausted" in str(e) or "quota" in str(e).lower()) and attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 10 + random.uniform(0, 5)
                print(f"[{task_id}] Quota exceeded (429). Retrying in {wait_time:.1f}s... (Attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_time)
            else:
                raise e

    return (response.text or "").strip()


def _is_retryable_gemini_error(error: Exception) -> bool:
    message = str(error).lower()
    retry_markers = (
        "429",
        "resourceexhausted",
        "quota",
        "timed out",
        "timeout",
        "deadline",
        "unavailable",
        "internal",
    )
    return any(marker in message for marker in retry_markers)


def _transcribe_with_gemini_only(
    *,
    task_id: str,
    temp_file_path: str,
    source_mime_type: str,
    transcription_type: str,
    language: str,
    correction_mode: str,
) -> tuple[str, str]:
    mime_type = source_mime_type or _resolve_audio_mime_type(temp_file_path)
    audio_file = genai.upload_file(temp_file_path, mime_type=mime_type)
    try:
        target_model = get_optimal_model()
        model = genai.GenerativeModel(
            target_model,
            system_instruction=get_gemini_prompt(),
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
            ),
        )
        content_prompt = get_gemini_content_prompt()

        response = None
        max_retries = 5
        for attempt in range(max_retries):
            try:
                _touch_task_runtime_state(task_id)
                response = model.generate_content(
                    [content_prompt, audio_file],
                    request_options={"timeout": GEMINI_REQUEST_TIMEOUT_SECONDS},
                )
                _touch_task_runtime_state(task_id)
                break
            except Exception as e:
                if _is_retryable_gemini_error(e) and attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 10 + random.uniform(0, 5)
                    print(
                        f"[{task_id}] Gemini-only retry in {wait_time:.1f}s "
                        f"(attempt {attempt+1}/{max_retries}): {e}"
                    )
                    time.sleep(wait_time)
                    continue
                raise

        raw_text = (response.text or "").strip()
        corrected_text = _postprocess_transcript(
            raw_text,
            transcription_type,
            language,
            correction_mode,
        )
        return raw_text, corrected_text
    finally:
        try:
            audio_file.delete()
        except Exception:
            pass


def _postprocess_transcript(
    text: str,
    transcription_type: str,
    language: str,
    correction_mode: str,
) -> str:
    normalized_mode = (correction_mode or "normal").strip().lower()
    if normalized_mode == "raw":
        return _normalize_transcript_line_breaks(text)

    corrected = correct_text(
        text,
        transcription_type,
        language,
        correction_mode=normalized_mode,
    )
    if normalized_mode == "strict":
        corrected = _enforce_speaker_separation(corrected, transcription_type, language)
    return _normalize_transcript_line_breaks(corrected)


def _process_transcription_sync(
    task_id: str,
    user_id: str,
    temp_file_path: str,
    language: str,
    correct: bool,
    transcription_type: str = "conversation",
    correction_mode: str = "normal",
    source_mime_type: str = "",
    audio_seconds: int = 0,
):
    """백그라운드 변환 로직: Whisper STT → Gemini 교정"""
    raw_text = ""
    corrected_text = ""
    engine = "gemini-only"
    try:
        _set_task_runtime_state(task_id, "processing", owner_id=user_id)
        _upsert_transcription_state(task_id, user_id, {
            "status": "processing",
            "language": language,
            "transcription_type": transcription_type,
        })
        _log_stage_memory(task_id, "start")

        use_whisper_pipeline = _should_use_whisper_pipeline()
        if (
            use_whisper_pipeline
            and WHISPER_MAX_PIPELINE_AUDIO_SECONDS > 0
            and audio_seconds > WHISPER_MAX_PIPELINE_AUDIO_SECONDS
        ):
            use_whisper_pipeline = False
            print(
                f"[{task_id}] Skip Whisper for long audio "
                f"({audio_seconds}s > {WHISPER_MAX_PIPELINE_AUDIO_SECONDS}s); using Gemini-only."
            )

        if use_whisper_pipeline:
            # ===== 2단계 방식: Whisper + Gemini =====
            engine = "whisper+gemini"
            try:
                # 1단계: Whisper로 완전 녹취
                print(f"[{task_id}] Step 1: Whisper STT...")
                raw_text = whisper_transcribe(
                    temp_file_path,
                    language,
                    transcription_type,
                    task_id=task_id,
                )
                print(f"[{task_id}] Whisper done. Raw length: {len(raw_text)} chars")
                _log_stage_memory(task_id, "after_whisper")

                # 임시 파일 삭제
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    temp_file_path = ""

                # 2단계: Gemini로 교정 + 구조화
                print(f"[{task_id}] Step 2: Gemini correction...")
                _touch_task_runtime_state(task_id)
                corrected_text = asyncio.run(
                    gemini_correct_and_structure(
                        raw_text,
                        task_id,
                        transcription_type,
                        language,
                        correction_mode=correction_mode,
                    )
                )
                _touch_task_runtime_state(task_id)
                print(f"[{task_id}] Gemini done. Corrected length: {len(corrected_text)} chars")
                _log_stage_memory(task_id, "after_gemini_correction")

                # 3단계: 규칙 기반 후처리
                corrected_text = _postprocess_transcript(
                    corrected_text,
                    transcription_type,
                    language,
                    correction_mode,
                )
                _log_stage_memory(task_id, "after_postprocess")
            except Exception as whisper_error:
                if not WHISPER_FALLBACK_TO_GEMINI_ON_ERROR:
                    raise
                print(
                    f"[{task_id}] Whisper pipeline failed, fallback to Gemini-only: {whisper_error}"
                )
                engine = "gemini-only-fallback"
                raw_text, corrected_text = _transcribe_with_gemini_only(
                    task_id=task_id,
                    temp_file_path=temp_file_path,
                    source_mime_type=source_mime_type,
                    transcription_type=transcription_type,
                    language=language,
                    correction_mode=correction_mode,
                )
                _log_stage_memory(task_id, "after_gemini_fallback")

        else:
            # ===== 폴백: Gemini 단일 방식 (기존) =====
            mode = _resolved_engine_mode()
            if openai_client is None:
                reason = "openai unavailable"
            elif WHISPER_MAX_PIPELINE_AUDIO_SECONDS > 0 and audio_seconds > WHISPER_MAX_PIPELINE_AUDIO_SECONDS:
                reason = "long audio guard"
            else:
                reason = "mode forced"
            print(f"[{task_id}] Gemini-only mode ({reason}, mode={mode})")
            engine = "gemini-only"

            raw_text, corrected_text = _transcribe_with_gemini_only(
                task_id=task_id,
                temp_file_path=temp_file_path,
                source_mime_type=source_mime_type,
                transcription_type=transcription_type,
                language=language,
                correction_mode=correction_mode,
            )
            _log_stage_memory(task_id, "after_postprocess")

        # 결과 저장
        created_at = datetime.now().isoformat()

        _upsert_transcription_state(task_id, user_id, {
            "status": "completed",
            "created_at": created_at,
            "language": language,
            "raw_text": raw_text,
            "corrected_text": corrected_text,
            "characters": len(corrected_text),
            "darakbang_optimized": transcription_type == "sermon",
            "engine": engine,
            "transcription_type": transcription_type,
            "error": None,
        })

        _increment_user_usage_seconds(user_id, audio_seconds)

        _clear_task_runtime_state(task_id)
        _log_stage_memory(task_id, "completed")

    except Exception as e:
        print(f"Transcription error: {e}")
        import traceback
        traceback.print_exc()
        _set_task_runtime_state(task_id, "error", owner_id=user_id)
        try:
            _upsert_transcription_state(task_id, user_id, {
                "status": "error",
                "error": str(e),
                "created_at": datetime.now().isoformat(),
                "language": language,
                "transcription_type": transcription_type,
            })
        except Exception as db_err:
            print(f"Failed to write error to Supabase: {db_err}")
        _log_stage_memory(task_id, "error")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass
        if FORCE_GC_AFTER_TRANSCRIPTION:
            gc.collect()
            _log_stage_memory(task_id, "after_gc")


async def process_transcription(
    task_id: str,
    user_id: str,
    temp_file_path: str,
    language: str,
    correct: bool,
    transcription_type: str = "conversation",
    correction_mode: str = "normal",
    source_mime_type: str = "",
    audio_seconds: int = 0,
):
    """이벤트 루프를 막지 않도록 변환 로직을 별도 스레드에서 실행한다."""
    async with transcription_semaphore:
        await asyncio.to_thread(
            _process_transcription_sync,
            task_id,
            user_id,
            temp_file_path,
            language,
            correct,
            transcription_type,
            correction_mode,
            source_mime_type,
            audio_seconds,
        )


@app.post("/api/transcribe")
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("ko"),
    correct: bool = Form(True),
    transcription_type: str = Form("conversation"),
    correction_mode: str = Form("normal"),
    authorization: str | None = Header(default=None),
):
    """음성 → 텍스트 변환 (Whisper + Gemini 2단계). 유형: sermon/phonecall/conversation"""
    temp_file_path = ""
    queued_for_processing = False
    try:
        # 파일 변환은 로그인 사용자만 허용
        _ensure_transcriptions_user_scope_ready()
        _ensure_user_usage_scope_ready()
        user = await _get_current_user(authorization)
        user_id = user["id"]

        normalized_language = (language or "ko").strip().lower()
        if normalized_language not in ALLOWED_LANGUAGES:
            raise HTTPException(status_code=400, detail="지원하지 않는 언어입니다. ko 또는 en만 가능합니다.")

        normalized_transcription_type = (transcription_type or "conversation").strip().lower()
        if normalized_transcription_type not in ALLOWED_TRANSCRIPTION_TYPES:
            raise HTTPException(status_code=400, detail="지원하지 않는 녹취 유형입니다.")
        normalized_correction_mode = (correction_mode or "normal").strip().lower()
        if normalized_correction_mode not in ALLOWED_CORRECTION_MODES:
            raise HTTPException(
                status_code=400,
                detail="지원하지 않는 교정 모드입니다. strict/normal/raw 중에서 선택하세요.",
            )

        max_size_mb = int(MAX_UPLOAD_BYTES / 1024 / 1024)
        file_signature = b""
        total_bytes = 0
        chunk_size = 1024 * 1024  # 1MB

        with tempfile.NamedTemporaryFile(delete=False, suffix=".upload") as temp_file:
            temp_file_path = temp_file.name
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=400, detail=f"파일 크기는 {max_size_mb}MB 이하")
                if len(file_signature) < 4096:
                    remain = 4096 - len(file_signature)
                    file_signature += chunk[:remain]
                temp_file.write(chunk)

        original_ext, source_mime_type = _validate_uploaded_audio_payload(file, file_signature)
        normalized_temp_path = f"{temp_file_path}{original_ext}"
        os.replace(temp_file_path, normalized_temp_path)
        temp_file_path = normalized_temp_path

        audio_seconds = _extract_audio_duration_seconds(temp_file_path)
        usage_snapshot = _enforce_upload_quota_or_raise(user, audio_seconds)

        task_id = str(uuid.uuid4())
        _set_task_runtime_state(task_id, "queued", owner_id=user_id)
        _upsert_transcription_state(task_id, user_id, {
            "status": "queued",
            "created_at": datetime.now().isoformat(),
            "language": normalized_language,
            "raw_text": "",
            "corrected_text": "",
            "characters": 0,
            "darakbang_optimized": normalized_transcription_type == "sermon",
            "engine": "whisper+gemini" if openai_client else "gemini-only",
            "transcription_type": normalized_transcription_type,
            "error": None,
        })

        background_tasks.add_task(
            process_transcription,
            task_id,
            user_id,
            temp_file_path,
            normalized_language,
            correct,
            normalized_transcription_type,
            normalized_correction_mode,
            source_mime_type,
            audio_seconds,
        )
        queued_for_processing = True

        type_labels = {"sermon": "설교 녹취", "phonecall": "통화 기록", "conversation": "대화/회의 기록"}

        return {
            "success": True,
            "task_id": task_id,
            "status": "queued",
            "message": f"{type_labels.get(normalized_transcription_type, '녹취')} 변환 작업이 시작되었습니다.",
            "engine": "whisper+gemini" if openai_client else "gemini-only",
            "transcription_type": normalized_transcription_type,
            "correction_mode": normalized_correction_mode,
            "audio_seconds": audio_seconds,
            "quota": usage_snapshot,
        }

    except HTTPException:
        if temp_file_path and (not queued_for_processing) and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        raise
    except Exception as e:
        if temp_file_path and (not queued_for_processing) and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        raise HTTPException(status_code=500, detail=f"오류: {str(e)}")


@app.get("/api/status/{task_id}")
async def get_task_status(
    task_id: str,
    authorization: str | None = Header(default=None),
):
    """작업 상태 조회"""
    _ensure_transcriptions_user_scope_ready()
    user = await _get_current_user(authorization)
    user_id = user["id"]
    _cleanup_stale_task_states()
    runtime_status: str | None = None

    if task_id in task_status:
        status = task_status[task_id]
        owner_id = task_owner.get(task_id)
        if owner_id is not None and owner_id != user_id:
            return {"task_id": task_id, "status": "not_found"}
        if status == "processing" or status == "queued":
            updated_ts = float(task_updated_at.get(task_id) or 0)
            if updated_ts and (time.time() - updated_ts) > TASK_STUCK_TIMEOUT_SECONDS:
                _clear_task_runtime_state(task_id)
                return {
                    "task_id": task_id,
                    "status": "error",
                    "error": TASK_STUCK_ERROR_MESSAGE,
                    "transcription_type": "conversation",
                }
            runtime_status = status

    response = (
        _get_supabase_client().table("transcriptions")
        .select("*")
        .eq("task_id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if response.data:
        row = response.data[0]
        row_status = str(row.get("status") or runtime_status or "")
        if row_status in {"queued", "processing"} and _has_task_exceeded_timeout(row.get("created_at")):
            _clear_task_runtime_state(task_id)
            _upsert_transcription_state(task_id, user_id, {
                "status": "error",
                "error": TASK_STUCK_ERROR_MESSAGE,
            })
            return {
                "task_id": row.get("task_id", task_id),
                "status": "error",
                "error": TASK_STUCK_ERROR_MESSAGE,
                "created_at": row.get("created_at"),
                "transcription_type": row.get("transcription_type", "conversation"),
            }

        if row_status == "completed":
            corrected_text = str(row.get("corrected_text") or "")
            raw_text = str(row.get("raw_text") or "")
            normalized_type = str(row.get("transcription_type") or "conversation")
            content_style = _infer_content_style(
                text=(corrected_text or raw_text),
                transcription_type=normalized_type,
                language=str(row.get("language") or "ko"),
            )
            return {
                "task_id": row["task_id"],
                "status": row_status,
                "created_at": row["created_at"],
                "language": row["language"],
                "raw_text": raw_text,
                "corrected_text": corrected_text,
                "characters": row["characters"],
                "darakbang_optimized": row["darakbang_optimized"],
                "engine": row["engine"],
                "transcription_type": normalized_type,
                "content_style": content_style,
            }
        else:
            return {
                "task_id": row["task_id"],
                "status": row_status,
                "error": row["error"],
                "created_at": row["created_at"],
                "transcription_type": row.get("transcription_type", "conversation"),
            }

    if runtime_status in {"queued", "processing"}:
        return {"task_id": task_id, "status": runtime_status}

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
    user = await _get_current_user(authorization)
    user_id = user["id"]

    response = (
        _get_supabase_client().table("transcriptions")
        .select("task_id, status, created_at, characters, engine, transcription_type")
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
            "summary_preview": "",
            "transcription_type": row.get("transcription_type", "conversation"),
        })

    return history


@app.get("/api/usage")
async def get_usage(authorization: str | None = Header(default=None)):
    """로그인 사용자 월간 음성 사용량 조회"""
    user = await _get_current_user(authorization)
    row = _get_or_create_usage_row(user["id"])
    snapshot = _build_usage_snapshot(
        row,
        is_admin_bypass=_is_admin_bypass_user(user=user),
    )
    return {
        "success": True,
        **snapshot,
    }


async def _read_optional_json_payload(request: Request) -> dict:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" not in content_type:
        return {}
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON 본문 형식이 올바르지 않습니다.")
    if payload is None:
        return {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON 본문은 객체 형식이어야 합니다.")
    return payload


@app.get("/api/billing/status")
async def get_billing_status(authorization: str | None = Header(default=None)):
    """로그인 사용자 구독/결제 상태 조회"""
    _ensure_user_usage_scope_ready()
    _ensure_billing_scope_ready()
    user = await _get_current_user(authorization)
    status = _build_billing_status_payload(user)
    return {
        "success": True,
        **status,
    }


@app.post("/api/billing/checkout")
async def create_checkout_session(
    request: Request,
    authorization: str | None = Header(default=None),
):
    """결제 체크아웃 세션 생성 (공급자별)"""
    _ensure_user_usage_scope_ready()
    _ensure_billing_scope_ready()
    user = await _get_current_user(authorization)
    payload = await _read_optional_json_payload(request)
    success_url, cancel_url = _resolve_checkout_redirect_urls(request, payload)
    billing_provider = _get_billing_provider_or_raise()
    checkout_mode = _get_checkout_mode(billing_provider)

    usage_row = _get_or_create_usage_row(user["id"])
    billing_row = _fetch_billing_row_by_user_id(user["id"])
    billing_status = str((billing_row or {}).get("status") or "").strip().lower()
    if billing_status in STRIPE_ACTIVE_SUBSCRIPTION_STATUSES:
        raise HTTPException(status_code=409, detail="이미 활성화된 구독이 있습니다. 구독 관리 페이지를 이용하세요.")
    if usage_row["plan_tier"] != USAGE_FREE_PLAN:
        raise HTTPException(status_code=409, detail="이미 유료 요금제를 사용 중입니다.")

    if checkout_mode == "disabled":
        raise HTTPException(
            status_code=503,
            detail=(
                f"{billing_provider} 결제 설정이 아직 완료되지 않았습니다. "
                "환경변수 또는 테스트 모드(BILLING_TEST_MODE=true)를 확인하세요."
            ),
        )

    if checkout_mode == "mock":
        mock_session = _create_mock_checkout_session(
            user_id=user["id"],
            email=(user.get("email") or "").strip().lower(),
            provider=billing_provider,
            success_url=success_url,
            cancel_url=cancel_url,
            locale=str(payload.get("locale") or "ko"),
            request=request,
        )

        _upsert_billing_row(
            user["id"],
            {
                "provider": billing_provider,
                "status": "checkout_pending",
                "plan_tier": usage_row["plan_tier"],
                "price_id": STRIPE_PRICE_ID_PRO or "",
            },
        )

        return {
            "success": True,
            "checkout_url": mock_session["checkout_url"],
            "session_id": mock_session["session_id"],
            "mode": "mock",
            "provider": billing_provider,
            "expires_in_seconds": mock_session["expires_in_seconds"],
        }

    if billing_provider == "portone":
        locale = str(payload.get("locale") or "ko").strip().lower()
        if locale not in {"ko", "en"}:
            locale = "ko"
        portone_session = _create_portone_checkout_session(
            user_id=user["id"],
            email=(user.get("email") or "").strip().lower(),
            success_url=success_url,
            cancel_url=cancel_url,
            locale=locale,
            amount_krw=PAID_PLAN_AMOUNT_KRW,
            request=request,
        )

        _upsert_billing_row(
            user["id"],
            {
                "provider": "portone",
                "status": "checkout_pending",
                "plan_tier": usage_row["plan_tier"],
                "price_id": f"portone_pro_{PAID_PLAN_AMOUNT_KRW}",
            },
        )

        return {
            "success": True,
            "checkout_url": portone_session["checkout_url"],
            "session_id": portone_session["session_id"],
            "payment_id": portone_session["payment_id"],
            "mode": "live",
            "provider": "portone",
            "amount_krw": PAID_PLAN_AMOUNT_KRW,
            "expires_in_seconds": portone_session["expires_in_seconds"],
        }

    if billing_provider != "stripe":
        raise HTTPException(
            status_code=501,
            detail=f"{billing_provider} 라이브 결제 연동은 아직 구현되지 않았습니다.",
        )

    _require_stripe_billing_enabled()

    customer_id = _resolve_or_create_stripe_customer(user)

    try:
        checkout_session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": STRIPE_PRICE_ID_PRO, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            allow_promotion_codes=True,
            metadata={
                "user_id": user["id"],
                "email": (user.get("email") or ""),
                "source": "mallog24-web",
            },
            subscription_data={
                "metadata": {
                    "user_id": user["id"],
                    "source": "mallog24-web",
                }
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"결제 세션 생성 실패: {str(e)}")

    _upsert_billing_row(
        user["id"],
        {
            "provider": "stripe",
            "customer_id": customer_id,
            "status": "checkout_pending",
            "price_id": STRIPE_PRICE_ID_PRO,
            "plan_tier": usage_row["plan_tier"],
        },
    )

    return {
        "success": True,
        "checkout_url": checkout_session.url,
        "session_id": checkout_session.id,
        "mode": "live",
        "provider": billing_provider,
    }


@app.get("/api/billing/mock/checkout/{session_id}", response_class=HTMLResponse)
async def render_mock_checkout_page(session_id: str):
    """테스트 결제 화면 (BILLING_TEST_MODE=true 전용)"""
    session = _get_mock_checkout_session_or_raise(session_id)
    locale = str(session.get("locale") or "ko").lower()
    is_en = locale == "en"
    title = "Mock Checkout" if is_en else "테스트 결제창"
    headline = "Test Payment Gateway" if is_en else "국내 PG 테스트 결제 화면"
    description = (
        "No real money will be charged. Choose success or cancel to test your flow."
        if is_en
        else "실제 결제는 발생하지 않습니다. 성공/취소를 눌러 결제 플로우를 확인하세요."
    )
    success_label = "Simulate Success" if is_en else "결제 성공 시뮬레이션"
    cancel_label = "Simulate Cancel" if is_en else "결제 취소 시뮬레이션"
    session_created = datetime.utcfromtimestamp(float(session.get("created_ts") or 0)).isoformat()

    html = f"""
    <!doctype html>
    <html lang="{ 'en' if is_en else 'ko' }">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style>
          body {{
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(140deg, #eef3ff 0%, #f6f0ff 100%);
            color: #1f2b47;
          }}
          .wrap {{
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }}
          .card {{
            width: 100%;
            max-width: 520px;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 20px 48px rgba(56, 85, 168, 0.14);
            padding: 24px;
          }}
          .title {{
            margin: 0 0 8px;
            font-size: 28px;
            font-weight: 800;
          }}
          .desc {{
            margin: 0 0 18px;
            font-size: 14px;
            color: #56648b;
            line-height: 1.6;
          }}
          .meta {{
            margin: 0 0 6px;
            font-size: 12px;
            color: #6d7ea8;
          }}
          .actions {{
            margin-top: 18px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }}
          .btn {{
            border: none;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            padding: 13px 16px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
          }}
          .btn-success {{
            background: #315df6;
            color: #fff;
          }}
          .btn-cancel {{
            background: #eef2ff;
            color: #1f2b47;
          }}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <h1 class="title">{headline}</h1>
            <p class="desc">{description}</p>
            <p class="meta">Session: {session_id}</p>
            <p class="meta">Provider: {session.get("provider", "mock")}</p>
            <p class="meta">Created (UTC): {session_created}</p>
            <div class="actions">
              <a class="btn btn-success" href="/api/billing/mock/complete/{session_id}?result=success">{success_label}</a>
              <a class="btn btn-cancel" href="/api/billing/mock/complete/{session_id}?result=cancel">{cancel_label}</a>
            </div>
          </div>
        </div>
      </body>
    </html>
    """
    return HTMLResponse(content=html, status_code=200)


@app.get("/api/billing/mock/complete/{session_id}")
async def complete_mock_checkout(session_id: str, result: str = "success"):
    """테스트 결제 완료 처리"""
    session = _get_mock_checkout_session_or_raise(session_id)
    user_id = str(session.get("user_id") or "")
    provider = str(session.get("provider") or _get_billing_provider_or_raise())
    success_url = str(session.get("success_url") or "")
    cancel_url = str(session.get("cancel_url") or "")

    if not user_id:
        mock_checkout_sessions.pop(session_id, None)
        raise HTTPException(status_code=400, detail="테스트 결제 세션 사용자 정보가 유효하지 않습니다.")

    normalized_result = (result or "").strip().lower()
    if normalized_result not in {"success", "cancel"}:
        normalized_result = "cancel"

    try:
        if normalized_result == "success":
            current_period_end = (datetime.utcnow() + timedelta(days=30)).isoformat()
            _upsert_billing_row(
                user_id,
                {
                    "provider": provider,
                    "customer_id": f"mock_cus_{user_id[:8]}",
                    "subscription_id": f"mock_sub_{uuid.uuid4().hex[:18]}",
                    "price_id": STRIPE_PRICE_ID_PRO or "mock_price_pro",
                    "status": "active",
                    "plan_tier": PAID_PLAN_TIER,
                    "current_period_end": current_period_end,
                    "cancel_at_period_end": False,
                    "checkout_completed_at": datetime.utcnow().isoformat(),
                },
            )
            _set_user_plan_tier(user_id, PAID_PLAN_TIER)
            redirect_url = success_url
        else:
            _upsert_billing_row(
                user_id,
                {
                    "provider": provider,
                    "status": "checkout_canceled",
                    "plan_tier": USAGE_FREE_PLAN,
                    "cancel_at_period_end": False,
                },
            )
            _set_user_plan_tier(user_id, USAGE_FREE_PLAN)
            redirect_url = cancel_url
    finally:
        mock_checkout_sessions.pop(session_id, None)

    if not redirect_url:
        redirect_url = "/pricing"
    redirect_url = redirect_url.replace("{CHECKOUT_SESSION_ID}", session_id)
    return RedirectResponse(url=redirect_url, status_code=303)


@app.get("/api/billing/portone/checkout/{session_id}", response_class=HTMLResponse)
async def render_portone_checkout_page(request: Request, session_id: str):
    """PortOne 실결제 호출 화면"""
    session = _get_portone_checkout_session_or_raise(session_id)
    locale = str(session.get("locale") or "ko").lower()
    is_en = locale == "en"

    payment_id = str(session.get("payment_id") or "")
    amount_krw = _to_int_safe(session.get("amount_krw"), default=PAID_PLAN_AMOUNT_KRW)
    order_name = str(session.get("order_name") or (PAID_PLAN_PRODUCT_NAME_EN if is_en else PAID_PLAN_PRODUCT_NAME_KO))
    success_url = str(session.get("success_url") or "")
    cancel_url = str(session.get("cancel_url") or "")
    customer_email = str(session.get("email") or "")

    complete_base_url = _build_redirect_url_from_request(request, f"/api/billing/portone/complete/{session_id}")
    if not cancel_url:
        cancel_url = "/pricing-en?checkout=cancel" if is_en else "/pricing?checkout=cancel"
    if cancel_url.startswith("/"):
        cancel_url = _build_redirect_url_from_request(request, cancel_url)

    payment_payload = {
        "storeId": PORTONE_STORE_ID,
        "channelKey": PORTONE_CHANNEL_KEY,
        "paymentId": payment_id,
        "orderName": order_name,
        "totalAmount": amount_krw,
        "currency": "KRW",
        "payMethod": "CARD",
        "customData": {
            "app": "mallog24",
            "plan_tier": PAID_PLAN_TIER,
            "provider": "portone",
            "mid": PORTONE_MID,
            "session_id": session_id,
        },
    }
    if customer_email:
        payment_payload["customer"] = {"email": customer_email}

    title = "PortOne Checkout" if is_en else "PortOne 결제창"
    headline = "Open live checkout" if is_en else "실결제창 열기"
    description = (
        "Tap the button below to open the payment window. Browser security may block auto-open."
        if is_en
        else "아래 버튼을 눌러 결제창을 여세요. 브라우저 보안 정책으로 자동 실행은 제한됩니다."
    )
    button_label = "Open Checkout" if is_en else "결제창 열기"
    cancel_label = "Cancel" if is_en else "취소"

    payload_json = json.dumps(payment_payload, ensure_ascii=False)
    complete_base_json = json.dumps(complete_base_url, ensure_ascii=False)
    cancel_url_json = json.dumps(cancel_url, ensure_ascii=False)
    headline_html = headline.replace("<", "&lt;").replace(">", "&gt;")
    description_html = description.replace("<", "&lt;").replace(">", "&gt;")
    button_label_html = button_label.replace("<", "&lt;").replace(">", "&gt;")
    cancel_label_html = cancel_label.replace("<", "&lt;").replace(">", "&gt;")
    title_html = title.replace("<", "&lt;").replace(">", "&gt;")

    html = f"""
    <!doctype html>
    <html lang="{ 'en' if is_en else 'ko' }">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title_html}</title>
        <script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
        <style>
          body {{
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(140deg, #eef3ff 0%, #f6f0ff 100%);
            color: #1f2b47;
          }}
          .wrap {{
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }}
          .card {{
            width: 100%;
            max-width: 540px;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 20px 48px rgba(56, 85, 168, 0.14);
            padding: 24px;
          }}
          .title {{
            margin: 0 0 10px;
            font-size: 28px;
            font-weight: 800;
          }}
          .desc {{
            margin: 0 0 16px;
            font-size: 14px;
            color: #56648b;
            line-height: 1.6;
          }}
          .meta {{
            margin: 0 0 6px;
            font-size: 12px;
            color: #6d7ea8;
            word-break: break-word;
          }}
          .actions {{
            margin-top: 18px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }}
          .btn {{
            border: none;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            padding: 13px 16px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
          }}
          .btn-primary {{
            background: #315df6;
            color: #fff;
          }}
          .btn-secondary {{
            background: #eef2ff;
            color: #1f2b47;
          }}
          .status {{
            margin-top: 10px;
            font-size: 12px;
            color: #56648b;
          }}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <h1 class="title">{headline_html}</h1>
            <p class="desc">{description_html}</p>
            <p class="meta">Payment ID: {payment_id}</p>
            <p class="meta">Amount: {amount_krw} KRW</p>
            <p class="meta">Order: {order_name}</p>
            <div class="actions">
              <button id="payButton" class="btn btn-primary">{button_label_html}</button>
              <a class="btn btn-secondary" href="{cancel_url}">{cancel_label_html}</a>
            </div>
            <p class="status" id="statusText"></p>
          </div>
        </div>
        <script>
          const REQUEST_PAYLOAD = {payload_json};
          const COMPLETE_BASE_URL = {complete_base_json};
          const CANCEL_URL = {cancel_url_json};
          const STATUS_TEXT = document.getElementById("statusText");
          const PAY_BUTTON = document.getElementById("payButton");
          let launched = false;

          const LOADING_TEXT = {json.dumps("Opening payment window..." if is_en else "결제창을 여는 중...", ensure_ascii=False)};
          const RETRY_TEXT = {json.dumps("Retry opening checkout" if is_en else "결제창 다시 열기", ensure_ascii=False)};
          const SDK_MISSING_TEXT = {json.dumps(
              "PortOne SDK did not load. Please refresh and try again."
              if is_en else
              "PortOne SDK를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.",
              ensure_ascii=False
          )};
          const EMPTY_RESPONSE_TEXT = {json.dumps(
              "No response from checkout. Please try again."
              if is_en else
              "결제 응답을 받지 못했습니다. 다시 시도해 주세요.",
              ensure_ascii=False
          )};
          const FAILURE_PREFIX_TEXT = {json.dumps(
              "Payment launch failed"
              if is_en else
              "결제창 호출 실패",
              ensure_ascii=False
          )};
          const EXCEPTION_TEXT = {json.dumps(
              "An unexpected error occurred while opening checkout."
              if is_en else
              "결제창 호출 중 예기치 않은 오류가 발생했습니다.",
              ensure_ascii=False
          )};

          const setStatus = (value) => {{
            if (STATUS_TEXT) STATUS_TEXT.textContent = value || "";
          }};

          const moveToCancel = (reason) => {{
            try {{
              const target = new URL(CANCEL_URL);
              target.searchParams.set("checkout", "cancel");
              if (reason) {{
                target.searchParams.set("reason", reason);
              }}
              window.location.replace(target.toString());
              return;
            }} catch (_err) {{
              window.location.replace(CANCEL_URL);
            }}
          }};

          const moveToComplete = (paymentId) => {{
            const resolvedPaymentId = paymentId || REQUEST_PAYLOAD.paymentId;
            try {{
              const target = new URL(COMPLETE_BASE_URL);
              target.searchParams.set("payment_id", resolvedPaymentId);
              window.location.replace(target.toString());
            }} catch (_err) {{
              const separator = COMPLETE_BASE_URL.includes("?") ? "&" : "?";
              window.location.replace(`${{COMPLETE_BASE_URL}}${{separator}}payment_id=${{encodeURIComponent(resolvedPaymentId)}}`);
            }}
          }};

          const openPaymentWindow = async () => {{
            if (launched) return;
            if (!window.PortOne || typeof window.PortOne.requestPayment !== "function") {{
              setStatus(SDK_MISSING_TEXT);
              return;
            }}
            launched = true;
            PAY_BUTTON.disabled = true;
            PAY_BUTTON.textContent = LOADING_TEXT;
            setStatus(LOADING_TEXT);
            try {{
              const response = await PortOne.requestPayment(REQUEST_PAYLOAD);
              if (!response) {{
                setStatus(EMPTY_RESPONSE_TEXT);
                launched = false;
                PAY_BUTTON.disabled = false;
                PAY_BUTTON.textContent = RETRY_TEXT;
                return;
              }}
              if (response.code) {{
                const reasonCode = String(response.code || "payment_error");
                const reasonMessage = String(response.message || "");
                const detail = reasonMessage ? `${{reasonCode}} - ${{reasonMessage}}` : reasonCode;
                setStatus(`${{FAILURE_PREFIX_TEXT}}: ${{detail}}`);
                launched = false;
                PAY_BUTTON.disabled = false;
                PAY_BUTTON.textContent = RETRY_TEXT;
                return;
              }}
              const paymentId = response.paymentId || response.payment_id || REQUEST_PAYLOAD.paymentId;
              moveToComplete(paymentId);
            }} catch (error) {{
              const detail = error?.message ? `${{EXCEPTION_TEXT}} (${{error.message}})` : EXCEPTION_TEXT;
              setStatus(detail);
              launched = false;
              PAY_BUTTON.disabled = false;
              PAY_BUTTON.textContent = RETRY_TEXT;
            }}
          }};

          PAY_BUTTON.addEventListener("click", openPaymentWindow);
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html, status_code=200)


@app.get("/api/billing/portone/complete/{session_id}")
async def complete_portone_checkout(
    request: Request,
    session_id: str,
    payment_id: str = "",
):
    """PortOne 결제 완료 검증 및 구독 반영"""
    session = _get_portone_checkout_session_or_raise(session_id)
    user_id = str(session.get("user_id") or "")
    success_url = str(session.get("success_url") or "")
    cancel_url = str(session.get("cancel_url") or "")
    expected_amount = _to_int_safe(session.get("amount_krw"), default=PAID_PLAN_AMOUNT_KRW)
    fallback_payment_id = str(session.get("payment_id") or "")
    resolved_payment_id = str(payment_id or fallback_payment_id).strip()

    if not user_id:
        portone_checkout_sessions.pop(session_id, None)
        raise HTTPException(status_code=400, detail="PortOne 결제 세션 사용자 정보가 유효하지 않습니다.")

    if not success_url:
        success_url = _build_redirect_url_from_request(request, "/pricing?checkout=success")
    if not cancel_url:
        cancel_url = _build_redirect_url_from_request(request, "/pricing?checkout=cancel")

    if not resolved_payment_id:
        _upsert_billing_row(
            user_id,
            {
                "provider": "portone",
                "status": "checkout_canceled",
                "plan_tier": USAGE_FREE_PLAN,
                "cancel_at_period_end": False,
            },
        )
        _set_user_plan_tier(user_id, USAGE_FREE_PLAN)
        portone_checkout_sessions.pop(session_id, None)
        return RedirectResponse(
            url=_append_query_params(cancel_url, {"checkout": "cancel", "reason": "missing_payment_id"}),
            status_code=303,
        )

    try:
        payment = await _fetch_portone_payment_by_id(resolved_payment_id)
        payment_status = _extract_portone_payment_status(payment)
        if payment_status != "PAID":
            raise HTTPException(status_code=409, detail=f"PortOne 결제 상태가 완료가 아닙니다: {payment_status or 'UNKNOWN'}")

        payment_amount = _extract_portone_total_amount(payment)
        if payment_amount != expected_amount:
            raise HTTPException(
                status_code=409,
                detail=f"결제 금액 검증 실패: expected={expected_amount}, actual={payment_amount}",
            )

        payment_currency = _extract_portone_payment_currency(payment)
        if payment_currency and payment_currency != "KRW":
            raise HTTPException(status_code=409, detail=f"지원하지 않는 결제 통화입니다: {payment_currency}")

        customer_reference = _extract_portone_customer_reference(payment) or (session.get("email") or "")
        current_period_end = (datetime.utcnow() + timedelta(days=30)).isoformat()
        _upsert_billing_row(
            user_id,
            {
                "provider": "portone",
                "customer_id": str(customer_reference)[:255] or resolved_payment_id,
                "subscription_id": resolved_payment_id,
                "price_id": f"portone_pro_{expected_amount}",
                "status": "active",
                "plan_tier": PAID_PLAN_TIER,
                "current_period_end": current_period_end,
                "cancel_at_period_end": False,
                "checkout_completed_at": datetime.utcnow().isoformat(),
            },
        )
        _set_user_plan_tier(user_id, PAID_PLAN_TIER)

        redirect_url = _append_query_params(
            success_url,
            {
                "checkout": "success",
                "provider": "portone",
                "payment_id": resolved_payment_id,
            },
        )
        return RedirectResponse(url=redirect_url, status_code=303)
    except HTTPException as verify_err:
        _upsert_billing_row(
            user_id,
            {
                "provider": "portone",
                "status": "checkout_canceled",
                "plan_tier": USAGE_FREE_PLAN,
                "cancel_at_period_end": False,
            },
        )
        _set_user_plan_tier(user_id, USAGE_FREE_PLAN)
        redirect_url = _append_query_params(
            cancel_url,
            {
                "checkout": "cancel",
                "provider": "portone",
                "reason": (verify_err.detail if isinstance(verify_err.detail, str) else "verification_failed"),
            },
        )
        return RedirectResponse(url=redirect_url, status_code=303)
    finally:
        portone_checkout_sessions.pop(session_id, None)


@app.post("/api/billing/portal")
async def create_portal_session(
    request: Request,
    authorization: str | None = Header(default=None),
):
    """구독 관리 포털 세션 생성 (공급자별)"""
    _ensure_billing_scope_ready()
    billing_provider = _get_billing_provider_or_raise()
    checkout_mode = _get_checkout_mode(billing_provider)
    if billing_provider != "stripe":
        raise HTTPException(
            status_code=501,
            detail=f"{billing_provider} 구독 관리 포털은 추후 구현 예정입니다.",
        )
    if checkout_mode != "live":
        raise HTTPException(
            status_code=501,
            detail="테스트 모드에서는 Stripe Billing Portal을 사용할 수 없습니다.",
        )

    _require_stripe_billing_enabled()
    user = await _get_current_user(authorization)
    payload = await _read_optional_json_payload(request)
    return_url = _resolve_portal_return_url(request, payload)

    billing_row = _fetch_billing_row_by_user_id(user["id"])
    if not billing_row or not billing_row.get("customer_id"):
        raise HTTPException(status_code=400, detail="구독 관리 가능한 고객 정보가 없습니다.")

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=billing_row["customer_id"],
            return_url=return_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"구독 관리 페이지 생성 실패: {str(e)}")

    return {
        "success": True,
        "portal_url": portal_session.url,
    }


@app.post("/api/billing/cancel")
async def cancel_billing_subscription(
    request: Request,
    authorization: str | None = Header(default=None),
):
    """구독 취소 요청 (자동/수동 처리)"""
    _ensure_user_usage_scope_ready()
    _ensure_billing_scope_ready()
    user = await _get_current_user(authorization)
    payload = await _read_optional_json_payload(request)
    immediate = _to_bool_from_payload(payload.get("immediate"), default=False)

    user_id = user["id"]
    billing_row = _fetch_billing_row_by_user_id(user_id)
    if not billing_row:
        raise HTTPException(status_code=404, detail="취소 가능한 구독 정보가 없습니다.")

    normalized = _normalize_billing_row(billing_row, user_id=user_id)
    subscription_id = normalized["subscription_id"]
    customer_id = normalized["customer_id"]
    provider = _get_billing_provider_or_raise()
    checkout_mode = _get_checkout_mode(provider)
    current_status = str(normalized["status"] or "").strip().lower()

    if (
        normalized["plan_tier"] == USAGE_FREE_PLAN
        and current_status not in STRIPE_ACTIVE_SUBSCRIPTION_STATUSES
        and not normalized["cancel_at_period_end"]
    ):
        raise HTTPException(status_code=409, detail="현재 활성화된 구독이 없습니다.")

    if checkout_mode == "mock" or subscription_id.startswith("mock_sub_"):
        if immediate:
            canceled_at = datetime.utcnow().isoformat()
            _upsert_billing_row(
                user_id,
                {
                    "provider": provider,
                    "status": "canceled",
                    "plan_tier": USAGE_FREE_PLAN,
                    "cancel_at_period_end": False,
                    "current_period_end": canceled_at,
                },
            )
            _set_user_plan_tier(user_id, USAGE_FREE_PLAN)
            return {
                "success": True,
                "provider": provider,
                "mode": "mock",
                "status": "canceled",
                "plan_tier": USAGE_FREE_PLAN,
                "message": "테스트 구독이 즉시 해지되었습니다.",
            }

        _upsert_billing_row(
            user_id,
            {
                "provider": provider,
                "cancel_at_period_end": True,
            },
        )
        return {
            "success": True,
            "provider": provider,
            "mode": "mock",
            "status": current_status or "active",
            "cancel_at_period_end": True,
            "message": "테스트 구독이 결제 주기 종료 시 해지되도록 설정되었습니다.",
        }

    if provider != "stripe" or checkout_mode != "live":
        _upsert_billing_row(
            user_id,
            {
                "provider": provider,
                "cancel_at_period_end": True,
            },
        )
        return {
            "success": True,
            "provider": provider,
            "mode": "manual",
            "manual_required": True,
            "status": current_status or "active",
            "cancel_at_period_end": True,
            "message": "구독 취소 요청이 접수되었습니다. 결제대행사 정책에 따라 순차 처리됩니다.",
        }

    _require_stripe_billing_enabled()

    stripe_subscription_id = subscription_id
    if not stripe_subscription_id and customer_id:
        try:
            subscription_list = stripe.Subscription.list(customer=customer_id, status="all", limit=10)
            for sub in (subscription_list.data or []):
                sub_status = str(sub.get("status") or "").strip().lower()
                if sub_status in STRIPE_ACTIVE_SUBSCRIPTION_STATUSES or bool(sub.get("cancel_at_period_end")):
                    stripe_subscription_id = str(sub.get("id") or "")
                    if stripe_subscription_id:
                        break
        except Exception:
            stripe_subscription_id = ""

    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="Stripe 구독 ID를 찾을 수 없습니다.")

    if not immediate and normalized["cancel_at_period_end"]:
        return {
            "success": True,
            "provider": "stripe",
            "mode": "live",
            "status": current_status or "active",
            "cancel_at_period_end": True,
            "message": "이미 결제 주기 종료 시 해지로 설정된 구독입니다.",
        }

    try:
        if immediate:
            subscription_obj = stripe.Subscription.delete(stripe_subscription_id)
        else:
            subscription_obj = stripe.Subscription.modify(
                stripe_subscription_id,
                cancel_at_period_end=True,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"구독 취소 처리 실패: {str(e)}")

    next_status = str(subscription_obj.get("status") or ("canceled" if immediate else current_status or "active"))
    next_cancel_at_period_end = bool(subscription_obj.get("cancel_at_period_end") or False)
    next_period_end = _to_iso_datetime_from_unix(subscription_obj.get("current_period_end"))
    next_plan_tier = (
        USAGE_FREE_PLAN
        if immediate or next_status not in STRIPE_ACTIVE_SUBSCRIPTION_STATUSES
        else PAID_PLAN_TIER
    )

    _upsert_billing_row(
        user_id,
        {
            "provider": "stripe",
            "subscription_id": stripe_subscription_id,
            "status": next_status,
            "plan_tier": next_plan_tier,
            "current_period_end": next_period_end or normalized["current_period_end"],
            "cancel_at_period_end": next_cancel_at_period_end if not immediate else False,
        },
    )
    _set_user_plan_tier(user_id, next_plan_tier)

    return {
        "success": True,
        "provider": "stripe",
        "mode": "live",
        "status": next_status,
        "plan_tier": next_plan_tier,
        "cancel_at_period_end": next_cancel_at_period_end if not immediate else False,
        "current_period_end": next_period_end or normalized["current_period_end"],
        "message": "구독 취소가 처리되었습니다." if immediate else "구독이 결제 주기 종료 시 해지되도록 설정되었습니다.",
    }


@app.post("/api/billing/refund")
async def request_billing_refund(
    request: Request,
    authorization: str | None = Header(default=None),
):
    """환불 요청 (무사용 + 기간 내 자동 처리, 그 외 수동 검토)"""
    _ensure_user_usage_scope_ready()
    _ensure_billing_scope_ready()
    _ensure_billing_refund_scope_ready()
    user = await _get_current_user(authorization)
    payload = await _read_optional_json_payload(request)

    user_id = user["id"]
    reason = str(payload.get("reason") or "").strip()[:500]
    if not reason:
        reason = "user_requested_refund"

    billing_row = _fetch_billing_row_by_user_id(user_id)
    if not billing_row:
        raise HTTPException(status_code=404, detail="환불 가능한 결제 이력이 없습니다.")

    normalized = _normalize_billing_row(billing_row, user_id=user_id)
    current_status = str(normalized["status"] or "").strip().lower()
    if current_status in {"inactive", "checkout_pending", "checkout_canceled", "refunded"}:
        raise HTTPException(status_code=409, detail="환불 가능한 활성 결제 상태가 아닙니다.")

    if not _is_refund_window_open(normalized):
        raise HTTPException(
            status_code=409,
            detail=f"환불 가능 기간({BILLING_REFUND_WINDOW_DAYS}일)이 지나 자동 환불 대상이 아닙니다.",
        )

    usage_row = _get_or_create_usage_row(user_id)
    used_audio_seconds = int(usage_row.get("used_audio_seconds") or 0)
    if used_audio_seconds > 0:
        raise HTTPException(
            status_code=409,
            detail="사용 이력이 있어 자동 환불 대상이 아닙니다. 문의 메일로 별도 심사를 요청해 주세요.",
        )

    provider = _get_billing_provider_or_raise()
    checkout_mode = _get_checkout_mode(provider)
    subscription_id = normalized["subscription_id"]
    customer_id = normalized["customer_id"]

    if checkout_mode == "mock" or subscription_id.startswith("mock_sub_"):
        refund_id = f"mock_ref_{uuid.uuid4().hex[:18]}"
        refunded_at = datetime.utcnow().isoformat()
        _insert_refund_request(
            user_id=user_id,
            provider=provider,
            subscription_id=subscription_id,
            payment_reference=refund_id,
            reason=reason,
            status="refunded",
            decision_note="테스트 결제 환불 완료",
            refund_id=refund_id,
            metadata={"mode": "mock"},
        )
        _upsert_billing_row(
            user_id,
            {
                "provider": provider,
                "status": "refunded",
                "plan_tier": USAGE_FREE_PLAN,
                "cancel_at_period_end": False,
                "current_period_end": refunded_at,
            },
        )
        _set_user_plan_tier(user_id, USAGE_FREE_PLAN)
        return {
            "success": True,
            "provider": provider,
            "mode": "mock",
            "status": "refunded",
            "refund_id": refund_id,
            "message": "테스트 결제 환불이 완료되었습니다.",
        }

    if provider != "stripe" or checkout_mode != "live":
        _insert_refund_request(
            user_id=user_id,
            provider=provider,
            subscription_id=subscription_id,
            payment_reference=normalized["customer_id"],
            reason=reason,
            status="manual_review",
            decision_note="국내 PG 환불은 운영자 수동 심사가 필요합니다.",
            metadata={"mode": "manual", "checkout_mode": checkout_mode},
        )
        _upsert_billing_row(
            user_id,
            {
                "provider": provider,
                "status": "refund_requested",
                "cancel_at_period_end": True,
            },
        )
        return {
            "success": True,
            "provider": provider,
            "mode": "manual",
            "status": "refund_requested",
            "manual_required": True,
            "message": "환불 요청이 접수되었습니다. 운영 검토 후 결제대행사 정책에 따라 처리됩니다.",
        }

    _require_stripe_billing_enabled()

    charge_id, invoice_id, amount_paid = _resolve_latest_paid_invoice_and_charge(
        subscription_id=subscription_id,
        customer_id=customer_id,
    )
    if not charge_id:
        raise HTTPException(status_code=409, detail="환불 가능한 결제 건(청구서/결제)을 찾지 못했습니다.")

    try:
        refund_obj = stripe.Refund.create(
            charge=charge_id,
            reason="requested_by_customer",
            metadata={
                "user_id": user_id,
                "subscription_id": subscription_id,
                "source": "mallog24-refund-endpoint",
            },
        )
    except Exception as e:
        _insert_refund_request(
            user_id=user_id,
            provider="stripe",
            subscription_id=subscription_id,
            payment_reference=charge_id,
            reason=reason,
            status="failed",
            decision_note=f"Stripe 환불 생성 실패: {str(e)}",
            metadata={"invoice_id": invoice_id, "amount_paid": amount_paid},
        )
        raise HTTPException(status_code=500, detail=f"Stripe 환불 요청 실패: {str(e)}")

    refund_id = str(refund_obj.get("id") or "")
    refund_status = str(refund_obj.get("status") or "pending")

    if subscription_id:
        try:
            stripe.Subscription.delete(subscription_id)
        except Exception as sub_cancel_err:
            print(f"[billing] failed to cancel subscription after refund request: {sub_cancel_err}")

    internal_refund_status = (
        "refunded" if refund_status == "succeeded" else "processing"
    )
    _insert_refund_request(
        user_id=user_id,
        provider="stripe",
        subscription_id=subscription_id,
        payment_reference=charge_id,
        reason=reason,
        status=internal_refund_status,
        decision_note=f"Stripe refund status: {refund_status}",
        refund_id=refund_id,
        metadata={"invoice_id": invoice_id, "amount_paid": amount_paid},
    )

    _upsert_billing_row(
        user_id,
        {
            "provider": "stripe",
            "status": "refunded" if refund_status == "succeeded" else "refund_requested",
            "plan_tier": USAGE_FREE_PLAN,
            "cancel_at_period_end": False,
            "current_period_end": datetime.utcnow().isoformat(),
        },
    )
    _set_user_plan_tier(user_id, USAGE_FREE_PLAN)

    return {
        "success": True,
        "provider": "stripe",
        "mode": "live",
        "status": "refunded" if refund_status == "succeeded" else "refund_requested",
        "refund_id": refund_id,
        "refund_status": refund_status,
        "charge_id": charge_id,
        "invoice_id": invoice_id,
        "amount_paid": amount_paid,
        "message": (
            "환불이 완료되었습니다."
            if refund_status == "succeeded"
            else "환불 요청이 접수되었습니다. 결제사 처리 상태를 확인해 주세요."
        ),
    }


@app.post("/api/billing/webhook")
async def stripe_billing_webhook(request: Request):
    """Stripe webhook 수신 및 구독 상태 반영"""
    _ensure_user_usage_scope_ready()
    _ensure_billing_scope_ready()
    billing_provider = _get_billing_provider_or_raise()
    checkout_mode = _get_checkout_mode(billing_provider)
    if billing_provider != "stripe":
        raise HTTPException(
            status_code=404,
            detail=f"현재 BILLING_PROVIDER={billing_provider} 이므로 Stripe webhook이 비활성화되어 있습니다.",
        )
    if checkout_mode != "live":
        raise HTTPException(status_code=404, detail="Stripe 라이브 결제가 비활성화되어 webhook을 처리하지 않습니다.")

    _require_stripe_billing_enabled()

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="STRIPE_WEBHOOK_SECRET 설정이 필요합니다.")

    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=400, detail="stripe-signature 헤더가 필요합니다.")

    try:
        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Webhook payload가 올바르지 않습니다.")
    except Exception as e:
        if "SignatureVerificationError" in e.__class__.__name__:
            raise HTTPException(status_code=400, detail="Webhook 서명 검증에 실패했습니다.")
        raise HTTPException(status_code=400, detail=f"Webhook 검증 실패: {str(e)}")

    event_type = str(event.get("type") or "")
    event_obj = event.get("data", {}).get("object", {})

    try:
        if event_type == "checkout.session.completed":
            metadata = event_obj.get("metadata") or {}
            user_id = (metadata.get("user_id") or "").strip()
            customer_id = str(event_obj.get("customer") or "")
            subscription_id = str(event_obj.get("subscription") or "")

            if user_id:
                subscription_status = "incomplete"
                current_period_end = None
                cancel_at_period_end = False
                price_id = STRIPE_PRICE_ID_PRO

                if subscription_id:
                    try:
                        subscription = stripe.Subscription.retrieve(subscription_id)
                        subscription_status = str(subscription.get("status") or "incomplete")
                        current_period_end = _to_iso_datetime_from_unix(subscription.get("current_period_end"))
                        cancel_at_period_end = bool(subscription.get("cancel_at_period_end") or False)
                        extracted_price_id = _extract_primary_price_id(subscription)
                        if extracted_price_id:
                            price_id = extracted_price_id
                    except Exception as sub_err:
                        print(f"[billing] failed to fetch subscription on checkout completion: {sub_err}")

                plan_tier = _resolve_plan_tier_from_subscription_status(subscription_status)
                _upsert_billing_row(
                    user_id,
                    {
                        "provider": "stripe",
                        "customer_id": customer_id,
                        "subscription_id": subscription_id,
                        "price_id": price_id,
                        "status": subscription_status,
                        "plan_tier": plan_tier,
                        "current_period_end": current_period_end,
                        "cancel_at_period_end": cancel_at_period_end,
                        "checkout_completed_at": datetime.utcnow().isoformat(),
                    },
                )
                _set_user_plan_tier(user_id, plan_tier)

        elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
            subscription = event_obj or {}
            subscription_id = str(subscription.get("id") or "")
            customer_id = str(subscription.get("customer") or "")
            billing_row = (
                _fetch_billing_row_by_subscription_id(subscription_id)
                or _fetch_billing_row_by_customer_id(customer_id)
            )
            if billing_row:
                user_id = billing_row["user_id"]
                status = str(subscription.get("status") or ("canceled" if event_type.endswith("deleted") else "inactive"))
                plan_tier = _resolve_plan_tier_from_subscription_status(status)
                _upsert_billing_row(
                    user_id,
                    {
                        "provider": "stripe",
                        "customer_id": customer_id,
                        "subscription_id": subscription_id,
                        "price_id": _extract_primary_price_id(subscription) or billing_row.get("price_id") or STRIPE_PRICE_ID_PRO,
                        "status": status,
                        "plan_tier": plan_tier,
                        "current_period_end": _to_iso_datetime_from_unix(subscription.get("current_period_end")),
                        "cancel_at_period_end": bool(subscription.get("cancel_at_period_end") or False),
                    },
                )
                _set_user_plan_tier(user_id, plan_tier)

        elif event_type == "invoice.payment_failed":
            invoice = event_obj or {}
            subscription_id = str(invoice.get("subscription") or "")
            customer_id = str(invoice.get("customer") or "")
            billing_row = (
                _fetch_billing_row_by_subscription_id(subscription_id)
                or _fetch_billing_row_by_customer_id(customer_id)
            )
            if billing_row:
                user_id = billing_row["user_id"]
                _upsert_billing_row(
                    user_id,
                    {
                        "provider": "stripe",
                        "status": "past_due",
                        "plan_tier": USAGE_FREE_PLAN,
                    },
                )
                _set_user_plan_tier(user_id, USAGE_FREE_PLAN)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook 처리 실패: {str(e)}")

    return {"received": True, "event_type": event_type}


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

    data = await _supabase_auth_request("signup", payload=payload)
    session = data.get("session") or {}
    access_token = data.get("access_token") or session.get("access_token")
    refresh_token = data.get("refresh_token") or session.get("refresh_token")
    user = data.get("user") or {}
    if access_token and isinstance(user, dict) and user.get("id"):
        _enforce_concurrent_login_limit(access_token, user, is_fresh_login=True)

    return {
        "success": True,
        "message": "회원가입이 완료되었습니다. 이메일 인증 설정 여부에 따라 추가 인증이 필요할 수 있습니다.",
        "user": user,
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
    data = await _supabase_auth_request(
        "token?grant_type=password",
        payload={"email": normalized_email, "password": password},
    )
    access_token = data.get("access_token") or ""
    user = data.get("user") or {}
    if access_token and isinstance(user, dict) and user.get("id"):
        _enforce_concurrent_login_limit(access_token, user, is_fresh_login=True)
    return {
        "success": True,
        "user": user,
        "access_token": access_token,
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
    user = await _get_current_user(authorization)
    return {
        "success": True,
        "user": user,
    }


@app.get("/api/auth/bootstrap")
async def auth_bootstrap(authorization: str | None = Header(default=None)):
    """로그인 초기 화면 부팅용 사용자/사용량 통합 조회"""
    user = await _get_current_user(authorization)
    row = _get_or_create_usage_row(user["id"])
    snapshot = _build_usage_snapshot(
        row,
        is_admin_bypass=_is_admin_bypass_user(user=user),
    )
    return {
        "success": True,
        "user": user,
        "usage": snapshot,
    }


@app.post("/api/records/draft")
async def generate_record_draft(
    text: str = Form(...),
    category: str = Form(...),
    language: str = Form("ko"),
    authorization: str | None = Header(default=None),
):
    """기록본 초안 생성 (회의 키워드/진료 도움 기록/설교 핵심 요약)"""
    await _get_current_user(authorization)
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
    user = await _get_current_user(authorization)
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
    user = await _get_current_user(authorization)
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
async def summarize_text(
    text: str = Form(...),
    summary_type: str = Form("short"),
    transcription_type: str = Form("conversation"),
    content_style: str = Form(""),
    language: str = Form("ko"),
    authorization: str | None = Header(default=None),
):
    """텍스트 요약 (유형별 프롬프트: 설교/통화/회의)"""
    try:
        await _get_current_user(authorization)
        normalized_text = text.strip()
        if not normalized_text:
            raise HTTPException(status_code=400, detail="요약할 텍스트가 비어 있습니다.")
        if len(normalized_text) > MAX_TEXT_INPUT_CHARS:
            raise HTTPException(status_code=400, detail=f"요약 입력은 {MAX_TEXT_INPUT_CHARS}자 이하여야 합니다.")
        normalized_transcription_type = (transcription_type or "conversation").strip().lower()
        if normalized_transcription_type not in ALLOWED_TRANSCRIPTION_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 transcription_type: {transcription_type}",
            )
        normalized_language = (language or "ko").strip().lower()
        if normalized_language not in {"ko", "en"}:
            normalized_language = "ko"
        normalized_content_style = (content_style or "").strip().lower()
        if normalized_content_style not in ALLOWED_CONTENT_STYLES:
            normalized_content_style = _infer_content_style(
                text=normalized_text,
                transcription_type=normalized_transcription_type,
                language=normalized_language,
            )

        target_model = get_optimal_model()
        model = genai.GenerativeModel(model_name=target_model)

        prompt = get_summary_prompt(
            summary_type=summary_type,
            transcription_type=normalized_transcription_type,
            language=normalized_language,
            content_style=normalized_content_style,
        )
        source_label = "원문" if normalized_language == "ko" else "Source Transcript"
        full_prompt = f"""{prompt}

[{source_label}]
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
            "summary_type": summary_type,
            "transcription_type": normalized_transcription_type,
            "content_style": normalized_content_style,
            "language": normalized_language,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    try:
        billing_provider = _get_billing_provider_or_raise()
        billing_enabled = _is_billing_enabled()
        billing_checkout_mode = _get_checkout_mode(billing_provider)
        stripe_billing = _is_stripe_billing_enabled()
    except Exception:
        billing_provider = BILLING_PROVIDER
        billing_enabled = False
        billing_checkout_mode = "disabled"
        stripe_billing = False

    return {
        "status": "healthy",
        "church_type": "다락방 전도운동",
        "terms_loaded": len(ALL_CHURCH_TERMS),
        "darakbang_terms": len(DARAKBANG_CORE),
        "engine": "whisper+gemini" if openai_client else "gemini-only",
        "apis": {
            "gemini": bool(GEMINI_API_KEY),
            "openai_whisper": bool(OPENAI_API_KEY),
            "billing_provider": billing_provider,
            "billing_enabled": billing_enabled,
            "billing_checkout_mode": billing_checkout_mode,
            "billing_test_mode": BILLING_TEST_MODE,
            "stripe_billing": stripe_billing,
        }
    }
