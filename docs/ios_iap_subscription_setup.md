# iOS Apple IAP 구독 설정 체크리스트

mallog24 iOS 앱은 App Store 심사 정책 3.1.1 대응을 위해 Pro 구독을 Apple In-App Purchase로 제공합니다. iOS에서는 Apple IAP로 검증된 구독만 Pro 권한으로 인정하고, 웹/안드로이드의 PortOne 구독은 iOS 앱 안에서 Pro로 표시하지 않습니다.

## 1. App Store Connect 상품

- 유형: 자동 갱신 구독(Auto-Renewable Subscription)
- 상품 ID: `com.mallog24.app.pro.monthly`
- 구독 그룹: mallog24 Pro
- 상품명 예시: mallog24 Pro Monthly Subscription
- 가격: 정책에 맞는 Apple 가격 티어 선택
- 상태: 앱 버전과 함께 심사 제출 필요

상품 ID를 바꾸면 다음 값도 모두 같은 값으로 맞춰야 합니다.

- `mobile/.env` 또는 EAS 환경변수: `EXPO_PUBLIC_APPLE_IAP_PRODUCT_ID_PRO`
- Render backend 환경변수: `APPLE_IAP_PRODUCT_ID_PRO`
- App Store Connect IAP Product ID

## 2. Render backend 환경변수

```env
APPLE_IAP_PRODUCT_ID_PRO=com.mallog24.app.pro.monthly
APPLE_IAP_SHARED_SECRET=앱별 공유 암호 또는 구독 영수증 검증용 shared secret
APPLE_IAP_BUNDLE_ID=com.mallog24.app
APPLE_IAP_ALLOW_UNVERIFIED_JWS=false
```

`APPLE_IAP_ALLOW_UNVERIFIED_JWS`는 운영에서 반드시 `false`로 유지합니다. 영수증 검증은 Apple `verifyReceipt` 응답을 기준으로 처리합니다.

## 3. Supabase SQL

`backend/sql/billing_subscriptions.sql`을 Supabase SQL Editor에서 실행해 `billing_subscriptions.provider`에 `apple` 값이 허용되도록 합니다.

실행 후 PostgREST 스키마 캐시를 갱신합니다.

```sql
NOTIFY pgrst, 'reload schema';
```

## 4. iOS 앱 빌드 전 확인

- `mobile/package.json`에 `expo-iap`가 설치되어 있어야 합니다.
- iOS 전용 IAP UI는 `mobile/components/AppleIapSubscriptionCard.ios.js`에 있습니다.
- Android에서는 `mobile/components/AppleIapSubscriptionCard.js`가 `null`을 반환하므로 기존 Android 앱에서 `expo-iap` 네이티브 모듈을 로드하지 않습니다.
- iOS 앱 설정 화면에 Apple Pro 구독 카드가 보여야 합니다.

## 5. 심사 제출 메모 권장 문구

App Review Information에 아래 내용을 요약해서 적습니다.

```text
The iOS app provides Pro subscription through Apple In-App Purchase in Settings > Apple Pro Subscription. External web/Android subscriptions are not unlocked as Pro inside the iOS app unless an active Apple IAP subscription is verified. Users can purchase, restore, and manage the Apple subscription in the app.
```

## 6. 심사 전 기능 확인

- 새 계정 또는 데모 계정으로 로그인
- 설정 탭 이동
- Apple Pro Subscription 카드 노출 확인
- Subscribe with Apple 버튼으로 Apple 결제 시트 호출 확인
- Sandbox 구매 후 Pro 표시 확인
- Restore Purchases 버튼으로 복원 확인
- Manage Apple Subscription 버튼으로 Apple 구독 관리 화면 이동 확인

## 7. 실패 시 우선 확인

- App Store Connect 상품 ID와 앱 환경변수가 완전히 같은지 확인
- IAP 상품이 앱 버전에 함께 제출되었는지 확인
- Render에 `APPLE_IAP_SHARED_SECRET`이 들어갔는지 확인
- Supabase `billing_subscriptions` 제약조건에 `apple`이 허용됐는지 확인
- iOS 빌드를 새로 만들었는지 확인. JS 업데이트만으로는 새 네이티브 모듈이 포함되지 않습니다.
