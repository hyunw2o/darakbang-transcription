# 다락방 설교 녹취 - 프론트엔드

## 빠른 시작

### 1. 설치
```bash
cd frontend
npm install
```

### 2. 환경변수
```bash
cp .env.local.example .env.local
# 백엔드 URL 확인 (로컬: http://localhost:8000)
```

### 3. 실행
```bash
npm run dev
```

### 4. 접속
http://localhost:3000

## 배포 (Vercel)

1. vercel.com 가입
2. GitHub 연결
3. 프로젝트 import
4. 환경변수 설정:
   - NEXT_PUBLIC_API_URL = https://your-backend.railway.app
5. 배포 완료!

## 기능

- 음성 파일 업로드 (최대 25MB)
- 실시간 변환 결과 확인
- 주보용 요약 생성
- 회원가입 / 로그인
- 회의 키워드 / 진료 도움 / 설교 핵심 요약 기록본 생성 및 별도 저장
- 원본 텍스트 비교
- 클립보드 복사

## 기술 스택

- Next.js 14
- React 18
- Tailwind CSS
- Fetch API
