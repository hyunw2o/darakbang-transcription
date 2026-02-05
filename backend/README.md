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

## API 키 발급

### OpenAI ($18 무료)
1. https://platform.openai.com
2. API Keys → Create new secret key
3. .env 파일에 입력

### Anthropic ($5 무료)
1. https://console.anthropic.com
2. API Keys → Create Key
3. .env 파일에 입력

## 배포 (Railway)

1. railway.app 가입
2. GitHub 연결
3. 프로젝트 import
4. 환경변수 설정 (Railway 대시보드)
   - OPENAI_API_KEY
   - ANTHROPIC_API_KEY
5. 자동 배포 완료!

## 다락방 용어 특화

- 렘넌트, 237, 5000종족
- 7망대, 7여정, 7이정표
- Heavenly, Thronely, Eternally
- TCK, CCK, NCK, CVDIP

## 문의

- 용어 추가: church_terms.py의 DARAKBANG_CORE 수정
- 교정 규칙: church_terms.py의 COMMON_MISTAKES 수정
