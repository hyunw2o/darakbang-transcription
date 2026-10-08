import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { abortError, apiFetch, safeReadJson, subscribeUnauthorized, waitForAuthServer } from '../utils/network'

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
    passwordResetRequested: '가입된 이메일이라면 비밀번호 재설정 안내 메일이 발송됩니다.',
    passwordRecoveryReady: '새 비밀번호를 입력해 계정 복구를 완료해 주세요.',
    passwordResetDone: '비밀번호가 변경되었습니다.',
    passwordMismatch: '새 비밀번호가 서로 일치하지 않습니다.',
    passwordMin: '비밀번호는 8자 이상이어야 합니다.',
    recoveryEmailRequired: '가입에 사용한 이메일을 입력해 주세요.',
    resetSessionExpired: '비밀번호 재설정 세션이 만료되었습니다. 메일 링크를 다시 요청해 주세요.',
    loggedOut: '로그아웃되었습니다.',
    loggedInUserFallback: '인증된 사용자',
    oauthRedirectPath: '',
    usageFailed: '사용량을 불러오지 못했습니다.',
    connectionDelayed: '서버 연결이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.',
    preparingLogin: '서버 연결을 준비하고 있습니다. 잠시만 기다려 주세요.',
    verifyingLogin: '로그인 정보를 확인하고 있습니다.',
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
    passwordResetRequested: 'If the email is registered, password reset instructions will be sent.',
    passwordRecoveryReady: 'Enter a new password to finish account recovery.',
    passwordResetDone: 'Your password has been updated.',
    passwordMismatch: 'The new passwords do not match.',
    passwordMin: 'Password must be at least 8 characters.',
    recoveryEmailRequired: 'Please enter the email used for sign-up.',
    resetSessionExpired: 'The password reset session has expired. Please request a new email link.',
    loggedOut: 'You have been logged out.',
    loggedInUserFallback: 'Authenticated user',
    oauthRedirectPath: '/en',
    usageFailed: 'Failed to load monthly usage.',
    connectionDelayed: 'The server is taking longer to respond. Please try again shortly.',
    preparingLogin: 'Connecting to the server. Please wait.',
    verifyingLogin: 'Verifying your sign-in details.',
  },
}

const COOKIE_SESSION_TOKEN = '__cookie_session__'
const AUTH_TOKEN_EXP_LEEWAY_MS = 30 * 1000
const AUTH_TIMEOUT_MS = 20000
const LOGIN_TIMEOUT_MS = 45000

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
  }
}

