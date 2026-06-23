import Link from 'next/link'
import StaticContentLayout from './StaticContentLayout'
import { GUIDE_ARTICLES, GUIDE_INDEX } from '../content/staticSiteContent'

export default function GuideIndexPage({ locale = 'ko', ...layoutProps }) {
  const index = GUIDE_INDEX[locale] || GUIDE_INDEX.ko
  const articles = GUIDE_ARTICLES[locale] || []
  const isEnglish = locale === 'en'
  const canonicalPath = isEnglish ? '/en/guides' : '/guides'
  const articlePrefix = isEnglish ? '/en/guides' : '/guides'

  return (
    <StaticContentLayout
      locale={locale}
      title={index.title}
      description={index.description}
      metaDescription={index.metaDescription}
      canonicalPath={canonicalPath}
      alternatePath={index.languageHref}
      {...layoutProps}
    >
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {articles.map((article, indexNumber) => (
          <Link
            key={article.slug}
            href={`${articlePrefix}/${article.slug}`}
            className="landing-reveal rounded-lg border-[0.5px] border-black/[0.1] bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[#2D5BE3]/45 dark:border-white/[0.1] dark:bg-[#1A1916]"
            style={{ animationDelay: `${indexNumber * 60}ms` }}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-nm-text-secondary">
              <span className="rounded-full bg-[#EBF0FD] px-2.5 py-1 text-[#1A3FA0] dark:bg-[#5B82F0]/10 dark:text-[#93AFFA]">
                {article.category}
              </span>
              <span>{article.readTime}</span>
              <span>|</span>
              <span>{article.updated}</span>
            </div>
            <h2 className={`mt-4 text-xl font-semibold leading-snug text-nm-text-primary ${isEnglish ? '' : 'mallog-keep'}`}>
              {article.title}
            </h2>
            <p className={`mt-3 text-sm leading-7 text-nm-text-secondary ${isEnglish ? '' : 'mallog-keep'}`}>
              {article.description}
            </p>
            <span className="mt-5 inline-flex text-sm font-semibold text-nm-accent">
              {isEnglish ? 'Read guide' : '가이드 읽기'}
            </span>
          </Link>
        ))}
      </section>
    </StaticContentLayout>
  )
}
