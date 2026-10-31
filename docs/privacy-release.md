# Privacy release (2026-10-31)

## Changes

- Web AdSense script, ad authorization files, native AdMob component, dependency and Expo plugin removed. Android AD_ID is blocked. A native store update is required; old installed binaries are not remotely stripped of SDKs.
- Explicit, unchecked AI transfer consent is stored per account/version in Supabase Auth `app_metadata`. Only the backend service role writes it. User-editable metadata and old device-local consent are not trusted. No SQL migration is required.
- Uploads, summaries and drafts are blocked before body parsing without consent. Workers recheck before AI requests. Login, history and deletion remain accessible when consent is declined. Revocation cannot recall a request already sent.
- Deletion first marks the account as deleting, cancels queued jobs and waits for active jobs to finish/stop. Physical storage objects are removed before database references. Cleanup failure keeps the identity for a retry and does not report success. Optional missing legacy tables are tolerated; network/permission errors are not.
- Public deletion instructions: `https://mallog24.com/delete-account`. Configure this URL in Play Console's account-deletion field. Web/native Korean/English privacy sections must stay identical.

## Apple

Render backend was inspected without revealing secrets: Apple server credentials are not configured. The new response reports `manual_disconnect_required` for Apple-linked accounts when tokens cannot be revoked. Clients explain how to stop using Sign in with Apple; account/data deletion is not blocked.

For automatic native revocation, set `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID=com.mallog24.app` and the Sign in with Apple `APPLE_PRIVATE_KEY` (.p8 contents, optionally escaped newlines) in Render's secret environment. Do not use an App Store Connect API key or paste keys in chat. The iOS client obtains a fresh authorization code when supported; the server verifies Apple's signed identity and its subject against the authenticated account before revocation. No Apple tokens are persisted or logged. Web OAuth and historical accounts without a code retain manual-disconnect instructions.

## Transcription migration

Official notice: https://developers.openai.com/api/docs/deprecations

`whisper-1` and the GPT-4o transcription family shut down on **2027-02-26**. Default completed-file transcription is now `gpt-transcribe`; an authenticated model lookup verified account availability. New requests use JSON and `languages`/literal `keywords` through `extra_body`, not legacy `language`, temperature, logprobs or verbose timestamp arguments. Existing silence-aligned chunk ownership, coverage validation, retries and fidelity guards remain in place. New-model word timestamps/logprobs are not fabricated; review positions use chunk boundaries. Legacy timestamp audit is disabled by default and hard-stops at retirement even if configured on.

If production explicitly overrides `OPENAI_TRANSCRIPTION_MODEL`, update it on both backend and worker. Optional legacy rollback is possible only before retirement; there is no automatic legacy fallback by default. This migration does not establish improved recognition accuracy without reviewed audio-aligned references.

## Verification / rollout

Run `backend/scripts/check_privacy_controls.py`, `backend/scripts/run_feature_quality_gates.py`, web auth/network tests, `frontend/scripts/check_privacy_ui.cjs`, `npm run build`, mobile session tests and Expo iOS/Android exports. Use synthetic recordings only for model smoke tests.

After deployment verify `/health` reports consent `2026-10-31`, `models: ["gpt-transcribe"]`, timestamp audit false; unauthenticated `/api/auth/privacy` and `/api/transcribe` return 401. Confirm privacy/deletion pages are public and ad endpoints no longer serve authorization text.

Store-console metadata is separate from source deployment: update privacy/deletion URLs, advertising declaration and Apple App Privacy/Google Data Safety to match actual data processing. Confirm Gemini project billing/logging configuration and retention settings in AI Studio; code cannot establish those settings. Existing `google.generativeai` SDK also emits an end-of-support warning; migration to `google.genai` is a separate compatibility change, not silently included in this privacy rollout.

Apple reference: https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple

Google deletion guidance: https://support.google.com/googleplay/android-developer/answer/13327111
