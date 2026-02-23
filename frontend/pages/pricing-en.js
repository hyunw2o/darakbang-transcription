import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://darakbang-transcription-production.up.railway.app'
const AUTH_TOKEN_KEY = 'mallog24_access_token'
const CONTACT_MAIL = 'ours113814@gmail.com'
const CONTACT_URL = `mailto:${CONTACT_MAIL}?subject=mallog24%20Subscription%20Upgrade%20Inquiry`

export default function PricingEnPage() {
  const [authToken, setAuthToken] = useState('')
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refreshBillingStatus = async (token, { quiet = false } = {}) => {
    if (!token) {
      setStatus(null)
      return
    }

    if (!quiet) {
      setStatusLoading(true)
    }
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/billing/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to load billing status.')
      }
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
    setAuthToken(window.sessionStorage.getItem(AUTH_TOKEN_KEY) || '')

    const checkoutResult = new URLSearchParams(window.location.search).get('checkout')
    if (checkoutResult === 'success') {
      setMessage('Payment completed. Syncing your subscription status.')
    } else if (checkoutResult === 'cancel') {
      setMessage('Payment was canceled.')
    }
  }, [])

  useEffect(() => {
    if (!authToken) {
      setStatus(null)
      return
    }
    refreshBillingStatus(authToken)
  }, [authToken])

  const withAuthHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
  })

  const startCheckout = async () => {
    if (!authToken) {
      setError('Please log in before starting checkout.')
      return
    }

    setActionLoading('checkout')
    setError('')
    setMessage('')
    try {
      const successUrl = `${window.location.origin}/pricing-en?checkout=success`
      const cancelUrl = `${window.location.origin}/pricing-en?checkout=cancel`
      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'en',
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to open checkout.')
      }
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
    if (!authToken) {
      setError('Please log in before opening billing portal.')
      return
    }

    setActionLoading('portal')
    setError('')
    setMessage('')
    try {
      const returnUrl = `${window.location.origin}/pricing-en`
      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'en',
          return_url: returnUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to open billing portal.')
      }
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
    if (!authToken) {
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
      const res = await fetch(`${API_URL}/api/billing/cancel`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          immediate: false,
          reason: 'user_requested_from_pricing_page_en',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to request cancellation.')
      }
      setMessage(data.message || 'Cancellation request submitted.')
      await refreshBillingStatus(authToken, { quiet: true })
    } catch (err) {
      setError(err.message || 'Failed to request cancellation.')
    } finally {
      setActionLoading('')
    }
  }

  const requestRefund = async () => {
    if (!authToken) {
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
      const res = await fetch(`${API_URL}/api/billing/refund`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'user_requested_from_pricing_page_en',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to request refund.')
      }
      setMessage(data.message || 'Refund request submitted.')
      await refreshBillingStatus(authToken, { quiet: true })
    } catch (err) {
      setError(err.message || 'Failed to request refund.')
    } finally {
      setActionLoading('')
    }
  }

  const currentPlan = status?.usage?.plan_tier || status?.plan_tier || 'free'
  const billingProvider = status?.provider || 'portone'
  const checkoutMode = status?.checkout_mode || 'disabled'
  const checkoutSupported = Boolean(status?.checkout_supported)
  const portalSupported = Boolean(status?.portal_supported)
  const paymentEnabled = Boolean(status?.payment_enabled)
  const isMockCheckout = checkoutMode === 'mock'
  const isPaid = currentPlan !== 'free'

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
            Free tier includes up to 10 hours each month. In environments with billing keys configured,
            you can start Pro immediately.
          </p>
          <p className="mt-2 text-xs text-nm-text-secondary leading-relaxed">
            Effective date: 2026-02-23 / Document version: v2026.02.23
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <div className="nm-concave p-4">
              <p className="text-xs text-nm-text-secondary">Free</p>
              <p className="text-xl font-bold mt-1">10 hours / month</p>
              <p className="text-xs text-nm-text-secondary mt-2">Core transcription and structuring features</p>
            </div>
            <div className="nm-concave p-4 border-l-4 border-nm-accent">
              <p className="text-xs text-nm-text-secondary">Pro</p>
              <p className="text-xl font-bold mt-1">KRW 8,000 / month</p>
              <p className="text-xs text-nm-text-secondary mt-2">Higher quota / priority · auto-renew monthly</p>
            </div>
          </div>

          <div className="mt-5 nm-concave p-4">
            <p className="text-sm font-semibold">Product Information</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
              <li>Product name: mallog24 Pro Monthly Subscription</li>
              <li>Service period: 1-month auto-renew cycle from payment approval time</li>
              <li>Price: KRW 8,000 per month (final amount shown at checkout)</li>
              <li>Included: higher usage limits, prioritized processing, and subscription management</li>
            </ul>
          </div>

          <div className="mt-4 nm-concave p-4">
            <p className="text-sm font-semibold">Checkout and Subscription Flow</p>
            <ol className="mt-2 list-decimal pl-5 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
              <li>Log in and select Pro from this pricing page.</li>
              <li>Review product name, amount, payment method, and terms in the payment provider checkout.</li>
              <li>After payment approval, subscription is activated immediately and billing period starts.</li>
              <li>To stop renewal, cancel from the subscription management page before the next billing date.</li>
            </ol>
          </div>

          <div className="mt-4 nm-concave p-4">
            <p className="text-sm font-semibold">Refund Policy</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
              <li>Full refund may be requested within 7 days after payment if no usage has occurred.</li>
              <li>If usage exists, partial refunds for the current billing cycle may be limited; cancellation is applied from the next cycle.</li>
              <li>Duplicate charges, payment errors, or confirmed overcharges are refunded in full after verification.</li>
              <li>Refund completion timing and payout rails depend on payment provider/card issuer policies.</li>
              <li>Applicable consumer protection laws take precedence where required.</li>
            </ul>
          </div>

          <div className="mt-5 nm-concave p-4">
            <p className="text-xs text-nm-text-secondary">Current Plan</p>
            {statusLoading ? (
              <p className="text-sm mt-1">Loading...</p>
            ) : (
              <p className="text-sm font-semibold mt-1">
                {authToken ? (isPaid ? 'Pro' : 'Free') : 'Login required'}
              </p>
            )}
            {authToken && (
              <p className="text-xs text-nm-text-secondary mt-1">
                Billing provider: {billingProvider} / checkout mode: {checkoutMode}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            {isPaid ? (
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={!portalSupported || actionLoading !== ''}
                className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading === 'portal'
                  ? 'Opening...'
                  : portalSupported
                    ? 'Manage Subscription'
                    : 'Domestic PG portal pending'}
              </button>
            ) : (
              <button
                type="button"
                onClick={startCheckout}
                disabled={!checkoutSupported || !authToken || actionLoading !== ''}
                className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading === 'checkout'
                  ? 'Opening...'
                  : checkoutSupported
                    ? isMockCheckout
                      ? 'Start Mock Checkout'
                      : 'Start Pro Subscription'
                    : 'Checkout unavailable'}
              </button>
            )}
            {isPaid && (
              <button
                type="button"
                onClick={cancelSubscription}
                disabled={actionLoading !== ''}
                className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? 'Processing...' : 'Cancel Subscription'}
              </button>
            )}
            {isPaid && (
              <button
                type="button"
                onClick={requestRefund}
                disabled={actionLoading !== ''}
                className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary disabled:opacity-50"
              >
                {actionLoading === 'refund' ? 'Processing...' : 'Request Refund'}
              </button>
            )}
            <a
              href={CONTACT_URL}
              className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary"
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

          {!authToken && (
            <p className="text-xs text-nm-text-secondary mt-3">
              Log in on mallog24 first to start checkout.
            </p>
          )}
          {!paymentEnabled && (
            <p className="text-xs text-nm-text-secondary mt-3">
              Billing keys are not configured on the backend yet, so live checkout is disabled.
            </p>
          )}
          {checkoutSupported && isMockCheckout && (
            <p className="text-xs text-nm-text-secondary mt-3">
              Mock checkout mode is enabled. You can validate success/cancel flow without real charges.
            </p>
          )}
          {isPaid && (
            <p className="text-xs text-nm-text-secondary mt-3">
              Default auto-refund criteria: within 7 days after payment and zero monthly usage.
            </p>
          )}
          {message && <p className="text-xs text-blue-600 mt-3">{message}</p>}
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          <p className="text-xs text-nm-text-secondary mt-4">Contact: {CONTACT_MAIL}</p>
        </div>
      </main>
    </div>
  )
}
