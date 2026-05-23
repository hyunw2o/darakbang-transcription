import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, safeReadJson } from '../utils/network'

const AUTH_MESSAGES = {
  ko: {
    sessionExpired: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
    socialComplete: '소셜 로그인이 완료되었습니다.',
    socialFailedPrefix: '소셜 로그인 실패: ',
    checking: '확인 중',
    expired: '만료됨',
    authFailed: '인증 처리에 실패했습니다.',
    authError: '인증 오류가 발생했습니다.',
    socialUrlFailed: '소셜 로그인 URL 요청에 실패했습니다.',
    socialError: '소셜 로그인 오류가 발생했습니다.',
    socialSessionError: '소셜 로그인 세션을 설정하지 못했습니다.',
    signupDone: '회원가입 및 로그인이 완료되었습니다.',
    loginDone: '로그인되었습니다.',
    signupPending: '회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.',
    loggedOut: '로그아웃되었습니다.',
    loggedInUserFallback: '인증된 사용자',
    oauthRedirectPath: '',
    usageFailed: '사용량을 불러오지 못했습니다.',
  },
  en: {
    sessionExpired: 'Your session has expired. Please sign in again.',
    socialComplete: 'Social sign-in completed.',
    socialFailedPrefix: 'Social sign-in failed: ',
    checking: 'Checking...',
    expired: 'Expired',
    authFailed: 'Authentication failed.',
    authError: 'Authentication error.',
    socialUrlFailed: 'Failed to get social sign-in URL.',
    socialError: 'Social sign-in error.',
    socialSessionError: 'Failed to establish social sign-in session.',
    signupDone: 'Sign-up and login completed.',
    loginDone: 'Logged in successfully.',
    signupPending: 'Sign-up completed. Please verify your email and log in.',
    loggedOut: 'You have been logged out.',
    loggedInUserFallback: 'Authenticated user',
    oauthRedirectPath: '/en',
    usageFailed: 'Failed to load monthly usage.',
  },
}

const COOKIE_SESSION_TOKEN = '__cookie_session__'
const AUTH_TOKEN_EXP_LEEWAY_MS = 30 * 1000
const WARMUP_TIMEOUT_MS = 4000

const normalizeExpiryMs = (value) => {
  const numeric = Number(value) || 0
  if (!numeric) return 0
  return numeric > 10_000_000_000 ? numeric : numeric * 1000
}

const mapUsageSnapshot = (usage) => {
  if (!usage) return null
  return {
    plan_tier: usage.plan_tier || 'free',
    access_source: usage.access_source || '',
    used_audio_seconds: Number(usage.used_audio_seconds) || 0,
    monthly_limit_seconds:
      usage.monthly_limit_seconds === null || usage.monthly_limit_seconds === undefined
        ? null
        : Number(usage.monthly_limit_seconds) || 0,
    remaining_seconds:
      usage.remaining_seconds === null || usage.remaining_seconds === undefined
        ? null
        : Number(usage.remaining_seconds) || 0,
    usage_percent: Number(usage.usage_percent) || 0,
    trial_active: Boolean(usage.trial_active),
    trial_ends_at: usage.trial_ends_at || null,
    trial_days_remaining: Number(usage.trial_days_remaining) || 0,
    trial_source: usage.trial_source || '',
  }
}

