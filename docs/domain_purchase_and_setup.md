# mallog24/OURS 실도메인 구매 및 연결 가이드

업데이트 기준일: 2026-02-19

이 문서는 현재 운영 구조를 기준으로 작성했습니다.

- OURS 랜딩: Vercel (`ours-homepage`)
- mallog24 웹앱: Vercel (`darakbang-transcription/frontend`)
- API 백엔드: Render (`darakbang-transcription/backend`)
- 인증/DB: Supabase
- 모바일 앱: Expo/React Native (`darakbang-transcription/mobile`)

---

## 0) 결론 먼저 (추천안 확정)

`mallog24.ai`를 메인으로 간다면, 현 시점 기준으로는 **해외 등록업체 사용이 유리**합니다.

- 1순위: **Porkbun** (구매 UI가 단순, `.ai` 가격 경쟁력)
- 2순위: Dynadot (안정적, `.ai` 가격도 좋음)
- 3순위: Namecheap (친숙하지만 `.ai` 갱신가가 상대적으로 높을 수 있음)

국내 플랫폼은 세금계산서/국문 CS가 장점이지만,
`.ai`는 해외가 일반적으로 선택지/가격/운영 문서 측면에서 유리한 편입니다.

---

## 1) 도메인 어디서 살지 (추천 + 가격 감각)

가격은 상시 변동되므로 결제 직전 반드시 재확인하세요.

### 추천 우선순위

1. Dynadot: `.com`, `.ai` 모두 비교적 안정적으로 저렴
2. Porkbun: `.ai` 가격 경쟁력이 좋은 편
3. Namecheap: UI 편하고 프로모션이 있으나 갱신가 확인 필수
4. Cloudflare Registrar: 마진 없이 원가 정책(갱신/이전비 절감용으로 좋음)

### 참고 가격 (USD)

- `.com`
  - Dynadot: 등록/갱신 약 `$10.88`
  - Namecheap: 등록 약 `$10.98`, 갱신 약 `$18.48` (신규 프로모션 별도)
- `.ai`
  - Dynadot: 등록/갱신 약 `$74.90`
  - Porkbun: 등록/갱신 약 `$72.40`
  - Namecheap: 등록 `$79.98/년` 수준(2년 결제 표시), 갱신 `$92.98/년` 수준

### 실무 예산 권장치

- `.com` 1년: `12~20달러`
- `.ai` 1년: `75~100달러` (등록 시 2년 결제가 걸리는 곳이 있어 초기 결제액은 150~200달러 구간이 흔함)

---

## 2) 권장 도메인 구조 (예시: `mallog24.ai`)

- `mallog24.ai` -> mallog24 웹앱 (Vercel)
- `www.mallog24.ai` -> mallog24 웹앱 (Vercel)
- `ours.mallog24.ai` -> OURS 랜딩 (Vercel)
- `api.mallog24.ai` -> Render 백엔드

---

## 2.1) 실제 등록 절차 (Porkbun 기준)

1. https://porkbun.com 접속 -> 회원가입/로그인
2. 검색창에 `mallog24.ai` 입력 -> 등록 가능 여부 확인
3. 장바구니에서 기간 선택 (보통 1년 또는 2년)
4. 옵션 확인
   - WHOIS Privacy: 기본 포함인지 확인
   - Auto Renew: ON 권장
5. 결제 완료
6. 결제 후 Domain Management -> `mallog24.ai` -> DNS Records로 이동
7. 아래 3번 표의 DNS 레코드를 그대로 입력
8. 저장 후 Vercel/Render에서 도메인 검증 완료될 때까지 대기

체크 포인트:

- 결제 직전 **등록가 + 갱신가** 둘 다 확인
- `.ai`는 업체별로 2년 결제 구조가 있을 수 있으니 주문서 금액을 마지막에 재확인

---

## 3) DNS 레코드 템플릿

도메인 구매처 DNS에서 아래를 추가합니다.

| Host | Type | Value | 용도 |
|---|---|---|---|
| `@` | `A` | Vercel 대시보드가 제시한 IP | `mallog24.ai` (apex) |
| `www` | `CNAME` | `cname.vercel-dns.com` | `www.mallog24.ai` |
| `ours` | `CNAME` | `cname.vercel-dns.com` | OURS 랜딩 |
| `api` | `CNAME` | `darakbang-transcription-backend.onrender.com` | 백엔드 API |

