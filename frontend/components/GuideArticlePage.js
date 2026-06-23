import Link from 'next/link'
import StaticContentLayout from './StaticContentLayout'

export default function GuideArticlePage({ locale = 'ko', article, ...layoutProps }) {
  if (!article) return null

  const isEnglish = locale === 'en'
  const guidesHref = isEnglish ? '/en/guides' : '/guides'
  const canonicalPath = `${guidesHref}/${article.slug}`
  const alternatePath = `${isEnglish ? '/guides' : '/en/guides'}/${article.slug}`

  return (
    <StaticContentLayout
      locale={locale}
      title={article.title}
      description={article.description}
      metaDescription={article.description}
      canonicalPath={canonicalPath}
      alternatePath={alternatePath}
      {...layoutProps}
    >
      <article className="space-y-6">
        <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-5 dark:border-white/[0.08] dark:bg-[#1A1916] sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-nm-text-secondary">
            <span className="rounded-full bg-[#EBF0FD] px-2.5 py-1 text-[#1A3FA0] dark:bg-[#5B82F0]/10 dark:text-[#93AFFA]">
              {article.category}
            </span>
            <span>{article.readTime}</span>
            <span>|</span>
            <span>{article.updated}</span>
          </div>
          <p className={`mt-5 text-base leading-8 text-nm-text-secondary ${isEnglish ? '' : 'mallog-keep'}`}>
            {article.intro}
          </p>
        </div>

        {article.sections.map((section) => (
          <section key={section.title} className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-5 dark:border-white/[0.08] dark:bg-[#1A1916] sm:p-6">
            <h2 className={`text-2xl font-semibold leading-snug text-nm-text-primary ${isEnglish ? '' : 'mallog-keep'}`}>
              {section.title}
            </h2>
            <div className="mt-4 space-y-4">
              {section.body.map((paragraph) => (
                <p key={paragraph} className={`text-sm leading-8 text-nm-text-secondary ${isEnglish ? '' : 'mallog-keep'}`}>
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-5 dark:border-white/[0.08] dark:bg-[#1A1916] sm:p-6">
            <h2 className="text-lg font-semibold text-nm-text-primary">{isEnglish ? 'Checklist' : '체크리스트'}</h2>
            <ul className="mt-4 space-y-3">
              {article.checklist.map((item) => (
                <li key={item} className={`flex gap-3 text-sm leading-7 text-nm-text-secondary ${isEnglish ? '' : 'mallog-keep'}`}>
                  <span className="mt-[7px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700 dark:bg-green-500/15 dark:text-green-300">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-5 dark:border-white/[0.08] dark:bg-[#1A1916] sm:p-6">
            <h2 className="text-lg font-semibold text-nm-text-primary">FAQ</h2>
            <div className="mt-4 space-y-4">
              {article.faq.map(([question, answer]) => (
                <div key={question}>
                  <p className={`text-sm font-semibold text-nm-text-primary ${isEnglish ? '' : 'mallog-keep'}`}>{question}</p>
                  <p className={`mt-1 text-sm leading-7 text-nm-text-secondary ${isEnglish ? '' : 'mallog-keep'}`}>{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Link href={guidesHref} className="inline-flex min-h-[44px] items-center rounded-lg border-[0.5px] border-black/[0.14] bg-white px-4 text-sm font-semibold text-nm-text-primary transition hover:-translate-y-[1px] dark:border-white/[0.14] dark:bg-[#1A1916]">
            {isEnglish ? 'Back to guides' : '가이드 목록으로'}
          </Link>
          <Link href={isEnglish ? '/en#auth-card' : '/#auth-card'} className="inline-flex min-h-[44px] items-center rounded-lg bg-[#1A1916] px-4 text-sm font-semibold text-white transition hover:-translate-y-[1px] dark:bg-[#F0EDE8] dark:text-[#111110]">
            {isEnglish ? 'Start mallog24' : 'mallog24 시작하기'}
          </Link>
        </div>
      </article>
    </StaticContentLayout>
  )
}
