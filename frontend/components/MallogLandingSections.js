import Link from 'next/link'
import { useState } from 'react'
import StepIndicator from './StepIndicator'

export default function MallogLandingSections({ locale = 'kr', content, pricingUrl, oursUrl, stats }) {
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const statsCards = [
    {
      key: 'hoursProcessed',
      label: content.statsCards.hoursProcessed.label,
      value: stats?.hoursProcessed || content.statsCards.hoursProcessed.fallback,
    },
    {
      key: 'betaUsers',
      label: content.statsCards.betaUsers.label,
      value: stats?.betaUsers || content.statsCards.betaUsers.fallback,
    },
    {
      key: 'avgTurnaround',
      label: content.statsCards.avgTurnaround.label,
      value: stats?.avgTurnaround || content.statsCards.avgTurnaround.fallback,
    },
    {
      key: 'timeSaving',
      label: content.statsCards.timeSaving.label,
      value: stats?.timeSaving || content.statsCards.timeSaving.fallback,
    },
  ]

  return (
    <section className="space-y-4 mb-5 animate-nm-card-in">
      <div className="nm-raised p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {content.heroBadges.map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 rounded-full text-[11px] font-semibold nm-concave text-nm-text-secondary"
            >
              {badge}
            </span>
          ))}
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-nm-text-primary leading-tight">{content.heroTitle}</h1>
        <p className="mt-2 text-sm text-nm-text-secondary leading-relaxed">{content.heroDescription}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="nm-concave p-4">
            <p className="text-[11px] font-semibold text-nm-text-secondary mb-2">{content.beforeLabel}</p>
            <p className="text-sm text-nm-text-secondary leading-relaxed">{content.beforeText}</p>
          </div>
          <div className="nm-concave p-4">
            <p className="text-[11px] font-semibold text-nm-text-secondary mb-2">{content.afterLabel}</p>
            <p className="text-sm font-semibold text-nm-text-primary">{content.afterTitle}</p>
            <ul className="mt-2 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
              {content.afterItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Link
            href={pricingUrl}
            className="nm-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold"
          >
            {content.primaryCtaLabel}
          </Link>
          <a
            href={oursUrl}
            className="nm-btn inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-nm-text-primary"
          >
            {content.secondaryCtaLabel}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {content.featureCards.map((card) => (
          <div key={card.title} className="nm-raised p-4">
            <p className="text-sm font-semibold text-nm-text-primary">{card.title}</p>
            <p className="text-xs text-nm-text-secondary mt-1">{card.body}</p>
          </div>
        ))}
      </div>

      <div className="nm-raised p-5 sm:p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-nm-accent uppercase tracking-[0.22em]">{content.howItWorksEyebrow}</p>
          <h2 className="mt-2 text-lg font-bold text-nm-text-primary">{content.howItWorksTitle}</h2>
          <p className="mt-1 text-sm text-nm-text-secondary leading-relaxed">{content.howItWorksDescription}</p>
        </div>
        <div className="nm-concave p-4 sm:p-5">
          <StepIndicator currentStep={1} locale={locale} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {content.stepCards.map((step) => (
            <div key={step.title} className="nm-concave p-4">
              <p className="text-sm font-semibold text-nm-text-primary">{step.title}</p>
              <p className="mt-1 text-xs text-nm-text-secondary leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="nm-raised p-5 sm:p-6">
        <h2 className="text-lg font-bold text-nm-text-primary">{content.trustTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {content.trustCards.map((card) => (
            <div key={card.title} className="nm-concave p-4">
              <p className="text-sm font-semibold text-nm-text-primary">{card.title}</p>
              <p className="mt-1 text-xs text-nm-text-secondary leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="nm-raised p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-nm-text-primary">{content.statsTitle}</h2>
            <p className="mt-1 text-sm text-nm-text-secondary leading-relaxed">{content.statsDescription}</p>
          </div>
          {stats?.updatedAt ? (
            <p className="text-[11px] text-nm-text-secondary">
              {content.statsUpdatedPrefix}: {stats.updatedAt}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {statsCards.map((card) => (
            <div key={card.key} className="nm-concave p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-nm-text-secondary">{card.label}</p>
              <p className="mt-2 text-base font-bold text-nm-text-primary leading-snug">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="nm-raised p-5 sm:p-6">
        <h2 className="text-lg font-bold text-nm-text-primary">{content.useCasesTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {content.useCases.map((item) => (
            <div key={item.title} className="nm-concave p-4">
              <p className="text-sm font-semibold text-nm-text-primary">{item.title}</p>
              <p className="mt-1 text-xs text-nm-text-secondary leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="nm-raised p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-nm-text-primary">{content.comparisonTitle}</h2>
          <p className="mt-1 text-sm text-nm-text-secondary leading-relaxed">{content.comparisonDescription}</p>
        </div>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10">
          <div className="grid grid-cols-[1.3fr,1fr,1fr] bg-white/5 text-[11px] font-semibold uppercase tracking-[0.12em] text-nm-text-secondary">
            <div className="px-4 py-3">{content.comparisonColumns.feature}</div>
            <div className="px-4 py-3 border-l border-white/10">{content.comparisonColumns.free}</div>
            <div className="px-4 py-3 border-l border-white/10">{content.comparisonColumns.pro}</div>
          </div>
          {content.comparisonRows.map((row) => (
            <div
              key={row.feature}
              className="grid grid-cols-[1.3fr,1fr,1fr] text-sm text-nm-text-primary border-t border-white/10 bg-white/[0.03]"
            >
              <div className="px-4 py-3 font-semibold">{row.feature}</div>
              <div className="px-4 py-3 border-l border-white/10 text-nm-text-secondary">{row.free}</div>
              <div className="px-4 py-3 border-l border-white/10 text-nm-text-secondary">{row.pro}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="nm-raised p-5 sm:p-6">
        <h2 className="text-lg font-bold text-nm-text-primary">{content.faqTitle}</h2>
        <div className="mt-4 space-y-3">
          {content.faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index
            return (
              <div key={faq.question} className="nm-concave overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                  className="w-full px-4 py-4 flex items-center justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-nm-text-primary">{faq.question}</span>
                  <span className={`text-nm-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {isOpen ? (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-nm-text-secondary leading-relaxed">{faq.answer}</p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
