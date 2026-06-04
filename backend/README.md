# 다락방 설교 녹취 API - 백엔드

류광수/이주현 목사 계열 다락방 전도운동 교회 특화 음성 녹취 API

## 빠른 시작

### 1. 설치
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 환경변수 설정
```bash
cp .env.example .env
# .env 파일을 열어서 API 키 입력
```

### 3. 실행
```bash
# 용어 테스트
python church_terms.py

# 서버 실행
uvicorn main:app --reload
```

### 4. 테스트
- http://localhost:8000 - API 정보
- http://localhost:8000/docs - Swagger UI
- http://localhost:8000/api/terms - 다락방 용어 확인

## API 키 / DB

### Gemini API 키
1. https://aistudio.google.com/app/apikey
2. `GEMINI_API_KEY` 발급 후 `.env`에 입력

### OpenAI API 키 (Whisper)
1. https://platform.openai.com
2. API Keys → Create new secret key
3. `OPENAI_API_KEY`를 `.env`에 입력 (선택 사항)

### Supabase
1. https://supabase.com 에서 프로젝트 생성
2. Project URL / API Keys 확인
3. `.env`에 아래 값 입력
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (`service_role` 또는 서버 전용 `secret key`, 프론트용 `anon/publishable` 키 사용 금지)
4. Supabase SQL Editor에서 아래 SQL 실행
   - `backend/sql/transcription_jobs.sql` (작업 상태 영속 저장: guest + 로그인 공용)
   - `backend/sql/transcription_storage_bucket.sql` (대기열용 원본 파일 공유 버킷)
   - `backend/sql/saved_records.sql` (저장 기록 테이블 + RLS 정책)
   - `backend/sql/user_glossary_terms.sql` (사용자 용어집 테이블 + RLS 정책)
   - `backend/sql/user_correction_samples.sql` (사용자 수정 결과 학습 데이터 + RLS 정책)
   - `backend/sql/training_data_assets.sql` (장기 학습 후보 음원/최종 정답 샘플 분리 보관)
   - `backend/sql/transcriptions_user_scope.sql` (사용자별 히스토리 + RLS 정책)
   - `backend/sql/user_usage_quota.sql` (월간 사용량 추적 + 무료 플랜 한도)
   - `backend/sql/billing_subscriptions.sql` (구독 결제 상태 저장 + RLS 정책)
5. SQL 실행 후 스키마 반영
   - `NOTIFY pgrst, 'reload schema';`

## 배포 (Render)

이 저장소 루트에 `render.yaml`과 `backend/Dockerfile`이 준비되어 있습니다.

1. Render 대시보드에서 `New +` → `Blueprint` 선택
2. GitHub 저장소 `darakbang-transcription` 연결
3. `render.yaml` 인식 후 `Apply` 실행
4. 환경변수 설정
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `CORS_ALLOW_ORIGINS`
   - `OAUTH_REDIRECT_ALLOW_HOSTS`
   - `OAUTH_REDIRECT_ALLOW_SCHEMES` (예: `http,https,mallog24,exp`)
   - `FREE_MONTHLY_LIMIT_SECONDS` (기본 36000, 무료 10시간)
   - `INLINE_TRANSCRIPTION_MAX_AUDIO_SECONDS` (기본 0, 로그인 파일은 즉시 queued 응답 후 폴링 처리. 아주 짧은 파일만 인라인 대기시키고 싶으면 소수 초로 조정)
   - `WHISPER_CHUNK_CONCURRENCY` (기본 2, Whisper 청크 병렬 처리 수)
   - `GEMINI_CORRECTION_CHUNK_CONCURRENCY` (기본 2, Gemini 교정 청크 병렬 처리 수)
   - `TRANSCRIPTION_USE_WORKER_QUEUE` (`true`면 긴 작업을 스토리지+워커 대기열로 분리)
   - `TRANSCRIPTION_STORAGE_BUCKET` (기본 `transcription-inputs`)
   - `TRANSCRIPTION_WORKER_POLL_INTERVAL_SECONDS` (기본 5초)
   - `OPTIONAL_SUPABASE_WRITE_TIMEOUT_SECONDS` (기본 5초, 학습 후보 저장 같은 선택적 DB 쓰기 제한)
   - `USAGE_TIMEZONE` (기본 `Asia/Seoul`)
   - `ADMIN_BYPASS_EMAILS` (쉼표 구분, 등록 계정은 무료 한도 우회)
   - `ADMIN_BYPASS_USER_IDS` (쉼표 구분, Supabase auth.users UUID 기준)
   - `BILLING_PROVIDER` (권장 기본 `portone`, 필요 시 `stripe`)
   - `BILLING_TEST_MODE` (테스트 플로우 확인 시 `true`)
   - `MOCK_CHECKOUT_SESSION_TTL_SECONDS` (기본 1800초)
   - `PORTONE_STORE_ID` (또는 `PORTONE_MID`), `PORTONE_CHANNEL_KEY`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`
   - `PAID_PLAN_AMOUNT_KRW` (기본 8800, VAT 포함), `PAID_PLAN_PRODUCT_NAME_KO`, `PAID_PLAN_PRODUCT_NAME_EN`
   - `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` (tosspayments 사용 시)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO` (글로벌 확장 시)
   - `PAID_PLAN_TIER` (기본 `pro`)
   - `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL`, `BILLING_PORTAL_RETURN_URL` (선택)
