# mallog24 Asset Rights Checklist

Use this checklist before app store submission, public launch, investor sharing, or copyright filing.

## 1. Brand assets

- [ ] App icon was created internally, or a written transfer/license exists.
- [ ] Favicon and web app icons match assets we own.
- [ ] Logo source files are archived outside the repo.
- [ ] Any logo redesign/derivative work approval is documented.

Relevant files:
- `frontend/public/mallog24-app-icon.png`
- `mobile/assets/icon.png`
- `mobile/assets/adaptive-icon.png`
- `mobile/assets/splash-icon.png`
- `ours-homepage/public/mallog24-app-icon.png`

## 2. Store graphics and screenshots

- [ ] Google Play feature graphic is first-party work.
- [ ] All mobile screenshots show only our UI or properly authorized sample data.
- [ ] No third-party copyrighted slides, photos, or lecture material appear in screenshots.
- [ ] No personally identifiable information appears in screenshots.

Relevant files:
- `mobile/store-graphics/feature-graphic-google-play-1024x500.png`
- `mobile/store-graphics/screenshot-*.png`

## 3. Fonts

- [ ] Bundled font license allows commercial redistribution.
- [ ] Required license text is retained outside or alongside release materials.
- [ ] Any locally downloaded Korean font used for PDF generation is licensed for that use.

Relevant files:
- `ours-homepage/pages/fonts/GeistVF.woff`
- `ours-homepage/pages/fonts/GeistMonoVF.woff`
- `generate_copyright_pdf.py`

## 4. Social login and payment branding

- [ ] Google button styling and wording follow current Google branding guidance.
- [ ] Kakao login button styling and wording follow Kakao design guidance.
- [ ] KakaoPay / payment brand usage is approved for the configured channel.
- [ ] No unofficial logos are used in a way that suggests affiliation beyond supported login/payment integration.

## 5. Audio, transcript, and demo content

- [ ] Sample audio/demo transcript content is first-party, licensed, or fully synthetic.
- [ ] Sermon/lecture/meeting examples do not include copyrighted third-party content without permission.
- [ ] Customer uploads are not committed to the repo.
- [ ] Generated transcripts and history exports are excluded from public release artifacts.

## 6. Legal and operational records

- [ ] Ownership or usage evidence is archived for all non-code assets.
- [ ] If an external designer was used, an IP assignment or commercial license exists.
- [ ] Launch owner reviewed `THIRD_PARTY_LICENSES.md`.
- [ ] Release owner confirmed no secrets/certificates are embedded in app/web bundles.

## 7. Notes for future video OCR features

- [ ] Do not assume YouTube link ingestion is legally safe.
- [ ] Prefer user-uploaded files where the uploader confirms rights.
- [ ] Add a rights-confirmation checkbox before processing copyrighted media.
