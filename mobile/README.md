# mallog24 Mobile App (Native)

WebView 셸이 아니라 React Native 화면으로 mallog24 핵심 기능을 직접 구현한 앱입니다.

## 포함 기능
- 이메일 로그인/회원가입
- Google/Kakao 소셜 로그인 URL 연동
- 최초 실행 시 개인정보처리방침 동의 팝업(동의 전 사용 불가)
- 파일 선택(오디오/비디오) 후 변환 요청
- 작업 상태 폴링(`/api/status/{task_id}`)
- 변환 결과/요약 생성
- 기록본 초안 생성 및 저장
- 히스토리/저장 기록 조회

## 환경 변수
`mobile/.env` 파일 생성:

```bash
EXPO_PUBLIC_API_URL=https://<your-backend>.onrender.com
EXPO_PUBLIC_PRIVACY_URL_KO=https://ours-homepage.vercel.app/privacy
EXPO_PUBLIC_PRIVACY_URL_EN=https://ours-homepage.vercel.app/privacy-en
```

기본값은 `https://darakbang-transcription-backend.onrender.com` 입니다.

## 설치/실행
```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo install expo-linking
npx expo install --fix
npm run start
```

## SDK 불일치 에러 시
Expo Go가 SDK 54인데 프로젝트가 다르면 실행되지 않습니다.
현재 프로젝트는 SDK 54 기준입니다. 위 재설치 명령 후 다시 QR 접속하세요.

## 소셜 로그인(모바일) 필수 설정
1. 백엔드 환경변수
- `OAUTH_REDIRECT_ALLOW_SCHEMES=http,https,mallog24,exp`
- `OAUTH_REDIRECT_ALLOW_HOSTS` 기존 웹 도메인 유지

2. Supabase Auth > URL Configuration
- Redirect URLs에 아래 추가
  - `mallog24://auth-callback`
  - `exp://*`

3. Google/Kakao 개발자 콘솔에서 Supabase OAuth 리다이렉트 URL과 앱 딥링크 정책이 일치해야 함

## 주의
- Expo Go에서는 딥링크가 `exp://...` 형태일 수 있어 Supabase/백엔드 허용 설정이 필요합니다.
- 스토어 배포(standalone)에서는 `mallog24://auth-callback` 딥링크를 권장합니다.
