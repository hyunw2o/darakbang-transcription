import Link from 'next/link'

const FEATURE_ICONS = {
  waveform: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <path d="M3 12h2l2-5 4 10 2-5 2 3h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <path d="M8 3h6l5 5v13H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4.13a4 4 0 0 1 0 5.74" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sparkles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <path d="m12 3 1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4v4" strokeLinecap="round" />
      <path d="M22 6h-4" strokeLinecap="round" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <path d="M12 3v12" strokeLinecap="round" />
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" strokeLinecap="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  ),
}

function SectionHeader({ eyebrow, title, description, localeTextClass }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2D5BE3]">{eyebrow}</p>
      <h2 className={`mt-3 text-[28px] font-semibold leading-tight text-[#1A1916] dark:text-[#F0EDE8] sm:text-[36px] ${localeTextClass}`}>
        {title}
      </h2>
      {description ? (
        <p className={`mt-3 text-base leading-7 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}>
          {description}
        </p>
      ) : null}
    </div>
  )
}

function FeatureCard({ card, localeTextClass, index }) {
  return (
    <article
      className="landing-reveal rounded-lg border-[0.5px] border-black/[0.1] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-[#2D5BE3]/45 dark:border-white/[0.1] dark:bg-[#1A1916]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg border-[0.5px] border-[#2D5BE3]/20 bg-[#EBF0FD] text-[#2D5BE3] dark:border-[#5B82F0]/30 dark:bg-[#5B82F0]/10 dark:text-[#93AFFA]">
        {FEATURE_ICONS[card.icon]}
      </div>
      <h3 className={`text-lg font-semibold leading-snug text-[#1A1916] dark:text-[#F0EDE8] ${localeTextClass}`}>
        {card.title}
      </h3>
      <p className={`mt-3 text-sm leading-7 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}>
        {card.body}
      </p>
    </article>
  )
}

function PreviewCase({ preview, content, locale, localeTextClass, index }) {
  const itemCount = preview.outputSections.reduce((total, section) => total + section.items.length, 0)

  return (
    <article
      className="landing-reveal overflow-hidden rounded-lg border-[0.5px] border-black/[0.12] bg-white dark:border-white/[0.1] dark:bg-[#1A1916]"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex items-center gap-2 border-b-[0.5px] border-black/[0.08] bg-[#F4F3EF] px-4 py-3 dark:border-white/[0.08] dark:bg-[#222120]">
        <span className="h-2.5 w-2.5 rounded-full bg-[#D95A4E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#D8A044]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4C9A61]" />
        <span className="ml-2 font-mono text-[11px] text-[#A09E99]">mallog24 · {preview.label}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[0.92fr,1.08fr]">
        <div className="border-b-[0.5px] border-black/[0.08] bg-[#F9F8F6] p-5 dark:border-white/[0.08] dark:bg-[#111110] lg:border-b-0 lg:border-r-[0.5px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#A09E99]">{content.preview.beforeLabel}</p>
          <div className="mt-4 space-y-3">
            {preview.sourceLines.map((line) => (
              <p key={line} className={`text-sm leading-7 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}>
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#2D5BE3]">{content.preview.afterLabel}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {preview.outputSections.map((section) => (
              <div key={section.title} className="rounded-lg border-[0.5px] border-black/[0.08] bg-[#FAFAF8] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <p className={`text-sm font-semibold text-[#1A1916] dark:text-[#F0EDE8] ${localeTextClass}`}>{section.title}</p>
                <ul className="mt-3 space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={item}
                      className={`mallog-output-item flex items-start gap-2 text-sm leading-6 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}
                      style={{ animationDelay: `${(itemIndex + 1) * 80}ms` }}
                    >
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2D5BE3]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border-[0.5px] border-[#2D5BE3]/20 bg-[#EBF0FD] px-4 py-3 text-sm text-[#1A3FA0] dark:border-[#5B82F0]/30 dark:bg-[#5B82F0]/10 dark:text-[#93AFFA]">
            {locale === 'kr'
              ? `${itemCount}개의 구조화 항목이 한 번에 생성됩니다.`
              : `${itemCount} structured items are generated in one pass.`}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function MallogLandingSections({
  locale = 'kr',
  content,
  pricingUrl,
  oursUrl,
  stats,
  appDownloadUrl = '',
  iosAppDownloadUrl = '',
}) {
  const localeTextClass = locale === 'kr' ? 'mallog-keep' : ''
  const authUrl = locale === 'kr' ? '/#auth-card' : '/en#auth-card'
  const hasStats = Boolean(
    stats &&
    [stats.hoursProcessed, stats.betaUsers, stats.avgTurnaround, stats.timeSaving].some((value) => String(value || '').trim())
  )
  const appDownloadLabels = locale === 'kr'
    ? {
        android: 'Android 다운로드',
        ios: 'iOS 다운로드',
        iosPending: 'iOS 심사 진행 중',
      }
    : {
        android: 'Android Download',
        ios: 'iOS Download',
        iosPending: 'iOS in Review',
      }
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
    <section className="mb-12 space-y-16 lg:space-y-20">
      <section id="hero" className="landing-anchor-offset pt-8 text-center sm:pt-12">
        <div className="mx-auto max-w-4xl landing-reveal">
          <span className="inline-flex items-center gap-2 rounded-full border-[0.5px] border-[#2D5BE3]/20 bg-[#EBF0FD] px-3 py-1.5 text-xs font-semibold text-[#1A3FA0] dark:border-[#5B82F0]/30 dark:bg-[#5B82F0]/10 dark:text-[#93AFFA]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2D5BE3]" />
            {content.hero.badge}
          </span>
          <h1 className={`mx-auto mt-6 max-w-4xl text-[38px] font-semibold leading-[1.08] text-[#1A1916] dark:text-[#F0EDE8] sm:text-[54px] lg:text-[66px] ${localeTextClass}`}>
            <span className="block">{content.hero.titleLead}</span>
            <span className="mt-2 block text-[#2D5BE3]">{content.hero.titleAccent}</span>
          </h1>
          <p className={`mx-auto mt-6 max-w-2xl text-base leading-8 text-[#6B6860] dark:text-[#B7B2A8] sm:text-lg ${localeTextClass}`}>
            {content.hero.description}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={authUrl}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[#1A1916] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:bg-[#2D2B27] dark:bg-[#F0EDE8] dark:text-[#111110] dark:hover:bg-white whitespace-nowrap"
            >
              {content.hero.primaryCtaLabel}
            </Link>
            <Link
              href={pricingUrl}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-[0.5px] border-black/[0.14] bg-white px-6 py-3 text-sm font-semibold text-[#1A1916] transition duration-200 hover:-translate-y-[1px] hover:border-[#2D5BE3]/45 dark:border-white/[0.14] dark:bg-[#1A1916] dark:text-[#F0EDE8] whitespace-nowrap"
            >
              {content.hero.secondaryCtaLabel}
            </Link>
          </div>
          <p className={`mt-5 text-sm leading-6 text-[#A09E99] dark:text-[#6F6B63] ${localeTextClass}`}>
            {content.hero.trustLine}
          </p>
        </div>
      </section>

      <section id="features" className="landing-anchor-offset space-y-7">
        <SectionHeader
          eyebrow={content.features.eyebrow}
          title={content.features.title}
          description={content.features.description}
          localeTextClass={localeTextClass}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {content.features.cards.map((card, index) => (
            <FeatureCard key={card.title} card={card} localeTextClass={localeTextClass} index={index} />
          ))}
        </div>
      </section>

      <section id="workflow" className="landing-anchor-offset space-y-7">
        <SectionHeader
          eyebrow={content.workflow.eyebrow}
          title={content.workflow.title}
          description={content.workflow.description}
          localeTextClass={localeTextClass}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {content.workflow.steps.map((step, index) => (
            <article
              key={step.step}
              className="landing-reveal rounded-lg border-[0.5px] border-black/[0.1] bg-white p-5 dark:border-white/[0.1] dark:bg-[#1A1916]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="font-mono text-xs text-[#2D5BE3]">{step.step}</span>
              <h3 className={`mt-4 text-lg font-semibold text-[#1A1916] dark:text-[#F0EDE8] ${localeTextClass}`}>{step.title}</h3>
              <p className={`mt-3 text-sm leading-7 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="preview" className="landing-anchor-offset space-y-7">
        <SectionHeader
          eyebrow={content.preview.eyebrow}
          title={content.preview.title}
          description={content.preview.description}
          localeTextClass={localeTextClass}
        />
        <div className="grid grid-cols-1 gap-5">
          {content.preview.cases.map((preview, index) => (
            <PreviewCase
              key={preview.key}
              preview={preview}
              content={content}
              locale={locale}
              localeTextClass={localeTextClass}
              index={index}
            />
          ))}
        </div>
      </section>

      <section id="use-cases" className="landing-anchor-offset space-y-7">
        <SectionHeader
          eyebrow={content.useCases.eyebrow}
          title={content.useCases.title}
          localeTextClass={localeTextClass}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {content.useCases.cards.map((card, index) => (
            <article
              key={card.title}
              className="landing-reveal rounded-lg border-[0.5px] border-black/[0.1] bg-white p-5 dark:border-white/[0.1] dark:bg-[#1A1916]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <h3 className={`text-lg font-semibold text-[#1A1916] dark:text-[#F0EDE8] ${localeTextClass}`}>{card.title}</h3>
              <p className={`mt-3 text-sm leading-7 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {content.resources ? (
        <section id="guides" className="landing-anchor-offset space-y-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeader
              eyebrow={content.resources.eyebrow}
              title={content.resources.title}
              description={content.resources.description}
              localeTextClass={localeTextClass}
            />
            <Link
              href={content.resources.href}
              className="inline-flex min-h-[44px] w-fit items-center rounded-lg border-[0.5px] border-black/[0.14] bg-white px-4 text-sm font-semibold text-[#1A1916] transition duration-200 hover:-translate-y-[1px] hover:border-[#2D5BE3]/45 dark:border-white/[0.14] dark:bg-[#1A1916] dark:text-[#F0EDE8]"
            >
              {content.resources.ctaLabel}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {content.resources.cards.map((card, index) => (
              <Link
                key={card.href}
                href={card.href}
                className="landing-reveal rounded-lg border-[0.5px] border-black/[0.1] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-[#2D5BE3]/45 dark:border-white/[0.1] dark:bg-[#1A1916]"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <h3 className={`text-lg font-semibold text-[#1A1916] dark:text-[#F0EDE8] ${localeTextClass}`}>{card.title}</h3>
                <p className={`mt-3 text-sm leading-7 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}>{card.body}</p>
                <span className="mt-5 inline-flex text-sm font-semibold text-[#2D5BE3]">
                  {locale === 'kr' ? '자세히 보기' : 'Read more'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {hasStats ? (
        <section id="stats" className="landing-anchor-offset space-y-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeader
              eyebrow="Metrics"
              title={content.stats.title}
              description={content.stats.description}
              localeTextClass={localeTextClass}
            />
            {stats?.updatedAt ? <p className="text-sm text-[#6B6860] dark:text-[#B7B2A8]">{content.stats.updatedPrefix}: {stats.updatedAt}</p> : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statsCards.map((card, index) => (
              <article
                key={card.key}
                className="landing-reveal rounded-lg border-[0.5px] border-black/[0.1] bg-white p-5 dark:border-white/[0.1] dark:bg-[#1A1916]"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A09E99]">{card.label}</p>
                <p className={`mt-3 text-lg font-semibold leading-tight text-[#1A1916] dark:text-[#F0EDE8] ${localeTextClass}`}>{card.value}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="pricing" className="landing-anchor-offset space-y-7">
        <SectionHeader
          eyebrow="Pricing"
          title={content.comparison.title}
          description={content.comparison.description}
          localeTextClass={localeTextClass}
        />
        <div className="overflow-x-auto rounded-lg border-[0.5px] border-black/[0.1] bg-white dark:border-white/[0.1] dark:bg-[#1A1916]">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.2fr,0.9fr,0.9fr] bg-[#F4F3EF] text-sm font-semibold text-[#6B6860] dark:bg-[#222120] dark:text-[#B7B2A8]">
              <div className="px-5 py-4">{content.comparison.columns.feature}</div>
              <div className="border-l-[0.5px] border-black/[0.08] px-5 py-4 dark:border-white/[0.08]">{content.comparison.columns.free}</div>
              <div className="border-l-[0.5px] border-black/[0.08] px-5 py-4 dark:border-white/[0.08]">{content.comparison.columns.pro}</div>
            </div>
            {content.comparison.rows.map((row) => (
              <div key={row.feature} className="grid grid-cols-[1.2fr,0.9fr,0.9fr] border-t-[0.5px] border-black/[0.08] text-sm leading-7 text-[#1A1916] dark:border-white/[0.08] dark:text-[#F0EDE8]">
                <div className={`px-5 py-4 font-semibold ${localeTextClass}`}>{row.feature}</div>
                <div className={`border-l-[0.5px] border-black/[0.08] px-5 py-4 text-[#6B6860] dark:border-white/[0.08] dark:text-[#B7B2A8] ${localeTextClass}`}>{row.free}</div>
                <div className={`border-l-[0.5px] border-black/[0.08] px-5 py-4 text-[#6B6860] dark:border-white/[0.08] dark:text-[#B7B2A8] ${localeTextClass}`}>{row.pro}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="landing-anchor-offset space-y-7">
        <SectionHeader
          eyebrow="FAQ"
          title={content.faq.title}
          localeTextClass={localeTextClass}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {content.faq.items.map((faq, index) => (
            <article
              key={faq.question}
              className="landing-reveal rounded-lg border-[0.5px] border-black/[0.1] bg-white p-5 dark:border-white/[0.1] dark:bg-[#1A1916]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <h3 className={`text-base font-semibold text-[#1A1916] dark:text-[#F0EDE8] ${localeTextClass}`}>{faq.question}</h3>
              <p className={`mt-3 text-sm leading-7 text-[#6B6860] dark:text-[#B7B2A8] ${localeTextClass}`}>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg bg-[#111110] px-6 py-10 text-white sm:px-8 lg:px-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h2 className={`text-[28px] font-semibold leading-tight sm:text-[38px] ${localeTextClass}`}>
              {content.ctaBanner.title}
            </h2>
            <p className={`mt-3 text-base leading-7 text-white/60 ${localeTextClass}`}>{content.ctaBanner.body}</p>
          </div>
          <div id="app-download" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
            <Link
              href={authUrl}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#111110] transition duration-200 hover:-translate-y-[1px] hover:bg-[#F0EDE8] whitespace-nowrap"
            >
              {content.ctaBanner.primaryLabel}
            </Link>
            <Link
              href={pricingUrl}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-[0.5px] border-white/20 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:bg-white/[0.06] whitespace-nowrap"
            >
              {content.ctaBanner.secondaryLabel}
            </Link>
            {appDownloadUrl ? (
              <a
                href={appDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-[0.5px] border-white/20 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:bg-white/[0.06] whitespace-nowrap"
              >
                {appDownloadLabels.android}
              </a>
            ) : null}
            {iosAppDownloadUrl ? (
              <a
                href={iosAppDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-[0.5px] border-white/20 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:bg-white/[0.06] whitespace-nowrap"
              >
                {appDownloadLabels.ios}
              </a>
            ) : (
              <span
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-[0.5px] border-dashed border-white/25 px-6 py-3 text-sm font-semibold text-white/55 whitespace-nowrap"
                aria-disabled="true"
              >
                {appDownloadLabels.iosPending}
              </span>
            )}
          </div>
        </div>
      </section>
    </section>
  )
}
