import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { apiFetch, safeReadJson } from '../utils/network'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mallog24.com'
const CONTACT_MAIL = 'ours113814@gmail.com'
const CONTACT_URL = `mailto:${CONTACT_MAIL}?subject=mallog24%20Subscription%20Upgrade%20Inquiry`
const PLAN_SUMMARY = {
  free: [
    'Free up to 10 hours per month',
    'TXT / DOCX / clipboard export',
    'Sermon / call / meeting structuring',
  ],
  pro: [
    'KRW 8,800/month (VAT included), unlimited',
    'Built for recurring operational work',
    'Subscription management and refund workflow',
  ],
}
const COMPARE_ROWS = [
  ['Monthly usage', '10 hours/month', 'Unlimited'],
  ['Exports', 'TXT / DOCX / Clipboard', 'TXT / DOCX / Clipboard'],
  ['Structured record saving', 'Included', 'Included'],
  ['Best fit', 'Evaluation / personal use', 'Team workflow / recurring work'],
]
const BILLING_NOTES = [
  'The monthly price is KRW 8,800 with 10% VAT included.',
  'Default cancellation takes effect at the end of the current billing period.',
  'Default refund criteria: within 7 days from payment and zero usage seconds.',
]
const FAQS = [
  ['What should I verify before payment?', 'Check the free usage cap, monthly Pro price, refund criteria, and available payment methods on this page first.'],
  ['Are both card and KakaoPay supported?', 'Card and KakaoPay are supported in sequence depending on the live channel status. If checkout does not open, the payment-channel review status should be checked first.'],
  ['Does cancellation stop access immediately?', 'No. Default cancellation keeps access available until the current billing cycle ends.'],
]

const readResponseData = async (response, fallbackMessage) => {
  const data = await safeReadJson(response)
  if (!response.ok) {
    throw new Error(data?.detail || fallbackMessage)
  }
  return data || {}
}

function ActionButton({ children, variant = 'secondary', className = '', ...props }) {
  const baseClassName = 'inline-flex min-h-[48px] w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition duration-200 whitespace-nowrap'
  const variantClassName = variant === 'primary'
    ? 'bg-[linear-gradient(135deg,#3B82F6,#7C3AED)] text-white shadow-[0_14px_30px_rgba(59,130,246,0.22)] hover:-translate-y-[1px] hover:opacity-90'
    : variant === 'kakao'
      ? 'bg-[#FEE500] text-[#1D1D1F] hover:-translate-y-[1px] hover:opacity-95'
      : 'border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8F9FF]'

  return (
    <button {...props} className={`${baseClassName} ${variantClassName} ${className}`}>
      {children}
    </button>
  )
}