export default function useMallogAuth({
  apiUrl,
  locale = 'ko',
  setError,
  setNotice,
  onResetState,
}) {
  const messages = AUTH_MESSAGES[locale] || AUTH_MESSAGES.ko
  const [authMode, setAuthMode] = useState('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [usage, setUsage] = useState(null)
  const [sessionExpiresAtMs, setSessionExpiresAtMs] = useState(0)
  const [sessionNowMs, setSessionNowMs] = useState(Date.now())

  const parseJwtExpMs = useCallback((token) => {
    try {
      const payload = token.split('.')[1]
      if (!payload) return 0
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
      const decoded = JSON.parse(window.atob(padded))
      if (!decoded?.exp || typeof decoded.exp !== 'number') return 0
      return decoded.exp * 1000
    } catch {
      return 0
    }
  }, [])

  const isJwtExpired = useCallback((token) => {
    const expMs = parseJwtExpMs(token)
    if (!expMs) return false
    return Date.now() >= expMs - AUTH_TOKEN_EXP_LEEWAY_MS
  }, [parseJwtExpMs])

  const formatSessionRemaining = useCallback((remainingSeconds) => {
    const safe = Math.max(0, Number(remainingSeconds) || 0)
    const hours = Math.floor(safe / 3600)
    const minutes = Math.floor((safe % 3600) / 60)
    const seconds = safe % 60

    if (locale === 'en') {
      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
      if (minutes > 0) return `${minutes}m ${seconds}s`
      return `${seconds}s`
    }

    if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`
    if (minutes > 0) return `${minutes}분 ${seconds}초`
    return `${seconds}초`
  }, [locale])

  const readResponseData = useCallback(async (response, fallbackMessage) => {
    const data = await safeReadJson(response)
    if (!response.ok) {
      throw new Error(data?.detail || fallbackMessage)
    }
    return data || {}
  }, [])

  const getAuthHeaders = useCallback((token = authToken) => {
    const normalized = String(token || '').trim()
    if (!normalized || normalized === COOKIE_SESSION_TOKEN) return {}
    return { Authorization: `Bearer ${normalized}` }
  }, [authToken])

  const resetAuthState = useCallback(({ errorMessage = null, noticeMessage = null } = {}) => {
    setAuthToken('')
    setAuthUser(null)
    setUsage(null)
    setSessionExpiresAtMs(0)
    setSessionNowMs(Date.now())
    onResetState?.()
    setError(errorMessage)
    setNotice(noticeMessage)
  }, [onResetState, setError, setNotice])

  const applySessionData = useCallback((data, { noticeMessage = null } = {}) => {
    setAuthToken(COOKIE_SESSION_TOKEN)
    setAuthUser(data?.user || null)
    setUsage(mapUsageSnapshot(data?.usage))
    setSessionExpiresAtMs(normalizeExpiryMs(data?.session_expires_at))
    setSessionNowMs(Date.now())
    onResetState?.()
    setError(null)
    if (noticeMessage) {
      setNotice(noticeMessage)
    }
  }, [onResetState, setError, setNotice])

  const fetchUsage = useCallback(async (token = authToken) => {
    if (!token && !authToken) {
      setUsage(null)
      return null
    }

    try {
      const res = await apiFetch(`${apiUrl}/api/usage`, {
        headers: getAuthHeaders(token),
      })
      if (res.status === 401) {
        if (authToken) {
          resetAuthState({ errorMessage: messages.sessionExpired })
        }
        return null
      }
      const data = await readResponseData(res, messages.usageFailed)
      const snapshot = mapUsageSnapshot(data)
      setUsage(snapshot)
      return snapshot
    } catch (error) {
      console.error('Failed to fetch usage', error)
      return null
    }
  }, [apiUrl, authToken, getAuthHeaders, messages.sessionExpired, messages.usageFailed, readResponseData, resetAuthState])

  const fetchBootstrap = useCallback(async (token = authToken, { silentUnauthorized = false } = {}) => {
    try {
      const res = await apiFetch(`${apiUrl}/api/auth/bootstrap`, {
        headers: getAuthHeaders(token),
      })
      if (res.status === 401) {
        resetAuthState({ errorMessage: silentUnauthorized ? null : (authToken ? messages.sessionExpired : null) })
        return null
      }
      const data = await readResponseData(res, messages.sessionExpired)
      applySessionData(data)
      return data
    } catch (error) {
      console.error('Failed to bootstrap auth state', error)
      resetAuthState({ errorMessage: silentUnauthorized ? null : (error?.message || messages.sessionExpired) })
      return null
    }
  }, [apiUrl, applySessionData, authToken, getAuthHeaders, messages.sessionExpired, readResponseData, resetAuthState])

  const establishCookieSession = useCallback(async (token) => {
    const formData = new FormData()
    formData.append('access_token', token)

    const response = await apiFetch(`${apiUrl}/api/auth/session`, {
      method: 'POST',
      body: formData,
    })
    const data = await readResponseData(response, messages.socialSessionError)
    applySessionData(data, { noticeMessage: messages.socialComplete })
    return data
  }, [apiUrl, applySessionData, messages.socialComplete, messages.socialSessionError, readResponseData])

  const warmUpBackend = useCallback(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS)
    apiFetch(`${apiUrl}/health`, { signal: controller.signal })
      .catch(() => {})
      .finally(() => window.clearTimeout(timeoutId))
  }, [apiUrl])

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      warmUpBackend()

      const oauthParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const queryParams = new URLSearchParams(window.location.search)
      const oauthAccessToken = oauthParams.get('access_token') || queryParams.get('access_token')
      const oauthError =
        oauthParams.get('error_description') ||
        oauthParams.get('error') ||
        queryParams.get('error_description') ||
        queryParams.get('error')

      if (oauthError) {
        setError(`${messages.socialFailedPrefix}${oauthError}`)
      }

      if (oauthAccessToken) {
        if (isJwtExpired(oauthAccessToken)) {
          resetAuthState({ errorMessage: messages.sessionExpired })
        } else {
          try {
            await establishCookieSession(oauthAccessToken)
          } catch (error) {
            if (!cancelled) {
              resetAuthState({ errorMessage: error?.message || messages.socialSessionError })
            }
          }
        }
      } else {
        await fetchBootstrap('', { silentUnauthorized: true })
      }

      if (!cancelled && (oauthAccessToken || oauthError)) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    bootstrapAuth()
    return () => {
      cancelled = true
    }
  }, [establishCookieSession, fetchBootstrap, isJwtExpired, messages.sessionExpired, messages.socialFailedPrefix, messages.socialSessionError, resetAuthState, setError, warmUpBackend])

  useEffect(() => {
    if (!authToken || !sessionExpiresAtMs) return undefined
    const intervalId = window.setInterval(() => {
      setSessionNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [authToken, sessionExpiresAtMs])

  const sessionRemainingLabel = useMemo(() => {
    const remainingSeconds = sessionExpiresAtMs
      ? Math.max(0, Math.floor((sessionExpiresAtMs - sessionNowMs) / 1000))
      : 0

    if (!sessionExpiresAtMs) return messages.checking
    if (remainingSeconds <= 0) return messages.expired
    return formatSessionRemaining(remainingSeconds)
  }, [formatSessionRemaining, messages.checking, messages.expired, sessionExpiresAtMs, sessionNowMs])

  const handleAuthSubmit = useCallback(async (event) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setAuthLoading(true)

    try {
      const formData = new FormData()
      formData.append('email', authEmail.trim())
      formData.append('password', authPassword)
      if (authMode === 'signup') {
        formData.append('full_name', authName.trim())
      }

      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const response = await apiFetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
      })
      const data = await readResponseData(response, messages.authFailed)

      if (data.session_established) {
        applySessionData(data, {
          noticeMessage: authMode === 'signup' ? messages.signupDone : messages.loginDone,
        })
      } else {
        setNotice(data.message || messages.signupPending)
      }

      setAuthPassword('')
      if (authMode === 'signup') {
        setAuthMode('login')
      }
    } catch (error) {
      setError(error?.message || messages.authError)
    } finally {
      setAuthLoading(false)
    }
  }, [
    apiUrl,
    applySessionData,
    authEmail,
    authMode,
    authName,
    authPassword,
    messages.authError,
    messages.authFailed,
    messages.loginDone,
    messages.signupDone,
    messages.signupPending,
    readResponseData,
    setError,
    setNotice,
  ])

  const handleSocialLogin = useCallback(async (provider) => {
    if (socialLoading) return
    setError(null)
    setNotice(null)
    setSocialLoading(provider)

    try {
      const redirectTo = `${window.location.origin}${messages.oauthRedirectPath || window.location.pathname}`
      const response = await apiFetch(
        `${apiUrl}/api/auth/oauth-url?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`
      )
      const data = await readResponseData(response, messages.socialUrlFailed)
      window.location.href = data.auth_url
    } catch (error) {
      setError(error?.message || messages.socialError)
      setSocialLoading('')
    }
  }, [apiUrl, messages.oauthRedirectPath, messages.socialError, messages.socialUrlFailed, readResponseData, setError, setNotice, socialLoading])

  const handleLogout = useCallback(async () => {
    setAuthLoading(false)
    setSocialLoading('')
    try {
      await apiFetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
    } catch (error) {
      console.error('Failed to clear auth cookie', error)
    }
    resetAuthState({ noticeMessage: messages.loggedOut })
  }, [apiUrl, getAuthHeaders, messages.loggedOut, resetAuthState])

  return {
    authMode,
    setAuthMode,
    authName,
    setAuthName,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authLoading,
    socialLoading,
    authToken,
    authUser,
    usage,
    setUsage,
    sessionRemainingLabel,
    getAuthHeaders,
    fetchUsage,
    fetchBootstrap,
    handleAuthSubmit,
    handleSocialLogin,
    handleLogout,
    authUserFallbackLabel: messages.loggedInUserFallback,
  }
}
