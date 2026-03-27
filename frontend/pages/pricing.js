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

function ActionButton({ children, variant = 'secondary', className = '', ...props }) {
  const baseClassName = 'inline-flex min-h-[48px] w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition duration-200 whitespace-nowrap'
  const variantClassName = variant === 'primary'
    ? 'bg-[linear-gradient(135deg,#3B82F6,#7C3AED)] text-white shadow-[0_14px_30px_rgba(59,130,246,0.22)] hover:-translate-y-[1px] hover:opacity-90'
    : variant === 'kakao'
      ? 'bg-[#FEE500] text-[#1D1D1F] hover:-translate-y-[1px] hover:opacity-95'
      : 'border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8F9FF] dark:border-white/10 dark:bg-[#111827] dark:text-white dark:hover:bg-white/10'

  return (
    <button {...props} className={`${baseClassName} ${variantClassName} ${className}`}>
      {children}
    </button>
  )
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
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A] dark:bg-[#020617] dark:text-white">
      <Head>
        <title>mallog24 요금제</title>
      </Head>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] bg-[#0F172A] px-6 py-8 shadow-[0_32px_80px_rgba(15,23,42,0.24)] sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#3B82F6]/20 bg-[rgba(59,130,246,0.15)] px-4 py-1.5 text-xs font-semibold text-[#93C5FD] whitespace-nowrap">
                ✦ Free / Pro 요금제를 한 번에 비교
              </span>
              <h1 className="mt-5 text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[46px]">
                <span className="block mallog-keep">필요한 만큼 무료로 검증하고,</span>
                <span className="mt-2 block text-gradient-brand mallog-keep">확신이 생기면 Pro로 전환하세요.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/60 sm:text-lg mallog-keep">
                mallog24 Pro는 월 8,800원(VAT 포함)으로 무제한 사용 기준입니다. 설교, 통화, 회의 구조화 문서를 반복적으로 만들어야 하는 팀과 개인을 위한 플랜입니다.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link
                href="/"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/5 whitespace-nowrap"
              >
                mallog24로 돌아가기
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#0F172A] dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B] dark:text-white/55">Current plan</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A] dark:text-white">{status?.plan_tier === 'pro' ? 'Pro' : 'Free'}</h2>
            <p className="mt-3 text-base leading-7 text-[#64748B] dark:text-white/72 mallog-keep">무료 플랜은 월 10시간까지 사용 가능합니다.</p>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#64748B] dark:text-white/72">
              {PLAN_SUMMARY.free.map((item) => (
                <li key={item} className="flex gap-2 mallog-keep"><span className="text-[#3B82F6]">•</span><span>{item}</span></li>
              ))}
            </ul>
            {statusLoading ? (
              <p className="mt-6 text-sm text-[#64748B] dark:text-white/60">구독 상태를 확인하는 중입니다.</p>
            ) : status ? (
              <div className="mt-6 rounded-2xl bg-[#F8F9FF] p-4 text-sm text-[#64748B] dark:bg-white/[0.04] dark:text-white/72">
                <p>상태: <span className="font-semibold text-[#0F172A] dark:text-white">{status.status || 'inactive'}</span></p>
                <p className="mt-2">갱신 예정일: <span className="font-semibold text-[#0F172A] dark:text-white">{status.current_period_end ? new Date(status.current_period_end).toLocaleString('ko-KR') : '없음'}</span></p>
                <p className="mt-2">취소 예약: <span className="font-semibold text-[#0F172A] dark:text-white">{status.cancel_at_period_end ? '예' : '아니오'}</span></p>
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#64748B] dark:text-white/60">로그인 후 구독 상태를 확인할 수 있습니다.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#0F172A] dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B] dark:text-white/55">Upgrade</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A] dark:text-white">Pro 월간 구독</h2>
            <p className="mt-3 text-base leading-7 text-[#64748B] dark:text-white/72 mallog-keep">무제한 사용, 우선 지원, 구독 관리와 환불 요청 흐름을 제공합니다.</p>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#64748B] dark:text-white/72">
              {PLAN_SUMMARY.pro.map((item) => (
                <li key={item} className="flex gap-2 mallog-keep"><span className="text-[#3B82F6]">•</span><span>{item}</span></li>
              ))}
            </ul>
            <div className="mt-6 grid gap-3">
              <ActionButton type="button" variant="primary" onClick={() => startCheckout('card')}>
                {actionLoading === 'checkout_card' ? '결제창 여는 중...' : '카드로 Pro 구독하기'}
              </ActionButton>
              <ActionButton type="button" variant="kakao" onClick={() => startCheckout('kakaopay')}>
                {actionLoading === 'checkout_kakaopay' ? '카카오페이 연결 중...' : '카카오페이로 Pro 구독하기'}
              </ActionButton>
              <ActionButton type="button" onClick={openBillingPortal}>
                {actionLoading === 'portal' ? '이동 중...' : '구독 관리 열기'}
              </ActionButton>
              <ActionButton type="button" onClick={cancelSubscription}>
                {actionLoading === 'cancel' ? '처리 중...' : '구독 취소하기'}
              </ActionButton>
              <ActionButton type="button" onClick={requestRefund}>
                {actionLoading === 'refund' ? '처리 중...' : '환불 요청하기'}
              </ActionButton>
              <a
                href={CONTACT_URL}
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-semibold text-[#0F172A] transition duration-200 hover:bg-[#F8F9FF] whitespace-nowrap dark:border-white/10 dark:bg-[#111827] dark:text-white dark:hover:bg-white/10"
              >
                구독 문의 메일 보내기
              </a>
            </div>
          </section>
        </div>

        {(message || error) ? (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'}`}>
            {error || message}
          </div>
        ) : null}

        <section className="mt-8 rounded-[24px] bg-[#F8F9FF] px-6 py-8 sm:px-8 dark:bg-[#0B1220]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">Pricing comparison</p>
            <h2 className="mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A] dark:text-white sm:text-[36px] mallog-keep">가입 전에 핵심 차이만 확인하세요</h2>
            <p className="mt-3 text-base leading-7 text-[#64748B] dark:text-white/72 mallog-keep">복잡한 옵션 없이 Free와 Pro 두 단계만 운영합니다.</p>
          </div>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#0F172A] dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[1.2fr,1fr,1fr] bg-[#F8F9FF] text-sm font-semibold text-[#64748B] dark:bg-white/[0.04] dark:text-white/60">
                <div className="px-5 py-4">항목</div>
                <div className="border-l border-[#E2E8F0] px-5 py-4 dark:border-white/10">Free</div>
                <div className="border-l border-[#E2E8F0] px-5 py-4 dark:border-white/10">Pro</div>
              </div>
              {COMPARE_ROWS.map(([label, free, pro]) => (
                <div key={label} className="grid grid-cols-[1.2fr,1fr,1fr] border-t border-[#E2E8F0] text-[15px] leading-7 text-[#0F172A] dark:border-white/10 dark:text-white">
                  <div className="px-5 py-4 font-semibold mallog-keep">{label}</div>
                  <div className="border-l border-[#E2E8F0] px-5 py-4 text-[#64748B] dark:border-white/10 dark:text-white/72 mallog-keep">{free}</div>
                  <div className="border-l border-[#E2E8F0] px-5 py-4 text-[#64748B] dark:border-white/10 dark:text-white/72 mallog-keep">{pro}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#0F172A] dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B] dark:text-white/55">Billing notes</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A] dark:text-white mallog-keep">결제 전 확인 사항</h2>
            <ul className="mt-5 space-y-3 text-[15px] leading-7 text-[#64748B] dark:text-white/72">
              {BILLING_NOTES.map((item) => (
                <li key={item} className="flex gap-2 mallog-keep"><span className="text-[#3B82F6]">•</span><span>{item}</span></li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#0F172A] dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#64748B] dark:text-white/55">FAQ</p>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#0F172A] dark:text-white mallog-keep">결제 관련 자주 묻는 질문</h2>
            <div className="mt-5 space-y-3">
              {FAQS.map(([question, answer], index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div key={question} className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8F9FF] dark:border-white/10 dark:bg-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-[#0F172A] dark:text-white mallog-keep">{question}</span>
                      <span className={`text-[#64748B] dark:text-white/60 transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
                    </button>
                    {isOpen ? <p className="px-4 pb-4 text-sm leading-7 text-[#64748B] dark:text-white/72 mallog-keep">{answer}</p> : null}
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