5. 배포 완료 후 백엔드 URL 확인 (`https://<service-name>.onrender.com`)
6. 프론트엔드(Vercel) 환경변수 `NEXT_PUBLIC_API_URL`을 Render URL로 변경

### Worker 분리 운영

긴 파일을 웹 프로세스와 분리하려면:

1. `TRANSCRIPTION_USE_WORKER_QUEUE=true` 설정
2. `backend/sql/transcription_jobs.sql`, `backend/sql/transcription_storage_bucket.sql` 실행
3. Render에서 별도 Worker 서비스를 만들고 시작 명령을 아래로 설정

```bash
python worker.py
```

4. Worker에도 동일한 환경변수(`SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` 등)를 넣습니다.

## 교정 파인튜닝 데이터셋 준비

사용자가 변환 결과 또는 기록본 초안을 직접 수정하고 품질 개선 학습 데이터 제공에 명시적으로 동의한 뒤 저장하면 `user_correction_samples`에 원본과 수정본이 누적됩니다.
실제 파인튜닝을 시작하기 전에 아래 스크립트로 JSONL 데이터셋을 만들고 필터링 통계를 확인하세요.

장기 학습 후보 데이터는 운영 기록과 분리해서 관리합니다.

- `transcription-inputs`: 변환 대기열/운영용 원본 업로드 임시 보관
- `training-audio`: 사용자 동의와 보관 정책을 통과한 장기 학습 후보 음원
- `training_audio_assets`: 장기 학습 후보 음원의 소유자, 원본 경로, 길이, 보관/동의 상태
- `training_text_samples`: 현재 변환 결과(`current_result`)와 사용자가 수정한 최종 정답(`final_result`)을 연결한 학습 후보 텍스트

사용자가 수정 결과를 학습 데이터로 제공하는 데 동의한 경우에만 기존 `user_correction_samples` 저장 성공 후 `training_text_samples`에도 `candidate` 상태로 복제됩니다.
`training_data_assets.sql`이 아직 실행되지 않은 환경에서는 기존 저장 흐름을 유지하고 서버 로그에 경고만 남깁니다.

초기 단계에서는 기존 변환 파이프라인이 음성 원본을 `training-audio`로 자동 복사하지 않습니다.
음성 원본을 ASR 파인튜닝 후보로 장기 보관하려면 먼저 약관/개인정보처리방침, 사용자 동의 UI, 삭제/철회 플로우를 확정한 뒤 서버에서 명시적으로 복사하도록 연결하세요.

먼저 누적 샘플의 분포와 주요 교정 패턴을 확인합니다. 기본 출력에는 원문/수정문 전문을 넣지 않습니다.

