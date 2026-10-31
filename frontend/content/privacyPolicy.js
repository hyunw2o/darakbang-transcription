// Keep web and native policy sections identical; checked by privacy regression tests.
export const PRIVACY_SECTIONS = {
  ko: [
    { title: "1. 운영자와 처리 항목", body: [
      "운영자: OURS(대표 김현우). 문의 및 권리 행사: ours113814@gmail.com.",
      "계정 이메일·이름·UID·소셜 로그인 식별자, 선택한 음성, 전사·교정·요약 텍스트, 저장 기록본, 용어집, 동의 버전·시각, 사용량과 접속·오류 로그를 처리합니다. 이메일 로그인 비밀번호는 인증 서비스에서 관리합니다."
    ] },
    { title: "2. 목적과 AI 전송 동의", body: [
      "로그인, 계정 보호, 음성 인식, 화자 구분, 교정, 요약, 기록 조회·내보내기, 장애 대응을 위해 필요한 데이터를 처리합니다.",
      "AI 기능 사용 전에 수신자·항목·목적을 안내하고 계정별 명시적 동의를 받습니다. 동의하지 않거나 철회해도 로그인, 기존 기록 조회, 계정 삭제는 가능합니다. 변환·요약 등 외부 AI 기능은 사용할 수 없습니다.",
      "설정에서 AI 전송 동의를 철회하면 이후 AI 요청을 차단합니다. 진행 작업은 다음 전송·처리 확인 시 중지되며, 이미 외부에 전송된 요청은 회수할 수 없습니다."
    ] },
    { title: "3. AI 처리 수신자와 국외 처리", body: [
      "OpenAI: 음성 파일·전사문·관련 용어 및 처리 문맥을 이용한 음성 인식과 선택적 텍스트 교정.",
      "Google(Gemini): 음성 파일·전사문·관련 용어 및 요청 문맥을 이용한 음성 인식, 화자 구분, 교정·구조화·요약.",
      "Supabase는 계정 인증, 데이터베이스와 임시 파일 저장을, 호스팅 인프라는 웹 제공과 서버·작업 실행을 처리합니다. Apple·Google·Kakao 로그인 선택 시 해당 제공자와 인증 정보가 교환됩니다.",
      "API 요청 시 암호화된 연결을 통해 국외 서버로 전송·처리될 수 있습니다. 처리 위치와 공급자 보관 조건은 이용 서비스·프로젝트 설정에 따라 달라집니다. 필요한 범위의 데이터만 전송하며, 식별정보가 불필요하면 업로드 전에 제거해 주세요."
    ] },
    { title: "4. 보관과 삭제", body: [
      "mallog24는 원본 음성을 작업 중 임시 보관하고 처리 종료 후 삭제합니다. 대기·처리 중인 작업의 원본은 작업 완료 또는 정리 전까지 남을 수 있습니다. 전사 원문과 교정 결과, 저장 기록본, 용어집은 이용자가 삭제하거나 계정을 삭제할 때까지 보관합니다.",
      "mallog24의 임시 파일 삭제와 외부 AI 제공자의 보관은 별개입니다. 외부 제공자는 보안·악용 방지 또는 프로젝트 로그 설정에 따라 일부 요청을 보관할 수 있습니다. OpenAI API 데이터는 기본적으로 모델 학습에 사용되지 않으나 개별 엔드포인트·선택 설정에 따라 보관 조건이 다릅니다. Google의 데이터 이용·보관은 유료/무료 서비스 및 로그 설정에 따라 달라집니다.",
      "서버·접속 로그는 보안과 장애 대응에 필요한 범위에서 관리합니다. 법령상 보존 의무가 있는 자료는 해당 의무에 따라 별도 보존될 수 있습니다. 신규 결제 정보는 수집하지 않습니다."
    ] },
    { title: "5. 선택적 학습 데이터", body: [
      "AI 처리 동의는 학습 데이터 제공 동의가 아닙니다. 수정 결과를 학습 후보로 제공하는 기능은 기본 해제되어 있으며, 이용자가 별도 선택한 경우에만 수정 전·후 텍스트와 필요한 메타데이터를 후보로 보관합니다.",
      "텍스트 학습 제공 선택만으로 음성 원본을 장기 보관하지 않습니다. 사용자 용어집은 해당 사용자의 인식 문맥에 활용하며, 자동으로 검수된 정답이나 학습 완료 모델이 되는 것은 아닙니다.",
      "학습 후보 삭제·동의 철회는 지원 이메일로 요청할 수 있습니다. 계정 삭제 시 계정에 연결된 학습 후보와 보관 음성도 정리합니다."
    ] },
    { title: "6. 이용자 권리와 계정 삭제", body: [
      "웹 개인정보 설정 또는 앱 설정 → 계정 관리에서 계정 삭제를 요청할 수 있습니다. 앱을 사용할 수 없거나 로그인할 수 없다면 https://www.mallog24.com/delete-account 안내에 따라 가입 이메일로 지원팀에 요청해 주세요. 본인 확인 후 처리 상태와 예상 일정을 안내합니다.",
      "계정 삭제는 계정, 변환 기록, 저장 기록본, 용어집, 제공한 학습 후보 및 연결된 저장 음성을 포함합니다. 작업 중지 대기나 일부 데이터 정리에 실패하면 재시도 안내를 제공하며 완료 전에 성공으로 표시하지 않습니다.",
      "열람·정정·삭제·처리정지·동의 철회를 요청할 수 있습니다. 계정 삭제는 되돌릴 수 없습니다. Apple 로그인 연결은 Apple 계정 설정에서도 해제할 수 있으며, 연결 해제만으로 mallog24 데이터가 삭제되지는 않습니다."
    ] },
    { title: "7. 광고와 기기 권한", body: [
      "이 버전의 웹·앱은 광고를 제공하지 않으며 광고 SDK나 광고 식별자를 사용하지 않습니다. 이전 앱 버전에는 광고 코드가 남아 있을 수 있으므로 최신 버전으로 업데이트해 주세요.",
      "쿠키·기기 저장소는 로그인 유지와 화면 설정에 사용합니다. 녹음할 때만 마이크 권한을 요청하며 운영체제 설정에서 철회할 수 있습니다. 파일 선택·녹음 시작만으로 AI 전송을 시작하지 않고 변환 요청 시 전송합니다."
    ] },
    { title: "8. 보호조치와 이용 주의", body: [
      "HTTPS, 계정 인증, 사용자별 접근 통제, 권한 제한을 적용합니다. 불필요한 민감정보나 타인의 권리를 침해하는 자료를 업로드하지 마세요. 녹음·업로드에 필요한 권한과 동의를 확보해야 합니다.",
      "AI 결과에는 오류·누락이 있을 수 있으므로 원음과 대조해야 합니다. 의료적 판단이나 진단을 대신하지 않습니다. 정책 변경 시 최신 안내를 게시하며 AI 전송 범위가 변경되면 다시 동의를 요청합니다."
    ] }
  ],
  en: [
    { title: "1. Operator and Data", body: [
      "Operator: OURS (representative: Kim Hyunwoo). Privacy contact: ours113814@gmail.com.",
      "We process account email, name, UID and social identifiers; selected audio; transcripts, corrections, summaries and saved records; glossary entries; consent version and timestamps; usage and access/error logs. Passwords for email sign-in are managed by the authentication service."
    ] },
    { title: "2. Purposes and AI Consent", body: [
      "Data supports authentication, account protection, transcription, speaker separation, correction, summaries, record access/export and troubleshooting.",
      "Before AI use, we disclose recipients, data and purposes and obtain explicit account-specific consent. Declining or withdrawing does not prevent sign-in, viewing existing records or account deletion; external AI features such as transcription and summaries are unavailable.",
      "Withdrawal in settings blocks subsequent AI requests. Active jobs stop at the next transfer/processing check. Requests already sent to a provider cannot be recalled."
    ] },
    { title: "3. AI Recipients and Overseas Processing", body: [
      "OpenAI receives audio, transcripts, relevant terms and processing context for speech recognition and optional text correction.",
      "Google (Gemini) receives audio, transcripts, relevant terms and request context for recognition, speaker separation, correction, structuring and summaries.",
      "Supabase handles authentication, database and temporary file storage. Hosting infrastructure serves the website and runs servers/jobs. Apple, Google or Kakao exchanges authentication information when the corresponding sign-in is selected.",
      "Data may be transmitted to and processed on servers outside Korea over encrypted connections when an API request is made. Processing location and provider retention depend on the service and project settings. Remove unnecessary identifiers before uploading."
    ] },
    { title: "4. Retention and Deletion", body: [
      "mallog24 temporarily retains source audio during a job and removes it after processing ends. Queued/active inputs may remain until completion or cleanup. Raw transcripts, corrected results, saved records and glossary entries remain until deleted by the user or through account deletion.",
      "Deleting mallog24 temporary files is separate from provider retention. Providers may retain some requests for security, abuse monitoring or project logging. OpenAI API data is not used for model training by default, but retention varies by endpoint and optional settings. Google's data use and retention depend on paid/unpaid service terms and logging settings.",
      "Access and server logs are managed for security and troubleshooting. Legally required records may be retained separately under applicable obligations. We collect no new payment information."
    ] },
    { title: "5. Optional Training Contributions", body: [
      "AI processing consent is not training-data consent. Contributing corrections is off by default. Only a separate user selection stores before/after text and necessary metadata as training candidates.",
      "Text contribution does not authorize long-term storage of source audio. Glossary entries provide context for that user; they do not automatically become verified ground truth or a trained model.",
      "Request candidate deletion or withdraw contribution consent by emailing support. Account deletion also cleans up associated candidates and retained audio."
    ] },
    { title: "6. Rights and Account Deletion", body: [
      "Use Privacy settings on the website or Settings → Account Management in the app. Without app/sign-in access, follow https://www.mallog24.com/delete-account and email support from your registered address. After ownership verification we reply with status and the expected timeline.",
      "Deletion covers the account, transcription history, saved records, glossary, contributed training candidates and linked stored audio. If a job is stopping or cleanup fails, a retry message is shown; deletion is not reported as successful prematurely.",
      "You may request access, correction, deletion, restriction or withdrawal. Account deletion is irreversible. Apple sign-in access can also be revoked in Apple account settings; revocation alone does not delete mallog24 data."
    ] },
    { title: "7. Ads and Device Permissions", body: [
      "This web/app version serves no ads and uses no advertising SDK or advertising identifiers. Older app versions may still contain ad code; update to the latest version.",
      "Cookies/device storage support sessions and display settings. Microphone permission is requested for recording and can be withdrawn in OS settings. Selecting a file or starting recording does not itself send audio to AI; a conversion request does."
    ] },
    { title: "8. Safeguards and Responsible Use", body: [
      "We use HTTPS, authentication, per-user access controls and restricted permissions. Do not upload unnecessary sensitive data or infringe others' rights. Obtain the rights and consent needed to record and upload.",
      "AI output may contain errors or omissions and needs review against the audio. It does not replace medical judgment or diagnosis. Policy changes are published, and changes to the scope of AI transfer require renewed consent."
    ] }
  ]
}
