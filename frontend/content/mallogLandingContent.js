export const KO_MALLOG_LANDING_CONTENT = {
  heroBadges: ['무료 월 10시간', 'Pro 월 8,800원(VAT 포함) 무제한', '오픈 베타'],
  heroTitle: '녹음만 올리세요. 바로 쓰는 구조화 녹취 문서가 나옵니다.',
  heroDescription:
    '설교, 통화, 회의에 맞춰 AI가 듣고 교정하고 요약합니다. 결과는 TXT/DOCX와 기록본으로 바로 저장할 수 있습니다.',
  beforeLabel: 'Before',
  beforeText: '"이번 주 광고 예산이 15% 초과됐고, 다음 주 수정안을 다시 공유해 주세요."',
  afterLabel: 'After',
  afterTitle: '회의 기록 요약',
  afterItems: ['안건: 예산 초과 15%', '결정: 수정안 재공유', '후속 조치: 일정/담당 재배정'],
  primaryCtaLabel: '요금제 보기',
  secondaryCtaLabel: 'OURS 소개 보기',
  featureCards: [
    {
      title: '전문 용어 정확도',
      body: '도메인 용어 사전 + 문맥 교정으로 설교, 회의, 통화의 오인식을 줄입니다.',
    },
    {
      title: '구조화된 문서 출력',
      body: '요약, 핵심 포인트, 후속 조치까지 바로 쓰는 형태로 정리합니다.',
    },
    {
      title: '2단계 엔진',
      body: 'Whisper 전사 + Gemini 교정으로 속도와 품질을 함께 확보합니다.',
    },
  ],
  howItWorksEyebrow: '작동 흐름',
  howItWorksTitle: '사용 흐름을 먼저 확인하세요',
  howItWorksDescription:
    '로그인 전에도 전체 흐름을 한 번에 이해할 수 있도록, 업로드부터 문서 완성까지 3단계로 보여드립니다.',
  stepCards: [
    { title: '1. 파일 업로드', body: '녹음 파일을 올리면 브라우저에서 길이를 먼저 확인하고 한도 초과 여부를 바로 안내합니다.' },
    { title: '2. AI 음성 인식 + 교정', body: '전사 유형에 맞춰 화자, 문맥, 도메인 용어를 보정하면서 텍스트를 정리합니다.' },
    { title: '3. 구조화 문서 완성', body: 'TXT, DOCX, 클립보드 복사와 기록본 저장까지 한 흐름에서 이어집니다.' },
  ],
  trustTitle: '가입 전에 확인할 운영 기준',
  trustCards: [
    { title: '무료 검증 가능', body: '월 10시간까지 결제 없이 바로 테스트할 수 있습니다.' },
    { title: '명확한 상품 구조', body: 'Pro는 월 8,800원(VAT 포함)으로 무제한 사용 기준입니다.' },
    { title: '원본 음성 임시 처리', body: '원본 음성 파일은 변환 완료 후 지체 없이 삭제하는 정책으로 운영합니다.' },
    { title: '실무 포맷 바로 저장', body: 'TXT, DOCX, 클립보드 복사, 기록본 저장을 모두 지원합니다.' },
  ],
  statsTitle: '신뢰 지표',
  statsDescription: '실측 가능한 항목만 공개하도록 구성했습니다. 수치가 업데이트되면 이 영역에 바로 반영됩니다.',
  statsCards: {
    hoursProcessed: { label: '누적 처리 시간', fallback: '집계 준비 중' },
    betaUsers: { label: '베타 사용자', fallback: '확장 중' },
    avgTurnaround: { label: '평균 처리 속도', fallback: '실측 데이터 준비 중' },
    timeSaving: { label: '시간 절감 효과', fallback: '비교 데이터 준비 중' },
  },
  statsUpdatedPrefix: '최근 업데이트',
  useCasesTitle: '누가 어떤 결과를 받는지 바로 보입니다',
  useCases: [
    {
      title: '목회자 / 설교',
      body: '본문, 핵심 메시지, 적용 포인트를 정리한 설교 기록 요약으로 이어집니다.',
    },
    {
      title: 'PM / 회의',
      body: '안건, 결정사항, 후속 조치를 분리한 회의 기록 형태로 바로 정리됩니다.',
    },
    {
      title: '상담 / 통화',
      body: '화자 구분, 대화 흐름, 핵심 메모가 잡힌 통화 기록 요약을 만들 수 있습니다.',
    },
  ],
  comparisonTitle: '랜딩에서 바로 비교할 수 있는 요금제',
  comparisonDescription: '가입 전에 무료 체험 범위와 Pro 전환 기준을 한 번에 확인할 수 있도록 핵심 항목만 정리했습니다.',
  comparisonColumns: { feature: '항목', free: 'Free', pro: 'Pro' },
  comparisonRows: [
    { feature: '월 사용량', free: '월 10시간', pro: '무제한' },
    { feature: '결제', free: '무료', pro: '월 8,800원(VAT 포함)' },
    { feature: '출력 포맷', free: 'TXT / DOCX / 클립보드', pro: 'TXT / DOCX / 클립보드' },
    { feature: '추천 용도', free: '개인 테스트 / 가벼운 사용', pro: '팀 운영 / 반복 실무 사용' },
  ],
  faqTitle: '가입 전에 많이 묻는 질문',
  faqs: [
    {
      question: '원본 음성 파일은 얼마나 보관되나요?',
      answer: '원본 음성 파일은 처리 목적의 임시 저장 후 변환 완료 시 지체 없이 삭제합니다. 변환 결과와 기록본은 계정 기능 범위 내에서 관리됩니다.',
    },
    {
      question: '영어 음성도 가능한가요?',
      answer: '한국어와 영어를 기본 지원하며, 업로드 전에 언어를 직접 선택할 수 있습니다.',
    },
    {
      question: '여러 화자 구분이 가능한가요?',
      answer: '회의/통화 유형에서는 화자 구분 형식을 우선 적용합니다. 녹음이 또렷하고 발화가 겹치지 않을수록 품질이 좋아집니다.',
    },
    {
      question: '녹음 품질이 좋지 않아도 되나요?',
      answer: '문맥 교정과 도메인 사전으로 일부 복원을 시도하지만, 배경 소음이 적고 발음이 분명한 파일일수록 결과가 안정적입니다.',
    },
  ],
}

