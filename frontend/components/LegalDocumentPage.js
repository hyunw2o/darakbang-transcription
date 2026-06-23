import Link from 'next/link'
import StaticContentLayout from './StaticContentLayout'
import { LEGAL_PAGES } from '../content/staticSiteContent'

export default function LegalDocumentPage({ locale = 'ko', docKey, ...layoutProps }) {
  const page = LEGAL_PAGES[locale]?.[docKey]

  if (!page) return null

  const canonicalPath = locale === 'en'
    ? `/${docKey === 'company' ? 'company-policy' : docKey}-en`
    : `/${docKey === 'company' ? 'company-policy' : docKey}`

  return (
    <StaticContentLayout
      locale={locale}
      title={page.title}
      description={page.description}
      metaDescription={page.metaDescription}
      canonicalPath={canonicalPath}
      alternatePath={page.alternateHref}
      {...layoutProps}
    >
      <div className="mb-6 rounded-lg border-[0.5px] border-black/[0.08] bg-white p-5 text-sm leading-7 text-nm-text-secondary dark:border-white/[0.08] dark:bg-[#1A1916]">
        <p>
          <span className="font-semibold text-nm-text-primary">{locale === 'en' ? 'Last updated' : '시행일'}:</span>{' '}
          {page.lastUpdated}
        </p>
        <p>
          <span className="font-semibold text-nm-text-primary">{locale === 'en' ? 'Version' : '문서 버전'}:</span>{' '}
          {page.version}
        </p>
      </div>

      <article className="space-y-5">
        {page.sections.map((section) => (
          <section key={section.title} className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-5 dark:border-white/[0.08] dark:bg-[#1A1916] sm:p-6">
            <h2 className={`text-xl font-semibold leading-snug text-nm-text-primary ${locale === 'ko' ? 'mallog-keep' : ''}`}>
              {section.title}
            </h2>
            <ul className="mt-4 space-y-3">
              {section.body.map((item) => (
                <li key={item} className={`flex gap-3 text-sm leading-7 text-nm-text-secondary ${locale === 'ko' ? 'mallog-keep' : ''}`}>
                  <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-nm-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </article>

      <div className="mt-8 rounded-lg border-[0.5px] border-[#2D5BE3]/20 bg-[#EBF0FD] p-5 dark:border-[#5B82F0]/30 dark:bg-[#5B82F0]/10">
        <p className="text-sm font-semibold text-nm-text-primary">
          {locale === 'en' ? 'Related pages' : '관련 문서'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {page.relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-white px-4 text-sm font-semibold text-nm-accent transition hover:-translate-y-[1px] dark:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </StaticContentLayout>
  )
}
