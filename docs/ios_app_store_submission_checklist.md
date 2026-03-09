# mallog24 iOS App Store Submission Checklist

## 1. Account and app setup

- [ ] Apple Developer Program is active
- [ ] App Store Connect app created
- [ ] App name: `mallog24`
- [ ] Bundle ID: `com.mallog24.app`
- [ ] SKU created
- [ ] Primary language selected

## 2. Build and signing

- [ ] `mobile/app.json` bundle identifier matches App Store Connect
- [ ] iOS icon and splash assets are final
- [ ] `eas build --platform ios --profile production` succeeds
- [ ] Build is visible in App Store Connect / TestFlight

## 3. Review-safe app behavior

- [ ] Login works with provided review account
- [ ] Upload/transcription/history/records flow works
- [ ] Privacy/Terms/Company Policy are accessible inside the app
- [ ] iOS build does not expose external web checkout buttons for digital subscription flow

## 4. Metadata

- [ ] Subtitle entered
- [ ] Promotional text entered
- [ ] Short and long descriptions entered
- [ ] Keywords entered
- [ ] Support URL entered
- [ ] Marketing URL entered if used
- [ ] Privacy Policy URL entered

## 5. Screenshots and media

- [ ] iPhone screenshots prepared
- [ ] 1024x1024 app icon prepared
- [ ] Screenshots do not contain personal or unauthorized third-party content

## 6. Privacy and compliance

- [ ] App Privacy answers reviewed based on actual data flow
- [ ] Audio upload and transcript retention policy matches in-app policy
- [ ] Third-party processors reviewed: Supabase, OpenAI, Google, payment provider as applicable

## 7. Review information

- [ ] Review contact name, email, and phone entered
- [ ] Review notes added
- [ ] Test login account added
- [ ] Any known limitations for review are explained clearly

## 8. Final review

- [ ] TestFlight internal test completed
- [ ] No dead links
- [ ] No broken OAuth redirect
- [ ] No payment screen shown that can trigger IAP policy issues
