# Login-required transcription

## Backend and client contract

- All new transcription uploads and status/result reads require a verified user.
  Mobile clients send `Authorization: Bearer <access_token>`; web clients may use
  the existing HttpOnly `mallog24_session` cookie with credentials enabled.
- `X-Guest-Session-Id` is ignored as authentication, even when sent alongside a
  cookie or an invalid bearer token. Explicit authorization takes precedence over
  cookies; an invalid explicit token never falls back to the cookie or a guest.
- Missing/invalid authentication returns `401` before operational route body
  parsing, database readiness checks, audio inspection, storage or ASR work.
  Existing identity-provider outages and concurrency-session errors retain their
  own error responses.
- Writes using session-cookie credentials require an allowed `Origin`, or an allowed origin
  derived from `Referer` when `Origin` is absent. Allowed origins are the API's
  own origin and configured CORS origins/regex. Missing/untrusted origins return
  `403`; a guest header does not bypass this check. Bearer clients do not need
  browser-origin headers. CORS preflight remains public.
- `GET /api/guest/usage` is retired and always returns `401` with
  `code: "authentication_required"`, `login_required: true` and
  `guest_transcription_enabled: false`. Legacy apps must offer login and use
  `GET /api/usage` after sign-in.
- Signed-in access remains free and unlimited. Admin-only per-transcription API
  usage stays admin-only. Results, history and saved records stay owner-scoped;
  another user's task returns the existing `status: "not_found"` response.

The early authentication boundary covers `/api/transcribe`, `/api/status/*`,
`/api/history`, `/api/usage`, `/api/glossary`, `/api/records`, `/api/corrections`,
`/api/summarize`, `/api/auth/me`, `/api/auth/bootstrap`, `/api/auth/account`, and
their child paths. Existing route-level authorization remains in place.

Health, API metadata, public stats, enabled reference terms, OpenAPI docs,
login/signup, Apple/OAuth/session entry points, and password recovery remain
available without an existing login. Recovery confirmation still requires its
recovery token. Frontend legal pages are outside this backend boundary. Retired
billing APIs keep their existing `410` responses.

Historical guest helpers and worker handling are retained for old queued jobs;
`GUEST_TRANSCRIPTION_ENABLED` can no longer enable new guest requests. The ASR
pipeline, worker queue and signed-in history persistence are not replaced.

## Website and apps

- The first functional screen is login, signup or password recovery. Upload,
  microphone recording, transcription, history, saved records and personal
  glossary operations are unavailable until the server verifies the account.
  Informational guides, terms, privacy and contact links remain public.
- Web cookie sessions are verified through bootstrap before mounting a workspace.
  Native stored tokens are verified through `/api/auth/me`, not trusted just
  because storage contains a token. Signup awaiting email confirmation grants
  no access. Native recovery credentials never become a workspace session.
- Logout, expiry or a protected `401` invalidates the request generation, stops
  client polling and microphone recording, and discards late responses. This
  does not cancel an already accepted server transcription: the owner can sign
  back in and open it from history. Temporary network failures remain retryable.
- The web workspace separates conversion, history, saved records and glossary.
  The apps keep conversion, history, records and settings in four stable tabs.
  Both use flat sections, restrained controls, free-account labels and wrapping
  text. Mobile web language/type selectors stack to avoid truncating labels.

## Local checks

With `backend/requirements.txt` installed:

```sh
python backend/scripts/check_login_required.py --self-test
python backend/scripts/smoke_transcription_api.py --self-test
python backend/scripts/run_post_deploy_checks.py --self-test
python -m py_compile backend/main.py backend/scripts/check_login_required.py
```

The login regression script uses the real ASGI app with fake identity/database
and ASR boundaries, never production credentials, network calls or billable ASR.
Live transcription smoke tests now need `--bearer-token` or
`MALLOG24_AUTH_TOKEN`. They are not part of these local checks.

Client checks (from each named directory):

```sh
# frontend: Playwright must be available locally or through NODE_PATH.
# CHROME_EXECUTABLE may point to an existing Chrome installation.
node --test tests/auth-gating.test.cjs
npm run build
npm run start -- -p 3106 -H 127.0.0.1
# In another terminal, with the preview server running:
UI_TEST_URL=http://127.0.0.1:3106 node scripts/check_workspace_ui.cjs

# mobile:
npm run test:session
npx expo export --platform ios --output-dir /tmp/mallog24-login-ios
npx expo export --platform android --output-dir /tmp/mallog24-login-android
```

The browser hook runner covers 18 web cases and 9 native-auth-hook cases. Native
services and storage are mocked; the native hook runs with the frontend React
renderer, not on a physical device. Eight additional native tests cover session
isolation, expiration, late responses and missing screen styles. The UI checker
uses fake accounts/API responses/audio and captures Korean/English, desktop/mobile
and dark-mode screenshots. No real transcription or billable model request is
made by these checks.

## Release boundary

This change requires deployment of both backend and frontend, followed by new
native app builds. Existing uploaded IPA/AAB files do not change. Do not reuse
an Android version code that Google Play already accepted. Native exports above
verify JavaScript/assets only, not signing, native compilation or store review.

Before production rollout, verify actual login, signup email confirmation,
Apple/Google/Kakao sign-in where supported, password reset and foreground session
expiry on devices. Check allowed web origins for cookie requests. Old apps can
still sign in, but anonymous requests will return `401` after backend deployment.