```bash
python backend/scripts/report_correction_samples.py \
  --from-supabase \
  --min-kept 50 \
  --asr-threshold 20 \
  --output backend/finetune_datasets/correction_sample_report.json
```

리포트의 `ready_to_train`은 교정 모델 파인튜닝 준비 여부이고,
`ready_for_asr_fine_tune`은 RVS/RUTC 같은 도메인 용어로 반복 교정되는 패턴이
`--asr-threshold` 이상 누적됐는지 보는 5차 판단 신호입니다.
`kept_gap`과 `next_action.stage`는 4차로 넘어가기 전 추가로 필요한 샘플 수와 다음 작업을 요약합니다.
CI나 수동 배포 점검에서 준비가 안 된 상태를 실패로 보고 싶으면 `--fail-unready`를 붙입니다.

```bash
python backend/scripts/export_correction_finetune_dataset.py \
  --from-supabase \
  --output backend/finetune_datasets/correction_train.jsonl \
  --validation-output backend/finetune_datasets/correction_validation.jsonl \
  --stats-output backend/finetune_datasets/correction_train.stats.json \
  --min-kept 50
```

로컬 샘플 JSON을 먼저 검증할 수도 있습니다.

```bash
python backend/scripts/export_correction_finetune_dataset.py \
  --input-json samples.json \
  --dry-run
```

- 출력 파일은 OpenAI chat fine-tuning JSONL 형식의 `messages` 배열만 포함합니다.
- 동일/너무 짧은/길이 비율이 과한 샘플은 자동 제외합니다.
- `metadata.smoke_test=true`인 운영 점검 샘플은 자동 제외합니다.
- `--validation-output`을 주면 필터 통과 샘플의 최신 일부를 검증 JSONL로 분리합니다.
  기본 비율은 `--validation-ratio 0.1`이며, 필요하면 `--validation-count`로 고정할 수 있습니다.
- `--min-kept`보다 적은 샘플만 남으면 JSONL을 쓰지 않고 실패하므로, 샘플을 더 모은 뒤 다시 실행합니다.
- 생성된 `backend/finetune_datasets/`는 로컬 산출물이므로 Git에 포함하지 않습니다.
- 실제 모델 업로드 전에는 개인정보/민감정보 포함 여부와 샘플 품질을 반드시 검토하세요.

JSONL을 검토한 뒤 파인튜닝 잡을 만들려면 먼저 dry-run으로 행 수와 형식을 확인합니다.

```bash
python backend/scripts/manage_correction_finetune.py create \
  --training-file backend/finetune_datasets/correction_train.jsonl \
  --validation-file backend/finetune_datasets/correction_validation.jsonl \
  --dry-run \
  --min-examples 50
```

충분한 샘플이 있고 검토가 끝난 뒤 실제 잡을 생성합니다.

```bash
python backend/scripts/manage_correction_finetune.py create \
  --training-file backend/finetune_datasets/correction_train.jsonl \
  --validation-file backend/finetune_datasets/correction_validation.jsonl \
  --output backend/finetune_datasets/correction_finetune_job.json \
  --min-examples 50
```

진행 상태는 아래처럼 확인합니다.

```bash
python backend/scripts/manage_correction_finetune.py status ftjob_...
python backend/scripts/manage_correction_finetune.py events ftjob_...
```

잡이 성공하면 결과의 `fine_tuned_model` 값을 검증 세트로 먼저 평가합니다.

```bash
python backend/scripts/evaluate_correction_model.py \
  --validation-jsonl backend/finetune_datasets/correction_validation.jsonl \
  --model ft:gpt-4o-mini:... \
  --output backend/finetune_datasets/correction_eval_report.json \
  --fail-unready
```

