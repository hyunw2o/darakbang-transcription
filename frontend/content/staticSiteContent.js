export const SITE_BASE_URL = 'https://www.mallog24.com'
export const LEGAL_DOC_VERSION = 'v2026.06.23'
export const LEGAL_DOC_DATE_KO = '2026년 6월 23일'
export const LEGAL_DOC_DATE_EN = 'June 23, 2026'

export const BUSINESS_INFO = {
  ko: {
    companyName: 'OURS',
    representative: '김현우',
    businessRegistrationNumber: '696-08-03518',
    ecommerceRegistrationNumber: '제 2026-경기광주-0442 호',
    address: '12735, 경기도 광주시 초월읍 무들로 28',
    phone: '010-4798-3619',
    supportEmail: 'ours113814@gmail.com',
    trademarkApplicationNo: '40-2026-0040381',
    copyrightRegistrationNo: '제 C-2026-013549 호',
  },
  en: {
    companyName: 'OURS',
    representative: 'Kim Hyunwoo',
    businessRegistrationNumber: '696-08-03518',
    ecommerceRegistrationNumber: 'No. 2026-Gyeonggi Gwangju-0442',
    address: '12735, 28 Mudeul-ro, Chowol-eup, Gwangju-si, Gyeonggi-do, Republic of Korea',
    phone: '+82-10-4798-3619',
    supportEmail: 'ours113814@gmail.com',
    trademarkApplicationNo: '40-2026-0040381',
    copyrightRegistrationNo: 'C-2026-013549',
  },
}

const koLegalCommon = {
  lastUpdated: LEGAL_DOC_DATE_KO,
  version: LEGAL_DOC_VERSION,
  homeLabel: '홈으로 돌아가기',
  languageLabel: 'English',
}

const enLegalCommon = {
  lastUpdated: LEGAL_DOC_DATE_EN,
  version: LEGAL_DOC_VERSION,
  homeLabel: 'Back to Home',
  languageLabel: '한국어',
}

