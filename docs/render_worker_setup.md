# Render Worker Setup

mallog24 백엔드의 긴 음성 변환을 웹 프로세스에서 분리하기 위한 Render 설정 체크리스트입니다.

## 1. Supabase SQL 먼저 적용

Supabase SQL Editor에서 아래 파일 내용을 순서대로 실행합니다.

1. `backend/sql/transcription_jobs.sql`
2. `backend/sql/transcription_storage_bucket.sql`

각 실행 뒤에 `NOTIFY pgrst, 'reload schema';` 가 포함되어 있습니다.

## 2. 기존 Web 서비스 설정

서비스: `darakbang-transcription-backend`

추가 환경변수:

```env
TRANSCRIPTION_USE_WORKER_QUEUE=true
TRANSCRIPTION_STORAGE_BUCKET=transcription-inputs
TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS=5
INLINE_TRANSCRIPTION_MAX_AUDIO_SECONDS=0
GUEST_INLINE_MAX_AUDIO_SECONDS=600
WHISPER_CHUNK_CONCURRENCY=2
GEMINI_CORRECTION_CHUNK_CONCURRENCY=2
```

주의:

- Worker 서비스가 준비되기 전에는 `TRANSCRIPTION_USE_WORKER_QUEUE=true` 를 켜지 않는 것이 안전합니다.
- 짧은 파일은 인라인 처리 경로를 계속 사용하므로 완전히 멈추지는 않지만, 긴 파일은 Worker가 필요합니다.

## 3. 새 Worker 서비스 생성

Render에서 새 서비스 생성:

1. `New +`
2. `Web Service` 또는 `Background Worker` 유형 선택
3. 동일한 GitHub 저장소 `darakbang-transcription` 연결
4. Dockerfile은 기존 `backend/Dockerfile` 사용
5. 실행 명령은 `python worker.py` 로 override

Render UI에 따라 항목명이 `Start Command`, `Docker Command`, `Command Override` 등으로 보일 수 있습니다.

## 4. Worker 서비스 환경변수

가장 안전한 방법:

- 기존 백엔드 환경변수를 거의 그대로 복사
- 아래 값은 반드시 포함

필수:

```env
SUPABASE_URL=...
SUPABASE_KEY=...
GEMINI_API_KEY=...
OPENAI_API_KEY=...
TRANSCRIPTION_USE_WORKER_QUEUE=true
TRANSCRIPTION_STORAGE_BUCKET=transcription-inputs
TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS=5
```

권장:

```env
TRANSCRIPTION_ENGINE_MODE=auto
FORCE_GC_AFTER_TRANSCRIPTION=true
MAX_CONCURRENT_TRANSCRIPTIONS=1
TASK_STUCK_TIMEOUT_SECONDS=7200
```

## 5. 배포 순서

권장 순서:

1. Supabase SQL 적용
2. Worker 서비스 생성 및 배포 성공 확인
3. 기존 Web 서비스에 `TRANSCRIPTION_USE_WORKER_QUEUE=true` 적용
4. Web 서비스 재배포
5. 새 긴 파일 업로드 테스트

## 6. 테스트 기준

짧은 파일:

- 3분 이하 파일로 테스트
- 즉시 완료 또는 빠른 완료 응답 확인

긴 파일:

- 10분 이상 파일 업로드
- 응답이 `queued` 로 오고, 이후 상태가 `processing` -> `completed` 로 이동하는지 확인

## 7. 장애 시 점검 포인트

`queued` 에서 안 움직이면:

- Worker 서비스 실행 여부 확인
- Worker 로그에서 `mallog24 transcription worker started` 출력 확인
- `TRANSCRIPTION_USE_WORKER_QUEUE=true` 가 Web/Worker 둘 다에 있는지 확인
- Supabase `transcription_jobs` 테이블에서 `worker_id`, `claimed_at`, `status` 값 확인

Storage 업로드 실패 시:

- `transcription-inputs` 버킷 생성 여부 확인
- `SUPABASE_URL`, `SUPABASE_KEY` 값 재확인

여전히 `not_found` 가 뜨면:

- 새 작업인지 확인
- 오래된 실패 task_id 재조회가 아닌지 확인
- `transcription_jobs` 테이블에 해당 `task_id` 가 생성되는지 확인
