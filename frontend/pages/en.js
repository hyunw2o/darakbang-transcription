import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Mallog24Logo from '../components/Mallog24Logo'

const UI_THEME_OPTIONS = [
  { key: 'auto', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]
const FREE_MONTHLY_LIMIT_SECONDS = 10800
const UPGRADE_CONTACT_URL = '/pricing-en'
const QUOTA_TOAST_MS = 2600

const formatSecondsToHourMinute = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const getAudioDurationSecondsInBrowser = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.src = objectUrl

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
      audio.removeAttribute('src')
    }

    audio.onloadedmetadata = () => {
      const duration = Number(audio.duration)
      cleanup()
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Unable to read audio duration in browser.'))
        return
      }
      resolve(Math.max(1, Math.ceil(duration)))
    }

    audio.onerror = () => {
      cleanup()
      reject(new Error('Unable to read audio duration in browser.'))
    }
  })

function HeaderMenuControls({ darkMode, setDarkMode, uiTheme, setUiTheme, uiThemeMode, setUiThemeMode, locale = 'en' }) {
  const menuRef = useRef(null)
  const [openMenu, setOpenMenu] = useState('')

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleThemeSelect = (themeKey) => {
    if (themeKey === 'auto') {
      setUiThemeMode('auto')
    } else if (themeKey === 'light') {
      setUiThemeMode('manual')
      setUiTheme('aurora')
      setDarkMode(false)
    } else {
      setUiThemeMode('manual')
      setUiTheme('noir')
      setDarkMode(true)
    }
    setOpenMenu('')
  }

  return (
    <div ref={menuRef} className="relative flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          className="nm-icon-btn"
          aria-label="Language"
          onClick={() => setOpenMenu(openMenu === 'lang' ? '' : 'lang')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" />
          </svg>
        </button>
        {openMenu === 'lang' && (
          <div className="nm-menu left-0 w-24">
            <Link
              href="/"
              onClick={() => setOpenMenu('')}
              className={`nm-menu-item ${locale === 'kr' ? 'active' : ''}`}
            >
              KR
            </Link>
            <Link
              href="/en"
              onClick={() => setOpenMenu('')}
              className={`nm-menu-item ${locale === 'en' ? 'active' : ''}`}
            >
              EN
            </Link>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          className="nm-icon-btn"
          aria-label="Theme"
          onClick={() => setOpenMenu(openMenu === 'theme' ? '' : 'theme')}
        >
          {darkMode ? (
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-nm-text-secondary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8 8 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
        {openMenu === 'theme' && (
          <div className="nm-menu right-0 w-40">
            {UI_THEME_OPTIONS.map((theme) => (
              <button
                key={theme.key}
                type="button"
                onClick={() => handleThemeSelect(theme.key)}
                className={`nm-menu-item ${theme.key === 'auto'
                  ? uiThemeMode === 'auto' ? 'active' : ''
                  : theme.key === 'light'
                    ? uiThemeMode === 'manual' && uiTheme === 'aurora' ? 'active' : ''
                    : uiThemeMode === 'manual' && uiTheme === 'noir' ? 'active' : ''}`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StepIndicator({ currentStep }) {
  const steps = [
    { label: 'Upload', num: 1 },
    { label: 'STT', num: 2 },
    { label: 'Refine', num: 3 },
  ]

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, i) => {
        const isCompleted = currentStep > step.num
        const isActive = currentStep === step.num

        return (
          <div key={i} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
                ${isCompleted ? 'nm-raised bg-green-500 text-white' :
                  isActive ? 'nm-raised bg-nm-accent text-white animate-pulse-slow' :
                    'nm-concave text-nm-text-secondary'}`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.num}
              </div>
              <span className={`text-[11px] font-medium ${isActive ? 'text-nm-accent' :
                  isCompleted ? 'text-green-600' :
                    'text-nm-text-secondary'
                }`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-14 h-0.5 mb-5 rounded-full transition-all duration-700
                ${currentStep > step.num ? 'bg-green-400' : 'bg-nm-bg shadow-nm-concave'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Home({ darkMode, setDarkMode, uiTheme, setUiTheme, uiThemeMode, setUiThemeMode }) {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('en')
  const [transcriptionType, setTranscriptionType] = useState('sermon')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [history, setHistory] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRecords, setShowRecords] = useState(false)
  const [copied, setCopied] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [usage, setUsage] = useState(null)
  const [fileDurationSeconds, setFileDurationSeconds] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [savedRecords, setSavedRecords] = useState([])
  const [recordDrafts, setRecordDrafts] = useState({})
  const [draftLoadingCategory, setDraftLoadingCategory] = useState('')
  const [savingCategory, setSavingCategory] = useState('')

  const pollInterval = useRef(null)
  const fileInputRef = useRef(null)
  const pollStartTime = useRef(null)
  const toastTimerRef = useRef(null)
  const fileDurationProbeRef = useRef(0)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mallog24.com'
  const OURS_URL = process.env.NEXT_PUBLIC_OURS_URL || 'https://ours-homepage.vercel.app'
  const AUTH_TOKEN_KEY = 'mallog24_access_token'
  const AUTH_TOKEN_EXP_LEEWAY_MS = 30 * 1000
  const WARMUP_TIMEOUT_MS = 4000

  const isJwtExpired = (token) => {
    try {
      const payload = token.split('.')[1]
      if (!payload) return false
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
      const decoded = JSON.parse(window.atob(padded))
      if (!decoded?.exp || typeof decoded.exp !== 'number') return false
      return Date.now() >= (decoded.exp * 1000) - AUTH_TOKEN_EXP_LEEWAY_MS
    } catch {
      return false
    }
  }

  const warmUpBackend = () => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS)
    fetch(`${API_URL}/health`, { signal: controller.signal })
      .catch(() => { })
      .finally(() => window.clearTimeout(timeoutId))
  }

  useEffect(() => {
    warmUpBackend()

    const oauthParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const queryParams = new URLSearchParams(window.location.search)
    const oauthAccessToken = oauthParams.get('access_token') || queryParams.get('access_token')
    const oauthError =
      oauthParams.get('error_description') ||
      oauthParams.get('error') ||
      queryParams.get('error_description') ||
      queryParams.get('error')

    if (oauthAccessToken) {
      if (isJwtExpired(oauthAccessToken)) {
        window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
        setError('Your session has expired. Please sign in again.')
      } else {
        setAuthToken(oauthAccessToken)
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, oauthAccessToken)
        fetchCurrentUser(oauthAccessToken)
        fetchSavedRecords(oauthAccessToken)
        setNotice('Social sign-in completed.')
      }
    } else {
      const savedToken = window.sessionStorage.getItem(AUTH_TOKEN_KEY)
      if (savedToken) {
        if (isJwtExpired(savedToken)) {
          window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
        } else {
          setAuthToken(savedToken)
          fetchCurrentUser(savedToken)
          fetchSavedRecords(savedToken)
        }
      }
    }

    if (oauthError) {
      setError(`Social sign-in failed: ${oauthError}`)
    }
    if (oauthAccessToken || oauthError) {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
    }
    return () => {
      stopPolling()
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const getAuthHeaders = (token = authToken) => {
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }

  const showToast = useCallback((message) => {
    if (!message) return
    setToastMessage(message)
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('')
      toastTimerRef.current = null
    }, QUOTA_TOAST_MS)
  }, [])

  const isFreeTier = (usage?.plan_tier || 'free') === 'free'
  const monthlyLimitSeconds = usage?.monthly_limit_seconds || FREE_MONTHLY_LIMIT_SECONDS
  const remainingQuotaSeconds = isFreeTier
    ? Math.max(0, usage?.remaining_seconds ?? monthlyLimitSeconds)
    : Number.MAX_SAFE_INTEGER
  const fileExceedsRemainingQuota = isFreeTier && fileDurationSeconds > 0 && fileDurationSeconds > remainingQuotaSeconds
  const uploadBlockedByQuota = isFreeTier && remainingQuotaSeconds <= 0

  const fetchHistory = async (token = authToken) => {
    if (!token) {
      setHistory([])
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/history`, {
        headers: getAuthHeaders(token),
      })
      if (!res.ok) throw new Error('Failed to load transcription history.')
      setHistory(await res.json())
    } catch (e) {
      console.error("Failed to fetch history", e)
    }
  }

  const fetchCurrentUser = async (token = authToken) => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: getAuthHeaders(token),
      })
      if (!res.ok) throw new Error('Session expired.')
      const data = await res.json()
      setAuthUser(data.user || null)
      fetchHistory(token)
      fetchUsage(token)
    } catch (e) {
      setAuthToken('')
      setAuthUser(null)
      setUsage(null)
      setSavedRecords([])
      setHistory([])
      setResult(null)
      setRecordDrafts({})
      setShowHistory(false)
      setShowRecords(false)
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
      console.error('Failed to fetch current user', e)
    }
  }

  const fetchUsage = async (token = authToken) => {
    if (!token) {
      setUsage(null)
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/usage`, {
        headers: getAuthHeaders(token),
      })
      if (!res.ok) throw new Error('Failed to load monthly usage.')
      const data = await res.json()
      setUsage({
        plan_tier: data.plan_tier || 'free',
        used_audio_seconds: Number(data.used_audio_seconds) || 0,
        monthly_limit_seconds: Number(data.monthly_limit_seconds) || FREE_MONTHLY_LIMIT_SECONDS,
        remaining_seconds: Number(data.remaining_seconds) || 0,
        usage_percent: Number(data.usage_percent) || 0,
      })
    } catch (e) {
      console.error('Failed to fetch usage', e)
    }
  }

  const fetchSavedRecords = async (token = authToken) => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/records`, {
        headers: getAuthHeaders(token),
      })
      if (!res.ok) throw new Error('Failed to load saved records.')
      const data = await res.json()
      setSavedRecords(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("Failed to fetch saved records", e)
    }
  }

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current)
      pollInterval.current = null
    }
  }

  const validateAndSetFile = async (selectedFile) => {
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('File size must be 100MB or less.')
      return
    }

    const probeId = fileDurationProbeRef.current + 1
    fileDurationProbeRef.current = probeId

    try {
      const durationSeconds = await getAudioDurationSecondsInBrowser(selectedFile)
      if (fileDurationProbeRef.current !== probeId) return

      if (isFreeTier && durationSeconds > remainingQuotaSeconds) {
        setFile(null)
        setFileDurationSeconds(0)
        setError('This file exceeds your remaining free allowance.')
        setNotice(null)
        showToast('This file exceeds your remaining free allowance.')
        return
      }

      setFile(selectedFile)
      setFileDurationSeconds(durationSeconds)
      setError(null)
      setNotice(null)
      setResult(null)
      setRecordDrafts({})
    } catch {
      if (fileDurationProbeRef.current !== probeId) return
      setFile(selectedFile)
      setFileDurationSeconds(0)
      setError('Could not read duration in browser. The server will re-check before processing.')
      setNotice(null)
      setResult(null)
      setRecordDrafts({})
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }, [isFreeTier, remainingQuotaSeconds, showToast])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const startPolling = (taskId) => {
    stopPolling()
    pollStartTime.current = Date.now()
    setCurrentStep(1)

    pollInterval.current = setInterval(async () => {
      try {
        const elapsed = Date.now() - pollStartTime.current
        if (elapsed > 3000) setCurrentStep(prev => Math.max(prev, 2))

        const res = await fetch(`${API_URL}/api/status/${taskId}`, {
          headers: getAuthHeaders(),
        })
        if (!res.ok) return

        const data = await res.json()

        if (data.status === 'completed') {
          stopPolling()
          setCurrentStep(3)
          setTimeout(() => {
            setResult(data)
            setLoading(false)
            setCurrentStep(0)
            fetchHistory()
            fetchUsage()
          }, 800)
        } else if (data.status === 'error') {
          stopPolling()
          setError(data.error || 'An error occurred during transcription.')
          setLoading(false)
          setCurrentStep(0)
        } else if (data.status === 'processing') {
          setCurrentStep(3)
        }
      } catch (e) {
        console.error("Polling error", e)
      }
    }, 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!authToken) {
      setError('Sign in is required before transcription.')
      return
    }
    if (!file) {
      setError('Please select an audio file.')
      return
    }
    if (uploadBlockedByQuota || fileExceedsRemainingQuota) {
      setError('This file exceeds your remaining free allowance.')
      showToast('This file exceeds your remaining free allowance.')
      return
    }

    setLoading(true)
    setError(null)
    setNotice(null)
    setResult(null)
    setRecordDrafts({})
    setCurrentStep(1)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', language)
      formData.append('correct', 'true')
      formData.append('transcription_type', transcriptionType)

      const response = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Transcription failed.')
      }

      const data = await response.json()

      if (data.status === 'queued') {
        setCurrentStep(2)
        startPolling(data.task_id)
      } else {
        setResult(data)
        setLoading(false)
        setCurrentStep(0)
      }
    } catch (err) {
      setError(err.message || 'An error occurred.')
      setLoading(false)
      setCurrentStep(0)
    }
  }

  const handleLoadHistory = async (taskId) => {
    setLoading(true)
    setError(null)
    setNotice(null)
    setResult(null)
    setRecordDrafts({})
    window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      const res = await fetch(`${API_URL}/api/status/${taskId}`, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.status === 'completed') {
        setResult(data)
      } else {
        setError('Unable to load this record.')
      }
    } catch (e) {
      setError('Failed to load record.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
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
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed.')
      }

      if (data.access_token) {
        setAuthToken(data.access_token)
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
        setAuthUser(data.user || null)
        fetchSavedRecords(data.access_token)
        fetchHistory(data.access_token)
        fetchUsage(data.access_token)
        setNotice(authMode === 'signup' ? 'Sign-up and login completed.' : 'Logged in successfully.')
      } else {
        setNotice(data.message || 'Sign-up completed. Please verify your email and log in.')
      }

      setAuthPassword('')
      if (authMode === 'signup') setAuthMode('login')
    } catch (err) {
      setError(err.message || 'Authentication error.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSocialLogin = async (provider) => {
    if (socialLoading) return
    setError(null)
    setNotice(null)
    setSocialLoading(provider)

    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`
      const response = await fetch(
        `${API_URL}/api/auth/oauth-url?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to get social sign-in URL.')
      }
      window.location.href = data.auth_url
    } catch (err) {
      setError(err.message || 'Social sign-in error.')
      setSocialLoading('')
    }
  }

  const handleLogout = () => {
    setAuthToken('')
    setAuthUser(null)
    setUsage(null)
    setSavedRecords([])
    setHistory([])
    setResult(null)
    setFile(null)
    setFileDurationSeconds(0)
    setRecordDrafts({})
    setShowHistory(false)
    setShowRecords(false)
    setError(null)
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
    setNotice('You have been logged out.')
  }

  const exportAsTxt = () => {
    if (!result) return
    const text = result.corrected_text || result.raw_text
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAsWord = () => {
    if (!result) return
    const text = result.corrected_text || result.raw_text
    const lines = text.split('\n')
    const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치',
      'Main Body', 'Conclusion', 'Prayer', 'Summary', 'Key Points', 'Agenda Items', 'Decisions', 'Action Items']
    let html = ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (sectionHeaders.includes(trimmed)) {
        html += `<h2>${trimmed}</h2>`
      } else if (trimmed === '') {
        html += '<br/>'
      } else {
        const speakerMatch = trimmed.match(/^(화자\s*(?:[A-Z]|\d+)(?:\s*\([^)]*\))?|참석자\s*\d+(?:\s*\([^)]*\))?|Speaker\s*(?:[A-Z]|\d+)(?:\s*\([^)]*\))?|Participant\s*\d+(?:\s*\([^)]*\))?)\s*[:：]/)
        if (speakerMatch) {
          html += `<p><b>${speakerMatch[1]}:</b> ${trimmed.slice(speakerMatch[0].length).trim()}</p>`
        } else {
          html += `<p>${trimmed}</p>`
        }
      }
    }
    const docContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>
        body { font-family: 'Segoe UI', sans-serif; font-size: 11pt; line-height: 1.8; }
        h2 { font-size: 14pt; color: #1a365d; border-bottom: 1px solid #3182ce; padding-bottom: 4px; margin-top: 20px; }
        p { margin: 6px 0; }
      </style></head>
      <body>${html}</body></html>`
    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript_${new Date().toISOString().slice(0, 10)}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSummarize = async () => {
    if (!result?.corrected_text && !result?.raw_text) return
    if (!authToken) {
      setError('Please log in to generate summaries.')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const formData = new FormData()
      formData.append('text', result.corrected_text || result.raw_text)
      formData.append('summary_type', 'short')

      const response = await fetch(`${API_URL}/api/summarize`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await response.json()
      setResult({ ...result, summary: data.summary })
    } catch (err) {
      setError('Summary generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRecordDraft = async (category) => {
    if (!result?.corrected_text && !result?.raw_text) return
    if (!authToken) {
      setError('Please log in to generate record drafts.')
      return
    }
    setError(null)
    setNotice(null)
    setDraftLoadingCategory(category)
    try {
      const formData = new FormData()
      formData.append('text', result.corrected_text || result.raw_text)
      formData.append('category', category)
      formData.append('language', language)

      const response = await fetch(`${API_URL}/api/records/draft`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to generate record draft.')
      }

      setRecordDrafts((prev) => ({ ...prev, [category]: data.content || '' }))
      setNotice(`${data.category_label || 'Record'} draft generated.`)
    } catch (err) {
      setError(err.message || 'Failed to generate record draft.')
    } finally {
      setDraftLoadingCategory('')
    }
  }

  const handleRecordDraftChange = (category, value) => {
    setRecordDrafts((prev) => ({ ...prev, [category]: value }))
  }

  const handleSaveRecord = async (category) => {
    if (!authToken) {
      setError('Please log in to save records.')
      return
    }

    const content = (recordDrafts[category] || '').trim()
    if (!content) {
      setError('Record content is empty.')
      return
    }

    setError(null)
    setNotice(null)
    setSavingCategory(category)

    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('title', recordTypeLabels[category] || category)
      formData.append('content', content)
      formData.append('task_id', result?.task_id || '')
      formData.append('source_type', result?.transcription_type || '')

      const response = await fetch(`${API_URL}/api/records`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save record.')
      }

      setNotice('Record saved separately.')
      fetchSavedRecords()
      setShowRecords(true)
    } catch (err) {
      setError(err.message || 'Failed to save record.')
    } finally {
      setSavingCategory('')
    }
  }

  const typeLabels = { sermon: 'Sermon Transcript', phonecall: 'Call Record', conversation: 'Meeting/Conversation Record' }
  const transcriptionTypeHints = {
    sermon: 'Structured by sermon flow (Main Body / Conclusion / Prayer) with stronger homophone correction (e.g., 3oneul/samoneul and forum-bang/forum-mang).',
    phonecall: 'Separates call speakers (A/B), reinforces clinical wording, and improves homophone correction (e.g., 3oneul/samoneul and forum-bang/forum-mang).',
    conversation: 'Separates meeting participants, structures agenda/decisions/actions, and improves homophone correction (e.g., 3oneul/samoneul and forum-bang/forum-mang).',
  }
  const recordTypeLabels = {
    meeting_keywords: 'Meeting Keywords',
    clinical_notes: 'Clinical Notes',
    sermon_core_summary: 'Sermon Core Summary',
  }
  const recordCategories = [
    { key: 'meeting_keywords', label: 'Meeting Keywords' },
    { key: 'clinical_notes', label: 'Clinical Notes' },
    { key: 'sermon_core_summary', label: 'Sermon Core Summary' },
  ]
  const socialProviders = [
    { key: 'google', label: 'Continue with Google', icon: 'G', iconClass: 'bg-white text-slate-700' },
    { key: 'kakao', label: 'Continue with Kakao', icon: 'K', iconClass: 'bg-yellow-300 text-slate-900' },
  ]
  const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치',
    'Main Body', 'Conclusion', 'Prayer', 'Summary', 'Key Points', 'Agenda Items', 'Decisions', 'Action Items']

  return (
    <div className="min-h-screen pb-12">
      <Head>
        <title>mallog24 - AI Speech to Text</title>
      </Head>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-nm-bg shadow-nm-flat">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <a
              href={OURS_URL}
              className="text-xs font-semibold text-nm-text-secondary hover:text-nm-accent transition-colors"
            >
              OURS
            </a>
            <span className="text-nm-text-secondary">/</span>
            <Mallog24Logo className="h-[18px] w-auto shrink-0" />
          </div>
          <HeaderMenuControls
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            uiTheme={uiTheme}
            setUiTheme={setUiTheme}
            uiThemeMode={uiThemeMode}
            setUiThemeMode={setUiThemeMode}
            locale="en"
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6">
        {/* Auth Card */}
        <div className="nm-raised p-5 sm:p-6 mb-5 animate-nm-card-in">
          {!authToken ? (
            <>
              <div className="mb-4">
                <p className="text-base font-bold text-nm-text-primary">Start AI speech notes in seconds.</p>
                <p className="mt-1 text-xs text-nm-text-secondary">Sign in once and upload your first file right away.</p>
                <div className="nm-segment-group mt-3">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`nm-segment-item px-3 py-1 text-xs font-semibold ${authMode === 'login' ? 'active' : ''
                      }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className={`nm-segment-item px-3 py-1 text-xs font-semibold ${authMode === 'signup' ? 'active' : ''
                      }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {authMode === 'signup' && (
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Name"
                    className="w-full nm-input"
                  />
                )}
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="w-full nm-input"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password (8+ chars)"
                  required
                  minLength={8}
                  className="w-full nm-input"
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full nm-btn-primary py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {authLoading
                    ? 'Processing...'
                    : authMode === 'signup'
                      ? 'Create Account'
                      : 'Login'}
                </button>
              </form>
              <div className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {socialProviders.map((provider) => (
                    <button
                      key={provider.key}
                      type="button"
                      onClick={() => handleSocialLogin(provider.key)}
                      disabled={authLoading || Boolean(socialLoading)}
                      className="nm-btn w-full h-11 px-3 text-sm font-semibold text-nm-text-primary disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      <span className={`w-5 h-5 rounded-full text-[11px] font-bold inline-flex items-center justify-center ${provider.iconClass}`}>
                        {provider.icon}
                      </span>
                      {socialLoading === provider.key ? 'Redirecting...' : provider.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <div className="mt-4 nm-concave p-3.5 border-l-[3px] border-l-red-500 animate-slide-up">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {notice && (
                <div className="mt-4 nm-concave p-3.5 border-l-[3px] border-l-blue-500 animate-slide-up">
                  <p className="text-sm text-nm-accent">{notice}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs text-nm-text-secondary">Signed in as</p>
                <p className="text-sm font-semibold text-nm-text-primary">
                  {authUser?.email || 'Authenticated user'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="nm-btn inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-nm-text-secondary"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {authToken && (
          <>
            {usage && (
              <div className="nm-raised p-4 sm:p-5 mb-5 animate-nm-card-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs text-nm-text-secondary">This month usage</p>
                    <p className="text-sm font-semibold text-nm-text-primary">
                      {isFreeTier
                        ? `${formatSecondsToHourMinute(usage.used_audio_seconds)} / ${formatSecondsToHourMinute(monthlyLimitSeconds)}`
                        : `${formatSecondsToHourMinute(usage.used_audio_seconds)} / Unlimited`}
                    </p>
                    {isFreeTier && (
                      <p className="text-[11px] text-nm-text-secondary mt-1">
                        Remaining: {formatSecondsToHourMinute(remainingQuotaSeconds)}
                      </p>
                    )}
                  </div>
                  <a
                    href={UPGRADE_CONTACT_URL}
                    className="nm-btn-primary inline-flex items-center justify-center px-4 py-2 text-xs font-semibold"
                  >
                    Upgrade Subscription
                  </a>
                </div>
                {isFreeTier && (
                  <div className="mt-3 h-2 rounded-full nm-concave overflow-hidden">
                    <div
                      className="h-full rounded-full bg-nm-accent transition-all duration-500"
                      style={{ width: `${Math.min(100, usage.usage_percent || 0)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="nm-flat mb-5 p-4 animate-nm-card-in">
              <p className="text-xs sm:text-sm text-nm-accent font-medium">
                mallog24 recommends the use of officially distributed audio files. Please be advised that mallog24 assumes no legal liability for any consequences arising from unauthorized or improper use if discovered by third parties.
              </p>
            </div>
            {/* 업로드 카드 */}
            <div className="nm-raised p-5 sm:p-6 mb-5 animate-nm-card-in">
              <form onSubmit={handleSubmit}>

                {/* 드래그 앤 드롭 영역 */}
                <div
                  className={`relative p-8 sm:p-10 text-center cursor-pointer transition-all duration-300
                ${uploadBlockedByQuota ? 'opacity-60 cursor-not-allowed nm-concave' :
                      dragOver ? 'nm-concave ring-2 ring-nm-accent scale-[1.01]' :
                        file ? 'nm-raised' : 'nm-concave'}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => {
                    if (uploadBlockedByQuota) {
                      showToast('You already used this month\'s free 3-hour quota. Please upgrade your plan.')
                      return
                    }
                    fileInputRef.current?.click()
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {file ? (
                    <div className="space-y-2">
                      <div className="w-11 h-11 mx-auto rounded-full nm-raised bg-green-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-nm-text-primary">{file.name}</p>
                      <p className="text-xs text-nm-text-secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      {fileDurationSeconds > 0 && (
                        <p className="text-xs text-nm-text-secondary">Duration: {formatSecondsToHourMinute(fileDurationSeconds)}</p>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                          setFileDurationSeconds(0)
                        }}
                        className="text-xs text-red-500 hover:text-red-600 font-medium mt-1"
                      >
                        Change File
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-11 h-11 mx-auto rounded-full nm-concave flex items-center justify-center">
                        <svg className="w-5 h-5 text-nm-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-sm text-nm-text-secondary">
                        Drag & drop your file, or <span className="text-nm-accent font-medium">click</span> to browse
                      </p>
                      <p className="text-xs text-nm-text-secondary">MP3, WAV, M4A, OGG, FLAC (up to 100MB)</p>
                    </div>
                  )}
                </div>

                {/* 설정 */}
                <div className="mt-4 flex gap-3">
                  <div className="flex-1 relative">
                    <label className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="ko">Korean</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="flex-1 relative">
                    <label className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">Type</label>
                    <select
                      value={transcriptionType}
                      onChange={(e) => setTranscriptionType(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="sermon">Sermon Transcript</option>
                      <option value="phonecall">Call Record</option>
                      <option value="conversation">Meeting/Conversation Record</option>
                    </select>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-nm-text-secondary">
                  {transcriptionTypeHints[transcriptionType]}
                </p>
                {fileExceedsRemainingQuota && (
                  <p className="mt-2 text-[12px] text-red-600 font-medium">
                    This file exceeds your remaining free allowance.
                  </p>
                )}

                {/* 변환 버튼 */}
                <button
                  type="submit"
                  disabled={loading || !file || !authToken || uploadBlockedByQuota || fileExceedsRemainingQuota}
                  className="w-full mt-5 nm-btn-primary py-3.5 font-semibold text-sm
                disabled:opacity-50 disabled:cursor-not-allowed
                active:scale-[0.98]"
                >
                  {loading
                    ? 'Transcribing...'
                    : uploadBlockedByQuota
                      ? 'Free quota exceeded (Upgrade required)'
                      : fileExceedsRemainingQuota
                        ? 'Exceeds remaining allowance'
                        : authToken
                          ? 'Start Transcription'
                          : 'Sign In to Transcribe'}
                </button>
              </form>

              {/* 에러 메시지 */}
              {error && (
                <div className="mt-4 nm-concave p-3.5 border-l-[3px] border-l-red-500 animate-slide-up">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {notice && (
                <div className="mt-4 nm-concave p-3.5 border-l-[3px] border-l-blue-500 animate-slide-up">
                  <p className="text-sm text-nm-accent">{notice}</p>
                </div>
              )}
            </div>

            {/* 진행률 표시 */}
            {loading && currentStep > 0 && (
              <div className="nm-raised p-6 mb-5 animate-slide-up animate-nm-card-in">
                <StepIndicator currentStep={currentStep} />
                <div className="h-1 nm-concave rounded-full overflow-hidden mt-5">
                  <div
                    className="h-full bg-nm-accent rounded-full transition-all duration-1000 ease-out"
                    style={{ width: currentStep === 1 ? '20%' : currentStep === 2 ? '55%' : '85%' }}
                  />
                </div>
                <p className="text-center text-xs text-nm-text-secondary mt-3">
                  {currentStep === 1 && 'Uploading file...'}
                  {currentStep === 2 && 'AI is recognizing speech...'}
                  {currentStep === 3 && 'Refining and structuring text...'}
                </p>
              </div>
            )}

            {/* 결과 영역 */}
            {result && (
              <div className="space-y-4 animate-slide-up">

                {/* 결과 헤더 + 텍스트 */}
                <div className="nm-raised p-5 sm:p-6 animate-nm-card-in">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-nm-text-primary">Transcription Result</h2>
                      {result.transcription_type && result.transcription_type !== 'sermon' && (
                        <span className="nm-flat px-2 py-0.5 text-[11px] font-medium text-nm-accent">
                          {typeLabels[result.transcription_type] || result.transcription_type}
                        </span>
                      )}
                    </div>
                    <span className="nm-flat px-2.5 py-1 text-green-600 text-[11px] font-medium">
                      {result.characters?.toLocaleString()} chars
                    </span>
                  </div>

                  <div className="nm-concave p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
                    <div className="text-[13px] leading-7 text-nm-text-primary">
                      {(result.corrected_text || result.raw_text)
                        .split('\n')
                        .map((line, i) => {
                          const trimmed = line.trim()
                          if (sectionHeaders.includes(trimmed)) {
                            return (
                              <div key={i} className="text-sm font-bold text-nm-accent border-b border-nm-accent/20 pb-1 mt-7 mb-3">
                                {trimmed}
                              </div>
                            )
                          }
                          const speakerMatch = trimmed.match(/^(화자\s*(?:[A-Z]|\d+)(?:\s*\([^)]*\))?|참석자\s*\d+(?:\s*\([^)]*\))?|Speaker\s*(?:[A-Z]|\d+)(?:\s*\([^)]*\))?|Participant\s*\d+(?:\s*\([^)]*\))?)\s*[:：]/)
                          if (speakerMatch) {
                            return (
                              <p key={i} className="mb-1.5">
                                <span className="nm-flat inline-block px-2 py-0.5 mr-1.5 text-[11px] font-semibold text-nm-accent">
                                  {speakerMatch[1]}
                                </span>
                                {trimmed.slice(speakerMatch[0].length).trim()}
                              </p>
                            )
                          }
                          if (trimmed === '') return <br key={i} />
                          return <p key={i} className="mb-1.5">{line}</p>
                        })
                      }
                    </div>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => copyToClipboard(result.corrected_text || result.raw_text, 'text')}
                      className="action-btn"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copied === 'text' ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={exportAsTxt} className="action-btn">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      TXT
                    </button>
                    <button onClick={exportAsWord} className="action-btn">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Word
                    </button>
                  </div>
                </div>

                {/* 요약 섹션 (설교 녹취만) */}
                {(result.transcription_type || 'sermon') === 'sermon' && (
                  !result.summary ? (
                    <button
                      onClick={handleSummarize}
                      disabled={loading}
                      className="w-full nm-btn p-4 text-sm font-medium text-nm-accent
                    disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Generating summary...' : 'Generate Bulletin Summary'}
                    </button>
                  ) : (
                    <div className="nm-raised p-5 sm:p-6 animate-nm-card-in">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-nm-text-primary">Bulletin Summary</h3>
                        <button
                          onClick={() => copyToClipboard(result.summary, 'summary')}
                          className="text-xs text-nm-accent hover:opacity-80 font-medium"
                        >
                          {copied === 'summary' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="nm-concave p-4">
                        <p className="whitespace-pre-wrap text-[13px] text-nm-text-primary leading-relaxed">
                          {result.summary}
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Record Drafts / Save */}
                <div className="nm-raised p-5 sm:p-6 animate-nm-card-in">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-nm-text-primary">Structured Record Notes</h3>
                    <span className="text-[11px] text-nm-text-secondary">
                      Meeting / Clinical / Sermon
                    </span>
                  </div>
                  <p className="text-xs text-nm-text-secondary mb-4">
                    Generate a structured note from the transcript and save it as a separate record under your account.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {recordCategories.map((recordCategory) => (
                      <button
                        key={recordCategory.key}
                        type="button"
                        onClick={() => handleGenerateRecordDraft(recordCategory.key)}
                        disabled={draftLoadingCategory === recordCategory.key}
                        className="action-btn"
                      >
                        {draftLoadingCategory === recordCategory.key ? 'Generating...' : recordCategory.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-3">
                    {recordCategories.map((recordCategory) => (
                      recordDrafts[recordCategory.key] ? (
                        <div key={recordCategory.key} className="nm-concave p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-nm-text-primary">
                              {recordCategory.label}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleSaveRecord(recordCategory.key)}
                              disabled={savingCategory === recordCategory.key}
                              className="nm-btn-primary text-[11px] px-2.5 py-1 disabled:opacity-50"
                            >
                              {savingCategory === recordCategory.key ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                          <textarea
                            value={recordDrafts[recordCategory.key]}
                            onChange={(e) => handleRecordDraftChange(recordCategory.key, e.target.value)}
                            rows={6}
                            className="nm-input w-full text-xs leading-relaxed"
                          />
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>

                {/* 원본 텍스트 */}
                {result.corrected_text && (
                  <details className="nm-raised overflow-hidden">
                    <summary className="p-4 cursor-pointer text-sm text-nm-text-secondary hover:text-nm-text-primary font-medium select-none transition-colors">
                      View Raw Text
                    </summary>
                    <div className="px-5 pb-5">
                      <div className="nm-concave p-4">
                        <p className="whitespace-pre-wrap text-xs text-nm-text-secondary leading-relaxed">
                          {result.raw_text}
                        </p>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* 히스토리 */}
            {history.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-sm font-medium text-nm-text-secondary hover:text-nm-text-primary mb-3 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistory ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Recent Transcriptions ({history.length})
                </button>

                {showHistory && (
                  <div className="nm-raised overflow-hidden animate-slide-up">
                    <ul className="divide-y divide-nm-text-secondary/10">
                      {history.map((item) => (
                        <li key={item.task_id}>
                          <button
                            onClick={() => handleLoadHistory(item.task_id)}
                            className="w-full text-left p-4 hover:bg-nm-bg/50 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.status === 'completed' ? 'bg-green-500' :
                                      item.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                                    }`} />
                                  <span className="text-[11px] text-nm-text-secondary">
                                    {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {item.transcription_type && item.transcription_type !== 'sermon' && (
                                    <span className="nm-flat px-2 py-0.5 text-[11px] text-nm-text-secondary font-medium">
                                      {item.transcription_type === 'phonecall' ? 'Call' : 'Meeting'}
                                    </span>
                                  )}
                                  {item.characters > 0 && (
                                    <span className="text-[11px] text-nm-text-secondary">
                                      {item.characters?.toLocaleString()} chars
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-nm-text-primary truncate group-hover:text-nm-accent transition-colors">
                                  {item.summary_preview || "No content"}
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-nm-text-secondary group-hover:text-nm-accent shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Saved Record Notes */}
            {authToken && (
              <div className="mt-8">
                <button
                  onClick={() => setShowRecords(!showRecords)}
                  className="flex items-center gap-2 text-sm font-medium text-nm-text-secondary hover:text-nm-text-primary mb-3 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showRecords ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  My Saved Records ({savedRecords.length})
                </button>

                {showRecords && (
                  <div className="nm-raised overflow-hidden animate-slide-up">
                    {savedRecords.length === 0 ? (
                      <p className="text-sm text-nm-text-secondary p-4">No saved records yet.</p>
                    ) : (
                      <ul className="divide-y divide-nm-text-secondary/10">
                        {savedRecords.map((item) => (
                          <li key={item.id} className="p-4">
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <p className="text-sm font-semibold text-nm-text-primary">
                                {recordTypeLabels[item.category] || item.title || item.category}
                              </p>
                              <span className="text-[11px] text-nm-text-secondary">
                                {item.created_at
                                  ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            </div>
                            <p className="text-xs text-nm-text-secondary whitespace-pre-wrap leading-relaxed">
                              {item.content}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 푸터 */}
        <footer className="mt-12 text-center">
          <p className="text-[11px] text-nm-text-secondary">
            mallog24 &middot; Copyright 2026. OURS All rights reserved.
          </p>
        </footer>
      </main>
      {toastMessage && (
        <div className="fixed top-16 right-4 z-[70] max-w-xs nm-raised px-4 py-3 border-l-4 border-amber-500">
          <p className="text-xs text-nm-text-primary">{toastMessage}</p>
        </div>
      )}
    </div>
  )
}