평가 리포트의 `ready_to_promote`가 `true`일 때만 `CORRECTION_FINE_TUNED_MODEL`에 모델 ID를 기록합니다.
런타임 적용은 `ENABLE_FINE_TUNED_CORRECTION=true`일 때만 동작하며, 기본값은 `false`입니다.
초기 적용은 짧은 텍스트부터 검증할 수 있도록 `FINE_TUNED_CORRECTION_MAX_CHARS` 한도 안에서만 실행됩니다.

### 배포 전후 준비 상태 확인

Supabase SQL 적용 여부, 수정 샘플 수, 백엔드 `/health` 상태를 한 번에 확인합니다.

기능 변경 후 push 전 기본 게이트는 아래 스크립트로 한 번에 실행할 수 있습니다.

```bash
python backend/scripts/run_feature_quality_gates.py
```

웹 UI를 바꾼 경우에는 프론트엔드 빌드까지 함께 확인합니다.

```bash
python backend/scripts/run_feature_quality_gates.py --with-frontend-build
```

배포 직전에는 직전 안정 커밋 기준의 비파괴 롤백 계획을 출력해 둡니다.
출력되는 명령은 실행되지 않으며, 문제가 생겼을 때 `git revert` 기반으로 되돌리기 위한 참고용입니다.

```bash
python backend/scripts/print_rollback_plan.py \
  --stable-ref HEAD~1 \
  --deploy-ref HEAD
```

```bash
python backend/scripts/check_feature_readiness.py \
  --api-url https://api.mallog24.com \
  --min-finetune-examples 50
```

`missing_sql`에 항목이 있으면 표시된 SQL 파일을 Supabase SQL Editor에서 실행한 뒤
`NOTIFY pgrst, 'reload schema';` 를 실행하세요.
`fine_tuned_correction.ready_to_train`이 `true`가 되면 export 필터를 통과한 교정 샘플이 충분히 쌓인 상태입니다.
원본 row 수는 `sample_count`, 실제 학습에 남는 수는 `kept_examples`와 `dataset_stats.kept`로 확인합니다.
그 전에는 4차 파인튜닝을 시작하지 않고 샘플 수집을 계속합니다.
`report_correction_samples.py`의 `recommended_commands`에는 현재 단계에서 바로 실행할 점검/내보내기/파인튜닝/평가 명령이 함께 표시됩니다.

배포 직후에는 아래 러너로 health/readiness, 사용자 용어집 preflight, 수정 샘플 API preflight, 저장 기록본 수정 preflight,
선택적 실제 변환 스모크를 한 번에 확인할 수 있습니다. 토큰이나 오디오 파일이 없으면 해당 단계는 건너뛰며,
필수로 강제하려면 `--require-glossary-smoke`, `--require-correction-smoke`, `--require-saved-record-edit-smoke`,
`--require-saved-record-create-capture-smoke`, `--require-transcription-smoke`를 붙입니다.

```bash
MALLOG24_AUTH_TOKEN=... python backend/scripts/run_post_deploy_checks.py \
  --api-url https://api.mallog24.com \
  --audio-file /path/to/short-sample.mp3 \
  --client-platform web \
  --client-platform android \
  --expect-corrected-contains RVS \
  --expect-corrected-contains RUTC
```

사용자 용어집의 실제 생성/조회/수정/정리까지 확인하려면 아래 옵션을 추가합니다.
생성된 테스트 용어는 테스트 끝에 삭제됩니다.

```bash
MALLOG24_AUTH_TOKEN=... python backend/scripts/run_post_deploy_checks.py \
  --api-url https://api.mallog24.com \
  --exercise-glossary
```

저장 기록본의 실제 생성/수정/수정 샘플 저장/정리까지 확인하려면 아래 옵션을 추가합니다.
생성된 저장 기록본은 테스트 끝에 삭제되고, 수정 샘플은 `metadata.smoke_test=true`로 표시되어 파인튜닝 export에서 제외됩니다.

```bash
MALLOG24_AUTH_TOKEN=... python backend/scripts/run_post_deploy_checks.py \
  --api-url https://api.mallog24.com \
  --exercise-saved-record-edit
```

기록본 초안 저장 요청 안에서 수정 샘플까지 함께 캡처되는 경로를 확인하려면 아래 옵션을 사용합니다.

