import GuideArticlePage from '../../../components/GuideArticlePage'
import { GUIDE_ARTICLES, findGuideArticle } from '../../../content/staticSiteContent'

export function getStaticPaths() {
  return {
    paths: GUIDE_ARTICLES.en.map((article) => ({ params: { slug: article.slug } })),
    fallback: false,
  }
}

export function getStaticProps({ params }) {
  return {
    props: {
      article: findGuideArticle('en', params.slug),
    },
  }
}

export default function GuideArticleEnPage(props) {
  return <GuideArticlePage locale="en" {...props} />
}
