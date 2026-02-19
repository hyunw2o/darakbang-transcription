import Head from 'next/head'
import Link from 'next/link'

const CONTACT_MAIL = 'ours113814@gmail.com'
const CONTACT_URL = `mailto:${CONTACT_MAIL}?subject=mallog24%20%EC%9A%94%EA%B8%88%EC%A0%9C%20%EC%97%85%EA%B7%B8%EB%A0%88%EC%9D%B4%EB%93%9C%20%EB%AC%B8%EC%9D%98`

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-nm-bg text-nm-text-primary">
      <Head>
        <title>mallog24 요금제 안내</title>
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="nm-raised p-6 sm:p-8">
          <p className="text-xs font-semibold text-nm-accent mb-2">Pricing</p>
          <h1 className="text-2xl sm:text-3xl font-bold">mallog24 요금제 안내</h1>
          <p className="mt-3 text-sm text-nm-text-secondary leading-relaxed">
            현재 결제대행(PG) 연동 준비 중입니다. 우선 구독 업그레이드 문의를 남겨주시면
            도입 일정과 맞춤 플랜을 안내드리겠습니다.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <div className="nm-concave p-4">
              <p className="text-xs text-nm-text-secondary">Free</p>
              <p className="text-xl font-bold mt-1">월 3시간</p>
              <p className="text-xs text-nm-text-secondary mt-2">기본 음성 인식/구조화 기능</p>
            </div>
            <div className="nm-concave p-4 border-l-4 border-nm-accent">
              <p className="text-xs text-nm-text-secondary">Pro (준비 중)</p>
              <p className="text-xl font-bold mt-1">무제한 또는 고한도</p>
              <p className="text-xs text-nm-text-secondary mt-2">우선 처리, 고급 기록본 기능 포함 예정</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <a
              href={CONTACT_URL}
              className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold"
            >
              구독 업그레이드 문의하기
            </a>
            <Link
              href="/"
              className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary"
            >
              mallog24로 돌아가기
            </Link>
          </div>
          <p className="text-xs text-nm-text-secondary mt-4">문의 이메일: {CONTACT_MAIL}</p>
        </div>
      </main>
    </div>
  )
}