export default function useMallogAuth({
  apiUrl,
  locale = 'ko',
  initialAuthMode = 'login',
  setError,
  setNotice,
  onResetState,
}) {
  const messages = AUTH_MESSAGES[locale] || AUTH_MESSAGES.ko
  const [authMode, setAuthMode] = useState(initialAuthMode)
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authInitializing, setAuthInitializing] = useState(true)
  const [authRetryAvailable, setAuthRetryAvailable] = useState(false)
  const [authSessionRevision, setAuthSessionRevision] = useState(0)
  const [socialLoading, setSocialLoading] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [usage, setUsage] = useState(null)
  const [sessionExpiresAtMs, setSessionExpiresAtMs] = useState(0)
  const [sessionNowMs, setSessionNowMs] = useState(Date.now())
  const callbacks = useRef({})
  callbacks.current = { onResetState, setError, setNotice, messages, authMode }
  const session = useRef({ token: '', user: null, expiresAt: 0 })
  const requestController = useRef(null)
  const authSubmitBusy = useRef(false)

  const beginAuthRequest = useCallback(() => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    return controller
  }, [])

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

  const getAuthHeaders = useCallback((token = session.current.token) => {
    const normalized = String(token || '').trim()
    if (!normalized || normalized === COOKIE_SESSION_TOKEN) return {}
    return { Authorization: `Bearer ${normalized}` }
  }, [])

  const resetAuthState = useCallback(({ errorMessage = null, noticeMessage = null } = {}) => {
    requestController.current?.abort()
    authSubmitBusy.current = false
    session.current = { token: '', user: null, expiresAt: 0 }
    setAuthSessionRevision((revision) => revision + 1)
    setAuthToken('')
    setAuthUser(null)
    setUsage(null)
    setSessionExpiresAtMs(0)
    setSessionNowMs(Date.now())
    setAuthInitializing(false)
    setAuthRetryAvailable(false)
    setAuthLoading(false)
    setSocialLoading('')
    setAuthPassword('')
    setAuthPasswordConfirm('')
    callbacks.current.onResetState?.()
    callbacks.current.setError(errorMessage)
    callbacks.current.setNotice(noticeMessage)
  }, [])

  const applySessionData = useCallback((data, { noticeMessage = null } = {}) => {
    const expiresAt = normalizeExpiryMs(data?.session_expires_at)
    if (!data?.user?.id || !expiresAt || expiresAt <= Date.now()) {
      throw new Error(callbacks.current.messages.sessionExpired)
    }
    session.current = { token: COOKIE_SESSION_TOKEN, user: data.user, expiresAt }
    setAuthSessionRevision((revision) => revision + 1)
    setAuthToken(COOKIE_SESSION_TOKEN)
    setAuthUser(data.user)
    setUsage(mapUsageSnapshot(data?.usage))
    setSessionExpiresAtMs(expiresAt)
    setSessionNowMs(Date.now())
    callbacks.current.onResetState?.()
    callbacks.current.setError(null)
    setAuthRetryAvailable(false)
    if (noticeMessage) {
      callbacks.current.setNotice(noticeMessage)
    }
  }, [])

  const fetchUsage = useCallback(async (token = session.current.token) => {
    const activeSession = session.current
    if (!activeSession.token || !activeSession.user || callbacks.current.authMode === 'reset_password') return null
    if (activeSession.expiresAt <= Date.now()) {
      resetAuthState({ errorMessage: callbacks.current.messages.sessionExpired })
      return null
    }
    const signal = requestController.current?.signal

    try {
      const res = await apiFetch(`${apiUrl}/api/usage`, {
        headers: getAuthHeaders(token),
        signal,
        protectedRequest: true,
      })
      if (res.status === 401) {
        if (session.current === activeSession) resetAuthState({ errorMessage: callbacks.current.messages.sessionExpired })
        return null
      }
      const data = await readResponseData(res, callbacks.current.messages.usageFailed)
      if (signal?.aborted || session.current !== activeSession) return null
      const snapshot = mapUsageSnapshot(data)
      setUsage(snapshot)
      return snapshot
    } catch (error) {
      if (signal?.aborted || session.current !== activeSession) return null
      console.error('Failed to fetch usage', error)
      return null
    }
  }, [apiUrl, getAuthHeaders, readResponseData, resetAuthState])

  const fetchBootstrap = useCallback(async (token = session.current.token, { silentUnauthorized = false, controller = beginAuthRequest() } = {}) => {
    setAuthInitializing(true)
    setAuthRetryAvailable(false)
    try {
      const res = await apiFetch(`${apiUrl}/api/auth/bootstrap?include_usage=false`, {
        headers: getAuthHeaders(token),
        signal: controller.signal,
        timeoutMs: AUTH_TIMEOUT_MS,
      })
      if (res.status === 401 || res.status === 403) {
        resetAuthState({ errorMessage: silentUnauthorized ? null : callbacks.current.messages.sessionExpired })
        return null
      }
      const data = await readResponseData(res, callbacks.current.messages.sessionExpired)
      if (controller.signal.aborted) return null
      applySessionData(data)
      return data
    } catch (error) {
      if (controller.signal.aborted) return null
      console.error('Failed to bootstrap auth state', error)
      resetAuthState({ errorMessage: callbacks.current.messages.connectionDelayed })
      setAuthRetryAvailable(true)
      return null
    } finally {
      if (!controller.signal.aborted) setAuthInitializing(false)
    }
  }, [apiUrl, applySessionData, beginAuthRequest, getAuthHeaders, readResponseData, resetAuthState])

  const establishCookieSession = useCallback(async (token, { noticeMessage, controller } = {}) => {
    const formData = new FormData()
    formData.append('access_token', token)

    const response = await apiFetch(`${apiUrl}/api/auth/session?include_usage=false`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      timeoutMs: AUTH_TIMEOUT_MS,
    })
    const data = await readResponseData(response, callbacks.current.messages.socialSessionError)
    if (controller.signal.aborted) throw abortError()
    applySessionData(data, { noticeMessage })
    return data
  }, [apiUrl, applySessionData, readResponseData])

  useEffect(() => {
    let cancelled = false
    const controller = beginAuthRequest()
    const { messages } = callbacks.current
    setAuthInitializing(true)

    const bootstrapAuth = async () => {
      const oauthParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const queryParams = new URLSearchParams(window.location.search)
      const oauthAccessToken = oauthParams.get('access_token') || queryParams.get('access_token')
      const oauthType = oauthParams.get('type') || queryParams.get('type')
      const oauthError =
        oauthParams.get('error_description') ||
        oauthParams.get('error') ||
        queryParams.get('error_description') ||
        queryParams.get('error')

      if (oauthError) {
        callbacks.current.setError(`${messages.socialFailedPrefix}${oauthError}`)
      }

      if (oauthAccessToken) {
        if (isJwtExpired(oauthAccessToken)) {
          resetAuthState({ errorMessage: messages.sessionExpired })
        } else {
          try {
            const isPasswordRecovery = oauthType === 'recovery'
            if (isPasswordRecovery) setAuthMode('reset_password')
            await establishCookieSession(oauthAccessToken, {
              controller,
              noticeMessage: isPasswordRecovery ? messages.passwordRecoveryReady : messages.socialComplete,
            })
            if (!controller.signal.aborted && isPasswordRecovery) {
              setAuthMode('reset_password')
              setAuthPassword('')
              setAuthPasswordConfirm('')
            }
          } catch (error) {
            if (!cancelled && !controller.signal.aborted) {
              resetAuthState({ errorMessage: error?.message || messages.socialSessionError })
            }
          }
        }
      } else {
        await fetchBootstrap('', { silentUnauthorized: true, controller })
      }

      if (!cancelled && (oauthAccessToken || oauthError)) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
      if (!cancelled && !controller.signal.aborted) setAuthInitializing(false)
    }

    bootstrapAuth()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [beginAuthRequest, establishCookieSession, fetchBootstrap, isJwtExpired, resetAuthState])

  useEffect(() => {
    if (authToken && authUser && !authInitializing && authMode !== 'reset_password') {
      fetchUsage()
    }
  }, [authSessionRevision, authToken, authUser, authInitializing, authMode, fetchUsage])

  useEffect(() => subscribeUnauthorized((url) => {
    if (String(url).startsWith(`${apiUrl}/`) && session.current.token) {
      resetAuthState({ errorMessage: callbacks.current.messages.sessionExpired })
    }
  }), [apiUrl, resetAuthState])

  useEffect(() => () => requestController.current?.abort(), [])

  useEffect(() => {
    if (!authToken || !sessionExpiresAtMs) return undefined
    const checkExpiry = () => {
      const now = Date.now()
      setSessionNowMs(now)
      if (session.current.token && now >= session.current.expiresAt) {
        resetAuthState({ errorMessage: callbacks.current.messages.sessionExpired })
      }
    }
    checkExpiry()
    const intervalId = window.setInterval(checkExpiry, 1000)
    window.addEventListener('focus', checkExpiry)
    document.addEventListener('visibilitychange', checkExpiry)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', checkExpiry)
      document.removeEventListener('visibilitychange', checkExpiry)
    }
  }, [authToken, resetAuthState, sessionExpiresAtMs])

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
    if (authSubmitBusy.current || authLoading || socialLoading) return
    authSubmitBusy.current = true
    const controller = beginAuthRequest()
    setAuthInitializing(false)
    setAuthRetryAvailable(false)
    setError(null)
    setNotice(null)
    setAuthLoading(true)

    try {
      if (authMode === 'recover') {
        if (!authEmail.trim()) {
          throw new Error(messages.recoveryEmailRequired)
        }
        const formData = new FormData()
        formData.append('email', authEmail.trim())
        formData.append('redirect_to', `${window.location.origin}${window.location.pathname || messages.oauthRedirectPath || '/'}`)
        const response = await apiFetch(`${apiUrl}/api/auth/password-reset/request`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          timeoutMs: AUTH_TIMEOUT_MS,
        })
        const data = await readResponseData(response, messages.authFailed)
        if (controller.signal.aborted) return
        setNotice(data.message || messages.passwordResetRequested)
        setAuthMode('login')
        setAuthPassword('')
        setAuthPasswordConfirm('')
        return
      }

      if (authMode === 'reset_password') {
        if (authPassword.length < 8) {
          throw new Error(messages.passwordMin)
        }
        if (authPassword !== authPasswordConfirm) {
          throw new Error(messages.passwordMismatch)
        }
        const formData = new FormData()
        formData.append('new_password', authPassword)
        const response = await apiFetch(`${apiUrl}/api/auth/password-reset/confirm?include_usage=false`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
          signal: controller.signal,
          timeoutMs: AUTH_TIMEOUT_MS,
          protectedRequest: true,
        })
        const data = await readResponseData(response, messages.resetSessionExpired)
        if (controller.signal.aborted) return
        applySessionData(data, { noticeMessage: data.message || messages.passwordResetDone })
        setAuthMode('login')
        setAuthPassword('')
        setAuthPasswordConfirm('')
        return
      }

      const formData = new FormData()
      formData.append('email', authEmail.trim())
      formData.append('password', authPassword)
      if (authMode === 'signup') {
        formData.append('full_name', authName.trim())
      }

      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      setNotice(messages.preparingLogin)
      await waitForAuthServer(apiUrl, { signal: controller.signal })
      if (controller.signal.aborted) return
      setNotice(messages.verifyingLogin)
      const data = await apiFetch(`${apiUrl}${endpoint}?include_usage=false`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        timeoutMs: LOGIN_TIMEOUT_MS,
        readResponse: response => readResponseData(response, messages.authFailed),
      })
      if (controller.signal.aborted) return

      if (data.session_established) {
        applySessionData(data, {
          noticeMessage: authMode === 'signup' ? messages.signupDone : messages.loginDone,
        })
      } else {
        setNotice(data.message || messages.signupPending)
      }

      setAuthPassword('')
      setAuthPasswordConfirm('')
      if (authMode === 'signup') {
        setAuthMode('login')
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setNotice(null)
      setError(error?.name === 'TimeoutError' ? messages.connectionDelayed : error?.message || messages.authError)
    } finally {
      if (requestController.current === controller) authSubmitBusy.current = false
      if (!controller.signal.aborted) setAuthLoading(false)
    }
  }, [
    apiUrl,
    applySessionData,
    authInitializing,
    authLoading,
    socialLoading,
    beginAuthRequest,
    authEmail,
    authMode,
    authName,
    authPassword,
    authPasswordConfirm,
    getAuthHeaders,
    messages.authError,
    messages.authFailed,
    messages.loginDone,
    messages.preparingLogin,
    messages.verifyingLogin,
    messages.connectionDelayed,
    messages.oauthRedirectPath,
    messages.passwordMismatch,
    messages.passwordMin,
    messages.passwordResetDone,
    messages.passwordResetRequested,
    messages.recoveryEmailRequired,
    messages.resetSessionExpired,
    messages.signupDone,
    messages.signupPending,
    readResponseData,
    setError,
    setNotice,
  ])

  const handleSocialLogin = useCallback(async (provider) => {
    if (authLoading || socialLoading) return
    const controller = beginAuthRequest()
    setAuthInitializing(false)
    setAuthRetryAvailable(false)
    setError(null)
    setNotice(null)
    setSocialLoading(provider)

    try {
      const redirectTo = `${window.location.origin}${messages.oauthRedirectPath || window.location.pathname}`
      const response = await apiFetch(
        `${apiUrl}/api/auth/oauth-url?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`,
        { signal: controller.signal, timeoutMs: AUTH_TIMEOUT_MS }
      )
      const data = await readResponseData(response, messages.socialUrlFailed)
      if (controller.signal.aborted) return
      window.location.href = data.auth_url
    } catch (error) {
      if (controller.signal.aborted) return
      setError(error?.message || messages.socialError)
      setSocialLoading('')
    }
  }, [apiUrl, authLoading, beginAuthRequest, messages.oauthRedirectPath, messages.socialError, messages.socialUrlFailed, readResponseData, setError, setNotice, socialLoading])

  const handleLogout = useCallback(async () => {
    const headers = getAuthHeaders()
    resetAuthState({ noticeMessage: messages.loggedOut })
    try {
      await apiFetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        headers,
      })
    } catch (error) {
      console.error('Failed to clear auth cookie', error)
    }
  }, [apiUrl, getAuthHeaders, messages.loggedOut, resetAuthState])

  return {
    authRetryAvailable,
    retryAuth: () => fetchBootstrap('', { silentUnauthorized: true }),
    authMode,
    setAuthMode,
    authName,
    setAuthName,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authPasswordConfirm,
    setAuthPasswordConfirm,
    authLoading,
    authInitializing,
    socialLoading,
    authSessionRevision,
    authToken,
    authUser,
    usage,
    setUsage,
    sessionRemainingLabel,
    getAuthHeaders,
    fetchUsage,
    fetchBootstrap,
    resetAuthState,
    handleAuthSubmit,
    handleSocialLogin,
    handleLogout,
    authUserFallbackLabel: messages.loggedInUserFallback,
  }
}