```bash
MALLOG24_AUTH_TOKEN=... python backend/scripts/run_post_deploy_checks.py \
  --api-url https://api.mallog24.com \
  --require-saved-record-create-capture-smoke
```

배포 직후 짧은 파일로 실제 변환 경로를 확인하려면 아래처럼 실행합니다.

```bash
python backend/scripts/smoke_transcription_api.py \
  --api-url https://api.mallog24.com \
  --audio-file /path/to/short-sample.mp3 \
  --client-platform android \
  --expect-corrected-contains RVS \
  --expect-corrected-contains RUTC
```

수정 샘플 저장 API의 인증/스키마 경로만 확인하려면 기본 preflight 모드로 실행합니다.
기본 모드는 원문과 수정문을 동일하게 보내므로 DB row를 추가하지 않습니다.

```bash
MALLOG24_AUTH_TOKEN=... python backend/scripts/smoke_correction_sample_api.py \
  --api-url https://api.mallog24.com
```

실제 insert까지 확인해야 할 때만 `--store-sample`을 붙입니다.
이때 생성되는 샘플은 `metadata.smoke_test=true`로 표시되어 파인튜닝 export와 품질 리포트에서 제외됩니다.

```bash
MALLOG24_AUTH_TOKEN=... python backend/scripts/smoke_correction_sample_api.py \
  --api-url https://api.mallog24.com \
  --store-sample
```

용어집/수정 샘플 테이블을 한 번에 적용할 SQL 파일이 필요하면 아래 명령으로 번들을 만들 수 있습니다.

```bash
python backend/scripts/build_feature_sql_bundle.py
```

기본 출력은 `/private/tmp/mallog24_feature_setup.sql`입니다.
현재 Supabase에서 빠진 테이블만 묶으려면 아래처럼 실행합니다.

```bash
python backend/scripts/build_feature_sql_bundle.py \
  --missing-only \
  --output /private/tmp/mallog24_missing_feature_setup.sql
```

### 5차 ASR 파인튜닝 판단 기준

교정 모델 파인튜닝 후에도 아래 조건이 반복될 때만 오디오 ASR 파인튜닝을 검토합니다.

- 원문 전사 단계에서 RVS/RUTC 같은 핵심 약어가 아예 누락되거나 다른 발음으로 고정 출력되는 경우
- 교정 모델이 원문에 없는 소리를 안정적으로 복원할 수 없을 만큼 STT 원문 품질이 낮은 경우
- 동일 화자/동일 녹음 환경에서 20건 이상 반복되는 오류 패턴이 쌓인 경우
- 짧은 파일 실변환 QA에서 용어집/교정 모델만으로 재현 오류가 해결되지 않는 경우
- `report_correction_samples.py`의 `ready_for_asr_fine_tune`이 `true`이고,
  `asr_escalation_candidates`에 같은 핵심 용어 오류가 반복 표시되는 경우

## 다락방 용어 특화

- 렘넌트, 237, 5000종족
- 7망대, 7여정, 7이정표
- Heavenly, Thronely, Eternally
- TCK, CCK, NCK, CVDIP

## 문의

- 용어 추가: church_terms.py의 DARAKBANG_CORE 수정
- 교정 규칙: church_terms.py의 COMMON_MISTAKES 수정

## 신규 API (인증/기록본)

