import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { apiFetch, safeReadJson } from '../utils/network'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mallog24.com'
const CONTACT_MAIL = 'ours113814@gmail.com'
const CONTACT_URL = `mailto:${CONTACT_MAIL}?subject=mallog24%20Subscription%20Upgrade%20Inquiry`

const readResponseData = async (response, fallbackMessage) => {
  const data = await safeReadJson(response)
  if (!response.ok) {
    throw new Error(data?.detail || fallbackMessage)
  }
  return data || {}
}

export default function PricingEnPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
    <div className="min-h-screen bg-[#071021] text-white">
      <Head>
        <title>mallog24 Pricing</title>
      </Head>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-sm text-white/60">Pricing</p>
            <h1 className="text-3xl font-bold">mallog24 Pro</h1>
            <p className="text-white/70 mt-2">KRW 8,800/month (VAT included) for unlimited structured transcription</p>
          </div>
          <Link href="/en" className="px-4 py-2 rounded-full border border-white/15 text-sm text-white/80 hover:text-white">
            Back to mallog24
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Current plan</p>
            <h2 className="text-2xl font-semibold mt-2">{status?.plan_tier === 'pro' ? 'Pro' : 'Free'}</h2>
            <p className="text-white/60 mt-2">Free plan includes up to 10 hours per month.</p>
            {statusLoading ? (
              <p className="mt-4 text-white/60">Checking billing status...</p>
            ) : status ? (
              <div className="mt-4 space-y-2 text-sm text-white/80">
                <p>Status: {status.status || 'inactive'}</p>
                <p>Renews on: {status.current_period_end ? new Date(status.current_period_end).toLocaleString('en-US') : 'N/A'}</p>
                <p>Cancel scheduled: {status.cancel_at_period_end ? 'Yes' : 'No'}</p>
              </div>
            ) : (
              <p className="mt-4 text-white/60">Log in first to see subscription status.</p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Upgrade</p>
            <h2 className="text-2xl font-semibold mt-2">Pro monthly subscription</h2>
            <p className="text-white/70 mt-2">Unlimited usage, priority support, and subscription management</p>
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={() => startCheckout('card')} className="rounded-2xl bg-white text-[#071021] px-4 py-3 font-semibold">
                {actionLoading === 'checkout_card' ? 'Opening checkout...' : 'Subscribe with card'}
              </button>
              <button type="button" onClick={() => startCheckout('kakaopay')} className="rounded-2xl bg-[#FEE500] text-[#1D1D1F] px-4 py-3 font-semibold">
                {actionLoading === 'checkout_kakaopay' ? 'Connecting KakaoPay...' : 'Subscribe with KakaoPay'}
              </button>
              <button type="button" onClick={openBillingPortal} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85">
                {actionLoading === 'portal' ? 'Opening...' : 'Open billing portal'}
              </button>
              <button type="button" onClick={cancelSubscription} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85">
                {actionLoading === 'cancel' ? 'Processing...' : 'Cancel subscription'}
              </button>
              <button type="button" onClick={requestRefund} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85">
                {actionLoading === 'refund' ? 'Processing...' : 'Request refund'}
              </button>
              <a href={CONTACT_URL} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85 text-center">
                Send billing inquiry email
              </a>
            </div>
          </section>
        </div>

        {(message || error) && (
          <div className={`mt-6 rounded-2xl px-4 py-3 text-sm ${error ? 'bg-red-500/15 text-red-200 border border-red-400/20' : 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/20'}`}>
            {error || message}
          </div>
        )}
      </main>
    </div>
  )
}
