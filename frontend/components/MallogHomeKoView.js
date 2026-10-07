import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import MallogWorkspaceLoading from './MallogWorkspaceLoading'
import HeaderMenuControls from './HeaderMenuControls'
import MallogAuthPanel from './MallogAuthPanel'
import Mallog24Logo from './Mallog24Logo'

const MallogWorkspaceKo = dynamic(() => import('./MallogWorkspaceKo'), {
  ssr: false,
  timeout: 15000,
  loading: (state) => <MallogWorkspaceLoading locale="ko" {...state} />,
})

function FooterInlineRow({ items, className = '' }) {
  const visibleItems = items.filter(Boolean)

  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${className}`}>
      {visibleItems.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-x-2">
          {index > 0 ? <span className="opacity-45">|</span> : null}
          <span>{item}</span>
        </span>
      ))}
    </p>
  )
}

export default function MallogHomeKoView(props) {
  const {
    darkMode,
    setDarkMode,
    uiTheme,
    setUiTheme,
    uiThemeMode,
    setUiThemeMode,
    toastMessage,
    OURS_PRIVACY_URL,
    OURS_TERMS_URL,
    OURS_COMPANY_POLICY_URL,
    OG_IMAGE_URL,
    BUSINESS_NAME,
    BUSINESS_REG_NUMBER,
    LANDLINE_PHONE,
    BUSINESS_ADDRESS,
    REPRESENTATIVE_NAME,
    ECOMMERCE_REG_NUMBER,
    TRADEMARK_APPLICATION_NO,
    COPYRIGHT_REGISTRATION_NO,
    SUPPORT_EMAIL,
    CANONICAL_URL,
    ALTERNATE_URL,
    SERVICE_INFO_URL,
    APP_DOWNLOAD_URL,
    IOS_APP_STORE_URL,
    homeHref,
  } = props

  const accessEnabled = Boolean(props.accessEnabled)

  useEffect(() => {
    if (!accessEnabled) {
      // Warm public UI code during auth; protected controls/data stay behind the access gate.
      // A failed warm-up is non-fatal: the dynamic import can retry when the workspace mounts.
      import('./MallogWorkspaceKo').catch(() => {})
    }
  }, [accessEnabled])

  const navItems = [
    { label: '사용 가이드', href: '/guides' },
    { label: '무료 이용 안내', href: SERVICE_INFO_URL },
    { label: 'Android', href: APP_DOWNLOAD_URL, external: true },
    { label: 'iOS', href: IOS_APP_STORE_URL, external: true },
  ].filter(item => item.href)

  const footerBusinessRows = [
    [`상호: ${BUSINESS_NAME}`, `대표: ${REPRESENTATIVE_NAME}`, `사업자등록번호: ${BUSINESS_REG_NUMBER}`, `통신판매신고번호: ${ECOMMERCE_REG_NUMBER}`],
    [`사업장주소: ${BUSINESS_ADDRESS}`, LANDLINE_PHONE ? `대표자 전화번호: ${LANDLINE_PHONE}` : '', `비즈니스 문의 이메일: ${SUPPORT_EMAIL}`],
    [`상표 출원번호: ${TRADEMARK_APPLICATION_NO}`, `저작권 등록번호: ${COPYRIGHT_REGISTRATION_NO}`, `1:1 문의 이메일: ${SUPPORT_EMAIL}`],
  ]

  return (
    <div className="mallog-app min-h-screen">
      <Head>
        <title>mallog24 - AI Speech to Text</title>
        <meta
          name="description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 무료 AI 녹취 서비스. 로그인 후 결제나 구독 없이 전체 변환 기능을 이용할 수 있습니다."
        />
        <link rel="canonical" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="ko" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="en" href={ALTERNATE_URL} />
        <link rel="alternate" hrefLang="x-default" href={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="mallog24 - AI Speech to Text" />
        <meta
          property="og:description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 무료 AI 녹취 서비스. 로그인 후 결제나 구독 없이 전체 변환 기능을 이용할 수 있습니다."
        />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="mallog24 - AI Speech to Text" />
        <meta
          name="twitter:description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 무료 AI 녹취 서비스입니다."
        />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
      </Head>

      <header className="mallog-topbar">
        <div className="mallog-topbar-inner">
          <Link prefetch={false} href={homeHref} className="mallog-brand" aria-label="mallog24">
            <Image src="/mallog24-app-icon.png" width={30} height={30} sizes="30px" alt="" />
            <Mallog24Logo className="h-6 w-auto" />
          </Link>
          <HeaderMenuControls
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            uiTheme={uiTheme}
            setUiTheme={setUiTheme}
            uiThemeMode={uiThemeMode}
            setUiThemeMode={setUiThemeMode}
            locale="kr"
            navItems={navItems}
          />
        </div>
      </header>

      <main className={accessEnabled ? 'mallog-main' : 'mallog-main mallog-main-auth'}>
        {!accessEnabled ? (
          <MallogAuthPanel {...props} />
        ) : (
          <MallogWorkspaceKo {...props} />
        )}

        {/* 푸터 */}
        <footer className="mallog-footer text-center">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
            <a href={OURS_PRIVACY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              개인정보처리방침
            </a>
            <span className="text-nm-text-secondary opacity-45">|</span>
            <a href={OURS_TERMS_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              이용약관
            </a>
            <span className="text-nm-text-secondary opacity-45">|</span>
            <a href={OURS_COMPANY_POLICY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              회사 정책
            </a>
          </div>
          <div className="mb-2 flex flex-col items-center gap-1 text-[11px] text-nm-text-secondary leading-relaxed">
            {footerBusinessRows.map((row, index) => (
              <FooterInlineRow key={`footer-business-${index}`} items={row} />
            ))}
          </div>
          <p className="text-[11px] text-nm-text-secondary">
            mallog24 &middot; Copyright 2026. OURS All rights reserved.
          </p>
        </footer>
      </main>
      {toastMessage && (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-16 right-4 z-[70] max-w-xs nm-raised px-4 py-3 border-l-4 border-amber-500"
        >
          <p className="text-xs text-nm-text-primary">{toastMessage}</p>
        </div>
      )}
    </div>
  )

}