export default function PricingEnPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  const refreshBillingStatus = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setStatusLoading(true)
    }
    setError('')
    try {
      const res = await apiFetch(`${API_URL}/api/billing/status`)
      if (res.status === 401) {
        setIsAuthenticated(false)
        setStatus(null)
        return
      }
      const data = await readResponseData(res, 'Failed to load billing status.')
      setIsAuthenticated(true)
      setStatus(data)
    } catch (err) {
      setError(err.message || 'Failed to load billing status.')
    } finally {
      if (!quiet) {
        setStatusLoading(false)
      }
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkoutResult = new URLSearchParams(window.location.search).get('checkout')
    if (checkoutResult === 'success') {
      setMessage('Payment completed. Syncing your subscription status.')
    } else if (checkoutResult === 'cancel') {
      setMessage('Payment was canceled.')
    }

    refreshBillingStatus()
  }, [])

  const startCheckout = async (payMethod = 'card') => {
    if (!isAuthenticated) {
      setError('Please log in before starting checkout.')
      return
    }

    const normalizedPayMethod = payMethod === 'kakaopay' ? 'kakaopay' : 'card'
    setActionLoading(`checkout_${normalizedPayMethod}`)
    setError('')
    setMessage('')
    try {
      const successUrl = `${window.location.origin}/pricing-en?checkout=success`
      const cancelUrl = `${window.location.origin}/pricing-en?checkout=cancel`
      const res = await apiFetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'en',
          success_url: successUrl,
          cancel_url: cancelUrl,
          pay_method: normalizedPayMethod,
        }),
      })
      const data = await readResponseData(res, 'Failed to open checkout.')
      if (!data.checkout_url) {
        throw new Error('Checkout URL is empty.')
      }
      window.location.href = data.checkout_url
    } catch (err) {
      setError(err.message || 'Checkout request failed.')
    } finally {
      setActionLoading('')
    }
  }

  const openBillingPortal = async () => {
    if (!isAuthenticated) {
      setError('Please log in before opening billing portal.')
      return
    }

    setActionLoading('portal')
    setError('')
    setMessage('')
    try {
      const returnUrl = `${window.location.origin}/pricing-en`
      const res = await apiFetch(`${API_URL}/api/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'en',
          return_url: returnUrl,
        }),
      })
      const data = await readResponseData(res, 'Failed to open billing portal.')
      if (!data.portal_url) {
        throw new Error('Billing portal URL is empty.')
      }
      window.location.href = data.portal_url
    } catch (err) {
      setError(err.message || 'Failed to open billing portal.')
    } finally {
      setActionLoading('')
    }
  }

  const cancelSubscription = async () => {
    if (!isAuthenticated) {
      setError('Please log in before canceling your subscription.')
      return
    }

    if (!window.confirm('Cancel subscription at period end?')) {
      return
    }

    setActionLoading('cancel')
    setError('')
    setMessage('')
    try {
      const res = await apiFetch(`${API_URL}/api/billing/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          immediate: false,
          reason: 'user_requested_from_pricing_page_en',
        }),
      })
      const data = await readResponseData(res, 'Failed to request cancellation.')
      setMessage(data.message || 'Cancellation request submitted.')
      await refreshBillingStatus({ quiet: true })
    } catch (err) {
      setError(err.message || 'Failed to request cancellation.')
    } finally {
      setActionLoading('')
    }
  }

  const requestRefund = async () => {
    if (!isAuthenticated) {
      setError('Please log in before requesting a refund.')
      return
    }

    if (!window.confirm('Request refund now? (Default auto criteria: within 7 days and zero usage)')) {
      return
    }

    setActionLoading('refund')
    setError('')
    setMessage('')
    try {
      const res = await apiFetch(`${API_URL}/api/billing/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'user_requested_from_pricing_page_en',
        }),
      })
      const data = await readResponseData(res, 'Failed to request refund.')
      setMessage(data.message || 'Refund request submitted.')
      await refreshBillingStatus({ quiet: true })
    } catch (err) {
      setError(err.message || 'Failed to request refund.')
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A]">
      <Head>
        <title>mallog24 Pricing</title>
      </Head>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] bg-[#0F172A] px-6 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.24)] sm:px-8 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#3B82F6]/20 bg-[rgba(59,130,246,0.15)] px-4 py-1.5 text-xs font-semibold text-[#93C5FD] whitespace-nowrap">
                ✦ Compare Free and Pro in one place
              </span>
              <h1 className="mt-5 text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[46px]">
                <span className="block">Validate with the free tier first,</span>
                <span className="mt-2 block text-gradient-brand">then move to Pro when the workflow fits.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
                mallog24 Pro is KRW 8,800 per month including VAT, built for unlimited structured transcription across sermons, calls, and meetings.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link
                href="/en"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/5 whitespace-nowrap"
              >
                Back to mallog24
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B]">Current plan</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A]">{status?.plan_tier === 'pro' ? 'Pro' : 'Free'}</h2>
            <p className="mt-3 text-base leading-7 text-[#64748B]">The free tier includes up to 10 hours per month.</p>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#64748B]">
              {PLAN_SUMMARY.free.map((item) => (
                <li key={item} className="flex gap-2"><span className="text-[#3B82F6]">•</span><span>{item}</span></li>
              ))}
            </ul>
            {statusLoading ? (
              <p className="mt-6 text-sm text-[#64748B]">Checking billing status...</p>
            ) : status ? (
              <div className="mt-6 rounded-2xl bg-[#F8F9FF] p-4 text-sm text-[#64748B]">
                <p>Status: <span className="font-semibold text-[#0F172A]">{status.status || 'inactive'}</span></p>
                <p className="mt-2">Renews on: <span className="font-semibold text-[#0F172A]">{status.current_period_end ? new Date(status.current_period_end).toLocaleString('en-US') : 'N/A'}</span></p>
                <p className="mt-2">Cancel scheduled: <span className="font-semibold text-[#0F172A]">{status.cancel_at_period_end ? 'Yes' : 'No'}</span></p>
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#64748B]">Log in first to see subscription status.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B]">Upgrade</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A]">Pro monthly subscription</h2>
            <p className="mt-3 text-base leading-7 text-[#64748B]">Unlimited usage, priority support, and subscription management in one recurring plan.</p>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#64748B]">
              {PLAN_SUMMARY.pro.map((item) => (
                <li key={item} className="flex gap-2"><span className="text-[#3B82F6]">•</span><span>{item}</span></li>
              ))}
            </ul>
            <div className="mt-6 grid gap-3">
              <ActionButton type="button" variant="primary" onClick={() => startCheckout('card')}>
                {actionLoading === 'checkout_card' ? 'Opening checkout...' : 'Subscribe with card'}
              </ActionButton>
              <ActionButton type="button" variant="kakao" onClick={() => startCheckout('kakaopay')}>
                {actionLoading === 'checkout_kakaopay' ? 'Connecting KakaoPay...' : 'Subscribe with KakaoPay'}
              </ActionButton>
              <ActionButton type="button" onClick={openBillingPortal}>
                {actionLoading === 'portal' ? 'Opening...' : 'Open billing portal'}
              </ActionButton>
              <ActionButton type="button" onClick={cancelSubscription}>
                {actionLoading === 'cancel' ? 'Processing...' : 'Cancel subscription'}
              </ActionButton>
              <ActionButton type="button" onClick={requestRefund}>
                {actionLoading === 'refund' ? 'Processing...' : 'Request refund'}
              </ActionButton>
              <a
                href={CONTACT_URL}
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-semibold text-[#0F172A] transition duration-200 hover:bg-[#F8F9FF] whitespace-nowrap"
              >
                Send billing inquiry email
              </a>
            </div>
          </section>
        </div>

        {(message || error) ? (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error || message}
          </div>
        ) : null}

        <section className="mt-8 rounded-[24px] bg-[#F8F9FF] px-6 py-8 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">Pricing comparison</p>
            <h2 className="mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[36px]">See the decision points before checkout</h2>
            <p className="mt-3 text-base leading-7 text-[#64748B]">The product stays intentionally simple: one free tier and one Pro plan.</p>
          </div>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[1.2fr,1fr,1fr] bg-[#F8F9FF] text-sm font-semibold text-[#64748B]">
                <div className="px-5 py-4">Feature</div>
                <div className="border-l border-[#E2E8F0] px-5 py-4">Free</div>
                <div className="border-l border-[#E2E8F0] px-5 py-4">Pro</div>
              </div>
              {COMPARE_ROWS.map(([label, free, pro]) => (
                <div key={label} className="grid grid-cols-[1.2fr,1fr,1fr] border-t border-[#E2E8F0] text-[15px] leading-7 text-[#0F172A]">
                  <div className="px-5 py-4 font-semibold">{label}</div>
                  <div className="border-l border-[#E2E8F0] px-5 py-4 text-[#64748B]">{free}</div>
                  <div className="border-l border-[#E2E8F0] px-5 py-4 text-[#64748B]">{pro}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B]">Billing notes</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A]">What to confirm before payment</h2>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#64748B]">
              {BILLING_NOTES.map((item) => (
                <li key={item} className="flex gap-2"><span className="text-[#3B82F6]">•</span><span>{item}</span></li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B]">FAQ</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A]">Common pre-purchase questions</h2>
            <div className="mt-5 space-y-3">
              {FAQS.map(([question, answer], index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div key={question} className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8F9FF]">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-[#0F172A]">{question}</span>
                      <span className={`text-[#64748B] transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
                    </button>
                    {isOpen ? <p className="px-4 pb-4 text-sm leading-7 text-[#64748B]">{answer}</p> : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
