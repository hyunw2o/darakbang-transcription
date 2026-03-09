import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { apiFetch, safeReadJson } from '../utils/network'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mallog24.com'
const CONTACT_MAIL = 'ours113814@gmail.com'
const CONTACT_URL = `mailto:${CONTACT_MAIL}?subject=mallog24%20%EC%9A%94%EA%B8%88%EC%A0%9C%20%EC%97%85%EA%B7%B8%EB%A0%88%EC%9D%B4%EB%93%9C%20%EB%AC%B8%EC%9D%98`
const PLAN_SUMMARY = {
  free: [
    '월 10시간까지 무료 사용',
    'TXT / DOCX / 클립보드 저장',
    '설교 / 통화 / 회의 구조화',
  ],
  pro: [
    '월 8,800원(VAT 포함) 무제한',
    '반복 업무용 상시 사용',
    '구독 관리 / 환불 요청 지원',
  ],
}
const COMPARE_ROWS = [
  ['월 사용량', '월 10시간', '무제한'],
  ['출력 포맷', 'TXT / DOCX / 클립보드', 'TXT / DOCX / 클립보드'],
  ['기록본 저장', '지원', '지원'],
  ['추천 용도', '테스트 / 개인 사용', '팀 운영 / 반복 실무'],
]
const BILLING_NOTES = [
  '가격은 월 8,800원이며 부가세 10% 포함 기준입니다.',
  '정기 구독 취소 시 현재 결제 주기 종료 시점까지 사용 가능합니다.',
  '환불 기본 조건은 결제 후 7일 이내이며 사용량이 0초인 경우입니다.',
]
const FAQS = [
  ['결제 전 어떤 정보를 확인하면 되나요?', '무료 플랜 한도, 월간 Pro 요금, 환불 기준, 지원 결제수단을 이 페이지에서 먼저 확인하시면 됩니다.'],
  ['카카오페이와 카드 결제 모두 가능한가요?', '운영 채널 설정에 따라 카드와 카카오페이 결제를 순차적으로 지원합니다. 결제창이 열리지 않으면 채널 심사 상태를 먼저 확인해야 합니다.'],
  ['구독을 취소하면 바로 사용이 막히나요?', '아닙니다. 기본 취소는 당월 결제 주기 종료 시점에 반영됩니다.'],
]

const readResponseData = async (response, fallbackMessage) => {
  const data = await safeReadJson(response)
  if (!response.ok) {
    throw new Error(data?.detail || fallbackMessage)
  }
  return data || {}
}

