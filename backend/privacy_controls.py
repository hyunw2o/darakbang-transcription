"""Server-owned consent and retryable account cleanup. Never trust user_metadata."""
from datetime import datetime, timezone

import httpx
from urllib.parse import quote
from fastapi import HTTPException

AI_CONSENT_VERSION = "2026-10-31"
AI_CONSENT_KEY = "mallog24_ai_consent"
DELETION_KEY = "mallog24_deletion_requested_at"
AI_PATHS = {"/api/transcribe", "/api/summarize", "/api/records/draft"}


def consent_status(user):
    metadata = user.get("app_metadata") or {}
    consent = metadata.get(AI_CONSENT_KEY) or {}
    return {
        "version": AI_CONSENT_VERSION,
        "accepted": bool(consent.get("accepted") is True
                         and consent.get("version") == AI_CONSENT_VERSION
                         and consent.get("accepted_at") and not metadata.get(DELETION_KEY)),
        "accepted_at": consent.get("accepted_at"),
        "revoked_at": consent.get("revoked_at"),
        "deletion_pending": bool(metadata.get(DELETION_KEY)),
    }


class PrivacyControls:
    def __init__(self, url, key):
        self.url = (url or "").rstrip("/")
        self.key = key

    def _admin_user(self, user_id, metadata=None):
        if not self.url or not self.key:
            raise HTTPException(503, "개인정보 설정 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.")
        headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}"}
        try:
            with httpx.Client(timeout=15) as client:
                url = f"{self.url}/auth/v1/admin/users/{quote(str(user_id), safe='')}"
                response = (client.get(url, headers=headers) if metadata is None else
                            client.put(url, headers=headers, json={"app_metadata": metadata}))
        except httpx.HTTPError as exc:
            raise HTTPException(503, "개인정보 설정 서버에 연결하지 못했습니다. 다시 시도해 주세요.") from exc
        if response.status_code == 404:
            raise HTTPException(401, "계정이 삭제되었거나 세션이 만료되었습니다.")
        if response.status_code != 200:
            raise HTTPException(503, "개인정보 설정을 확인하지 못했습니다. 다시 시도해 주세요.")
        try:
            data = response.json()
        except ValueError as exc:
            raise HTTPException(503, "개인정보 설정 응답을 확인하지 못했습니다.") from exc
        if not isinstance(data, dict):
            raise HTTPException(503, "개인정보 설정 응답을 확인하지 못했습니다.")
        user = data.get("user", data)
        if str(user.get("id") or "") != str(user_id):
            raise HTTPException(503, "개인정보 설정 응답을 확인하지 못했습니다.")
        return user

    def user(self, user_id):
        return self._admin_user(user_id)

    def require(self, user_id):
        user = self.user(user_id)
        if not consent_status(user)["accepted"]:
            raise HTTPException(403, "AI 전송 동의가 필요합니다. 웹 또는 최신 앱의 개인정보 설정에서 동의해 주세요. (AI_CONSENT_REQUIRED)")
        return user

    def update(self, user_id, accepted, version):
        if version != AI_CONSENT_VERSION or not isinstance(accepted, bool):
            raise HTTPException(400, "최신 AI 전송 안내를 확인하고 동의 여부를 선택해 주세요.")
        user = self.user(user_id)
        metadata = dict(user.get("app_metadata") or {})
        if metadata.get(DELETION_KEY):
            raise HTTPException(409, "계정 삭제가 진행 중입니다. 계정 삭제를 다시 시도해 주세요.")
        now = datetime.now(timezone.utc).isoformat()
        previous = metadata.get(AI_CONSENT_KEY) or {}
        metadata[AI_CONSENT_KEY] = {
            "version": version, "accepted": accepted,
            "accepted_at": now if accepted else previous.get("accepted_at"),
            "revoked_at": None if accepted else now,
            "scope": "openai_google_audio_text_processing",
        }
        return consent_status(self._admin_user(user_id, metadata))

    def mark_deleting(self, user_id):
        user = self.user(user_id)
        metadata = dict(user.get("app_metadata") or {})
        metadata[DELETION_KEY] = metadata.get(DELETION_KEY) or datetime.now(timezone.utc).isoformat()
        return self._admin_user(user_id, metadata)


def missing_table(exc):
    # Optional legacy tables may not exist. Connection/permission failures must abort.
    return getattr(exc, "code", None) in {"42P01", "PGRST205"}


def cleanup_account(client, user_id, delete_object, required_tables, optional_tables):
    client.table("transcription_jobs").update({"status": "error", "error": "Account deletion requested"}).eq("owner_key", user_id).eq("status", "queued").execute()
    jobs = _all_rows(client, "transcription_jobs", "owner_key", user_id)
    if any(row.get("status") in {"queued", "processing"} for row in jobs):
        raise HTTPException(409, "진행 중인 변환을 중지하고 있습니다. 잠시 후 계정 삭제를 다시 눌러 주세요. 계정은 아직 삭제되지 않았습니다.")
    # Delete physical objects before their only database references disappear.
    for row in jobs:
        if row.get("storage_bucket") and row.get("storage_object_path"):
            delete_object(row["storage_bucket"], row["storage_object_path"])
    try:
        assets = _all_rows(client, "training_audio_assets", "user_id", user_id)
    except Exception as exc:
        if not missing_table(exc):
            raise
        assets = []
    for row in assets:
        for prefix in ("", "source_"):
            if row.get(f"{prefix}storage_bucket") and row.get(f"{prefix}storage_object_path"):
                delete_object(row[f"{prefix}storage_bucket"], row[f"{prefix}storage_object_path"])
    for table in dict.fromkeys([*required_tables, *optional_tables]):
        try:
            client.table(table).delete().eq("user_id", user_id).execute()
        except Exception as exc:
            if table not in optional_tables or not missing_table(exc):
                raise
    client.table("transcription_jobs").delete().eq("owner_key", user_id).execute()


def _all_rows(client, table, column, user_id):
    rows = []
    while True:
        order_key = "task_id" if table == "transcription_jobs" else "id"
        page = client.table(table).select("*").eq(column, user_id).order(order_key).range(len(rows), len(rows) + 499).execute().data or []
        rows.extend(page)
        if len(page) < 500:
            return rows
