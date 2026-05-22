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

사용자가 기록본 초안을 직접 수정한 뒤 저장하면 `user_correction_samples`에 원본 초안과 수정본이 누적됩니다.
실제 파인튜닝을 시작하기 전에 아래 스크립트로 JSONL 데이터셋을 만들고 필터링 통계를 확인하세요.

```bash
python backend/scripts/export_correction_finetune_dataset.py \
  --from-supabase \
  --output backend/finetune_datasets/correction_train.jsonl \
  --stats-output backend/finetune_datasets/correction_train.stats.json
```

로컬 샘플 JSON을 먼저 검증할 수도 있습니다.

```bash
python backend/scripts/export_correction_finetune_dataset.py \
  --input-json samples.json \
  --dry-run
```

- 출력 파일은 OpenAI chat fine-tuning JSONL 형식의 `messages` 배열만 포함합니다.
- 동일/너무 짧은/길이 비율이 과한 샘플은 자동 제외합니다.
- 생성된 `backend/finetune_datasets/`는 로컬 산출물이므로 Git에 포함하지 않습니다.
- 실제 모델 업로드 전에는 개인정보/민감정보 포함 여부와 샘플 품질을 반드시 검토하세요.

JSONL을 검토한 뒤 파인튜닝 잡을 만들려면 먼저 dry-run으로 행 수와 형식을 확인합니다.

```bash
python backend/scripts/manage_correction_finetune.py create \
  --training-file backend/finetune_datasets/correction_train.jsonl \
  --dry-run \
  --min-examples 50
```

충분한 샘플이 있고 검토가 끝난 뒤 실제 잡을 생성합니다.

```bash
python backend/scripts/manage_correction_finetune.py create \
  --training-file backend/finetune_datasets/correction_train.jsonl \
  --output backend/finetune_datasets/correction_finetune_job.json \
  --min-examples 50
```

진행 상태는 아래처럼 확인합니다.

```bash
python backend/scripts/manage_correction_finetune.py status ftjob_...
python backend/scripts/manage_correction_finetune.py events ftjob_...
```

잡이 성공하면 결과의 `fine_tuned_model` 값을 `CORRECTION_FINE_TUNED_MODEL`에 기록합니다.
런타임 적용은 `ENABLE_FINE_TUNED_CORRECTION=true`일 때만 동작하며, 기본값은 `false`입니다.
초기 적용은 짧은 텍스트부터 검증할 수 있도록 `FINE_TUNED_CORRECTION_MAX_CHARS` 한도 안에서만 실행됩니다.

### 배포 전후 준비 상태 확인

Supabase SQL 적용 여부, 수정 샘플 수, 백엔드 `/health` 상태를 한 번에 확인합니다.

```bash
python backend/scripts/check_feature_readiness.py \
  --api-url https://api.mallog24.com
```

`missing_sql`에 항목이 있으면 표시된 SQL 파일을 Supabase SQL Editor에서 실행한 뒤
`NOTIFY pgrst, 'reload schema';` 를 실행하세요.
용어집/수정 샘플 테이블을 한 번에 적용할 SQL 파일이 필요하면 아래 명령으로 번들을 만들 수 있습니다.

```bash
python backend/scripts/build_feature_sql_bundle.py
```

기본 출력은 `/private/tmp/mallog24_feature_setup.sql`입니다.

### 5차 ASR 파인튜닝 판단 기준

교정 모델 파인튜닝 후에도 아래 조건이 반복될 때만 오디오 ASR 파인튜닝을 검토합니다.

- 원문 전사 단계에서 RVS/RUTC 같은 핵심 약어가 아예 누락되거나 다른 발음으로 고정 출력되는 경우
- 교정 모델이 원문에 없는 소리를 안정적으로 복원할 수 없을 만큼 STT 원문 품질이 낮은 경우
- 동일 화자/동일 녹음 환경에서 20건 이상 반복되는 오류 패턴이 쌓인 경우
- 짧은 파일 실변환 QA에서 용어집/교정 모델만으로 재현 오류가 해결되지 않는 경우

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
- `GET /api/auth/oauth-url` : 소셜 로그인 URL 발급 (`provider=google|kakao`, `redirect_to` 필요)
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
