export const KO_MALLOG_LANDING_CONTENT = {
  hero: {
    badge: '✦ 첫 가입 30일 Pro 체험 · 무료 10시간 제공',
    titleLead: '녹음만 올리세요.',
    titleAccent: '구조화 문서가 나옵니다.',
    description:
      '설교, 통화, 회의 음성을 업로드하면 AI가 듣고 정리하고 바로 쓰는 문서로 바꿉니다. TXT, DOCX, 기록본 저장, 설교용 주보 초안까지 한 흐름으로 이어집니다.',
    primaryCtaLabel: '무료로 시작하기',
    secondaryCtaLabel: '요금제 보기',
    trustLine: '첫 가입 30일 Pro 체험 · 신용카드 불필요 · 자동 결제 전환 없음',
  },
  features: {
    eyebrow: '핵심 기능',
    title: '설교, 통화, 회의를 바로 쓰는 문서로 바꾸는 흐름',
    description:
      'mallog24는 단순 녹취에서 멈추지 않고, 결과물을 바로 전달하거나 저장할 수 있는 실무형 출력까지 한 번에 연결합니다.',
    cards: [
      {
        icon: 'waveform',
        variant: 'dark',
        title: 'AI 음성 인식',
        body: 'Whisper 기반 전사로 한국어, 영어, 일본어 음성을 안정적으로 받아 구조화의 출발점을 만듭니다.',
      },
      {
        icon: 'document',
        variant: 'light',
        title: '구조화 문서 출력',
        body: '회의는 안건·결정·후속 조치, 설교는 본문·핵심 메시지·적용 포인트처럼 결과 형식을 목적에 맞게 정리합니다.',
      },
      {
        icon: 'users',
        variant: 'light',
        title: '화자 흐름 정리',
        body: '통화와 회의에서는 화자 흐름과 핵심 메모를 분리해 나중에 다시 읽어도 맥락이 남도록 정돈합니다.',
      },
      {
        icon: 'sparkles',
        variant: 'dark',
        title: '스마트 텍스트 교정',
        body: '문맥 교정과 도메인 용어 사전으로 설교, 의료, 회의 용어 오인식을 줄이고 읽기 좋은 문장으로 다듬습니다.',
      },
      {
        icon: 'download',
        variant: 'light',
        title: 'TXT / DOCX 저장',
        body: '클립보드 복사, TXT, DOCX 저장과 공유까지 지원해 생성된 결과를 바로 다음 업무에 넘길 수 있습니다.',
      },
      {
        icon: 'grid',
        variant: 'light',
        title: '설교 / 통화 / 회의 전용 정리',
        body: '같은 녹취라도 목적이 다르면 출력 구조가 달라야 합니다. mallog24는 전사 유형에 맞춰 요약과 기록본을 다르게 생성합니다.',
      },
    ],
  },
  workflow: {
    eyebrow: 'How it works',
    title: '업로드부터 문서 완성까지 3단계로 끝납니다',
    description:
      '로그인 전에도 전체 흐름을 먼저 볼 수 있고, 로그인 후에는 같은 화면에서 바로 업로드와 변환을 이어갈 수 있습니다.',
    steps: [
      {
        step: '01',
        title: '파일 업로드',
        body: '브라우저에서 길이를 먼저 확인하고 무료 사용량 초과 여부까지 바로 안내합니다.',
      },
      {
        step: '02',
        title: 'AI 음성 인식 + 교정',
        body: '화자, 문맥, 도메인 용어를 반영해 전사를 읽기 좋은 텍스트로 정리합니다.',
      },
      {
        step: '03',
        title: '구조화 문서 완성',
        body: '요약, 기록본, TXT/DOCX 저장, 주보용 요약 초안까지 한 흐름으로 이어집니다.',
      },
    ],
  },
  preview: {
    eyebrow: 'Before / After',
    title: '입력은 거칠어도 결과는 구조화됩니다',
    description:
      '설교, 통화, 회의는 출력 방식이 다릅니다. 원본 음성과 구조화 결과를 나란히 보며 어떤 문서가 생성되는지 확인할 수 있습니다.',
    beforeLabel: 'INPUT',
    afterLabel: 'OUTPUT',
    cases: [
      {
        key: 'sermon',
        label: '설교',
        sourceLines: [
          '본문은 행1:8입니다. 오늘은 증인의 삶에 대해서 같이 보겠습니다.',
          '결론에서는 적용과 기도 제목을 함께 정리하겠습니다.',
        ],
        outputSections: [
          { title: '본문', items: ['행1:8'] },
          { title: '핵심 메시지', items: ['증인의 정체성', '현장 적용 중심 정리'] },
          { title: '적용 / 기도', items: ['오늘의 적용 포인트', '주보용 요약 초안 연결'] },
        ],
      },
      {
        key: 'call',
        label: '통화',
        sourceLines: [
          '약 복용 이후 어지러움이 있었고 오늘 오후에 다시 전화 부탁드립니다.',
          '검사 일정은 다음 주 수요일로 잡겠습니다.',
        ],
        outputSections: [
          { title: '핵심 메모', items: ['복용 후 어지러움 보고', '오후 재통화 필요'] },
          { title: '일정', items: ['검사 예약: 다음 주 수요일'] },
          { title: '주의 사항', items: ['증상 변화 시 즉시 재연락'] },
        ],
      },
      {
        key: 'meeting',
        label: '회의',
        sourceLines: [
          '광고 예산이 이번 주에 15% 초과됐고 다음 주 수정안이 필요합니다.',
          '담당자를 다시 배정하고 일정도 조정해야 합니다.',
        ],
        outputSections: [
          { title: '안건', items: ['광고 예산 초과 15%', '다음 주 수정안 재공유'] },
          { title: '결정', items: ['담당자 재배정', '일정 조정'] },
          { title: '후속 조치', items: ['수정안 공유 일정 확정', '실행 담당자 명시'] },
        ],
      },
    ],
  },
  useCases: {
    eyebrow: '적합한 사용자',
    title: '누가 어떤 결과를 받는지 바로 보입니다',
    cards: [
      {
        title: '목회자 / 설교',
        body: '본문, 핵심 메시지, 적용 포인트와 주보용 요약 초안까지 연결된 설교 기록을 만들 수 있습니다.',
      },
      {
        title: 'PM / 회의',
        body: '안건, 결정, 후속 조치를 분리한 회의 기록으로 바로 공유할 수 있습니다.',
      },
      {
        title: '상담 / 통화',
        body: '화자 흐름과 핵심 메모를 정리해 다음 통화나 후속 업무에 바로 이어갈 수 있습니다.',
      },
    ],
  },
  resources: {
    eyebrow: '사용 가이드',
    title: '정확도를 높이는 녹음과 검수 방법',
    description:
      '처음 사용하는 사람도 파일 준비, 변환 유형 선택, 결과 검수까지 스스로 확인할 수 있도록 실전 가이드를 제공합니다.',
    ctaLabel: '전체 가이드 보기',
    href: '/guides',
    cards: [
      {
        title: '설교 녹취 정리',
        body: '본문, 핵심 메시지, 적용 포인트, 주보용 요약으로 설교 기록을 정리하는 방법입니다.',
        href: '/guides/sermon-transcription',
      },
      {
        title: '회의록 작성',
        body: '안건, 결정사항, 담당자, 후속 조치를 놓치지 않는 회의 녹음 검수 흐름입니다.',
        href: '/guides/meeting-minutes',
      },
      {
        title: '녹음 품질 체크',
        body: '앞부분 누락, 소음, 겹치는 발화, 특수 용어 오인식을 줄이는 녹음 전 체크리스트입니다.',
        href: '/guides/recording-quality',
      },
    ],
  },
  stats: {
    title: '신뢰 지표',
    description: '실측 가능한 수치만 표시합니다. 값이 없으면 이 영역은 보이지 않습니다.',
    updatedPrefix: '최근 업데이트',
    cards: {
      hoursProcessed: { label: '누적 처리 시간', fallback: '' },
      betaUsers: { label: '베타 사용자', fallback: '' },
      avgTurnaround: { label: '평균 처리 속도', fallback: '' },
      timeSaving: { label: '시간 절감 효과', fallback: '' },
    },
  },
  comparison: {
    title: '요금제 비교',
    description: '첫 가입자에게 제공되는 30일 Pro 체험과 무료/유료 전환 기준을 한 번에 확인할 수 있습니다.',
    columns: { feature: '항목', free: 'Free', pro: 'Pro' },
    rows: [
      { feature: '신규 가입 혜택', free: '30일 Pro 체험 제공', pro: '체험 종료 후 선택 가능' },
      { feature: '월 사용량', free: '월 10시간', pro: '무제한' },
      { feature: '결제', free: '무료', pro: '월 8,800원 (VAT 포함)' },
      { feature: '출력 포맷', free: 'TXT / DOCX / 클립보드', pro: 'TXT / DOCX / 클립보드' },
      { feature: '추천 용도', free: '개인 테스트 / 가벼운 사용', pro: '반복 업무 / 팀 운영' },
    ],
  },
  faq: {
    title: '가입 전에 많이 묻는 질문',
    items: [
      {
        question: '원본 음성 파일은 얼마나 보관되나요?',
        answer: '원본 음성 파일은 처리 목적의 임시 저장 후 변환 완료 시 지체 없이 삭제합니다. 변환 결과와 기록본은 계정 기능 범위 내에서 관리됩니다.',
      },
      {
        question: '영어와 일본어도 가능한가요?',
        answer: '한국어, 영어, 일본어를 지원하며 업로드 전에 언어를 직접 선택할 수 있습니다.',
      },
      {
        question: '여러 화자 구분이 가능한가요?',
        answer: '회의와 통화 유형에서는 화자 흐름을 우선 적용합니다. 녹음이 또렷하고 발화가 겹치지 않을수록 품질이 좋아집니다.',
      },
      {
        question: '주보용 요약도 만들 수 있나요?',
        answer: '설교형 기록에서는 본문, 핵심 메시지, 적용 포인트와 함께 주보용 요약 초안을 이어서 생성할 수 있습니다.',
      },
      {
        question: '첫 가입 30일 Pro 체험은 어떻게 적용되나요?',
        answer: '신규 가입 계정에는 결제 정보 입력 없이 30일 동안 Pro 권한이 제공됩니다. 체험 종료 후 자동 결제되지 않으며, Free 월 10시간 또는 Pro 구독 중 직접 선택할 수 있습니다.',
      },
    ],
  },
  ctaBanner: {
    title: '첫 가입 30일 Pro 체험으로 먼저 충분히 검증하세요',
    body: '신규 가입자는 결제 없이 Pro 권한을 30일 동안 사용할 수 있고, 체험 종료 후 Free 월 10시간 또는 Pro 구독을 직접 선택할 수 있습니다.',
    primaryLabel: '지금 무료로 시작',
    secondaryLabel: '요금제 자세히 보기',
  },
}

