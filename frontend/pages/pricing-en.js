import Head from 'next/head'
import Link from 'next/link'

const CONTACT_MAIL = 'ours113814@gmail.com'
const CONTACT_URL = `mailto:${CONTACT_MAIL}?subject=mallog24%20Subscription%20Upgrade%20Inquiry`

export default function PricingEnPage() {
  return (
    <div className="min-h-screen bg-nm-bg text-nm-text-primary">
      <Head>
        <title>mallog24 Pricing</title>
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="nm-raised p-6 sm:p-8">
          <p className="text-xs font-semibold text-nm-accent mb-2">Pricing</p>
          <h1 className="text-2xl sm:text-3xl font-bold">mallog24 Plans</h1>
          <p className="mt-3 text-sm text-nm-text-secondary leading-relaxed">
            Payment gateway integration is in progress. Until checkout goes live,
            send us an upgrade inquiry and we will guide you with rollout timing and plan details.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <div className="nm-concave p-4">
              <p className="text-xs text-nm-text-secondary">Free</p>
              <p className="text-xl font-bold mt-1">3 hours / month</p>
              <p className="text-xs text-nm-text-secondary mt-2">Core transcription and structuring features</p>
            </div>
            <div className="nm-concave p-4 border-l-4 border-nm-accent">
              <p className="text-xs text-nm-text-secondary">Pro (Coming soon)</p>
              <p className="text-xl font-bold mt-1">Unlimited or higher quota</p>
              <p className="text-xs text-nm-text-secondary mt-2">Priority processing and advanced record features</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <a
              href={CONTACT_URL}
              className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold"
            >
              Upgrade Inquiry
            </a>
            <Link
              href="/en"
              className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary"
            >
              Back to mallog24
            </Link>
          </div>
          <p className="text-xs text-nm-text-secondary mt-4">Contact: {CONTACT_MAIL}</p>
        </div>
      </main>
    </div>
  )
}