- `POST /api/transcribe` : 음성 변환 시작 (인증 필요)
- `GET /api/status/{task_id}` : 작업 상태 조회 (인증 필요, 본인 작업만)
- `GET /api/history` : 내 변환 기록 조회 (인증 필요)
- `POST /api/auth/signup` : 회원가입
- `POST /api/auth/login` : 로그인
- `GET /api/auth/oauth-url` : 소셜 로그인 URL 발급 (`provider=apple|google|kakao`, `redirect_to` 필요)
- `GET /api/auth/me` : 현재 사용자 조회
- `GET /api/usage` : 이번 달 사용량 조회 (무료 한도 10시간)
- `GET /api/billing/status` : 내 구독 상태 조회
- `POST /api/billing/checkout` : 결제 체크아웃 생성 (공급자별)
- `POST /api/billing/portal` : 구독 관리 포털 생성 (공급자별)
- `POST /api/billing/webhook` : Stripe 웹훅 수신 (BILLING_PROVIDER=stripe일 때 활성)
- `GET /api/billing/portone/checkout/{session_id}` : PortOne 실결제창 호출 페이지
- `GET /api/billing/portone/complete/{session_id}` : PortOne 결제 검증 후 구독 반영
- `GET /api/billing/mock/checkout/{session_id}` : 테스트 결제 화면
- `GET /api/billing/mock/complete/{session_id}` : 테스트 결제 성공/취소 완료 처리
- `POST /api/records/draft` : 기록본 초안 생성 (인증 필요)
- `POST /api/records` : 기록본 저장 (인증 필요)
- `PUT /api/records/{record_id}` : 내 저장 기록본 수정 및 `saved_record_edit` 교정 샘플 자동 캡처 (인증 필요)
- `DELETE /api/records/{record_id}` : 내 저장 기록본 삭제 (인증 필요)
- `GET /api/records` : 내 기록본 목록 조회 (인증 필요)
- `POST /api/corrections` : 사용자가 수정한 결과 저장 (인증 필요)
- `POST /api/summarize` : 설교 요약 (인증 필요)

## 보안 설정 체크리스트

- `CORS_ALLOW_ORIGINS`: 프론트엔드 도메인만 허용 (와일드카드 금지)
- `OAUTH_REDIRECT_ALLOW_HOSTS`: OAuth 리다이렉트 도메인 화이트리스트 설정
- `OAUTH_REDIRECT_ALLOW_SCHEMES`: OAuth 리다이렉트 스킴 화이트리스트 설정 (`mallog24`, `exp` 등 모바일 딥링크 포함)
- `RATE_LIMIT_*`: 인증/변환 API 과도 호출 제한
- `MAX_UPLOAD_BYTES`, `MAX_TEXT_INPUT_CHARS`: 대용량 요청 제한
- `EXPOSE_TERMS_ENDPOINT=false`: 디버깅용 `/api/terms` 외부 비활성화
- Supabase SQL에서 RLS 정책 적용 여부 확인

## 월간 무료 한도 초기화 Cron

`backend/jobs/reset_monthly_free_usage.py`를 매월 1일에 실행하세요.

예시:

```bash
python backend/jobs/reset_monthly_free_usage.py
```

Render Cron Job 스케줄 예시: `0 0 1 * *` (UTC 기준)

## 국내 PG 우선 + Stripe 확장 전략

1. 1차 운영(국내): `BILLING_PROVIDER=portone`로 설정하고 국내 PG 키를 적용
   - 필수값: `PORTONE_CHANNEL_KEY`, `PORTONE_STORE_ID`(또는 `PORTONE_MID`), `PORTONE_API_SECRET`
   - `BILLING_TEST_MODE=false`일 때 `/api/billing/checkout`이 실제 결제창 URL을 반환
   - PortOne webhook URL: `https://<backend-domain>/api/billing/portone/webhook`
   - webhook secret 발급 후 `PORTONE_WEBHOOK_SECRET` 설정
2. 2차 글로벌: `BILLING_PROVIDER=stripe`로 전환 후 Stripe 키/Price/Webhook 설정
3. Stripe Webhook URL: `https://<backend-domain>/api/billing/webhook`
   - 이벤트: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### 테스트 결제 플로우(실제 과금 없음)

1. `BILLING_TEST_MODE=true` 설정 후 백엔드 재배포
2. `/pricing` 또는 `/pricing-en`에서 "테스트 결제 시작하기" 클릭
3. 테스트 결제 화면에서 성공/취소를 눌러 상태 반영 확인
4. 성공 시 `plan_tier=pro`, 취소 시 `plan_tier=free`로 되돌아갑니다.