export const LEGAL_PAGES = {
  ko: {
    privacy: {
      ...koLegalCommon,
      title: '개인정보처리방침',
      description: 'mallog24는 음성 파일을 구조화된 텍스트로 변환하는 과정에서 필요한 최소한의 개인정보와 서비스 데이터를 처리합니다.',
      metaDescription: 'mallog24 개인정보처리방침: 수집 항목, 이용 목적, 보관 기간, 음성 파일 처리, 제3자 처리 위탁, 이용자 권리를 안내합니다.',
      alternateHref: '/privacy-en',
      relatedLinks: [
        { label: '이용약관', href: '/terms' },
        { label: '회사 정책', href: '/company-policy' },
        { label: '사용 가이드', href: '/guides' },
      ],
      sections: [
        {
          title: '1. 처리하는 개인정보 항목',
          body: [
            '회원 인증: 이메일, 비밀번호(이메일 로그인 시), 사용자 식별자, 소셜 로그인 공급자 식별자',
            '소셜 로그인: Google, Kakao, Apple ID에서 전달하는 이메일, 이름 또는 닉네임, Apple 비공개 릴레이 이메일',
            '서비스 데이터: 업로드 음성 파일, 전사 원문, 교정 텍스트, 요약, 저장 기록본, 사용자 용어집',
            '결제 및 구독 정보: 상품 ID, 구독 상태, 거래 식별자, 결제 플랫폼, 환불 또는 해지 처리 상태',
            '자동 수집 정보: 접속 IP, 브라우저/기기 정보, 오류 로그, 사용량 산정에 필요한 처리 시간',
          ],
        },
        {
          title: '2. 개인정보 이용 목적',
          body: [
            '계정 생성, 로그인, 본인 식별, 계정 보호 및 고객지원',
            '음성 인식, 텍스트 교정, 요약, 기록본 저장, 사용자 용어집 반영',
            '무료/유료 사용량 계산, 첫 가입 30일 Pro 체험 적용, 웹/Android/iOS 구독 상태 확인',
            '서비스 안정화, 장애 분석, 부정 사용 방지, 보안 사고 대응',
            '공지, 약관 변경, 환불 및 결제 문의 처리',
          ],
        },
        {
          title: '3. 음성 파일과 변환 결과 처리',
          body: [
            '원본 음성 파일은 변환 처리를 위해 일시적으로 사용되며, 변환 완료 후 지체 없이 삭제하는 것을 기본 정책으로 합니다.',
            '전사 결과, 교정 결과, 저장 기록본은 이용자가 다시 조회하고 내보낼 수 있도록 계정 기능 범위 내에서 보관됩니다.',
            '사용자가 수정한 결과와 사용자 용어집은 품질 개선을 위한 후보 데이터로 분리 관리될 수 있으며, 학습 데이터 활용은 명시적 동의와 운영 기준에 따라 제한됩니다.',
            '주민등록번호, 계좌 비밀번호, 의료 민감정보 등 서비스 목적에 불필요한 민감정보가 포함된 음성 업로드는 권장하지 않습니다.',
          ],
        },
        {
          title: '4. 보유 기간 및 파기',
          body: [
            '회원 정보는 회원 탈퇴 또는 서비스 종료 시까지 보관하며, 법령상 보존 의무가 있는 정보는 해당 기간 동안 별도 보관합니다.',
            '원본 음성 파일은 임시 처리 후 삭제하는 것을 원칙으로 합니다.',
            '변환 결과와 저장 기록본은 이용자 삭제 요청, 계정 삭제, 또는 서비스 운영상 보관 필요가 종료된 시점에 파기됩니다.',
            '로그 데이터는 보안, 장애 대응, 분쟁 예방 목적상 필요한 기간 동안 보관 후 파기합니다.',
          ],
        },
        {
          title: '5. 제3자 제공, 처리 위탁 및 국외 이전',
          body: [
            '회사는 이용자 동의 없이 개인정보를 판매하지 않습니다.',
            '서비스 제공을 위해 Supabase(인증/DB), OpenAI(음성 인식), Google Gemini(교정/요약), Apple(App Store 구독/Apple 로그인), Google/Kakao(소셜 로그인) 등 외부 서비스를 사용할 수 있습니다.',
            '외부 API 처리 과정에서 데이터가 국외 서버로 전송될 수 있으며, 서비스 제공에 필요한 최소 범위로만 처리합니다.',
            '법령상 의무 이행, 수사기관의 적법한 요청, 이용자 권리 보호에 필요한 경우 예외적으로 제공될 수 있습니다.',
          ],
        },
        {
          title: '6. 이용자 권리',
          body: [
            '이용자는 개인정보 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수 있습니다.',
            '계정 삭제, 저장 기록본 삭제, 결제/환불 문의는 고객지원 이메일로 요청할 수 있습니다.',
            '요청 접수 후 본인 확인이 필요한 경우 추가 정보를 요청할 수 있으며, 합리적인 기간 내 처리 결과를 안내합니다.',
          ],
        },
        {
          title: '7. 쿠키, 로그 및 광고 관련 기술',
          body: [
            'mallog24는 로그인 유지, 보안, 사용량 계산, 장애 분석을 위해 쿠키와 로그를 사용할 수 있습니다.',
            '웹사이트에는 Google AdSense 등 광고 관련 스크립트가 포함될 수 있으며, 광고 개인화 여부는 Google 계정 및 브라우저 설정에 따라 달라질 수 있습니다.',
            '이용자는 브라우저 설정을 통해 쿠키 저장을 제한할 수 있으나, 일부 로그인 또는 결제 기능이 제한될 수 있습니다.',
          ],
        },
        {
          title: '8. 안전성 확보조치 및 문의',
          body: [
            'HTTPS 전송 암호화, 인증 토큰 검증, 권한 최소화, 보안 헤더, 요청량 제한, 로그 모니터링을 적용합니다.',
            '보안 사고가 확인되면 사실 확인, 영향 범위 분석, 통지 및 복구 절차를 진행합니다.',
            '문의 및 권리행사 창구: ours113814@gmail.com',
          ],
        },
      ],
    },
    terms: {
      ...koLegalCommon,
      title: '이용약관',
      description: '본 약관은 mallog24 웹, Android 앱, iOS 앱에서 제공하는 음성 인식 및 구조화 문서 생성 서비스의 이용 조건을 규정합니다.',
      metaDescription: 'mallog24 이용약관: 계정, 업로드 책임, 구독, 환불, 금지 행위, 서비스 제한, AI 결과 검수 책임을 안내합니다.',
      alternateHref: '/terms-en',
      relatedLinks: [
        { label: '개인정보처리방침', href: '/privacy' },
        { label: '회사 정책', href: '/company-policy' },
        { label: '요금제', href: '/pricing' },
      ],
      sections: [
        {
          title: '1. 목적 및 적용 범위',
          body: [
            '본 약관은 OURS가 제공하는 mallog24 웹사이트, Android 앱, iOS 앱, 고객지원, 관련 안내 문서에 적용됩니다.',
            '이용자가 mallog24를 사용하면 본 약관과 개인정보처리방침, 회사 정책에 동의한 것으로 봅니다.',
          ],
        },
        {
          title: '2. 계정 및 인증',
          body: [
            '이용자는 이메일 또는 Apple, Google, Kakao 등 외부 인증 방식을 통해 로그인할 수 있습니다.',
            '회원은 정확한 정보를 제공해야 하며, 타인의 계정을 무단으로 사용해서는 안 됩니다.',
            '계정 정보와 세션 관리 책임은 이용자에게 있으며, 비정상 접근이 의심될 경우 즉시 문의해야 합니다.',
          ],
        },
        {
          title: '3. 서비스 내용',
          body: [
            'mallog24는 음성 파일 또는 녹음 데이터를 전사하고, 문맥 교정, 요약, 기록본 저장, TXT/DOCX 내보내기를 제공합니다.',
            '설교, 회의, 통화 유형에 따라 출력 구조가 다를 수 있습니다.',
            'AI 결과는 보조 도구이며, 최종 문서로 사용하기 전 이용자의 검토가 필요합니다.',
          ],
        },
        {
          title: '4. 업로드 자료에 대한 책임',
          body: [
            '이용자는 업로드하는 음성, 대화, 자료에 대해 적법한 권리 또는 사용 허가를 보유해야 합니다.',
            '저작권, 초상권, 개인정보, 영업비밀을 침해하는 자료 업로드를 금지합니다.',
            '타인의 권리를 침해한 자료로 인해 발생하는 책임은 이용자에게 있습니다.',
          ],
        },
        {
          title: '5. 요금제, 구독 및 환불',
          body: [
            '무료 플랜은 월 10시간 한도를 기본으로 하며, 첫 가입 계정에는 결제 정보 없이 30일 Pro 체험이 제공될 수 있습니다.',
            'Pro 상품은 웹/Android 결제 또는 iOS App Store 인앱구독으로 제공될 수 있으며, 결제 경로별 구독 관리와 환불 절차가 다릅니다.',
            '현재 기본 Pro 상품은 월 8,800원(VAT 포함)이며, iOS 최종 가격은 App Store 국가/지역 기준으로 표시됩니다.',
            '환불은 결제 수단, 플랫폼 정책, 사용량, 관련 법령에 따라 처리됩니다.',
          ],
        },
        {
          title: '6. 금지 행위',
          body: [
            '불법 콘텐츠 업로드, 악성코드 유포, 시스템 공격, 자동화 남용, 결제 우회, API 오용을 금지합니다.',
            '서비스 결과를 허위 사실 유포, 명예훼손, 권리침해, 불법 영업 목적으로 사용해서는 안 됩니다.',
            '운영 정책 위반이 확인되면 이용 제한, 계정 정지, 자료 삭제가 이루어질 수 있습니다.',
          ],
        },
        {
          title: '7. 서비스 변경, 제한 및 중단',
          body: [
            '회사는 보안, 품질 개선, 외부 API 변경, 법령 준수 등을 위해 기능을 변경하거나 일시 중단할 수 있습니다.',
            '긴급 보안 이슈 또는 장애가 발생한 경우 사전 고지 없이 필요한 조치를 할 수 있습니다.',
            '중대한 변경 사항은 서비스 화면 또는 웹사이트를 통해 안내합니다.',
          ],
        },
        {
          title: '8. 지식재산권과 면책',
          body: [
            'mallog24의 소프트웨어, UI, 브랜드, 문서에 관한 권리는 OURS에 있습니다.',
            '이용자가 업로드한 원본 자료의 권리는 이용자 또는 원권리자에게 있습니다.',
            'AI 전사와 요약 결과의 정확성은 녹음 품질, 발화 방식, 외부 API 상태에 따라 달라질 수 있으며, 최종 활용 책임은 이용자에게 있습니다.',
          ],
        },
        {
          title: '9. 준거법 및 문의',
          body: [
            '본 약관은 대한민국 법령을 준거법으로 합니다.',
            '서비스, 결제, 환불, 정책 문의는 ours113814@gmail.com으로 접수합니다.',
          ],
        },
      ],
    },
    company: {
      ...koLegalCommon,
      title: '회사 정책',
      description: 'OURS는 mallog24를 신뢰성, 보안성, 책임 있는 AI 사용 원칙에 따라 운영합니다.',
      metaDescription: 'mallog24 회사 정책: 데이터 처리 원칙, 품질 운영, 보안, 광고, 고객지원, 유료상품 관리 기준을 안내합니다.',
      alternateHref: '/company-policy-en',
      relatedLinks: [
        { label: '개인정보처리방침', href: '/privacy' },
        { label: '이용약관', href: '/terms' },
        { label: '사용 가이드', href: '/guides' },
      ],
      sections: [
        {
          title: '1. 제품 운영 원칙',
          body: [
            'mallog24는 음성 기록을 실무 문서로 바꾸는 흐름을 단순하고 안정적으로 제공하는 것을 목표로 합니다.',
            '웹, Android, iOS 앱은 별개의 배포 형태를 유지하되 핵심 정책과 데이터 처리 기준은 일관되게 관리합니다.',
            '기능 변경은 사용 중인 웹/Android/iOS 사용자에게 갑작스러운 변환 장애가 발생하지 않도록 작은 단위로 검증합니다.',
          ],
        },
        {
          title: '2. 데이터 거버넌스',
          body: [
            '원본 음성, 전사 결과, 사용자 수정 결과, 사용자 용어집은 목적별로 분리해 관리합니다.',
            '원본 음성은 임시 처리 후 삭제를 기본 정책으로 하며, 장기 학습 데이터로 쓰려면 별도의 동의와 저장 기준이 필요합니다.',
            '사용자 수정 결과와 용어집은 품질 개선 후보 데이터로 활용될 수 있으나, 민감정보와 권리침해 요소를 필터링합니다.',
          ],
        },
        {
          title: '3. 품질 및 AI 정확도 운영',
          body: [
            '설교, 회의, 통화처럼 목적이 다른 녹취는 서로 다른 출력 구조와 검수 기준을 적용합니다.',
            '도메인 용어, 발음이 뭉개지는 단어, 유사 발음 약어는 용어집과 후처리 규칙을 통해 단계적으로 개선합니다.',
            'AI 결과는 자동 생성물이므로, 대외 배포나 의사결정에 사용하기 전 이용자 검토를 권장합니다.',
          ],
        },
        {
          title: '4. 보안 및 안정화',
          body: [
            'HTTPS, 인증 토큰 검증, 권한 분리, 요청 제한, 오류 로그 분석을 기본 운영 원칙으로 둡니다.',
            '동시 변환, 장시간 음성 처리, 외부 API 오류는 작업 큐와 재시도 정책으로 안정화합니다.',
            '장애 발생 시 원인 파악, 재현 테스트, 영향 범위 확인, 배포 후 검증 순서로 대응합니다.',
          ],
        },
        {
          title: '5. 광고와 수익화 정책',
          body: [
            '광고는 서비스 이용을 방해하지 않는 위치와 방식으로만 배치합니다.',
            '로그인, 결제, 변환 진행, 민감한 오류 표시 영역에는 사용자가 오인할 수 있는 광고 배치를 지양합니다.',
            '광고 네트워크 정책, ads.txt, app-ads.txt, 개인정보 고지 기준을 유지합니다.',
          ],
        },
        {
          title: '6. 유료상품과 고객지원',
          body: [
            '유료상품은 상품명, 가격, 결제주기, 환불 기준, 지원 채널을 명확히 고지한 뒤 운영합니다.',
            'iOS 인앱구독과 웹/Android 결제는 각각의 플랫폼 정책과 검증 절차를 따릅니다.',
            '고객지원 이메일은 ours113814@gmail.com이며, 보안·결제 문의를 우선 처리합니다.',
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      ...enLegalCommon,
      title: 'Privacy Policy',
      description: 'mallog24 processes only the account, audio, transcription, and billing data needed to provide structured transcription workflows.',
      metaDescription: 'mallog24 Privacy Policy covering account data, audio processing, retention, subprocessors, ads, and user rights.',
      alternateHref: '/privacy',
      relatedLinks: [
        { label: 'Terms of Service', href: '/terms-en' },
        { label: 'Company Policy', href: '/company-policy-en' },
        { label: 'User Guides', href: '/en/guides' },
      ],
      sections: [
        {
          title: '1. Data We Process',
          body: [
            'Account data: email address, password for email login, user identifier, and social login provider identifier.',
            'Social login data: email, name or nickname, Google/Kakao/Apple account identifiers, and Apple private relay email where selected.',
            'Service data: uploaded audio, raw transcript, corrected text, summaries, saved records, and user glossary terms.',
            'Billing data: product ID, subscription status, transaction identifiers, platform information, refund or cancellation status.',
            'Technical data: IP address, browser/device information, error logs, and processing duration for usage calculation.',
          ],
        },
        {
          title: '2. Purposes of Processing',
          body: [
            'Account creation, login, user identification, account protection, and customer support.',
            'Speech recognition, text correction, summaries, saved records, and glossary-assisted transcription.',
            'Usage calculation, 30-day Pro trial eligibility, and web/Android/iOS subscription status checks.',
            'Security monitoring, abuse prevention, reliability improvements, and incident response.',
          ],
        },
        {
          title: '3. Audio and Transcript Handling',
          body: [
            'Original audio files are used temporarily for processing and are deleted after transcription completes as the default operating policy.',
            'Transcripts, corrections, summaries, and saved records may remain in the user account so the user can review and export them.',
            'User-edited results and glossary entries may be separated as quality-improvement candidates under explicit consent and filtering rules.',
            'Users should avoid uploading unnecessary sensitive data such as national ID numbers, payment credentials, or private medical identifiers.',
          ],
        },
        {
          title: '4. Retention and Deletion',
          body: [
            'Account data is retained until account deletion or service termination unless legal retention duties apply.',
            'Original audio is temporarily processed and then deleted by default.',
            'Saved text records are removed when the user deletes them, closes the account, or when operational retention is no longer needed.',
            'Security and error logs are retained only for the period necessary for reliability, abuse prevention, and dispute handling.',
          ],
        },
        {
          title: '5. Subprocessors and International Transfer',
          body: [
            'mallog24 does not sell personal data.',
            'The service may use Supabase for authentication/database, OpenAI for speech recognition, Google Gemini for correction/summarization, Apple for App Store subscriptions and Apple login, and Google/Kakao for social login.',
            'Data may be transferred to servers outside Korea as part of these API workflows and is limited to what is necessary to provide the service.',
          ],
        },
        {
          title: '6. User Rights, Cookies, Ads, and Contact',
          body: [
            'Users may request access, correction, deletion, suspension, or withdrawal of consent by contacting support.',
            'Cookies and logs may be used for login, security, usage calculation, and reliability.',
            'Google AdSense scripts may be used on public pages. Ad personalization depends on user browser and Google account settings.',
            'Contact: ours113814@gmail.com',
          ],
        },
      ],
    },
    terms: {
      ...enLegalCommon,
      title: 'Terms of Service',
      description: 'These terms govern the use of mallog24 on web, Android, and iOS for speech-to-text, correction, summaries, and structured records.',
      metaDescription: 'mallog24 Terms of Service covering accounts, uploads, subscriptions, refunds, prohibited use, and AI output review.',
      alternateHref: '/terms',
      relatedLinks: [
        { label: 'Privacy Policy', href: '/privacy-en' },
        { label: 'Company Policy', href: '/company-policy-en' },
        { label: 'Pricing', href: '/pricing-en' },
      ],
      sections: [
        {
          title: '1. Scope',
          body: [
            'These terms apply to the mallog24 website, Android app, iOS app, support channels, and related documentation provided by OURS.',
            'By using mallog24, users agree to these terms, the Privacy Policy, and Company Policy.',
          ],
        },
        {
          title: '2. Accounts and Authentication',
          body: [
            'Users may log in with email or supported social providers such as Apple, Google, and Kakao.',
            'Users must provide accurate information and must not use another person’s account without authorization.',
            'Users are responsible for protecting their account credentials and sessions.',
          ],
        },
        {
          title: '3. Service Features',
          body: [
            'mallog24 provides audio upload or recording, speech-to-text, correction, summarization, saved records, and TXT/DOCX export.',
            'The output structure differs by purpose, including sermon, meeting, and call workflows.',
            'AI-generated output is assistive. Users are responsible for final review before relying on it.',
          ],
        },
        {
          title: '4. User Upload Responsibility',
          body: [
            'Users must have lawful rights or permission to upload audio and related materials.',
            'Uploads that infringe copyright, privacy, publicity rights, confidential information, or other third-party rights are prohibited.',
            'Users are responsible for disputes arising from unauthorized uploads.',
          ],
        },
        {
          title: '5. Plans, Subscriptions, and Refunds',
          body: [
            'The free plan includes a monthly usage cap. New accounts may receive a 30-day Pro trial without entering payment information.',
            'Pro may be offered through web/Android checkout or iOS App Store in-app subscriptions; management and refunds differ by platform.',
            'The default web/Android Pro price is KRW 8,800/month including VAT. iOS pricing is shown by Apple based on App Store country or region.',
            'Refund handling depends on platform policies, usage status, payment provider rules, and applicable law.',
          ],
        },
        {
          title: '6. Prohibited Use and Service Limits',
          body: [
            'Illegal uploads, malware, attacks, abnormal automation, payment circumvention, and API abuse are prohibited.',
            'The service may restrict access, remove content, or suspend accounts when a policy violation or security risk is confirmed.',
            'The service may change or pause features for security, quality, third-party API changes, or legal compliance.',
          ],
        },
        {
          title: '7. Intellectual Property and Liability',
          body: [
            'The software, UI, brand, and documentation of mallog24 belong to OURS.',
            'Rights to user-uploaded source materials remain with the user or the original rights holder.',
            'Accuracy depends on recording quality, speakers, domain terms, and third-party API availability. Users are responsible for final use.',
          ],
        },
        {
          title: '8. Governing Law and Contact',
          body: [
            'These terms are governed by the laws of the Republic of Korea.',
            'Contact for service, billing, refund, and policy questions: ours113814@gmail.com',
          ],
        },
      ],
    },
    company: {
      ...enLegalCommon,
      title: 'Company Policy',
      description: 'OURS operates mallog24 under reliability, security, responsible AI, advertising, and customer support principles.',
      metaDescription: 'mallog24 Company Policy covering data governance, quality, security, ads, subscriptions, and support standards.',
      alternateHref: '/company-policy',
      relatedLinks: [
        { label: 'Privacy Policy', href: '/privacy-en' },
        { label: 'Terms of Service', href: '/terms-en' },
        { label: 'User Guides', href: '/en/guides' },
      ],
      sections: [
        {
          title: '1. Product Operations',
          body: [
            'mallog24 is operated to help users turn audio into practical structured documents.',
            'The web, Android, and iOS apps remain separate releases while sharing core policy and data-handling standards.',
            'Feature changes are verified in small units to avoid unexpected disruption for active users.',
          ],
        },
        {
          title: '2. Data Governance',
          body: [
            'Original audio, transcripts, user-edited corrections, and glossary entries are managed by purpose.',
            'Original audio is temporary by default; long-term training use requires separate consent and retention rules.',
            'Quality-improvement candidates are filtered for sensitive data and rights concerns before further use.',
          ],
        },
        {
          title: '3. Quality and Responsible AI',
          body: [
            'Different workflows, such as sermons, meetings, and calls, require different output structures.',
            'Domain terms, unclear pronunciation, and similar acronyms are improved through glossary and post-processing updates.',
            'AI output should be reviewed by users before external publication or final decision-making.',
          ],
        },
        {
          title: '4. Security, Ads, and Support',
          body: [
            'HTTPS, token validation, permission separation, request limiting, and error-log review are baseline controls.',
            'Ads are placed only where they do not interfere with login, payment, transcription progress, or important error messages.',
            'Customer support and billing questions are handled through ours113814@gmail.com.',
          ],
        },
      ],
    },
  },
}

export const GUIDE_INDEX = {
  ko: {
    title: 'mallog24 사용 가이드',
    eyebrow: 'Knowledge Base',
    description: '음성 파일을 더 정확하게 녹취하고, AI가 만든 결과를 바로 쓸 수 있는 문서로 다듬는 방법을 정리했습니다.',
    metaDescription: 'mallog24 사용 가이드: 설교 녹취, 회의록, 통화 기록, 녹음 품질, AI 전사 결과 검수 방법을 안내합니다.',
    homeLabel: '홈으로',
    languageLabel: 'English',
    languageHref: '/en/guides',
    featuredLabel: '추천 가이드',
  },
  en: {
    title: 'mallog24 User Guides',
    eyebrow: 'Knowledge Base',
    description: 'Practical guides for preparing audio, improving transcription accuracy, and reviewing AI-generated records.',
    metaDescription: 'mallog24 user guides for sermon transcription, meeting minutes, call notes, recording quality, and transcript review.',
    homeLabel: 'Home',
    languageLabel: '한국어',
    languageHref: '/guides',
    featuredLabel: 'Featured Guides',
  },
}

export const GUIDE_ARTICLES = {
  ko: [
    {
      slug: 'sermon-transcription',
      title: '설교 녹취를 주보용 기록으로 정리하는 방법',
      description: '설교 음성을 단순 원고가 아니라 본문, 핵심 메시지, 적용 포인트, 기도 제목으로 정리하는 실전 흐름입니다.',
      category: '설교',
      readTime: '5분 읽기',
      updated: LEGAL_DOC_DATE_KO,
      intro: '설교 녹취는 일반 회의록과 다릅니다. 본문과 중심 메시지가 있고, 반복되는 표현 속에서도 전달하려는 흐름이 살아 있어야 합니다. mallog24의 설교 유형은 원문을 그대로 늘어놓기보다 예배 후 다시 읽고 공유할 수 있는 기록 형태를 목표로 합니다.',
      sections: [
        {
          title: '본문과 핵심 메시지를 먼저 분리하기',
          body: [
            '설교 파일을 올릴 때 유형을 설교 녹취로 선택하면 결과는 본문, 본론, 결론, 기도, 요약 같은 흐름을 우선합니다. 본문 구절이 말로만 언급되어도 결과에서 별도 항목으로 확인하는 것이 좋습니다.',
            '성경 본문, 인물, 장소, 기관명, 교회 내부 용어는 일반 음성 인식 모델이 틀리기 쉽습니다. RVS, RUTC, 렘넌트 같은 고유어는 사용자 용어집에 추가해 두면 후처리 단계에서 더 안정적으로 보정됩니다.',
          ],
        },
        {
          title: '주보용 요약은 짧고 검토 가능한 문장으로',
          body: [
            '주보나 공지 문서에 넣을 요약은 설교 전체를 압축하는 것보다 핵심 문장 2~4개와 적용 포인트를 분리하는 편이 읽기 좋습니다.',
            'AI가 만든 문장은 반드시 표현 수위와 신학적 의도, 인용 구절을 다시 확인해야 합니다. 특히 비슷하게 들리는 단어가 교리적 의미를 바꿀 수 있으므로 최종 배포 전 검수가 필요합니다.',
          ],
        },
        {
          title: '반복 설교 시리즈는 용어집으로 품질을 누적하기',
          body: [
            '같은 설교자, 같은 시리즈, 같은 기관 용어가 반복된다면 사용자 용어집이 가장 현실적인 학습 데이터 역할을 합니다.',
            '잘못 인식된 표현과 올바른 표기를 함께 저장하면 이후 변환에서 비슷한 오류를 줄일 수 있습니다. 이 데이터는 장기적으로 별도 동의 기반의 품질 개선 데이터셋으로 확장할 수 있습니다.',
          ],
        },
      ],
      checklist: [
        '설교 유형을 선택했는지 확인하기',
        '본문 구절과 핵심 메시지가 분리됐는지 확인하기',
        '고유명사와 약어를 사용자 용어집에 추가하기',
        '주보용 문장은 최종 배포 전 사람이 검수하기',
      ],
      faq: [
        ['설교 파일이 길어도 사용할 수 있나요?', '사용량 한도와 파일 크기 제한 안에서 사용할 수 있습니다. 긴 파일은 녹음 품질과 서버 처리 상태에 따라 시간이 더 걸릴 수 있습니다.'],
        ['설교자의 말투까지 그대로 보존되나요?', '기본 목적은 읽기 좋은 기록입니다. 말투를 그대로 남기고 싶다면 원문 영역을 함께 확인하고 필요한 부분을 직접 수정하는 것이 좋습니다.'],
      ],
    },
    {
      slug: 'meeting-minutes',
      title: '회의 녹음에서 결정사항과 후속 조치를 놓치지 않는 방법',
      description: '회의 음성을 안건, 결정, 담당자, 다음 행동으로 나누어 재사용 가능한 회의록으로 만드는 방법입니다.',
      category: '회의',
      readTime: '6분 읽기',
      updated: LEGAL_DOC_DATE_KO,
      intro: '좋은 회의록은 모든 말을 기록하는 문서가 아니라, 나중에 실행할 사람이 바로 이해할 수 있는 문서입니다. mallog24의 회의 유형은 참석자 발언 흐름을 보존하면서 안건, 결정, 후속 조치를 분리하는 데 초점을 둡니다.',
      sections: [
        {
          title: '회의 시작 전에 녹음 목적을 정하기',
          body: [
            '회의 녹음은 회의록, 의사결정 기록, 상담 메모처럼 목적에 따라 결과 검수 기준이 달라집니다. 회의 전 “오늘 반드시 남겨야 하는 항목”을 정해두면 결과를 빠르게 확인할 수 있습니다.',
            '예산, 일정, 담당자, 승인 여부처럼 숫자와 고유명사가 많은 회의는 AI가 틀릴 수 있으므로 원본과 비교해야 합니다.',
          ],
        },
        {
          title: '발화 겹침 줄이기',
          body: [
            '여러 사람이 동시에 말하면 화자 흐름이 무너질 수 있습니다. 발표자 한 명이 말한 뒤 다른 사람이 이어가는 구조가 가장 안정적입니다.',
            '온라인 회의라면 스피커 출력과 마이크 입력이 겹치지 않도록 녹음 장치를 확인하고, 가능하면 회의 플랫폼 자체 녹음 파일을 사용하는 편이 좋습니다.',
          ],
        },
        {
          title: '회의록 검수 순서',
          body: [
            '먼저 결정사항을 확인하고, 다음으로 담당자와 기한을 봅니다. 마지막으로 요약 문장의 표현을 다듬으면 검수 시간이 줄어듭니다.',
            '회의 후속 조치가 없는 회의록은 다시 읽어도 실행으로 이어지기 어렵습니다. “누가, 언제까지, 무엇을”이 빠졌다면 직접 보완해 저장하세요.',
          ],
        },
      ],
      checklist: [
        '회의 유형을 선택하기',
        '안건과 결정사항이 분리됐는지 확인하기',
        '담당자와 날짜 같은 고유값을 원본과 대조하기',
        '후속 조치를 실행 가능한 문장으로 바꾸기',
      ],
      faq: [
        ['회의 참석자 이름을 자동으로 완벽히 구분하나요?', '녹음 품질과 발화 방식에 따라 다릅니다. 중요한 회의는 결과를 검수하고 이름을 직접 정리하는 것이 안전합니다.'],
        ['회의록을 DOCX로 바로 내보낼 수 있나요?', '예. 결과 화면에서 TXT, DOCX, 클립보드 복사를 사용할 수 있습니다.'],
      ],
    },
    {
      slug: 'call-notes',
      title: '통화 녹음을 기록본으로 정리할 때 확인할 점',
      description: '상담, 고객 응대, 업무 통화에서 핵심 메모와 후속 조치를 안전하게 남기는 방법입니다.',
      category: '통화',
      readTime: '5분 읽기',
      updated: LEGAL_DOC_DATE_KO,
      intro: '통화 기록은 짧아 보여도 개인정보, 약속, 금액, 일정이 함께 포함될 수 있습니다. 단순 녹취보다 핵심 메모와 확인이 필요한 항목을 분리하는 것이 중요합니다.',
      sections: [
        {
          title: '통화 녹음의 법적 책임 확인하기',
          body: [
            '통화 녹음은 국가와 상황에 따라 동의 요건이 다를 수 있습니다. mallog24는 공식적으로 배포되거나 적법하게 확보한 음성 파일 사용을 권장합니다.',
            '제3자의 개인정보, 의료정보, 금융정보가 포함된 경우 필요한 범위만 기록하고 불필요한 민감정보는 공유하지 않는 것이 좋습니다.',
          ],
        },
        {
          title: '핵심 메모와 원문을 분리하기',
          body: [
            '통화 유형을 사용하면 전체 대화보다 핵심 메모, 일정, 요청사항, 후속 연락이 더 눈에 띄게 정리됩니다.',
            '전화번호, 계좌, 주소, 날짜처럼 숫자 정보는 음성 인식 오류가 생기기 쉬우므로 원본 통화와 반드시 대조해야 합니다.',
          ],
        },
        {
          title: '후속 조치 중심으로 저장하기',
          body: [
            '통화 기록은 “무슨 이야기를 했는가”보다 “다음에 무엇을 해야 하는가”가 중요합니다.',
            '저장 전 후속 조치 문장을 짧게 정리해 두면 나중에 다시 찾을 때 업무 맥락을 빠르게 복원할 수 있습니다.',
          ],
        },
      ],
      checklist: [
        '녹음 사용 권한과 동의 요건 확인하기',
        '개인정보가 포함된 부분은 공유 전 삭제 또는 마스킹하기',
        '숫자, 날짜, 주소를 원본과 대조하기',
        '다음 연락 또는 처리해야 할 일을 별도 항목으로 남기기',
      ],
      faq: [
        ['통화 녹음도 여러 화자를 분리하나요?', '통화 유형은 A/B 흐름을 우선 적용하지만, 녹음 품질이나 겹침 발화에 따라 결과가 달라질 수 있습니다.'],
        ['민감정보가 들어간 통화를 올려도 되나요?', '서비스 목적에 꼭 필요한 경우를 제외하고 민감정보 업로드는 권장하지 않습니다. 공유 전에는 반드시 검수하세요.'],
      ],
    },
    {
      slug: 'recording-quality',
      title: 'AI 녹취 정확도를 높이는 녹음 환경 체크리스트',
      description: '앞부분이 짤리거나 단어가 뭉개지는 문제를 줄이기 위해 녹음 전 확인할 수 있는 기준입니다.',
      category: '품질',
      readTime: '7분 읽기',
      updated: LEGAL_DOC_DATE_KO,
      intro: 'AI 녹취 품질은 모델만으로 결정되지 않습니다. 마이크 위치, 주변 소음, 파일 형식, 발화 겹침, 녹음 시작 시점이 결과에 큰 영향을 줍니다. 변환 정확도를 높이려면 녹음 단계에서부터 작은 습관을 만드는 것이 좋습니다.',
      sections: [
        {
          title: '처음 3초를 비워두기',
          body: [
            '녹음 시작 직후 바로 말하면 기기나 브라우저가 마이크 입력을 안정화하기 전에 중요한 첫 문장이 들어갈 수 있습니다.',
            '회의나 설교 시작 전 2~3초 정도 여유를 두고 말하면 앞부분 누락 가능성을 줄일 수 있습니다. 실시간 녹음도 시작 버튼을 누른 뒤 파형이 반응하는지 확인하고 시작하는 편이 좋습니다.',
          ],
        },
        {
          title: '마이크와 화자의 거리',
          body: [
            '마이크가 너무 멀면 “렘넌트” 같은 단어가 “렙논트”처럼 뭉개져 인식될 수 있습니다. 반대로 너무 가까우면 파열음이 커져 다른 오류가 생길 수 있습니다.',
            '스마트폰 녹음은 화자와 30~60cm 거리, 노트북 내장 마이크는 키보드 소음이 적은 위치를 권장합니다.',
          ],
        },
        {
          title: '소음과 반향 줄이기',
          body: [
            '카페, 큰 강당, 울림이 심한 공간에서는 고유명사와 약어 인식률이 떨어질 수 있습니다.',
            '가능하면 벽 반사가 적은 위치에서 녹음하고, 스피커 출력 소리가 다시 마이크로 들어가지 않게 합니다.',
          ],
        },
        {
          title: '파일 형식과 길이',
          body: [
            'MP3, M4A, WAV처럼 일반적인 형식을 사용하는 것이 안정적입니다. 너무 낮은 비트레이트나 손상된 파일은 길이 확인과 전사 모두에 영향을 줄 수 있습니다.',
            '긴 파일은 처리 시간이 길어질 수 있으므로, 회의 단위나 설교 단위로 파일을 나누면 검수와 재처리가 쉬워집니다.',
          ],
        },
      ],
      checklist: [
        '녹음 시작 후 2~3초 뒤 말하기',
        '마이크 거리와 입력 레벨 확인하기',
        '스피커 소리가 마이크로 재입력되지 않게 하기',
        '긴 파일은 의미 단위로 나누어 보관하기',
        '중요 고유명사는 사용자 용어집에 미리 등록하기',
      ],
      faq: [
        ['이미 녹음된 파일의 품질도 개선할 수 있나요?', '일부 소음 제거 도구가 도움이 될 수 있지만, 원본 음질이 낮으면 한계가 있습니다. 중요한 파일은 원본을 보존해 두는 것이 좋습니다.'],
        ['앞부분이 짤리는 문제는 완전히 없어지나요?', '처리 로직을 개선해도 녹음 파일 자체가 늦게 시작됐거나 손상된 경우에는 한계가 있습니다. 시작 전 여유 녹음이 가장 안전합니다.'],
      ],
    },
    {
      slug: 'transcript-review',
      title: 'AI 전사 결과를 검수하고 재사용 가능한 문서로 다듬는 방법',
      description: 'AI가 만든 결과를 그대로 끝내지 않고, 정확한 기록과 학습 가능한 수정 데이터로 바꾸는 검수 방법입니다.',
      category: '검수',
      readTime: '6분 읽기',
      updated: LEGAL_DOC_DATE_KO,
      intro: 'AI 전사 결과는 시작점입니다. 좋은 기록은 오인식을 바로잡고, 핵심 정보를 확인하고, 다음에 같은 오류가 반복되지 않도록 데이터를 남기는 과정에서 만들어집니다.',
      sections: [
        {
          title: '먼저 구조를 확인하기',
          body: [
            '결과가 설교, 회의, 통화 목적에 맞게 나뉘었는지 먼저 봅니다. 구조가 맞으면 문장 단위 수정은 훨씬 빨라집니다.',
            '본문, 주제, 핵심, 요약, 결정사항처럼 큰 항목을 먼저 정리하고, 세부 표현은 마지막에 다듬는 편이 좋습니다.',
          ],
        },
        {
          title: '오인식은 용어집으로 남기기',
          body: [
            'RVS, RUTC, 렘넌트, 무교병, 그리스도처럼 자주 틀리는 단어는 결과만 수정하고 끝내지 말고 사용자 용어집에도 추가하세요.',
            '정확한 표기, 뜻/설명, 오인식 표현을 함께 남기면 다음 변환에서 같은 맥락을 더 잘 반영할 수 있습니다.',
          ],
        },
        {
          title: '수정 결과를 학습 데이터 후보로 관리하기',
          body: [
            '원본 전사와 사용자가 수정한 최종 정답을 짝으로 보관하면 장기적으로 교정 모델 개선에 사용할 수 있습니다.',
            '다만 음성 원본과 텍스트 정답은 개인정보와 저작권 이슈가 있으므로, 명시적 동의, 민감정보 필터링, 목적별 저장소 분리가 필요합니다.',
          ],
        },
      ],
      checklist: [
        '큰 구조부터 확인하기',
        '고유명사와 숫자를 원본과 대조하기',
        '반복 오류는 사용자 용어집에 남기기',
        '외부 공유 전 개인정보와 민감정보를 확인하기',
        '중요 문서는 DOCX로 저장해 별도 보관하기',
      ],
      faq: [
        ['수정한 결과가 자동으로 모델에 학습되나요?', '아닙니다. 품질 개선 후보 데이터로 저장할 수는 있지만, 실제 학습에는 별도 동의와 데이터 정제가 필요합니다.'],
        ['용어집을 많이 넣으면 무조건 좋아지나요?', '맥락이 맞는 용어는 도움이 되지만, 너무 넓거나 애매한 별칭은 오히려 잘못된 보정을 만들 수 있습니다.'],
      ],
    },
  ],
  en: [
    {
      slug: 'sermon-transcription',
      title: 'How to Turn Sermon Audio into Reusable Notes',
      description: 'A practical workflow for organizing sermon audio into scripture, core message, application points, and bulletin-ready notes.',
      category: 'Sermons',
      readTime: '5 min read',
      updated: LEGAL_DOC_DATE_EN,
      intro: 'Sermon transcription is different from ordinary meeting notes. It has a passage, a message flow, and repeated expressions that should remain readable after the service.',
      sections: [
        {
          title: 'Separate scripture and the core message first',
          body: [
            'When you select the sermon workflow, mallog24 prioritizes sections such as scripture, main body, conclusion, prayer, and summary.',
            'Domain terms and acronyms such as RVS, RUTC, and Remnant should be added to the user glossary when they appear repeatedly.',
          ],
        },
        {
          title: 'Keep bulletin summaries short',
          body: [
            'A bulletin summary should not compress the entire sermon. Two to four key sentences plus application points are usually easier to reuse.',
            'AI-generated theological phrasing should always be reviewed before publication.',
          ],
        },
        {
          title: 'Use the glossary for recurring sermon series',
          body: [
            'When the same speaker or series uses repeated terms, glossary entries become the most practical quality-improvement layer.',
            'Store the preferred spelling, meaning, and common misrecognitions together so later corrections are more stable.',
          ],
        },
      ],
      checklist: [
        'Select the sermon workflow',
        'Verify scripture references and key message',
        'Add recurring proper nouns to the user glossary',
        'Review bulletin-ready text before publishing',
      ],
      faq: [
        ['Can long sermons be processed?', 'Yes, within file-size and usage limits. Longer recordings can take more time depending on quality and server load.'],
        ['Does the output preserve the speaker’s exact style?', 'The goal is readable notes. Check the raw transcript when exact wording matters.'],
      ],
    },
    {
      slug: 'meeting-minutes',
      title: 'How to Capture Decisions and Action Items from Meetings',
      description: 'A guide for turning meeting recordings into agenda, decisions, owners, and next actions.',
      category: 'Meetings',
      readTime: '6 min read',
      updated: LEGAL_DOC_DATE_EN,
      intro: 'Useful meeting notes are not a record of every word. They help people understand what was decided and what should happen next.',
      sections: [
        {
          title: 'Set the purpose before recording',
          body: [
            'Decide whether the recording is meant for minutes, decision logs, or follow-up task tracking.',
            'Budget numbers, dates, owners, and approvals should be checked against the source recording.',
          ],
        },
        {
          title: 'Reduce overlapping speech',
          body: [
            'Speaker flow is much more reliable when people avoid talking at the same time.',
            'For online meetings, a platform recording is usually cleaner than recording speaker output through a laptop microphone.',
          ],
        },
        {
          title: 'Review decisions first',
          body: [
            'Check decisions, owners, and deadlines before polishing language.',
            'If a note does not say who will do what by when, add that before saving it.',
          ],
        },
      ],
      checklist: [
        'Select the meeting workflow',
        'Verify decisions and action items',
        'Check names, dates, and numbers',
        'Rewrite follow-ups as executable tasks',
      ],
      faq: [
        ['Can speaker names be separated perfectly?', 'It depends on recording quality and speaker overlap. Important meetings should be reviewed manually.'],
        ['Can I export to DOCX?', 'Yes. TXT, DOCX, and clipboard export are available from the result screen.'],
      ],
    },
    {
      slug: 'call-notes',
      title: 'How to Review Call Recordings Safely',
      description: 'What to check when turning customer, support, or consultation calls into structured notes.',
      category: 'Calls',
      readTime: '5 min read',
      updated: LEGAL_DOC_DATE_EN,
      intro: 'Call notes often include personal data, promises, prices, dates, or addresses. The goal is to separate key notes and follow-ups safely.',
      sections: [
        {
          title: 'Confirm recording rights',
          body: [
            'Call recording rules vary by situation and jurisdiction. mallog24 recommends using lawfully obtained audio.',
            'If personal or sensitive information appears, remove or mask unnecessary details before sharing.',
          ],
        },
        {
          title: 'Separate key notes from the full transcript',
          body: [
            'The call workflow focuses on key memo, schedule, request, and follow-up sections.',
            'Numbers, addresses, dates, and account-like values should be checked against the source audio.',
          ],
        },
        {
          title: 'Save the next action',
          body: [
            'For call notes, the most important part is often what needs to happen next.',
            'Short action sentences help recover the context later.',
          ],
        },
      ],
      checklist: [
        'Confirm recording permission and lawful use',
        'Mask personal data before sharing',
        'Verify dates, numbers, and addresses',
        'Store next actions separately',
      ],
      faq: [
        ['Does the call workflow separate speakers?', 'It prioritizes A/B speaker flow, but quality depends on audio clarity and overlapping speech.'],
        ['Can I upload calls with sensitive data?', 'Avoid unnecessary sensitive data. Review carefully before sharing any generated output.'],
      ],
    },
    {
      slug: 'recording-quality',
      title: 'Recording Quality Checklist for Better AI Transcription',
      description: 'How to reduce missing starts, unclear terms, and noisy transcripts before uploading audio.',
      category: 'Quality',
      readTime: '7 min read',
      updated: LEGAL_DOC_DATE_EN,
      intro: 'AI transcription quality is shaped by the microphone, room noise, file format, speaker overlap, and the first few seconds of recording.',
      sections: [
        {
          title: 'Leave two or three seconds at the start',
          body: [
            'If speech starts immediately after pressing record, the first phrase can be captured while the device is still stabilizing input.',
            'Wait until the recording indicator or waveform is active before starting important content.',
          ],
        },
        {
          title: 'Control microphone distance',
          body: [
            'A microphone that is too far away can blur terms. A microphone that is too close can overemphasize plosive sounds.',
            'For phone recordings, 30-60 cm from the speaker is usually a useful starting point.',
          ],
        },
        {
          title: 'Reduce noise and echo',
          body: [
            'Cafes, large halls, and rooms with heavy echo can reduce recognition of acronyms and proper nouns.',
            'Avoid letting speaker output feed back into the recording microphone.',
          ],
        },
        {
          title: 'Use common file formats',
          body: [
            'MP3, M4A, and WAV are generally reliable. Damaged files or extremely low bitrates can affect both duration detection and transcription.',
            'Long files can be split by meeting or sermon section to make review and retry easier.',
          ],
        },
      ],
      checklist: [
        'Start speaking after a short pause',
        'Check microphone distance and input level',
        'Reduce echo and speaker feedback',
        'Split long files by meaningful sections',
        'Add important terms to the glossary',
      ],
      faq: [
        ['Can poor audio be fixed after recording?', 'Some noise removal can help, but the original quality still limits the result.'],
        ['Can missing starts be completely prevented?', 'Logic can reduce the risk, but if the source file itself starts late or is damaged, there are limits.'],
      ],
    },
    {
      slug: 'transcript-review',
      title: 'How to Review AI Transcripts Before Reuse',
      description: 'A review workflow for turning AI output into accurate documents and useful correction data.',
      category: 'Review',
      readTime: '6 min read',
      updated: LEGAL_DOC_DATE_EN,
      intro: 'AI transcription is a starting point. Better records come from reviewing structure, correcting recurring errors, and saving what should improve next time.',
      sections: [
        {
          title: 'Review structure before wording',
          body: [
            'Check whether the result is organized correctly for sermon, meeting, or call purposes.',
            'Fix large sections first, then polish sentence-level wording.',
          ],
        },
        {
          title: 'Save recurring errors in the glossary',
          body: [
            'Terms such as RVS, RUTC, Remnant, and other domain vocabulary should be stored with preferred spelling and common misrecognitions.',
            'This helps later correction steps use context more consistently.',
          ],
        },
        {
          title: 'Manage edits as training candidates',
          body: [
            'A pair of raw transcript and final user correction can become valuable quality data.',
            'Audio and corrected text still require consent, sensitive-data filtering, and separate storage before training use.',
          ],
        },
      ],
      checklist: [
        'Review large sections first',
        'Check names, numbers, and proper nouns',
        'Add recurring mistakes to the glossary',
        'Remove sensitive data before external sharing',
        'Export important documents to DOCX',
      ],
      faq: [
        ['Are user edits automatically used for model training?', 'No. They can be stored as candidates, but training requires separate consent and data preparation.'],
        ['Does adding many glossary terms always help?', 'Relevant terms help. Very broad or ambiguous aliases can create incorrect corrections.'],
      ],
    },
  ],
}

export const findGuideArticle = (locale, slug) => (
  (GUIDE_ARTICLES[locale] || []).find((article) => article.slug === slug) || null
)
