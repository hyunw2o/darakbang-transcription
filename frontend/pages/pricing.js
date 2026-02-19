import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://darakbang-transcription-production.up.railway.app'
const AUTH_TOKEN_KEY = 'mallog24_access_token'
const CONTACT_MAIL = 'ours113814@gmail.com'
const CONTACT_URL = `mailto:${CONTACT_MAIL}?subject=mallog24%20%EC%9A%94%EA%B8%88%EC%A0%9C%20%EC%97%85%EA%B7%B8%EB%A0%88%EC%9D%B4%EB%93%9C%20%EB%AC%B8%EC%9D%98`

export default function PricingPage() {
  const [authToken, setAuthToken] = useState('')
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    setAuthToken(window.sessionStorage.getItem(AUTH_TOKEN_KEY) || '')

    const checkoutResult = new URLSearchParams(window.location.search).get('checkout')
    if (checkoutResult === 'success') {
      setMessage('결제가 완료되었습니다. 구독 상태를 확인 중입니다.')
    } else if (checkoutResult === 'cancel') {
      setMessage('결제가 취소되었습니다.')
    }
  }, [])

  useEffect(() => {
    if (!authToken) {
      setStatus(null)
      return
    }

    const fetchStatus = async () => {
      setStatusLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_URL}/api/billing/status`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.detail || '구독 상태를 불러오지 못했습니다.')
        }
        setStatus(data)
      } catch (err) {
        setError(err.message || '구독 상태 조회 실패')
      } finally {
        setStatusLoading(false)
      }
    }

    fetchStatus()
  }, [authToken])

  const withAuthHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
  })

  const startCheckout = async () => {
    if (!authToken) {
      setError('로그인 후 결제를 진행할 수 있습니다.')
      return
    }

    setActionLoading('checkout')
    setError('')
    setMessage('')
    try {
      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale: 'ko' }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || '결제 페이지 이동에 실패했습니다.')
      }
      if (!data.checkout_url) {
        throw new Error('결제 URL이 비어 있습니다.')
      }
      window.location.href = data.checkout_url
    } catch (err) {
      setError(err.message || '결제 요청 실패')
    } finally {
      setActionLoading('')
    }
  }

  const openBillingPortal = async () => {
    if (!authToken) {
      setError('로그인 후 구독 관리를 진행할 수 있습니다.')
      return
    }

    setActionLoading('portal')
    setError('')
    setMessage('')
    try {
      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale: 'ko' }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || '구독 관리 페이지 이동에 실패했습니다.')
      }
      if (!data.portal_url) {
        throw new Error('구독 관리 URL이 비어 있습니다.')
      }
      window.location.href = data.portal_url
    } catch (err) {
      setError(err.message || '구독 관리 페이지 요청 실패')
    } finally {
      setActionLoading('')
    }
  }

  const currentPlan = status?.usage?.plan_tier || status?.plan_tier || 'free'
  const paymentEnabled = Boolean(status?.payment_enabled)
  const isPaid = currentPlan !== 'free'

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
            무료는 월 3시간까지 사용 가능합니다. 결제 연동이 설정된 환경에서는 Pro 구독을 즉시 시작할 수 있습니다.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <div className="nm-concave p-4">
              <p className="text-xs text-nm-text-secondary">Free</p>
              <p className="text-xl font-bold mt-1">월 3시간</p>
              <p className="text-xs text-nm-text-secondary mt-2">기본 음성 인식/구조화 기능</p>
            </div>
            <div className="nm-concave p-4 border-l-4 border-nm-accent">
              <p className="text-xs text-nm-text-secondary">Pro</p>
              <p className="text-xl font-bold mt-1">고한도/우선 처리</p>
              <p className="text-xs text-nm-text-secondary mt-2">결제 연동 시 바로 구독 가능</p>
            </div>
          </div>

          <div className="mt-5 nm-concave p-4">
            <p className="text-xs text-nm-text-secondary">현재 플랜</p>
            {statusLoading ? (
              <p className="text-sm mt-1">확인 중...</p>
            ) : (
              <p className="text-sm font-semibold mt-1">
                {authToken ? (isPaid ? 'Pro' : 'Free') : '로그인 필요'}
              </p>
            )}
            {authToken && (
              <p className="text-xs text-nm-text-secondary mt-1">
                결제 기능 상태: {paymentEnabled ? '활성화' : '미설정'}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            {isPaid ? (
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={!paymentEnabled || actionLoading !== ''}
                className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading === 'portal' ? '이동 중...' : '구독 관리하기'}
              </button>
            ) : (
              <button
                type="button"
                onClick={startCheckout}
                disabled={!paymentEnabled || !authToken || actionLoading !== ''}
                className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading === 'checkout' ? '연결 중...' : 'Pro 구독 시작하기'}
              </button>
            )}
            <a
              href={CONTACT_URL}
              className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary"
            >
              구독 문의 메일 보내기
            </a>
            <Link
              href="/"
              className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary"
            >
              mallog24로 돌아가기
            </Link>
          </div>

          {!authToken && (
            <p className="text-xs text-nm-text-secondary mt-3">
              결제를 진행하려면 먼저 mallog24에 로그인해 주세요.
            </p>
          )}
          {!paymentEnabled && (
            <p className="text-xs text-nm-text-secondary mt-3">
              현재 서버에 결제 키가 설정되지 않아 실결제가 비활성화되어 있습니다.
            </p>
          )}
          {message && <p className="text-xs text-blue-600 mt-3">{message}</p>}
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          <p className="text-xs text-nm-text-secondary mt-4">문의 이메일: {CONTACT_MAIL}</p>
        </div>
      </main>
    </div>
  )
}
