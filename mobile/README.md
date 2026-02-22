# mallog24 Mobile App (Native)

WebView 셸이 아니라 React Native 화면으로 mallog24 핵심 기능을 직접 구현한 앱입니다.

## 포함 기능
- 이메일 로그인/회원가입
- Google/Kakao 소셜 로그인 URL 연동
- 최초 실행 시 개인정보처리방침 동의 팝업(요약 + 동의 체크, 동의 전 사용 불가)
- 설정 탭에서 정책 문서 페이지(개인정보처리방침/이용약관/회사 정책) 상시 확인
- 설정 탭에서 공지사항/FAQ 문서 상시 확인
- 파일 선택(오디오/비디오) 후 변환 요청
- 작업 상태 폴링(`/api/status/{task_id}`)
- 변환 결과/요약 생성
- 기록본 초안 생성 및 저장
- 히스토리/저장 기록 조회

## 환경 변수
`mobile/.env` 파일 생성:

```bash
EXPO_PUBLIC_API_URL=https://<your-backend>.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_AUTH_REQUEST_TIMEOUT_MS=120000
EXPO_PUBLIC_LEGAL_DOC_VERSION=v2026.02.21
```

기본값은 `https://api.mallog24.com` 입니다.
법률 문서 버전을 개정할 때는 `EXPO_PUBLIC_LEGAL_DOC_VERSION` 값만 올리면 앱 내 표기가 함께 갱신됩니다.
소셜 로그인 시작 API가 지연될 때를 대비해 `EXPO_PUBLIC_SUPABASE_URL` 설정을 권장합니다.

## 설치/실행
```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo install expo-linking
npx expo install --fix
npm run start
```

## 출시 준비 (EAS)
1. Expo 계정 로그인
```bash
npx expo login
```

2. 프로젝트 연결 (최초 1회)
```bash
npx eas init
```

3. 프로덕션 빌드 생성
```bash
npm run release:android
npm run release:ios
```

4. 스토어 제출
```bash
npm run submit:android
npm run submit:ios
```

### 출시 전 체크리스트
- `app.json` 번들 ID/패키지명 최종 확인
  - iOS: `com.mallog24.app`
  - Android: `com.mallog24.app`
- 앱 버전 증가
  - `expo.version` (예: `1.0.1`)
  - Android `android.versionCode`는 자동 증가(`eas.json production.autoIncrement`)
  - iOS `ios.buildNumber`는 자동 증가(`eas.json production.autoIncrement`)
- 운영 API 주소 확인
  - `mobile/.env`의 `EXPO_PUBLIC_API_URL=https://api.mallog24.com`
- 개인정보처리방침/이용약관/회사정책 최신 버전 확인
- 실제 단말 테스트
  - 로그인(이메일/구글/카카오), 파일 업로드, 변환, 요약, 기록본 저장, TXT/DOCX 공유

### 주의
- 첫 `eas init` 후 생성되는 `projectId`를 `app.json`의 `expo.extra.eas.projectId`에 반영해야 할 수 있습니다.
- iOS 제출은 Apple Developer Program(유료) 등록이 필요합니다.
- Android 제출은 Google Play Console(유료) 등록이 필요합니다.

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
