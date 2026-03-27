import Link from 'next/link'
import { useMemo, useState } from 'react'

const FEATURE_ICONS = {
  waveform: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M3 12h2l2-5 4 10 2-5 2 3h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M8 3h6l5 5v13H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4.13a4 4 0 0 1 0 5.74" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sparkles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="m12 3 1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4v4" strokeLinecap="round" />
      <path d="M22 6h-4" strokeLinecap="round" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 3v12" strokeLinecap="round" />
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" strokeLinecap="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  ),
}

function flattenPreviewItems(sections = []) {
  return sections.flatMap((section, sectionIndex) => (
    section.items.map((item, itemIndex) => ({
      key: `${section.title}-${itemIndex}`,
      label: sectionIndex === 0 && itemIndex === 0 ? `${section.title}: ${item}` : item,
      delay: (sectionIndex * 2 + itemIndex) * 90,
    }))
  ))
}

function FeatureCard({ card, localeTextClass }) {
  const isDark = card.variant === 'dark'
  return (
    <article
      className={`rounded-2xl border p-6 transition-transform duration-200 hover:-translate-y-1 ${
        isDark
          ? 'border-[#DBEAFE] bg-[linear-gradient(180deg,#EEF4FF_0%,#FFFFFF_100%)] shadow-[0_10px_30px_rgba(59,130,246,0.12)] dark:bg-[#0F172A] dark:border-white/10 dark:shadow-[0_18px_40px_rgba(15,23,42,0.26)]'
          : 'bg-white border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:bg-[#0F172A] dark:border-white/10 dark:shadow-[0_18px_40px_rgba(15,23,42,0.16)]'
      }`}
    >
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border ${
          isDark
            ? 'border-[#BFDBFE] bg-[#DBEAFE] text-[#2563EB] dark:border-transparent dark:bg-[rgba(59,130,246,0.2)] dark:text-[#93C5FD]'
            : 'border-[#DBEAFE] bg-[#EFF6FF] text-[#3B82F6] dark:border-white/10 dark:bg-[rgba(59,130,246,0.16)] dark:text-[#93C5FD]'
        }`}
      >
        {FEATURE_ICONS[card.icon]}
      </div>
      <h3 className={`text-xl font-semibold tracking-[-0.02em] ${isDark ? 'text-[#0F172A] dark:text-white' : 'text-[#0F172A] dark:text-white'} ${localeTextClass}`}>
        {card.title}
      </h3>
      <p className={`mt-3 text-base leading-7 ${
        isDark
          ? 'text-[#475569] dark:text-[rgba(255,255,255,0.72)]'
          : 'text-[#64748B] dark:text-[rgba(255,255,255,0.72)]'
      } ${localeTextClass}`}>
        {card.body}
      </p>
    </article>
  )
}

export default function MallogLandingSections({ locale = 'kr', content, pricingUrl, oursUrl, stats, appDownloadUrl = '' }) {
  const [activePreviewIndex, setActivePreviewIndex] = useState(0)
  const localeTextClass = locale === 'kr' ? 'mallog-keep' : ''
  const authUrl = locale === 'kr' ? '/#auth-card' : '/en#auth-card'
  const activePreview = content.preview.cases?.[activePreviewIndex] || content.preview.cases?.[0]
  const previewItems = useMemo(() => flattenPreviewItems(activePreview?.outputSections), [activePreview])
  const hasStats = Boolean(
    stats &&
    [stats.hoursProcessed, stats.betaUsers, stats.avgTurnaround, stats.timeSaving].some((value) => String(value || '').trim())
  )
  const statsCards = [
    {
      key: 'hoursProcessed',
      label: content.stats.cards.hoursProcessed.label,
      value: stats?.hoursProcessed || content.stats.cards.hoursProcessed.fallback,
    },
    {
      key: 'betaUsers',
      label: content.stats.cards.betaUsers.label,
      value: stats?.betaUsers || content.stats.cards.betaUsers.fallback,
    },
    {
      key: 'avgTurnaround',
      label: content.stats.cards.avgTurnaround.label,
      value: stats?.avgTurnaround || content.stats.cards.avgTurnaround.fallback,
    },
    {
      key: 'timeSaving',
      label: content.stats.cards.timeSaving.label,
      value: stats?.timeSaving || content.stats.cards.timeSaving.fallback,
    },
  ]

  return (
    <section className="mb-10 space-y-16 lg:space-y-20">
      <section id="hero" className="landing-anchor-offset overflow-hidden rounded-[28px] bg-[#0F172A] px-6 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.28)] sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <div className="relative">
          <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-[#3B82F6]/20 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-10 h-52 w-52 rounded-full bg-[#7C3AED]/20 blur-3xl" />
          <div className="relative max-w-4xl">
            <span className="inline-flex items-center rounded-full border border-[#3B82F6]/20 bg-[rgba(59,130,246,0.15)] px-4 py-1.5 text-xs font-semibold tracking-[0.01em] text-[#93C5FD] whitespace-nowrap">
              {content.hero.badge}
            </span>
            <h1 className={`mt-5 text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[46px] lg:text-[56px] ${localeTextClass}`}>
              <span className="block">{content.hero.titleLead}</span>
              <span className="mt-2 block text-gradient-brand">{content.hero.titleAccent}</span>
            </h1>
            <p className={`mt-6 max-w-3xl text-base leading-8 text-white/60 sm:text-lg ${localeTextClass}`}>
              {content.hero.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={authUrl}
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[linear-gradient(135deg,#3B82F6,#7C3AED)] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(59,130,246,0.28)] transition duration-200 hover:-translate-y-[1px] hover:opacity-90 whitespace-nowrap"
              >
                {content.hero.primaryCtaLabel}
              </Link>
              <Link
                href={pricingUrl}
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/5 whitespace-nowrap"
              >
                {content.hero.secondaryCtaLabel}
              </Link>
            </div>
            <p className={`mt-5 text-[13px] leading-6 text-white/40 ${localeTextClass}`}>
              {content.hero.trustLine}
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="landing-anchor-offset space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">{content.features.eyebrow}</p>
          <h2 className={`mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
            {content.features.title}
          </h2>
          <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{content.features.description}</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {content.features.cards.map((card) => (
            <FeatureCard key={card.title} card={card} localeTextClass={localeTextClass} />
          ))}
        </div>
      </section>

      <section id="workflow" className="landing-anchor-offset rounded-[24px] bg-[#F8F9FF] px-6 py-8 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">{content.workflow.eyebrow}</p>
          <h2 className={`mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
            {content.workflow.title}
          </h2>
          <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{content.workflow.description}</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {content.workflow.steps.map((step) => (
            <article key={step.step} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <span className="inline-flex rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#2563EB]">{step.step}</span>
              <h3 className={`mt-4 text-xl font-semibold tracking-[-0.02em] text-[#0F172A] ${localeTextClass}`}>{step.title}</h3>
              <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="preview" className="landing-anchor-offset space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">{content.preview.eyebrow}</p>
          <h2 className={`mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
            {content.preview.title}
          </h2>
          <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{content.preview.description}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {content.preview.cases.map((preview, index) => {
            const isActive = index === activePreviewIndex
            return (
              <button
                key={preview.key}
                type="button"
                onClick={() => setActivePreviewIndex(index)}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'border-transparent bg-[linear-gradient(135deg,#3B82F6,#7C3AED)] text-white shadow-[0_12px_24px_rgba(59,130,246,0.2)]'
                    : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8F9FF]'
                }`}
                aria-pressed={isActive}
              >
                {preview.label}
              </button>
            )
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_18px_60px_rgba(15,23,42,0.14)] dark:border-white/8 dark:bg-[#0F172A] dark:shadow-[0_18px_60px_rgba(15,23,42,0.28)]">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 dark:border-white/8 dark:bg-[#0F172A]">
            <span className="h-3 w-3 rounded-full bg-[#FB7185]" />
            <span className="h-3 w-3 rounded-full bg-[#FBBF24]" />
            <span className="h-3 w-3 rounded-full bg-[#34D399]" />
            <span className="ml-3 text-sm font-medium text-[#64748B] whitespace-nowrap">mallog24.com</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[0.92fr,1.08fr]">
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] p-5 lg:border-b-0 lg:border-r dark:border-white/8 dark:bg-[#1E293B]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#64748B]">{content.preview.beforeLabel}</p>
              <div className="mt-4 space-y-3">
                {activePreview?.sourceLines.map((line) => (
                  <p key={line} className={`text-[15px] leading-7 text-[#475569] dark:text-[#94A3B8] ${localeTextClass}`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <div className="bg-white p-5 dark:bg-[#0F172A]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#3B82F6]">{content.preview.afterLabel}</p>
              <div className="mt-4 space-y-4">
                {activePreview?.outputSections.map((section) => (
                  <div key={section.title} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-white/8 dark:bg-white/[0.02]">
                    <p className={`text-sm font-semibold text-[#0F172A] dark:text-white ${localeTextClass}`}>{section.title}</p>
                    <ul className="mt-3 space-y-2">
                      {section.items.map((item, itemIndex) => (
                        <li
                          key={item}
                          className={`mallog-output-item flex items-start gap-2 text-[15px] leading-7 text-[#475569] dark:text-[rgba(255,255,255,0.74)] ${localeTextClass}`}
                          style={{ animationDelay: `${(itemIndex + 1 + activePreview.outputSections.indexOf(section) * 2) * 90}ms` }}
                        >
                          <span className="mt-[11px] text-[#3B82F6]">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#2563EB] dark:border-[#3B82F6]/20 dark:bg-[#111C34] dark:text-[#93C5FD]">
                  {locale === 'kr'
                    ? `${previewItems.length}개의 구조화 항목이 전사 결과에서 바로 생성됩니다.`
                    : `${previewItems.length} structured items are generated directly from the transcript.`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="landing-anchor-offset space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">{content.useCases.eyebrow}</p>
          <h2 className={`mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
            {content.useCases.title}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {content.useCases.cards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              <h3 className={`text-xl font-semibold tracking-[-0.02em] text-[#0F172A] ${localeTextClass}`}>{card.title}</h3>
              <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {hasStats ? (
        <section id="stats" className="landing-anchor-offset rounded-[24px] bg-[#F8F9FF] px-6 py-8 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">Metrics</p>
              <h2 className={`mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
                {content.stats.title}
              </h2>
              <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{content.stats.description}</p>
            </div>
            {stats?.updatedAt ? <p className="text-sm text-[#64748B]">{content.stats.updatedPrefix}: {stats.updatedAt}</p> : null}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statsCards.map((card) => (
              <article key={card.key} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B]">{card.label}</p>
                <p className={`mt-3 text-xl font-semibold leading-tight text-[#0F172A] ${localeTextClass}`}>{card.value}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="pricing" className="landing-anchor-offset rounded-[24px] bg-[#F8F9FF] px-6 py-8 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">Pricing</p>
          <h2 className={`mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
            {content.comparison.title}
          </h2>
          <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{content.comparison.description}</p>
        </div>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.2fr,0.9fr,0.9fr] bg-[#F8F9FF] text-sm font-semibold text-[#64748B]">
              <div className="px-5 py-4">{content.comparison.columns.feature}</div>
              <div className="border-l border-[#E2E8F0] px-5 py-4">{content.comparison.columns.free}</div>
              <div className="border-l border-[#E2E8F0] px-5 py-4">{content.comparison.columns.pro}</div>
            </div>
            {content.comparison.rows.map((row) => (
              <div key={row.feature} className="grid grid-cols-[1.2fr,0.9fr,0.9fr] border-t border-[#E2E8F0] text-[15px] leading-7 text-[#0F172A]">
                <div className={`px-5 py-4 font-semibold ${localeTextClass}`}>{row.feature}</div>
                <div className={`border-l border-[#E2E8F0] px-5 py-4 text-[#64748B] ${localeTextClass}`}>{row.free}</div>
                <div className={`border-l border-[#E2E8F0] px-5 py-4 text-[#64748B] ${localeTextClass}`}>{row.pro}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="landing-anchor-offset space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">FAQ</p>
          <h2 className={`mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
            {content.faq.title}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {content.faq.items.map((faq) => (
            <article key={faq.question} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              <h3 className={`text-lg font-semibold tracking-[-0.02em] text-[#0F172A] ${localeTextClass}`}>{faq.question}</h3>
              <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] sm:px-8 lg:px-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h2 className={`text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px] ${localeTextClass}`}>
              {content.ctaBanner.title}
            </h2>
            <p className={`mt-3 text-base leading-7 text-[#64748B] ${localeTextClass}`}>{content.ctaBanner.body}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Link
              href={authUrl}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[linear-gradient(135deg,#3B82F6,#7C3AED)] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(59,130,246,0.28)] transition duration-200 hover:-translate-y-[1px] hover:opacity-90 whitespace-nowrap"
            >
              {content.ctaBanner.primaryLabel}
            </Link>
            <Link
              href={pricingUrl}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#E2E8F0] px-6 py-3 text-sm font-semibold text-[#0F172A] transition duration-200 hover:bg-[#F8F9FF] whitespace-nowrap"
            >
              {content.ctaBanner.secondaryLabel}
            </Link>
            {appDownloadUrl ? (
              <a
                href={appDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#E2E8F0] px-6 py-3 text-sm font-semibold text-[#0F172A] transition duration-200 hover:bg-[#F8F9FF] whitespace-nowrap"
              >
                {locale === 'kr' ? '앱 다운로드' : 'Download App'}
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  )
}
