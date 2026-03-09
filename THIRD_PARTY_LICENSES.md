# Third-Party Licenses and Notices

This project includes or depends on third-party software, assets, APIs, and brand features.
This file is a practical release note for mallog24 maintainers. It is not a substitute for
the original license texts or provider terms.

## 1. Bundled or referenced assets

### Geist fonts
- Files:
  - `ours-homepage/pages/fonts/GeistVF.woff`
  - `ours-homepage/pages/fonts/GeistMonoVF.woff`
- Source: Vercel Geist font project
- License: SIL Open Font License 1.1
- Notes:
  - Keep attribution/license notice with redistributed font files.
  - Do not sell the font files by themselves.

### mallog24 icons and store graphics
- Files:
  - `frontend/public/mallog24-app-icon.png`
  - `mobile/assets/icon.png`
  - `mobile/assets/adaptive-icon.png`
  - `mobile/assets/splash-icon.png`
  - `mobile/store-graphics/*`
- Status:
  - Treat these as first-party assets only if ownership or a valid transfer/license can be proved.
  - Keep source design files or written permission records outside the repo if needed.

### Nanum fonts used by copyright PDF tooling
- Script: `generate_copyright_pdf.py`
- Usage:
  - The script may use system-installed Nanum fonts or locally supplied Korean fonts.
  - The script may also reference Nanum font download locations during local generation.
- Notes:
  - If Nanum font files are redistributed with release artifacts, include the applicable font license notice.
  - If only system-installed fonts are used locally, no repo redistribution occurs.

## 2. External APIs and service terms

This project integrates with third-party hosted services. Their SDK/package license is only one layer.
Actual use is also governed by each provider's service terms, brand requirements, and developer policies.

- OpenAI API
- Google Gemini API
- Supabase
- PortOne / NHN KCP / KakaoPay
- Google OAuth
- Kakao Login

Before commercial release, verify:
- active account standing
- production-use approval
- branding/button requirements
- data processing terms
- webhook and payment policy compliance

## 3. Open-source dependency policy

The project should prefer permissive licenses for bundled backend/runtime dependencies when commercial
distribution or on-premise delivery is planned.

### Current policy decision
- `mutagen` was removed from the backend because GPL-based obligations were not a good fit for
  planned commercial distribution scenarios.
- Audio duration detection now relies on `ffprobe` and Python `wave` fallback.

## 4. Release checklist

Before shipping a hosted release, app store build, or installable package:

1. Re-run dependency license review for Python, web, and mobile packages.
2. Confirm all bundled fonts/images/icons/screenshots are first-party or properly licensed.
3. Confirm Google/Kakao branding is still aligned with current provider guidance.
4. Confirm no copyrighted customer/test content is bundled in the repo or release artifacts.
5. Confirm no `.env`, secrets, certificates, or private keys are distributed.

## 5. Internal note

This file is intentionally conservative. If a release introduces new bundled assets or SDKs,
update this document in the same change.
