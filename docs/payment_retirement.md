# mallog24 결제 기능 종료 기록

mallog24는 2026년 9월 11일부터 로그인 사용자에게 전체 기능을 무료로 제공합니다.

## 적용 범위

- 웹, Android, iOS의 결제, 구독, 업그레이드, 구매 복원 UI 제거
- Apple IAP 네이티브 모듈과 상품 ID 설정 제거
- PortOne, TossPayments, Stripe 런타임 의존성과 배포 환경변수 제거
- `/api/billing/*` 경로 종료 및 OpenAPI 비노출
- 로그인 계정의 월간 변환 한도 제거
- 비로그인 체험의 오남용 방지 제한 유지

## 과거 기록

기존 `billing_subscriptions`와 환불 관련 행은 회계, 분쟁 대응, 법정 보존 목적의
과거 기록으로만 유지합니다. 신규 결제 상태를 이 테이블에 기록하지 않습니다.

## 외부 서비스 정리

- App Store Connect에서 기존 자동 갱신 구독을 판매 중지합니다.
- Render와 EAS에 저장된 PortOne, TossPayments, Stripe, Apple IAP 비밀값을 삭제합니다.
- 배포된 앱에서 결제 화면이 사라진 것을 확인한 뒤 새 바이너리를 스토어에 제출합니다.
- AdSense와 AdMob은 결제 수단이 아니므로 광고 운영 여부에 따라 별도로 관리합니다.