주의:

- Vercel apex는 반드시 Vercel 프로젝트 도메인 화면에서 안내하는 값을 우선 사용하세요.
- Render는 루트 도메인 연결 시 `A 216.24.57.1` 방식도 지원하지만, 현재 구성은 `api` 서브도메인이므로 `CNAME`이 간단합니다.

---

## 4) Vercel 설정

### mallog24 프론트 프로젝트

- Domains
  - `mallog24.ai`
  - `www.mallog24.ai`
- Environment Variables
  - `NEXT_PUBLIC_API_URL=https://api.mallog24.ai`
  - `NEXT_PUBLIC_OURS_URL=https://ours.mallog24.ai`

### OURS 홈페이지 프로젝트

- Domains
  - `ours.mallog24.ai`

---

## 5) Render 설정

서비스: `darakbang-transcription-backend`

- Custom Domains
  - `api.mallog24.ai` 추가
- Environment Variables 예시
  - `CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://mallog24.ai,https://www.mallog24.ai,https://mallog24.vercel.app,https://www.mallog24.vercel.app`
  - `OAUTH_REDIRECT_ALLOW_HOSTS=localhost,127.0.0.1,mallog24.ai,www.mallog24.ai,mallog24.vercel.app,www.mallog24.vercel.app`
  - `OAUTH_REDIRECT_ALLOW_SCHEMES=http,https,mallog24,exp`

---

## 6) Supabase Auth 설정

Dashboard -> Authentication -> URL Configuration

- Site URL
  - `https://mallog24.ai`
- Redirect URLs (권장)
  - `https://mallog24.ai`
  - `https://www.mallog24.ai`
  - `https://mallog24.ai/en`
  - `https://www.mallog24.ai/en`
  - `mallog24://auth-callback`
  - `exp://*`

Social Provider(Google/Kakao)는 Supabase에서 제공하는 Callback URL을 그대로 복사해 각 콘솔에 등록하세요.

---

## 7) 모바일 앱 설정 (`mobile/.env`)

```env
EXPO_PUBLIC_API_URL=https://api.mallog24.ai
EXPO_PUBLIC_PRIVACY_URL_KO=https://ours.mallog24.ai/privacy
EXPO_PUBLIC_PRIVACY_URL_EN=https://ours.mallog24.ai/privacy-en
```

`mobile/app.json`의 `scheme`는 이미 `mallog24`로 설정되어 있으므로 유지하면 됩니다.

---

## 8) 최종 점검 체크리스트

- [ ] DNS 전파 완료(보통 수분~수시간)
- [ ] `https://mallog24.ai` 접속 OK
- [ ] `https://ours.mallog24.ai` 접속 OK
- [ ] `https://api.mallog24.ai/health` 응답 OK
- [ ] 웹 구글/카카오 로그인 성공
- [ ] 모바일 로그인 성공 (`mallog24://auth-callback` 동작)
- [ ] 변환 API 호출/기록 저장 정상

---

## 참고 출처

- Dynadot pricing (`.com`, `.ai`):  
  https://www.dynadot.com/domain/extensions?domain=.COM  
  https://www.dynadot.com/domain/extensions?domain=.AI
- Namecheap pricing (`.com`, `.ai`):  
  https://www.namecheap.com/promos/new-com-promo/  
  https://www.namecheap.com/domains/domain-name-search/  
  https://www.namecheap.com/domains/ai/
- Porkbun pricing (`.ai`) 및 수수료 안내:  
  https://porkbun.com/products/domains/pricing  
  https://porkbun.com/about
- Cloudflare Registrar pricing policy (at-cost):  
  https://developers.cloudflare.com/registrar/faq/#what-fees-are-included-in-the-domain-pricing
- Vercel custom domain DNS:  
  https://vercel.com/docs/domains/working-with-domains/add-a-domain
- Render custom domain DNS:  
  https://render.com/docs/custom-domains
- Supabase Auth redirect URLs:  
  https://supabase.com/docs/guides/auth/redirect-urls
