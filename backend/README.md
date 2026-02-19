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
2. Project URL / API Key 확인
3. `.env`에 아래 값 입력
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
4. Supabase SQL Editor에서 아래 SQL 실행
   - `backend/sql/saved_records.sql` (저장 기록 테이블 + RLS 정책)
   - `backend/sql/transcriptions_user_scope.sql` (사용자별 히스토리 + RLS 정책)
   - `backend/sql/user_usage_quota.sql` (월간 사용량 추적 + 무료 플랜 한도)

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
   - `FREE_MONTHLY_LIMIT_SECONDS` (기본 10800, 무료 3시간)
   - `USAGE_TIMEZONE` (기본 `Asia/Seoul`)
5. 배포 완료 후 백엔드 URL 확인 (`https://<service-name>.onrender.com`)
6. 프론트엔드(Vercel) 환경변수 `NEXT_PUBLIC_API_URL`을 Render URL로 변경

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
- `GET /api/usage` : 이번 달 사용량 조회 (무료 한도 3시간)
- `POST /api/records/draft` : 기록본 초안 생성 (인증 필요)
- `POST /api/records` : 기록본 저장 (인증 필요)
- `GET /api/records` : 내 기록본 목록 조회 (인증 필요)
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
