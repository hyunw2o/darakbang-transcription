import os
import time
import uuid

from dotenv import load_dotenv

load_dotenv()

from main import (
    TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS,
    _can_use_worker_queue,
    _claim_transcription_job,
    _delete_transcription_input_from_storage,
    _download_transcription_input_from_storage,
    _ensure_transcription_jobs_scope_ready,
    _fetch_queued_transcription_jobs,
    _process_transcription_sync,
    _upsert_transcription_job,
    _upsert_transcription_state,
)


WORKER_ID = (os.getenv("TRANSCRIPTION_WORKER_ID") or f"worker-{uuid.uuid4().hex[:8]}").strip()


def process_claimed_job(job: dict) -> None:
    task_id = str(job.get("task_id") or "").strip()
    owner_key = str(job.get("owner_key") or "").strip()
    storage_bucket = str(job.get("storage_bucket") or "").strip()
    storage_object_path = str(job.get("storage_object_path") or "").strip()
    language = str(job.get("language") or "ko").strip().lower()
    transcription_type = str(job.get("transcription_type") or "conversation").strip().lower()
    correction_mode = str(job.get("correction_mode") or "normal").strip().lower()
    source_mime_type = str(job.get("source_mime_type") or "").strip()
    audio_seconds = int(job.get("audio_seconds") or 0)
    is_guest = bool(job.get("is_guest"))
    persisted_user_id = None if is_guest else str(job.get("user_id") or "").strip() or None

    if not task_id or not owner_key or not storage_bucket or not storage_object_path:
        return

    temp_file_path = ""
    try:
        temp_file_path = _download_transcription_input_from_storage(
            storage_bucket,
            storage_object_path,
        )
        _process_transcription_sync(
            task_id,
            owner_key,
            temp_file_path,
            language,
            True,
            transcription_type,
            correction_mode,
            source_mime_type,
            audio_seconds,
            None,
            is_guest,
        )
        temp_file_path = ""
    except Exception as e:
        error_text = str(e)
        print(f"[{WORKER_ID}] Failed to process claimed job {task_id}: {error_text}")
        _upsert_transcription_job(
            task_id,
            owner_key,
            {"status": "error", "error": error_text},
            user_id=persisted_user_id,
            is_guest=is_guest,
        )
        if persisted_user_id:
            _upsert_transcription_state(
                task_id,
                persisted_user_id,
                {"status": "error", "error": error_text},
            )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass
        _delete_transcription_input_from_storage(storage_bucket, storage_object_path)


def run_forever() -> None:
    if not _can_use_worker_queue():
        raise RuntimeError(
            "Worker queue is disabled. Set TRANSCRIPTION_USE_WORKER_QUEUE=true and configure Supabase storage."
        )
    _ensure_transcription_jobs_scope_ready(required=True)

    print(f"[{WORKER_ID}] mallog24 transcription worker started")
    while True:
        claimed_job = None
        for job in _fetch_queued_transcription_jobs(limit=10):
            if not job.get("storage_object_path"):
                continue
            claimed_job = _claim_transcription_job(str(job.get("task_id") or ""), WORKER_ID)
            if claimed_job:
                break

        if not claimed_job:
            time.sleep(TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS)
            continue

        process_claimed_job(claimed_job)


if __name__ == "__main__":
    run_forever()