export const EN_MALLOG_LANDING_CONTENT = {
  heroBadges: ['Free 10h/month', 'Pro KRW 8,800/month (VAT included) Unlimited', 'Open Beta'],
  heroTitle: 'Upload audio once. Get structured transcripts ready to use.',
  heroDescription:
    'For sermons, calls, and meetings, AI listens, corrects, and summarizes. Export as TXT/DOCX and save structured records in one flow.',
  beforeLabel: 'Before',
  beforeText: '"Ad budget was 15% over this week, and we need the revised plan by next week."',
  afterLabel: 'After',
  afterTitle: 'Meeting Summary',
  afterItems: ['Agenda: Budget overrun (+15%)', 'Decision: Share revised plan', 'Action: Reassign owner and timeline'],
  primaryCtaLabel: 'View Pricing',
  secondaryCtaLabel: 'About OURS',
  featureCards: [
    {
      title: 'Domain Term Accuracy',
      body: 'Dictionary + context correction reduces term confusion across sermons, meetings, and calls.',
    },
    {
      title: 'Structured Output',
      body: 'Summaries, key points, and follow-up actions arrive in a format teams can reuse immediately.',
    },
    {
      title: 'Two-stage Engine',
      body: 'Whisper transcription + Gemini correction balances speed and output quality.',
    },
  ],
  howItWorksEyebrow: 'How it works',
  howItWorksTitle: 'See the workflow before you sign in',
  howItWorksDescription:
    'The full flow is visible up front so new visitors understand the product from upload to finished document in three steps.',
  stepCards: [
    { title: '1. Upload audio', body: 'As soon as a file is selected, the browser estimates duration and warns when it exceeds the remaining quota.' },
    { title: '2. AI transcription + refinement', body: 'mallog24 applies speaker-aware formatting, context correction, and domain term refinement by content type.' },
    { title: '3. Structured document ready', body: 'TXT, DOCX, clipboard copy, and structured record saving continue in the same flow.' },
  ],
  trustTitle: 'Operational facts you can verify before signup',
  trustCards: [
    { title: 'Free trial first', body: 'You can validate the service without payment up to 10 hours per month.' },
    { title: 'Clear paid plan', body: 'Pro is KRW 8,800/month (VAT included) for unlimited usage.' },
    { title: 'Temporary raw-audio handling', body: 'Raw audio files are handled temporarily and removed after transcription is complete.' },
    { title: 'Practical export formats', body: 'TXT, DOCX, clipboard copy, and structured record saving are all supported.' },
  ],
  statsTitle: 'Trust Metrics',
  statsDescription: 'Only measurable items are shown here. Once you provide real numbers, this section updates immediately.',
  statsCards: {
    hoursProcessed: { label: 'Processed audio', fallback: 'Data preparing' },
    betaUsers: { label: 'Beta users', fallback: 'Growing' },
    avgTurnaround: { label: 'Average turnaround', fallback: 'Measurement pending' },
    timeSaving: { label: 'Time saved', fallback: 'Benchmark pending' },
  },
  statsUpdatedPrefix: 'Last updated',
  useCasesTitle: 'Different roles, different outputs',
  useCases: [
    {
      title: 'Pastor / Sermon',
      body: 'Capture scripture flow, core message, and application points in a sermon-ready summary.',
    },
    {
      title: 'PM / Meeting',
      body: 'Separate agenda, decisions, and follow-up actions into a meeting-ready format.',
    },
    {
      title: 'Call / Consultation',
      body: 'Organize speaker turns, conversation flow, and key notes into a usable call record.',
    },
  ],
  comparisonTitle: 'Compare plans without leaving the landing page',
  comparisonDescription:
    'Only the decision-making items are shown here so visitors can compare free usage and the Pro upgrade before signup.',
  comparisonColumns: { feature: 'Feature', free: 'Free', pro: 'Pro' },
  comparisonRows: [
    { feature: 'Monthly usage', free: '10 hours/month', pro: 'Unlimited' },
    { feature: 'Billing', free: 'Free', pro: 'KRW 8,800/month (VAT included)' },
    { feature: 'Exports', free: 'TXT / DOCX / Clipboard', pro: 'TXT / DOCX / Clipboard' },
    { feature: 'Best fit', free: 'Evaluation / light use', pro: 'Team operations / recurring work' },
  ],
  faqTitle: 'Questions people ask before signing up',
  faqs: [
    {
      question: 'How long are raw audio files stored?',
      answer: 'Raw audio files are handled temporarily for processing and removed after transcription completes. Output text and saved records remain within the account feature scope.',
    },
    {
      question: 'Does it support English audio?',
      answer: 'Korean and English are supported, and the language can be selected before upload.',
    },
    {
      question: 'Can it separate multiple speakers?',
      answer: 'Meeting and call types prioritize speaker-aware output. Clear audio and less overlap improve the result.',
    },
    {
      question: 'What if the recording quality is poor?',
      answer: 'Context correction and domain dictionaries try to recover part of the content, but clear recordings with less background noise remain the most stable input.',
    },
  ],
}
