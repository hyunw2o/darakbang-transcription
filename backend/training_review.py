"""Private, explicitly reviewed audio/text pairs. No model calls or auto-approval."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unicodedata
import uuid

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response

AUDIO = "training_audio_assets"
TEXT = "training_text_samples"
EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4"}
SPLITS = {"unassigned", "train", "validation", "test"}
TAGS = {"term", "pronunciation", "missing", "duplicate", "boundary", "language", "other"}
MAX_UPLOAD = 200 * 1024 * 1024


def now():
    return datetime.now(timezone.utc).isoformat()


def require_admin(user):
    # Deliberately separate from free-plan/admin billing bypass lists.
    allowed = {x.strip() for x in os.getenv("TRAINING_REVIEW_ADMIN_USER_IDS", "").split(",") if x.strip()}
    if not user or str(user.get("id")) not in allowed:
        raise HTTPException(403, "학습 검수 관리자 권한이 필요합니다.")
    return user


def is_review_admin(user):
    try:
        require_admin(user)
        return True
    except HTTPException:
        return False


def reference_hints(text):
    """Text-only leads; never invent audio timestamps for rewritten references."""
    seen, hints = set(), []
    for part in re.split(r"(?<=[.!?。])\s+|\n+", text):
        part = part.strip()
        key = re.sub(r"\s+", "", part)
        if len(key) >= 15 and key in seen and len(hints) < 20:
            hints.append({"reason": "repeated_reference", "text": part[:500]})
        seen.add(key)
    return hints


def valid_asset(asset):
    if asset.get("deleted_at") or asset.get("consent_status") != "granted":
        return False
    if asset.get("retention_until"):
        try:
            if datetime.fromisoformat(asset["retention_until"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                return False
        except (TypeError, ValueError):
            return False
    return True


def validate_review(payload, asset):
    try:
        start, end = float(payload["start_seconds"]), float(payload["end_seconds"])
        duration = float((asset.get("metadata") or {}).get("duration_seconds", asset["audio_seconds"]))
    except (KeyError, TypeError, ValueError):
        raise HTTPException(422, "구간 시작과 종료 시간을 확인해 주세요.")
    if not all(math.isfinite(x) for x in (start, end, duration)) or not 0 <= start < end <= duration or end - start > 60:
        raise HTTPException(422, "원음 범위 안에서 60초 이하의 구간을 지정해 주세요.")
    text = payload.get("final_result", "")
    notes = payload.get("notes", "")
    if not isinstance(text, str) or len(text) > 10000 or not isinstance(notes, str) or len(notes) > 2000:
        raise HTTPException(422, "정답 또는 메모의 길이를 확인해 주세요.")
    status = payload.get("quality_status", "needs_review")
    if status not in {"needs_review", "approved", "rejected"}:
        raise HTTPException(422, "잘못된 검수 상태입니다.")
    tags = payload.get("error_tags", [])
    if not isinstance(tags, list) or any(not isinstance(tag, str) or tag not in TAGS for tag in tags):
        raise HTTPException(422, "잘못된 오류 분류입니다.")
    verified, listened = payload.get("verbatim_verified") is True, payload.get("listened") is True
    if status == "approved" and (not text.strip() or not verified or not listened or not valid_asset(asset)):
        raise HTTPException(422, "원음 청취·정답 검수와 학습 이용 동의를 확인해야 완료할 수 있습니다.")
    return {
        "start_seconds": start, "end_seconds": end, "final_result": text.strip(),
        "quality_status": status, "verbatim_verified": verified if status == "approved" else False,
        "listened": listened if status == "approved" else False,
        "metadata": {"notes": notes.strip(), "error_tags": sorted(set(tags))},
    }


def export_rows(assets, samples):
    by_id = {a["id"]: a for a in assets if valid_asset(a)}
    output, ranges, hash_splits = [], {}, {}
    for row in samples:
        asset = by_id.get(row.get("audio_asset_id"))
        if not asset or row.get("source_type") != "audio_review" or row.get("quality_status") != "approved":
            continue
        split = asset.get("dataset_split", "unassigned")
        if split not in SPLITS - {"unassigned"}:
            continue
        if not row.get("reviewed_by") or not row.get("reviewed_at"):
            continue
        checked = validate_review(row, asset)
        fingerprint = asset["sha256"]
        if fingerprint in hash_splits and hash_splits[fingerprint] != split:
            raise HTTPException(409, "동일한 원음이 서로 다른 학습/평가 분류에 있습니다.")
        hash_splits[fingerprint] = split
        start, end = checked["start_seconds"], checked["end_seconds"]
        for a, b in ranges.setdefault(fingerprint, []):
            if start < b and end > a:
                raise HTTPException(409, "검수 완료 구간이 중첩됩니다. 중복 구간을 수정한 뒤 내보내세요.")
        ranges[fingerprint].append((start, end))
        output.append({
            "id": row["id"], "audio_asset_id": asset["id"], "audio": asset["original_filename"],
            "audio_sha256": fingerprint, "start_seconds": start, "end_seconds": end,
            "text": checked["final_result"], "language": row["language"], "split": split,
            "reference_verified": True, "reviewed_at": row["reviewed_at"], "review_version": row["review_version"],
        })
    return output


def build_router(get_client, get_user):
    router = APIRouter(prefix="/api/admin/training", tags=["training-review"])

    async def admin(response: Response, authorization: str | None = Header(default=None)):
        response.headers["Cache-Control"] = "no-store"
        return require_admin(await get_user(authorization))

    async def body(request):
        try:
            payload = await request.json()
        except ValueError:
            raise HTTPException(422, "JSON 형식이 필요합니다.")
        if not isinstance(payload, dict):
            raise HTTPException(422, "객체 형식의 검수 데이터가 필요합니다.")
        return payload

    async def run(operation):
        try:
            return await asyncio.to_thread(operation)
        except HTTPException:
            raise
        except Exception as exc:
            if getattr(exc, "code", None) in {"42P01", "42703", "PGRST204", "PGRST205"}:
                raise HTTPException(503, "학습 검수 DB 설정이 필요합니다: training_data_assets.sql, training_review.sql") from exc
            if getattr(exc, "code", None) == "23505":
                raise HTTPException(409, "이미 등록된 자료입니다. 목록을 새로고침해 주세요.") from exc
            raise HTTPException(503, "학습 자료 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.") from exc

    def asset_for(asset_id, user):
        rows = get_client().table(AUDIO).select("*").eq("id", asset_id).eq("user_id", user["id"]).execute().data
        if not rows or not rows[0].get("review_import_key"):
            raise HTTPException(404, "학습 원음을 찾을 수 없습니다.")
        return rows[0]

    def all_rows(table, user, **filters):
        rows = []
        while True:
            query = get_client().table(table).select("*").eq("user_id", user["id"]).order("id")
            for key, value in filters.items():
                query = query.eq(key, value)
            page = query.range(len(rows), len(rows) + 499).execute().data or []
            rows.extend(page)
            if len(page) < 500:
                return rows

    @router.get("/access")
    async def access(user=Depends(admin)):
        return {"allowed": True}

    @router.get("/assets")
    async def assets(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100), user=Depends(admin)):
        def read():
            rows = get_client().table(AUDIO).select(
                "id,original_filename,audio_seconds,consent_status,dataset_split,created_at"
            ).eq("user_id", user["id"]).not_.is_("review_import_key", "null").order("id", desc=True).range(offset, offset + limit).execute().data or []
            return {"assets": rows[:limit], "has_more": len(rows) > limit}
        return await run(read)

    @router.post("/import")
    async def import_pair(audio: UploadFile = File(...), reference: UploadFile = File(...),
                          training_rights: bool = Form(False), user=Depends(admin)):
        if not training_rights:
            raise HTTPException(422, "음성과 텍스트의 보관·학습 활용 권한을 확인해 주세요.")
        name = unicodedata.normalize("NFC", Path((audio.filename or "").replace("\\", "/")).name)
        ext = Path(name).suffix.lower()
        if ext not in EXTENSIONS or Path(reference.filename or "").suffix.lower() != ".txt":
            raise HTTPException(422, "음원과 UTF-8 TXT 파일을 선택해 주세요.")
        raw = await reference.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise HTTPException(413, "참고문은 1MB 이하여야 합니다.")
        try:
            reference_text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(422, "TXT 파일은 UTF-8 형식이어야 합니다.")
        with tempfile.TemporaryDirectory(prefix="mallog-review-") as folder:
            path = Path(folder) / ("source" + ext)
            digest, size = hashlib.sha256(), 0
            with path.open("wb") as target:
                while chunk := await audio.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_UPLOAD:
                        raise HTTPException(413, "음원은 200MB 이하여야 합니다.")
                    digest.update(chunk)
                    target.write(chunk)

            def store():
                ffprobe = shutil.which("ffprobe")
                if not ffprobe:
                    raise HTTPException(503, "서버에 ffprobe가 필요합니다.")
                try:
                    probe = subprocess.run([ffprobe, "-v", "error", "-select_streams", "a:0", "-show_entries",
                                            "stream=codec_type:format=duration", "-of", "json", str(path)],
                                           capture_output=True, text=True, check=True, timeout=30)
                    data = json.loads(probe.stdout)
                    duration = float(data["format"]["duration"])
                    if not data.get("streams") or not math.isfinite(duration) or duration <= 0:
                        raise ValueError("Invalid audio duration")
                except (subprocess.SubprocessError, ValueError, KeyError):
                    raise HTTPException(422, "원음의 오디오 길이를 확인할 수 없습니다.")
                fingerprint = digest.hexdigest()
                key = hashlib.sha256(f"{user['id']}:{fingerprint}".encode()).hexdigest()
                existing = get_client().table(AUDIO).select("id").eq("review_import_key", key).execute().data
                if existing:
                    return {"id": existing[0]["id"], "existing": True}
                object_path = f"{user['id']}/review/{uuid.uuid4().hex}{ext}"
                bucket = get_client().storage.from_("training-audio")
                bucket.upload(object_path, str(path), {"content-type": mimetypes.guess_type(name)[0] or "application/octet-stream", "upsert": "false"})
                try:
                    rows = get_client().table(AUDIO).insert({
                        "user_id": user["id"], "storage_bucket": "training-audio", "storage_object_path": object_path,
                        "original_filename": name, "audio_seconds": math.ceil(duration), "file_size_bytes": size,
                        "sha256": fingerprint, "consent_status": "granted", "review_import_key": key,
                        "metadata": {"duration_seconds": duration, "reference_text": reference_text,
                                     "reference_kind": "unreviewed", "reference_filename": Path(reference.filename).name,
                                     "rights_confirmed_at": now(), "rights_confirmed_by": user["id"]},
                    }).execute().data
                except Exception:
                    bucket.remove([object_path])
                    raise
                return {"id": rows[0]["id"], "existing": False}
            return await run(store)

    @router.get("/assets/{asset_id}")
    async def detail(asset_id: int, user=Depends(admin)):
        def read():
            asset = asset_for(asset_id, user)
            metadata = asset.get("metadata") or {}
            return {"asset": {k: asset.get(k) for k in ("id", "original_filename", "audio_seconds", "dataset_split", "consent_status")},
                    "duration_seconds": metadata.get("duration_seconds", asset["audio_seconds"]),
                    "reference_text": metadata.get("reference_text", ""),
                    "hints": reference_hints(metadata.get("reference_text", "")),
                    "segments": all_rows(TEXT, user, audio_asset_id=asset_id, source_type="audio_review")}
        return await run(read)

    @router.get("/assets/{asset_id}/audio")
    async def audio_link(asset_id: int, user=Depends(admin)):
        def read():
            asset = asset_for(asset_id, user)
            if not valid_asset(asset):
                raise HTTPException(403, "이용 동의가 없거나 보관 기한이 만료된 음원입니다.")
            signed = get_client().storage.from_(asset["storage_bucket"]).create_signed_url(asset["storage_object_path"], 600)
            return {"url": signed.get("signedURL") or signed.get("signedUrl"), "expires_in": 600}
        return await run(read)

    @router.patch("/assets/{asset_id}")
    async def asset_settings(asset_id: int, request: Request, user=Depends(admin)):
        payload = await body(request)
        patch = {}
        if payload.get("dataset_split") in SPLITS:
            patch["dataset_split"] = payload["dataset_split"]
        if payload.get("consent_status") in {"granted", "revoked"}:
            patch["consent_status"] = payload["consent_status"]
        if not patch:
            raise HTTPException(422, "변경할 분류 또는 동의 상태가 필요합니다.")
        def update():
            asset_for(asset_id, user)
            return get_client().table(AUDIO).update(patch).eq("id", asset_id).eq("user_id", user["id"]).execute().data[0]
        return await run(update)

    @router.post("/assets/{asset_id}/segments")
    async def create_segment(asset_id: int, request: Request, user=Depends(admin)):
        payload = await body(request)
        def create():
            asset = asset_for(asset_id, user)
            fields = validate_review({**payload, "quality_status": "needs_review"}, asset)
            return get_client().table(TEXT).insert({**fields, "user_id": user["id"], "audio_asset_id": asset_id,
                "source_type": "audio_review", "language": "ko", "current_result": "", "raw_transcript": None,
                "train_split": "unassigned"}).execute().data[0]
        return await run(create)

    @router.put("/segments/{segment_id}")
    async def save_segment(segment_id: int, request: Request, user=Depends(admin)):
        payload = await body(request)
        if type(payload.get("review_version")) is not int:
            raise HTTPException(422, "검수 버전이 필요합니다.")
        def save():
            rows = get_client().table(TEXT).select("*").eq("id", segment_id).eq("user_id", user["id"]).eq("source_type", "audio_review").execute().data
            if not rows:
                raise HTTPException(404, "검수 구간을 찾을 수 없습니다.")
            previous = rows[0]
            asset = asset_for(previous["audio_asset_id"], user)
            fields = validate_review(payload, asset)
            language = payload.get("language", previous["language"])
            if language not in {"ko", "en", "ja"}:
                raise HTTPException(422, "지원하지 않는 언어입니다.")
            approved = fields["quality_status"] == "approved"
            # Revision snapshots plus CAS prevent one review silently replacing another.
            history = list((previous.get("metadata") or {}).get("history", []))[-49:]
            history.append({"version": previous["review_version"], "text": previous["final_result"],
                            "start_seconds": previous["start_seconds"], "end_seconds": previous["end_seconds"],
                            "status": previous["quality_status"], "at": now(), "by": user["id"]})
            fields["metadata"]["history"] = history
            result = get_client().table(TEXT).update({**fields, "language": language,
                "review_version": payload["review_version"] + 1, "reviewed_by": user["id"] if approved else None,
                "reviewed_at": now() if approved else None,
            }).eq("id", segment_id).eq("user_id", user["id"]).eq("review_version", payload["review_version"]).execute().data
            if not result:
                raise HTTPException(409, "다른 창에서 수정되었습니다. 새로고침 후 다시 검수해 주세요.")
            return result[0]
        return await run(save)

    @router.get("/export")
    async def export(user=Depends(admin)):
        def read():
            return export_rows(all_rows(AUDIO, user), all_rows(TEXT, user, source_type="audio_review", quality_status="approved"))
        rows = await run(read)
        if not rows:
            raise HTTPException(409, "검수 완료 및 학습/평가 분류를 지정한 구간이 없습니다.")
        return Response("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
                        media_type="application/x-ndjson", headers={"Content-Disposition": 'attachment; filename="reviewed-dataset.jsonl"', "Cache-Control": "no-store"})

    return router
