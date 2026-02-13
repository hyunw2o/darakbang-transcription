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

## 배포 (Render)

이 저장소 루트에 `render.yaml`과 `backend/Dockerfile`이 준비되어 있습니다.

1. Render 대시보드에서 `New +` → `Blueprint` 선택
2. GitHub 저장소 `darakbang-transcription` 연결
3. `render.yaml` 인식 후 `Apply` 실행
4. 환경변수 설정
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
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
