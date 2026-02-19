"""
Monthly free-tier usage reset job.

Run with:
  python backend/jobs/reset_monthly_free_usage.py

Suggested cron:
  0 0 1 * *  (UTC 기준, 필요 시 플랫폼 타임존 설정 확인)
"""

import os
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv
from supabase import create_client


def _now_text(timezone_name: str) -> str:
    try:
        now = datetime.now(ZoneInfo(timezone_name))
    except ZoneInfoNotFoundError:
        now = datetime.utcnow()
    return now.isoformat()


def _month_start_text(timezone_name: str) -> str:
    try:
        now = datetime.now(ZoneInfo(timezone_name))
    except ZoneInfoNotFoundError:
        now = datetime.utcnow()
    return f"{now.year:04d}-{now.month:02d}-01"


def run_reset() -> int:
    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    timezone_name = (os.getenv("USAGE_TIMEZONE") or "Asia/Seoul").strip() or "Asia/Seoul"

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_KEY 환경변수가 필요합니다.")

    client = create_client(supabase_url, supabase_key)
    month_start = _month_start_text(timezone_name)
    response = client.rpc("reset_monthly_free_usage", {"target_month": month_start}).execute()

    payload = response.data
    if isinstance(payload, list):
        if payload and isinstance(payload[0], dict):
            # PostgREST may wrap scalar in list/object on some versions.
            value = next(iter(payload[0].values()), 0)
            return int(value or 0)
        if payload:
            return int(payload[0] or 0)
        return 0
    return int(payload or 0)


if __name__ == "__main__":
    updated_count = run_reset()
    tz_name = (os.getenv("USAGE_TIMEZONE") or "Asia/Seoul").strip() or "Asia/Seoul"
    print(f"[{_now_text(tz_name)}] reset_monthly_free_usage updated rows: {updated_count}")
