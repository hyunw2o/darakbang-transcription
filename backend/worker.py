import os
import time
import uuid
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait

from dotenv import load_dotenv

load_dotenv()

from main import (
    TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS,
    _can_use_worker_queue,
    _claim_transcription_job,
    _delete_transcription_input_from_storage,
    _download_transcription_input_from_storage,
    _ensure_transcription_jobs_scope_ready,
    _extract_audio_duration_seconds,
    _fetch_queued_transcription_jobs,
    _process_transcription_sync,
    _upsert_transcription_job,
    _upsert_transcription_state,
)


WORKER_ID = (os.getenv("TRANSCRIPTION_WORKER_ID") or f"worker-{uuid.uuid4().hex[:8]}").strip()
DEFAULT_TRANSCRIPTION_WORKER_CONCURRENCY = 2


def _parse_worker_concurrency() -> int:
    raw_value = (
        os.getenv("TRANSCRIPTION_WORKER_CONCURRENCY")
        or os.getenv("MAX_CONCURRENT_TRANSCRIPTIONS")
        or str(DEFAULT_TRANSCRIPTION_WORKER_CONCURRENCY)
    )
    try:
        value = int(str(raw_value).strip())
    except Exception:
        value = DEFAULT_TRANSCRIPTION_WORKER_CONCURRENCY
    return max(1, min(8, value))


TRANSCRIPTION_WORKER_CONCURRENCY = _parse_worker_concurrency()


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
        downloaded_audio_seconds = _extract_audio_duration_seconds(temp_file_path)
        if audio_seconds > 0 and downloaded_audio_seconds + 2 < audio_seconds:
            raise RuntimeError(
                "Downloaded audio is shorter than the verified upload "
                f"({downloaded_audio_seconds}s < {audio_seconds}s)."
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


def _claim_next_job(fetch_limit: int, active_owner_keys: set[str] | None = None) -> dict | None:
    jobs = _fetch_queued_transcription_jobs(limit=fetch_limit)
    excluded_owners = active_owner_keys or set()
    preferred_jobs = [job for job in jobs if str(job.get("owner_key") or "") not in excluded_owners]
    fallback_jobs = [job for job in jobs if str(job.get("owner_key") or "") in excluded_owners]

    # Give another account a free slot first, while still allowing one account to
    # use all idle slots when nobody else is waiting.
    for job in [*preferred_jobs, *fallback_jobs]:
        if not job.get("storage_object_path"):
            continue
        claimed_job = _claim_transcription_job(str(job.get("task_id") or ""), WORKER_ID)
        if claimed_job:
            return claimed_job
    return None


def _finish_completed(in_flight: dict[Future, dict[str, str]], completed: set[Future] | None = None) -> None:
    futures = list(completed) if completed is not None else [future for future in in_flight if future.done()]
    for future in futures:
        job_meta = in_flight.pop(future, {})
        task_id = job_meta.get("task_id", "")
        try:
            future.result()
        except Exception as exc:
            print(f"[{WORKER_ID}] Worker future for job {task_id or 'unknown'} failed unexpectedly: {exc}")


def run_forever() -> None:
    if not _can_use_worker_queue():
        raise RuntimeError(
            "Worker queue is disabled. Set TRANSCRIPTION_USE_WORKER_QUEUE=true and configure Supabase storage."
        )
    _ensure_transcription_jobs_scope_ready(required=True)

    print(
        f"[{WORKER_ID}] mallog24 transcription worker started "
        f"(concurrency={TRANSCRIPTION_WORKER_CONCURRENCY})"
    )
    fetch_limit = max(10, TRANSCRIPTION_WORKER_CONCURRENCY * 4)
    with ThreadPoolExecutor(max_workers=TRANSCRIPTION_WORKER_CONCURRENCY) as executor:
        in_flight: dict[Future, dict[str, str]] = {}
        while True:
            _finish_completed(in_flight)

            claimed_any = False
            while len(in_flight) < TRANSCRIPTION_WORKER_CONCURRENCY:
                active_owner_keys = {
                    job_meta.get("owner_key", "")
                    for job_meta in in_flight.values()
                    if job_meta.get("owner_key")
                }
                claimed_job = _claim_next_job(fetch_limit, active_owner_keys)
                if not claimed_job:
                    break

                task_id = str(claimed_job.get("task_id") or "").strip()
                owner_key = str(claimed_job.get("owner_key") or "").strip()
                print(f"[{WORKER_ID}] Claimed job {task_id or 'unknown'}")
                future = executor.submit(process_claimed_job, claimed_job)
                in_flight[future] = {
                    "task_id": task_id,
                    "owner_key": owner_key,
                }
                claimed_any = True

            if not in_flight:
                time.sleep(TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS)
                continue

            if claimed_any and len(in_flight) < TRANSCRIPTION_WORKER_CONCURRENCY:
                continue

            completed, _ = wait(
                set(in_flight.keys()),
                timeout=TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS,
                return_when=FIRST_COMPLETED,
            )
            if completed:
                _finish_completed(in_flight, completed)


if __name__ == "__main__":
    run_forever()