export default function PricingPage() {
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
      const data = await readResponseData(res, '구독 상태를 불러오지 못했습니다.')
      setIsAuthenticated(true)
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

    const checkoutResult = new URLSearchParams(window.location.search).get('checkout')
    if (checkoutResult === 'success') {
      setMessage('결제가 완료되었습니다. 구독 상태를 확인 중입니다.')
    } else if (checkoutResult === 'cancel') {
      setMessage('결제가 취소되었습니다.')
    }

    refreshBillingStatus()
  }, [])

  const startCheckout = async (payMethod = 'card') => {
    if (!isAuthenticated) {
      setError('로그인 후 결제를 진행할 수 있습니다.')
      return
    }

    const normalizedPayMethod = payMethod === 'kakaopay' ? 'kakaopay' : 'card'
    setActionLoading(`checkout_${normalizedPayMethod}`)
    setError('')
    setMessage('')
    try {
      const successUrl = `${window.location.origin}/pricing?checkout=success`
      const cancelUrl = `${window.location.origin}/pricing?checkout=cancel`
      const res = await apiFetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'ko',
          success_url: successUrl,
          cancel_url: cancelUrl,
          pay_method: normalizedPayMethod,
        }),
      })
      const data = await readResponseData(res, '결제 페이지 이동에 실패했습니다.')
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
    if (!isAuthenticated) {
      setError('로그인 후 구독 관리를 진행할 수 있습니다.')
      return
    }

    setActionLoading('portal')
    setError('')
    setMessage('')
    try {
      const returnUrl = `${window.location.origin}/pricing`
      const res = await apiFetch(`${API_URL}/api/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'ko',
          return_url: returnUrl,
        }),
      })
      const data = await readResponseData(res, '구독 관리 페이지 이동에 실패했습니다.')
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
    if (!isAuthenticated) {
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
      const res = await apiFetch(`${API_URL}/api/billing/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          immediate: false,
          reason: 'user_requested_from_pricing_page',
        }),
      })
      const data = await readResponseData(res, '구독 취소 요청에 실패했습니다.')
      setMessage(data.message || '구독 취소 요청이 완료되었습니다.')
      await refreshBillingStatus({ quiet: true })
    } catch (err) {
      setError(err.message || '구독 취소 요청 실패')
    } finally {
      setActionLoading('')
    }
  }

  const requestRefund = async () => {
    if (!isAuthenticated) {
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
      const res = await apiFetch(`${API_URL}/api/billing/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'user_requested_from_pricing_page',
        }),
      })
      const data = await readResponseData(res, '환불 요청에 실패했습니다.')
      setMessage(data.message || '환불 요청이 접수되었습니다.')
      await refreshBillingStatus({ quiet: true })
    } catch (err) {
      setError(err.message || '환불 요청 실패')
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div className="min-h-screen bg-[#071021] text-white">
      <Head>
        <title>mallog24 요금제</title>
      </Head>
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-sm text-white/60">Pricing</p>
            <h1 className="text-3xl font-bold">mallog24 Pro</h1>
            <p className="text-white/70 mt-2">월 8,800원(VAT 포함) 무제한 음성 구조화 기록</p>
            <p className="text-sm text-white/45 mt-2">무료 10시간 검증 후 필요한 경우에만 Pro로 전환하는 구조입니다.</p>
          </div>
          <Link href="/" className="px-4 py-2 rounded-full border border-white/15 text-sm text-white/80 hover:text-white">
            mallog24로 돌아가기
          </Link>
        </div>

        <div className="grid xl:grid-cols-[0.95fr,1.05fr] gap-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">현재 플랜</p>
            <h2 className="text-2xl font-semibold mt-2">{status?.plan_tier === 'pro' ? 'Pro' : 'Free'}</h2>
            <p className="text-white/60 mt-2">무료 플랜은 월 10시간까지 사용 가능합니다.</p>
            <ul className="mt-4 space-y-2 text-sm text-white/75">
              {PLAN_SUMMARY.free.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
            {statusLoading ? (
              <p className="mt-4 text-white/60">구독 상태를 확인하는 중입니다.</p>
            ) : status ? (
              <div className="mt-4 space-y-2 text-sm text-white/80">
                <p>상태: {status.status || 'inactive'}</p>
                <p>갱신 예정일: {status.current_period_end ? new Date(status.current_period_end).toLocaleString('ko-KR') : '없음'}</p>
                <p>취소 예약: {status.cancel_at_period_end ? '예' : '아니오'}</p>
              </div>
            ) : (
              <p className="mt-4 text-white/60">로그인 후 구독 상태를 확인할 수 있습니다.</p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">업그레이드</p>
            <h2 className="text-2xl font-semibold mt-2">Pro 월간 구독</h2>
            <p className="text-white/70 mt-2">무제한 사용, 우선 지원, 정기 구독 관리 제공</p>
            <ul className="mt-4 space-y-2 text-sm text-white/75">
              {PLAN_SUMMARY.pro.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={() => startCheckout('card')} className="rounded-2xl bg-white text-[#071021] px-4 py-3 font-semibold">
                {actionLoading === 'checkout_card' ? '결제창 여는 중...' : '카드로 Pro 구독하기'}
              </button>
              <button type="button" onClick={() => startCheckout('kakaopay')} className="rounded-2xl bg-[#FEE500] text-[#1D1D1F] px-4 py-3 font-semibold">
                {actionLoading === 'checkout_kakaopay' ? '카카오페이 연결 중...' : '카카오페이로 Pro 구독하기'}
              </button>
              <button type="button" onClick={openBillingPortal} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85">
                {actionLoading === 'portal' ? '이동 중...' : '구독 관리 열기'}
              </button>
              <button type="button" onClick={cancelSubscription} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85">
                {actionLoading === 'cancel' ? '처리 중...' : '구독 취소하기'}
              </button>
              <button type="button" onClick={requestRefund} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85">
                {actionLoading === 'refund' ? '처리 중...' : '환불 요청하기'}
              </button>
              <a href={CONTACT_URL} className="rounded-2xl border border-white/15 px-4 py-3 font-semibold text-white/85 text-center">
                구독 문의 메일 보내기
              </a>
            </div>
          </section>
        </div>

        {(message || error) && (
          <div className={`mt-6 rounded-2xl px-4 py-3 text-sm ${error ? 'bg-red-500/15 text-red-200 border border-red-400/20' : 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/20'}`}>
            {error || message}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-white/60">Plan comparison</p>
              <h2 className="text-2xl font-semibold mt-1">가입 전에 핵심 차이만 확인하세요</h2>
            </div>
            <p className="text-sm text-white/45">복잡한 옵션 없이 Free와 Pro 두 단계만 운영합니다.</p>
          </div>
          <div className="mt-5 overflow-x-auto rounded-3xl border border-white/10">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1.2fr,1fr,1fr] bg-white/5 text-xs uppercase tracking-[0.14em] text-white/55">
                <div className="px-4 py-3">항목</div>
                <div className="px-4 py-3 border-l border-white/10">Free</div>
                <div className="px-4 py-3 border-l border-white/10">Pro</div>
              </div>
              {COMPARE_ROWS.map(([label, free, pro]) => (
                <div key={label} className="grid grid-cols-[1.2fr,1fr,1fr] border-t border-white/10 text-sm">
                  <div className="px-4 py-3 font-semibold text-white">{label}</div>
                  <div className="px-4 py-3 border-l border-white/10 text-white/70">{free}</div>
                  <div className="px-4 py-3 border-l border-white/10 text-white/70">{pro}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Billing notes</p>
            <h2 className="text-2xl font-semibold mt-1">결제 전 확인 사항</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/75 leading-relaxed">
              {BILLING_NOTES.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">FAQ</p>
            <h2 className="text-2xl font-semibold mt-1">결제 관련 자주 묻는 질문</h2>
            <div className="mt-4 space-y-3">
              {FAQS.map(([question, answer], index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div key={question} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                      className="w-full px-4 py-4 flex items-center justify-between gap-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-white">{question}</span>
                      <span className={`text-white/55 transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
                    </button>
                    {isOpen ? (
                      <p className="px-4 pb-4 text-sm text-white/70 leading-relaxed">{answer}</p>
                    ) : null}
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
