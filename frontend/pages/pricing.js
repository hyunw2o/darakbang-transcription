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
        throw new Error(data.detail || '구독 상태를 불러오지 못했습니다.')
      }
      setStatus(data)
    } catch (err) {
      setError(err.message || '구독 상태 조회 실패')
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
    refreshBillingStatus(authToken)
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
      const successUrl = `${window.location.origin}/pricing?checkout=success`
      const cancelUrl = `${window.location.origin}/pricing?checkout=cancel`
      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'ko',
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
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
      const returnUrl = `${window.location.origin}/pricing`
      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: 'POST',
        headers: {
          ...withAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'ko',
          return_url: returnUrl,
        }),
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

  const cancelSubscription = async () => {
    if (!authToken) {
      setError('로그인 후 구독 취소를 진행할 수 있습니다.')
      return
    }

    if (!window.confirm('구독을 취소하시겠습니까? 결제 주기 종료 시점에 해지됩니다.')) {
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
          reason: 'user_requested_from_pricing_page',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || '구독 취소 요청에 실패했습니다.')
      }
      setMessage(data.message || '구독 취소 요청이 완료되었습니다.')
      await refreshBillingStatus(authToken, { quiet: true })
    } catch (err) {
      setError(err.message || '구독 취소 요청 실패')
    } finally {
      setActionLoading('')
    }
  }

  const requestRefund = async () => {
    if (!authToken) {
      setError('로그인 후 환불 요청을 진행할 수 있습니다.')
      return
    }

    if (!window.confirm('환불을 요청하시겠습니까? (기본 조건: 결제 후 7일 이내 + 사용량 0초)')) {
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
          reason: 'user_requested_from_pricing_page',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || '환불 요청에 실패했습니다.')
      }
      setMessage(data.message || '환불 요청이 접수되었습니다.')
      await refreshBillingStatus(authToken, { quiet: true })
    } catch (err) {
      setError(err.message || '환불 요청 실패')
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
        <title>mallog24 요금제 안내</title>
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="nm-raised p-6 sm:p-8">
          <p className="text-xs font-semibold text-nm-accent mb-2">Pricing</p>
          <h1 className="text-2xl sm:text-3xl font-bold">mallog24 요금제 안내</h1>
          <p className="mt-3 text-sm text-nm-text-secondary leading-relaxed">
            무료는 월 10시간까지 사용 가능합니다. 결제 연동이 설정된 환경에서는 Pro 구독을 즉시 시작할 수 있습니다.
          </p>
          <p className="mt-2 text-xs text-nm-text-secondary leading-relaxed">
            시행일: 2026-02-23 / 문서 버전: v2026.02.23
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <div className="nm-concave p-4">
              <p className="text-xs text-nm-text-secondary">Free</p>
              <p className="text-xl font-bold mt-1">월 10시간</p>
              <p className="text-xs text-nm-text-secondary mt-2">기본 음성 인식/구조화 기능</p>
            </div>
            <div className="nm-concave p-4 border-l-4 border-nm-accent">
              <p className="text-xs text-nm-text-secondary">Pro</p>
              <p className="text-xl font-bold mt-1">월 8,800원 (VAT 포함)</p>
              <p className="text-[11px] text-nm-text-secondary mt-1">공급가 8,000원 + 부가세 10%(800원)</p>
              <p className="text-xs text-nm-text-secondary mt-2">고한도/우선 처리 · 월간 자동갱신</p>
            </div>
          </div>

          <div className="mt-5 nm-concave p-4">
            <p className="text-sm font-semibold">상품 정보</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
              <li>상품명: mallog24 Pro 월간 구독</li>
              <li>이용기간: 결제 승인 시점부터 1개월 단위 자동 갱신</li>
              <li>이용요금: 월 8,800원 (VAT 포함, 결제창 표시 금액 기준)</li>
              <li>제공기능: 무료 플랜 대비 상향 사용량 및 우선 처리, 구독 관리 기능</li>
            </ul>
          </div>

          <div className="mt-4 nm-concave p-4">
            <p className="text-sm font-semibold">결제 및 구독 절차</p>
            <ol className="mt-2 list-decimal pl-5 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
              <li>로그인 후 요금제 페이지에서 Pro 상품을 선택합니다.</li>
              <li>결제 대행사 체크아웃에서 상품명/금액/결제수단/약관을 확인합니다.</li>
              <li>결제 승인 시 구독이 즉시 활성화되며, 결제 내역 기준으로 이용기간이 시작됩니다.</li>
              <li>다음 결제일부터 중단하려면 결제 주기 종료 전 구독 관리 메뉴에서 해지합니다.</li>
            </ol>
          </div>

          <div className="mt-4 nm-concave p-4">
            <p className="text-sm font-semibold">환불 규정</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
              <li>결제 후 7일 이내, 사용 이력이 없는 경우 전액 환불을 요청할 수 있습니다.</li>
              <li>결제 후 사용 이력이 있는 경우 당월 이용분에 대한 부분 환불은 제한될 수 있으며, 해지는 다음 결제일부터 반영됩니다.</li>
              <li>중복 결제, 시스템 오류, 결제 실패 후 과금 등 명백한 과오금은 확인 후 전액 환불합니다.</li>
              <li>환불 처리일/지급수단은 결제사 및 카드사 정책에 따라 달라질 수 있습니다.</li>
              <li>전자상거래법 등 관련 법령이 본 규정보다 우선 적용됩니다.</li>
            </ul>
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
                결제 공급자: {billingProvider} / 체크아웃 모드: {checkoutMode}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            {isPaid ? (
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={!portalSupported || actionLoading !== ''}
                className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-center leading-tight whitespace-normal disabled:opacity-50"
                style={{ wordBreak: 'keep-all' }}
              >
                {actionLoading === 'portal'
                  ? '이동 중...'
                  : portalSupported
                    ? (
                      <span>
                        구독
                        <br />
                        관리하기
                      </span>
                    )
                    : (
                      <span>
                        국내 PG 관리자 페이지
                        <br />
                        준비중
                      </span>
                    )}
              </button>
            ) : (
              <button
                type="button"
                onClick={startCheckout}
                disabled={!checkoutSupported || !authToken || actionLoading !== ''}
                className="nm-btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading === 'checkout'
                  ? '연결 중...'
                  : checkoutSupported
                    ? isMockCheckout
                      ? '테스트 결제 시작하기'
                      : 'Pro 구독 시작하기'
                    : '결제 준비 중'}
              </button>
            )}
            {isPaid && (
              <button
                type="button"
                onClick={cancelSubscription}
                disabled={actionLoading !== ''}
                className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary text-center leading-tight whitespace-normal disabled:opacity-50"
                style={{ wordBreak: 'keep-all' }}
              >
                {actionLoading === 'cancel'
                  ? '처리 중...'
                  : (
                    <span>
                      구독
                      <br />
                      취소하기
                    </span>
                  )}
              </button>
            )}
            {isPaid && (
              <button
                type="button"
                onClick={requestRefund}
                disabled={actionLoading !== ''}
                className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary text-center leading-tight whitespace-normal disabled:opacity-50"
                style={{ wordBreak: 'keep-all' }}
              >
                {actionLoading === 'refund'
                  ? '처리 중...'
                  : (
                    <span>
                      환불
                      <br />
                      요청하기
                    </span>
                  )}
              </button>
            )}
            <a
              href={CONTACT_URL}
              className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary text-center leading-tight whitespace-normal break-keep"
              style={{ wordBreak: 'keep-all' }}
            >
              <span>
                구독 문의 메일
                <br />
                보내기
              </span>
            </a>
            <Link
              href="/"
              className="nm-btn inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-nm-text-primary text-center leading-tight whitespace-normal break-keep"
              style={{ wordBreak: 'keep-all' }}
            >
              <span>
                mallog24로
                <br />
                돌아가기
              </span>
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
          {checkoutSupported && isMockCheckout && (
            <p className="text-xs text-nm-text-secondary mt-3">
              현재는 테스트 결제 모드입니다. 실제 과금 없이 성공/취소 플로우를 확인할 수 있습니다.
            </p>
          )}
          {isPaid && (
            <p className="text-xs text-nm-text-secondary mt-3">
              환불 자동 처리 기본 조건: 결제 후 7일 이내 + 사용 이력 0초 (그 외는 수동 심사)
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
