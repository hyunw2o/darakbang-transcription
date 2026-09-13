import Link from 'next/link'
import StaticContentLayout from '../components/StaticContentLayout'

const ACCESS_ROWS = [
  ['Price', 'Free'],
  ['Signed-in usage', 'Unlimited'],
  ['Payments and subscriptions', 'Not offered'],
  ['Included features', 'Transcription, correction, summaries, saved records, and TXT/DOCX export'],
]

export default function FreeAccessEnPage(props) {
  return (
    <StaticContentLayout
      locale="en"
      title="Free Access"
      description="mallog24 does not offer paid plans or in-app purchases. Sign in to use the full transcription workflow for free."
      metaDescription="mallog24 free access details. Use the full transcription workflow after sign-in without payment or a subscription."
      canonicalPath="/pricing-en"
      alternatePath="/pricing"
      {...props}
    >
      <section className="overflow-hidden rounded-lg border border-black/[0.08] bg-white dark:border-white/10 dark:bg-[#1A1916]">
        {ACCESS_ROWS.map(([label, value]) => (
          <div key={label} className="grid gap-2 border-b border-black/[0.08] px-5 py-5 last:border-b-0 sm:grid-cols-[180px,1fr] dark:border-white/10">
            <h2 className="text-sm font-semibold text-nm-text-primary">{label}</h2>
            <p className="text-sm leading-7 text-nm-text-secondary">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 border-t border-black/[0.08] pt-8 dark:border-white/10">
        <h2 className="text-2xl font-semibold text-nm-text-primary">Sign in for free access</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-nm-text-secondary">
          Sign in to record, upload, transcribe, and manage your records. No payment details or subscription are required. Guides and privacy information remain available without signing in.
        </p>
        <Link href="/en#auth-card" className="nm-btn-primary mt-6 inline-flex min-h-[48px] items-center justify-center px-6 py-3 text-sm font-semibold">
          Start for free
        </Link>
      </section>
    </StaticContentLayout>
  )
}
