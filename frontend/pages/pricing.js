import Link from 'next/link'
import StaticContentLayout from '../components/StaticContentLayout'

const ACCESS_ROWS = [
  ['이용 요금', '무료'],
  ['로그인 사용자 사용량', '제한 없음'],
  ['결제 및 구독', '운영하지 않음'],
  ['지원 기능', '음성 변환, 교정, 요약, 기록 저장, TXT/DOCX 내보내기'],
]

export default function FreeAccessPage(props) {
  return (
    <StaticContentLayout
      locale="ko"
      title="무료 이용 안내"
      description="mallog24는 유료 요금제와 인앱결제를 운영하지 않습니다. 로그인하면 전체 변환 기능을 무료로 이용할 수 있습니다."
      metaDescription="mallog24 무료 이용 안내. 결제나 구독 없이 로그인 후 전체 음성 변환 기능을 이용할 수 있습니다."
      canonicalPath="/pricing"
      alternatePath="/pricing-en"
      {...props}
    >
      <section className="overflow-hidden rounded-lg border border-black/[0.08] bg-white dark:border-white/10 dark:bg-[#1A1916]">
        {ACCESS_ROWS.map(([label, value]) => (
          <div key={label} className="grid gap-2 border-b border-black/[0.08] px-5 py-5 last:border-b-0 sm:grid-cols-[180px,1fr] dark:border-white/10">
            <h2 className="text-sm font-semibold text-nm-text-primary">{label}</h2>
            <p className="mallog-keep text-sm leading-7 text-nm-text-secondary">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 border-t border-black/[0.08] pt-8 dark:border-white/10">
        <h2 className="text-2xl font-semibold text-nm-text-primary">로그인 후 무료 이용</h2>
        <p className="mallog-keep mt-3 max-w-3xl text-sm leading-7 text-nm-text-secondary">
          녹음, 파일 업로드, 변환 및 기록 관리는 로그인 후 이용할 수 있습니다. 별도의 결제 정보나 구독은 필요하지 않습니다. 이용 안내와 개인정보처리방침은 로그인 없이 확인할 수 있습니다.
        </p>
        <Link href="/#auth-card" className="nm-btn-primary mt-6 inline-flex min-h-[48px] items-center justify-center px-6 py-3 text-sm font-semibold">
          무료로 시작하기
        </Link>
      </section>
    </StaticContentLayout>
  )
}
