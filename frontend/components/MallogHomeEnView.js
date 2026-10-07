import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import MallogWorkspaceLoading from './MallogWorkspaceLoading'
import HeaderMenuControls from './HeaderMenuControls'
import MallogAuthPanel from './MallogAuthPanel'
import Mallog24Logo from './Mallog24Logo'

const MallogWorkspaceEn = dynamic(() => import('./MallogWorkspaceEn'), {
  ssr: false,
  timeout: 15000,
  loading: (state) => <MallogWorkspaceLoading locale="en" {...state} />,
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

export default function MallogHomeEnView(props) {
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
      import('./MallogWorkspaceEn').catch(() => {})
    }
  }, [accessEnabled])

  const navItems = [
    { label: 'Guides', href: '/en/guides' },
    { label: 'Free access', href: SERVICE_INFO_URL },
    { label: 'Android', href: APP_DOWNLOAD_URL, external: true },
    { label: 'iOS', href: IOS_APP_STORE_URL, external: true },
  ].filter(item => item.href)

  const footerBusinessRows = [
    [`Company Name: ${BUSINESS_NAME}`, `Representative: ${REPRESENTATIVE_NAME}`, `Business Registration No.: ${BUSINESS_REG_NUMBER}`, `E-commerce Registration No.: ${ECOMMERCE_REG_NUMBER}`],
    [`Business Address: ${BUSINESS_ADDRESS}`, LANDLINE_PHONE ? `Representative Phone: ${LANDLINE_PHONE}` : '', `Business Inquiry Email: ${SUPPORT_EMAIL}`],
    [`Trademark Application No.: ${TRADEMARK_APPLICATION_NO}`, `Copyright Registration No.: ${COPYRIGHT_REGISTRATION_NO}`, `1:1 Inquiry Email: ${SUPPORT_EMAIL}`],
  ]

  return (
    <div className="mallog-app min-h-screen">
      <Head>
        <title>mallog24 - AI Speech to Text</title>
        <meta
          name="description"
          content="Free AI transcription for sermons, calls, and meetings with structured output. Signed-in users can use the full workflow without payment or a subscription."
        />
        <link rel="canonical" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="en" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="ko" href={ALTERNATE_URL} />
        <link rel="alternate" hrefLang="x-default" href={ALTERNATE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="mallog24 - AI Speech to Text" />
        <meta
          property="og:description"
          content="Free AI transcription for sermons, calls, and meetings with structured output. Signed-in users can use the full workflow without payment or a subscription."
        />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="mallog24 - AI Speech to Text" />
        <meta
          name="twitter:description"
          content="Free AI transcription for sermons, calls, and meetings with structured output."
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
            locale="en"
            navItems={navItems}
          />
        </div>
      </header>

      <main className={accessEnabled ? 'mallog-main' : 'mallog-main mallog-main-auth'}>
        {!accessEnabled ? (
          <MallogAuthPanel {...props} />
        ) : (
          <MallogWorkspaceEn {...props} />
        )}
        {/* 푸터 */}
        <footer className="mallog-footer text-center">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
            <a href={OURS_PRIVACY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              Privacy Policy
            </a>
            <span className="text-nm-text-secondary opacity-45">|</span>
            <a href={OURS_TERMS_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              Terms of Service
            </a>
            <span className="text-nm-text-secondary opacity-45">|</span>
            <a href={OURS_COMPANY_POLICY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              Company Policy
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
