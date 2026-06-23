import Head from 'next/head'
import Link from 'next/link'
import HeaderMenuControls from './HeaderMenuControls'
import Mallog24Logo from './Mallog24Logo'
import { BUSINESS_INFO, SITE_BASE_URL } from '../content/staticSiteContent'

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

function FooterLink({ href, children }) {
  return (
    <Link href={href} className="text-nm-text-secondary transition-colors hover:text-nm-accent">
      {children}
    </Link>
  )
}

export default function StaticContentLayout({
  locale = 'ko',
  title,
  description,
  metaDescription,
  canonicalPath,
  alternatePath,
  children,
  darkMode,
  setDarkMode,
  uiTheme,
  setUiTheme,
  uiThemeMode,
  setUiThemeMode,
}) {
  const isEnglish = locale === 'en'
  const headerLocale = isEnglish ? 'en' : 'kr'
  const homeHref = isEnglish ? '/en' : '/'
  const guidesHref = isEnglish ? '/en/guides' : '/guides'
  const pricingHref = isEnglish ? '/pricing-en' : '/pricing'
  const privacyHref = isEnglish ? '/privacy-en' : '/privacy'
  const termsHref = isEnglish ? '/terms-en' : '/terms'
  const companyHref = isEnglish ? '/company-policy-en' : '/company-policy'
  const business = BUSINESS_INFO[locale] || BUSINESS_INFO.ko
  const pageTitle = `${title} | mallog24`
  const canonicalUrl = `${SITE_BASE_URL}${canonicalPath || homeHref}`
  const alternateUrl = alternatePath ? `${SITE_BASE_URL}${alternatePath}` : null
  const navItems = [
    { label: isEnglish ? 'Home' : '홈', href: homeHref },
    { label: isEnglish ? 'Guides' : '사용 가이드', href: guidesHref },
    { label: isEnglish ? 'Pricing' : '요금제', href: pricingHref },
    { label: isEnglish ? 'Start' : '시작하기', href: `${homeHref}#auth-card` },
  ]

  const footerRows = isEnglish
    ? [
        [`Company Name: ${business.companyName}`, `Representative: ${business.representative}`, `Business Registration No.: ${business.businessRegistrationNumber}`, `E-commerce Registration No.: ${business.ecommerceRegistrationNumber}`],
        [`Business Address: ${business.address}`, `Representative Phone: ${business.phone}`, `Business Inquiry Email: ${business.supportEmail}`],
        [`Trademark Application No.: ${business.trademarkApplicationNo}`, `Copyright Registration No.: ${business.copyrightRegistrationNo}`, `1:1 Inquiry Email: ${business.supportEmail}`],
      ]
    : [
        [`상호: ${business.companyName}`, `대표: ${business.representative}`, `사업자등록번호: ${business.businessRegistrationNumber}`, `통신판매신고번호: ${business.ecommerceRegistrationNumber}`],
        [`사업장주소: ${business.address}`, `대표자 전화번호: ${business.phone}`, `비즈니스 문의 이메일: ${business.supportEmail}`],
        [`상표 출원번호: ${business.trademarkApplicationNo}`, `저작권 등록번호: ${business.copyrightRegistrationNo}`, `1:1 문의 이메일: ${business.supportEmail}`],
      ]

  return (
    <div className="min-h-screen pb-12">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription || description} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang={isEnglish ? 'en' : 'ko'} href={canonicalUrl} />
        {alternateUrl ? <link rel="alternate" hrefLang={isEnglish ? 'ko' : 'en'} href={alternateUrl} /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription || description} />
        <meta property="og:url" content={canonicalUrl} />
      </Head>

      <header className="sticky top-0 z-50 border-b border-black/[0.08] bg-[rgba(249,248,246,0.9)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(17,17,16,0.86)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={homeHref} className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#6B6860] dark:text-white/60">OURS</span>
            <span className="text-black/20 dark:text-white/20">/</span>
            <Mallog24Logo className="h-[18px] w-auto shrink-0" />
          </Link>
          <HeaderMenuControls
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            uiTheme={uiTheme}
            setUiTheme={setUiTheme}
            uiThemeMode={uiThemeMode}
            setUiThemeMode={setUiThemeMode}
            locale={headerLocale}
            navItems={navItems}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-nm-accent">
            {isEnglish ? 'mallog24 resources' : 'mallog24 리소스'}
          </p>
          <h1 className={`mt-3 text-[34px] font-semibold leading-tight text-nm-text-primary sm:text-[48px] ${isEnglish ? '' : 'mallog-keep'}`}>
            {title}
          </h1>
          {description ? (
            <p className={`mt-4 max-w-3xl text-base leading-8 text-nm-text-secondary ${isEnglish ? '' : 'mallog-keep'}`}>
              {description}
            </p>
          ) : null}
        </section>

        {children}
      </main>

      <footer className="mx-auto mt-10 max-w-6xl border-t border-black/[0.08] px-4 pt-8 text-center text-xs text-nm-text-secondary sm:px-6 dark:border-white/10">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-semibold">
          <FooterLink href={privacyHref}>{isEnglish ? 'Privacy Policy' : '개인정보처리방침'}</FooterLink>
          <FooterLink href={termsHref}>{isEnglish ? 'Terms of Service' : '이용약관'}</FooterLink>
          <FooterLink href={companyHref}>{isEnglish ? 'Company Policy' : '회사 정책'}</FooterLink>
          <FooterLink href={guidesHref}>{isEnglish ? 'User Guides' : '사용 가이드'}</FooterLink>
        </div>
        <div className="space-y-2">
          {footerRows.map((row, index) => (
            <FooterInlineRow key={`static-footer-${index}`} items={row} />
          ))}
        </div>
        <p className="mt-5 text-[11px] text-nm-text-secondary/75">© 2026 OURS. mallog24.</p>
      </footer>
    </div>
  )
}
