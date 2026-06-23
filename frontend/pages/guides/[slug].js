import GuideArticlePage from '../../components/GuideArticlePage'
import { GUIDE_ARTICLES, findGuideArticle } from '../../content/staticSiteContent'

export function getStaticPaths() {
  return {
    paths: GUIDE_ARTICLES.ko.map((article) => ({ params: { slug: article.slug } })),
    fallback: false,
  }
}

export function getStaticProps({ params }) {
  return {
    props: {
      article: findGuideArticle('ko', params.slug),
    },
  }
}

export default function GuideArticleKoPage(props) {
  return <GuideArticlePage locale="ko" {...props} />
}
