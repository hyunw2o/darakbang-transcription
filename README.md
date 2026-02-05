# 다락방 설교 녹취 변환 시스템

류광수/이주현 목사 계열 다락방 전도운동 교회 전용 AI 음성 녹취 시스템

## 🎯 특징

- **다락방 용어 특화**: 렘넌트, 237, 5000종족, 7망대, 7여정, 7이정표
- **영문 용어 유지**: Heavenly, Thronely, Eternally, CVDIP
- **약어 인식**: TCK, CCK, NCK
- **성경 구절 자동 정리**: "요한복음 3장 16절" 형식
- **주보용 요약 자동 생성**

## 🚀 빠른 시작

### 필수 요구사항

- Python 3.8+
- Node.js 16+
- OpenAI API 키 ($18 무료 크레딧)
- Anthropic API 키 ($5 무료 크레딧)

### 1. 백엔드 실행

```bash
cd backend

# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일에 API 키 입력

# 서버 실행
uvicorn main:app --reload
```

### 2. 프론트엔드 실행 (새 터미널)

```bash
cd frontend

# 패키지 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local

# 개발 서버 실행
npm run dev
```

### 3. 접속

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/docs

## 📋 API 키 발급

### OpenAI ($18 무료)
1. https://platform.openai.com 접속
2. API Keys → Create new secret key
3. backend/.env 파일에 입력

### Anthropic ($5 무료)
1. https://console.anthropic.com 접속
2. API Keys → Create Key
3. backend/.env 파일에 입력

## 🌐 배포

### 백엔드 (Railway - 무료)
1. railway.app 가입
2. GitHub 연결
3. backend 폴더 배포
4. 환경변수 설정
5. 배포 URL 복사

### 프론트엔드 (Vercel - 무료)
1. vercel.com 가입
2. GitHub 연결
3. frontend 폴더 배포
4. 환경변수 설정 (NEXT_PUBLIC_API_URL)
5. 배포 완료

## 📁 프로젝트 구조

```
darakbang-transcription/
├── backend/              # FastAPI 백엔드
│   ├── main.py          # API 서버
│   ├── church_terms.py  # 다락방 용어 사전
│   └── requirements.txt
└── frontend/            # Next.js 프론트엔드
    ├── pages/
    │   └── index.js     # 메인 페이지
    └── package.json
```

## 🛠️ 용어 커스터마이징

`backend/church_terms.py` 파일에서 용어 추가/수정:

```python
# 교회 특화 용어 추가
DARAKBANG_CORE = [
    "렘넌트", "237", "5000",
    # 여기에 추가...
]

# 자주 틀리는 발음 교정
COMMON_MISTAKES = {
    "램넌트": "렘넌트",
    # 여기에 추가...
}
```

## 💡 사용 예시

1. 설교 음성 파일 업로드 (MP3, WAV 등)
2. 자동 변환 (약 30초-1분)
3. 다락방 용어 교정된 텍스트 확인
4. 주보용 요약 생성
5. 복사해서 주보/홈페이지에 사용

## 📊 비용

- 설교 1시간당 약 600원
- 월 100건 처리 시: 약 6만원
- 무료 크레딧으로 50건 무료 사용 가능

## ❓ 문제 해결

### 백엔드가 안 켜져요
- Python 가상환경 활성화 확인
- 패키지 설치 확인: `pip install -r requirements.txt`
- API 키 확인: `.env` 파일

### 프론트엔드가 안 켜져요
- Node.js 설치 확인
- 패키지 설치: `npm install`
- 백엔드 URL 확인: `.env.local` 파일

### 변환이 안 돼요
- 파일 크기 확인 (25MB 이하)
- API 키 잔액 확인
- 브라우저 콘솔 에러 확인

## 📞 지원

- 백엔드 문제: backend/README.md 참고
- 프론트엔드 문제: frontend/README.md 참고

## 📄 라이센스

개인/교회 사용 자유
상업적 사용 시 문의 필요