export const EN_MALLOG_LANDING_CONTENT = {
  hero: {
    badge: '✦ 30-day Pro trial for new signups · Free 10 hours included',
    titleLead: 'Upload audio once.',
    titleAccent: 'Structured documents come out ready to use.',
    description:
      'For sermons, calls, and meetings, mallog24 turns spoken content into structured output you can ship immediately. TXT, DOCX, saved records, and bulletin-ready sermon notes stay in one flow.',
    primaryCtaLabel: 'Start Free',
    secondaryCtaLabel: 'View Pricing',
    trustLine: '30-day Pro trial for new signups · No credit card required · No automatic paid conversion',
  },
  features: {
    eyebrow: 'Core capabilities',
    title: 'A transcription workflow designed for output, not just raw text',
    description:
      'mallog24 does not stop at speech-to-text. It structures, corrects, and exports the result in formats teams can actually reuse.',
    cards: [
      {
        icon: 'waveform',
        variant: 'dark',
        title: 'AI Speech Recognition',
        body: 'Whisper-based transcription supports Korean, English, and Japanese as a reliable starting point for structured output.',
      },
      {
        icon: 'document',
        variant: 'light',
        title: 'Structured Output',
        body: 'Meetings become agenda / decisions / follow-up items, while sermons become scripture / core message / application.',
      },
      {
        icon: 'users',
        variant: 'light',
        title: 'Speaker-aware Formatting',
        body: 'Calls and meetings preserve speaker flow and key notes so the result stays readable when revisited later.',
      },
      {
        icon: 'sparkles',
        variant: 'dark',
        title: 'Smart Text Correction',
        body: 'Context correction and domain dictionaries reduce transcription confusion in sermon, medical, and meeting vocabulary.',
      },
      {
        icon: 'download',
        variant: 'light',
        title: 'TXT / DOCX Export',
        body: 'Clipboard copy plus TXT and DOCX export let teams move the result straight into the next step of work.',
      },
      {
        icon: 'grid',
        variant: 'light',
        title: 'Templates by Content Type',
        body: 'Sermons, calls, and meetings should not share the same summary shape. mallog24 generates them differently by intent.',
      },
    ],
  },
  workflow: {
    eyebrow: 'How it works',
    title: 'Three steps from upload to final document',
    description:
      'Visitors can understand the workflow before signing in, and the same screen continues into real uploads after login.',
    steps: [
      {
        step: '01',
        title: 'Upload audio',
        body: 'The browser estimates duration first and warns immediately when the file exceeds the remaining free quota.',
      },
      {
        step: '02',
        title: 'AI transcription + correction',
        body: 'Speaker flow, context, and domain terms are refined into readable text instead of raw machine output.',
      },
      {
        step: '03',
        title: 'Structured document ready',
        body: 'Summaries, saved records, TXT/DOCX export, and bulletin-ready sermon notes stay in the same workflow.',
      },
    ],
  },
  preview: {
    eyebrow: 'Before / After',
    title: 'Messy input can still become structured output',
    description:
      'Sermons, calls, and meetings should not end in the same format. Compare the original voice sentence and generated document side by side.',
    beforeLabel: 'INPUT',
    afterLabel: 'OUTPUT',
    cases: [
      {
        key: 'sermon',
        label: 'Sermon',
        sourceLines: [
          'The scripture is Acts 1:8. Today we will look at the life of a witness.',
          'In the conclusion, application points and prayer topics will be organized together.',
        ],
        outputSections: [
          { title: 'Scripture', items: ['Acts 1:8'] },
          { title: 'Core message', items: ['Identity as a witness', 'Field-centered application'] },
          { title: 'Application / Prayer', items: ['Today’s application points', 'Bulletin-ready summary draft'] },
        ],
      },
      {
        key: 'call',
        label: 'Call',
        sourceLines: [
          'There was dizziness after the medication, so please call again this afternoon.',
          'Let us keep the test appointment for next Wednesday.',
        ],
        outputSections: [
          { title: 'Key notes', items: ['Dizziness reported after medication', 'Afternoon follow-up call needed'] },
          { title: 'Schedule', items: ['Test booked for next Wednesday'] },
          { title: 'Watchouts', items: ['Call back immediately if symptoms worsen'] },
        ],
      },
      {
        key: 'meeting',
        label: 'Meeting',
        sourceLines: [
          'Ad spend ran 15% over this week, and we need a revised plan next week.',
          'We should reassign the owner and adjust the timeline.',
        ],
        outputSections: [
          { title: 'Agenda', items: ['Budget overrun (+15%)', 'Revised plan request'] },
          { title: 'Decision', items: ['Reassign owner', 'Adjust delivery timeline'] },
          { title: 'Follow-up', items: ['Lock revised plan date', 'Assign execution owner'] },
        ],
      },
    ],
  },
  useCases: {
    eyebrow: 'Who benefits',
    title: 'Different roles need different outputs',
    cards: [
      {
        title: 'Pastor / Sermon',
        body: 'Capture scripture flow, core message, application points, and bulletin-ready sermon notes in one sermon record.',
      },
      {
        title: 'PM / Meeting',
        body: 'Separate agenda, decisions, and follow-up actions into a meeting-ready document you can share immediately.',
      },
      {
        title: 'Call / Consultation',
        body: 'Preserve speaker turns, conversation flow, and key notes so the next follow-up starts from a usable record.',
      },
    ],
  },
  resources: {
    eyebrow: 'User Guides',
    title: 'Improve recording quality and transcript review',
    description:
      'Practical guides help new users prepare audio, choose the right workflow, and review AI-generated text responsibly.',
    ctaLabel: 'View all guides',
    href: '/en/guides',
    cards: [
      {
        title: 'Sermon transcription',
        body: 'How to organize sermons into scripture, core message, application points, and bulletin-ready notes.',
        href: '/en/guides/sermon-transcription',
      },
      {
        title: 'Meeting minutes',
        body: 'How to review agenda, decisions, owners, and follow-up tasks from meeting recordings.',
        href: '/en/guides/meeting-minutes',
      },
      {
        title: 'Recording quality',
        body: 'A checklist for reducing missed starts, noise, overlapping speech, and domain-term errors.',
        href: '/en/guides/recording-quality',
      },
    ],
  },
  stats: {
    title: 'Trust metrics',
    description: 'Only measurable numbers appear here. If no data exists yet, this section stays hidden.',
    updatedPrefix: 'Last updated',
    cards: {
      hoursProcessed: { label: 'Processed audio', fallback: '' },
      betaUsers: { label: 'Beta users', fallback: '' },
      avgTurnaround: { label: 'Average turnaround', fallback: '' },
      timeSaving: { label: 'Time saved', fallback: '' },
    },
  },
  comparison: {
    title: 'Plan comparison',
    description: 'Compare the 30-day welcome Pro trial, the free tier, and the paid Pro plan before signup.',
    columns: { feature: 'Feature', free: 'Free', pro: 'Pro' },
    rows: [
      { feature: 'New signup benefit', free: '30-day Pro trial included', pro: 'Optional after the trial' },
      { feature: 'Monthly usage', free: '10 hours / month', pro: 'Unlimited' },
      { feature: 'Billing', free: 'Free', pro: 'KRW 8,800 / month (VAT included)' },
      { feature: 'Exports', free: 'TXT / DOCX / Clipboard', pro: 'TXT / DOCX / Clipboard' },
      { feature: 'Best fit', free: 'Evaluation / light use', pro: 'Recurring work / team use' },
    ],
  },
  faq: {
    title: 'Questions people ask before signing up',
    items: [
      {
        question: 'How long are raw audio files stored?',
        answer: 'Raw audio files are handled temporarily for processing and removed after transcription completes. Output text and saved records remain within the account feature scope.',
      },
      {
        question: 'Does it support English and Japanese audio?',
        answer: 'Korean, English, and Japanese are supported, and the transcription language can be selected before upload.',
      },
      {
        question: 'Can it separate multiple speakers?',
        answer: 'Meeting and call types prioritize speaker-aware output. Clear audio and less overlap improve the result.',
      },
      {
        question: 'Can it create bulletin-ready sermon summaries?',
        answer: 'Sermon-type output can extend from scripture and core message into application points and bulletin-ready sermon note drafts.',
      },
      {
        question: 'How does the 30-day Pro trial for new signups work?',
        answer: 'New accounts receive Pro access for 30 days without entering payment information. The trial does not convert into a paid subscription automatically; after it ends, users can choose the free 10-hour monthly tier or subscribe to Pro.',
      },
    ],
  },
  ctaBanner: {
    title: 'Start with a 30-day Pro trial for new signups',
    body: 'New users can try Pro access for 30 days without payment information, then choose the free 10-hour monthly tier or a Pro subscription after the trial.',
    primaryLabel: 'Start Free Now',
    secondaryLabel: 'See Pricing Details',
  },
}
