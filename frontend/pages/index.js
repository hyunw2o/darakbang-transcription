import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Mallog24Logo from '../components/Mallog24Logo'

const UI_THEME_OPTIONS = [
  { key: 'auto', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]
const FREE_MONTHLY_LIMIT_SECONDS = 36000
const UPGRADE_CONTACT_URL = '/pricing'
const QUOTA_TOAST_MS = 2600

const formatSecondsToHourMinute = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return `${hours}시간 ${minutes}분`
}

const getAudioDurationSecondsInBrowser = async (file) => {
  const fromMetadata = () =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.src = objectUrl

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl)
        audio.removeAttribute('src')
      }

      const timeoutId = window.setTimeout(() => {
        cleanup()
        reject(new Error('metadata-timeout'))
      }, 6000)

      audio.onloadedmetadata = () => {
        window.clearTimeout(timeoutId)
        const duration = Number(audio.duration)
        cleanup()
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error('invalid-metadata-duration'))
          return
        }
        resolve(Math.max(1, Math.ceil(duration)))
      }

      audio.onerror = () => {
        window.clearTimeout(timeoutId)
        cleanup()
        reject(new Error('metadata-error'))
      }
    })

  const fromDecode = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      throw new Error('audio-context-unavailable')
    }

    const audioContext = new AudioContextClass()
    try {
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      const duration = Number(decoded.duration)
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error('invalid-decoded-duration')
      }
      return Math.max(1, Math.ceil(duration))
    } finally {
      if (typeof audioContext.close === 'function') {
        audioContext.close().catch(() => {})
      }
    }
  }

  try {
    return await fromMetadata()
  } catch {
    return fromDecode()
  }
}

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const utf8Encode = (text) => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(text || ''))
  }
  const encoded = encodeURIComponent(String(text || ''))
  const out = []
  for (let i = 0; i < encoded.length; i += 1) {
    const ch = encoded[i]
    if (ch === '%') {
      out.push(parseInt(encoded.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      out.push(ch.charCodeAt(0))
    }
  }
  return new Uint8Array(out)
}

const createCrc32Table = () => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
}

const CRC32_TABLE = createCrc32Table()

const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    const idx = (crc ^ bytes[i]) & 0xff
    crc = (crc >>> 8) ^ CRC32_TABLE[idx]
  }
  return (crc ^ 0xffffffff) >>> 0
}

const writeUInt16LE = (view, offset, value) => {
  view.setUint16(offset, value & 0xffff, true)
}

const writeUInt32LE = (view, offset, value) => {
  view.setUint32(offset, value >>> 0, true)
}

const concatUint8Arrays = (arrays) => {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  arrays.forEach((arr) => {
    out.set(arr, offset)
    offset += arr.length
  })
  return out
}

const buildZipFile = (files) => {
  const localParts = []
  const centralParts = []
  let localOffset = 0

  files.forEach((file) => {
    const nameBytes = utf8Encode(file.path)
    const dataBytes = utf8Encode(file.content)
    const crc = crc32(dataBytes)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUInt32LE(localView, 0, 0x04034b50)
    writeUInt16LE(localView, 4, 20)
    writeUInt16LE(localView, 6, 0)
    writeUInt16LE(localView, 8, 0)
    writeUInt16LE(localView, 10, 0)
    writeUInt16LE(localView, 12, 0)
    writeUInt32LE(localView, 14, crc)
    writeUInt32LE(localView, 18, dataBytes.length)
    writeUInt32LE(localView, 22, dataBytes.length)
    writeUInt16LE(localView, 26, nameBytes.length)
    writeUInt16LE(localView, 28, 0)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, dataBytes)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUInt32LE(centralView, 0, 0x02014b50)
    writeUInt16LE(centralView, 4, 20)
    writeUInt16LE(centralView, 6, 20)
    writeUInt16LE(centralView, 8, 0)
    writeUInt16LE(centralView, 10, 0)
    writeUInt16LE(centralView, 12, 0)
    writeUInt16LE(centralView, 14, 0)
    writeUInt32LE(centralView, 16, crc)
    writeUInt32LE(centralView, 20, dataBytes.length)
    writeUInt32LE(centralView, 24, dataBytes.length)
    writeUInt16LE(centralView, 28, nameBytes.length)
    writeUInt16LE(centralView, 30, 0)
    writeUInt16LE(centralView, 32, 0)
    writeUInt16LE(centralView, 34, 0)
    writeUInt16LE(centralView, 36, 0)
    writeUInt32LE(centralView, 38, 0)
    writeUInt32LE(centralView, 42, localOffset)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    localOffset += localHeader.length + dataBytes.length
  })

  const centralDirectory = concatUint8Arrays(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  writeUInt32LE(endView, 0, 0x06054b50)
  writeUInt16LE(endView, 4, 0)
  writeUInt16LE(endView, 6, 0)
  writeUInt16LE(endView, 8, files.length)
  writeUInt16LE(endView, 10, files.length)
  writeUInt32LE(endView, 12, centralDirectory.length)
  writeUInt32LE(endView, 16, localOffset)
  writeUInt16LE(endView, 20, 0)

  return concatUint8Arrays([...localParts, centralDirectory, end])
}

const buildDocxBlob = (title, text) => {
  const paragraphs = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => !(line === '' && idx === arr.length - 1))
    .map((line) => {
      const safe = escapeXml(line === '' ? ' ' : line)
      return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`
    })
    .join('')

  const safeTitle = escapeXml(title || 'mallog24')
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${safeTitle}</w:t></w:r></w:p>
    ${paragraphs || '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>'}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const zipBytes = buildZipFile([
    { path: '[Content_Types].xml', content: contentTypes },
    { path: '_rels/.rels', content: rels },
    { path: 'word/document.xml', content: documentXml },
  ])

  return new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

const sanitizeFileName = (input) =>
  String(input || 'mallog24')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 48)

const triggerBlobDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function HeaderMenuControls({ darkMode, setDarkMode, uiTheme, setUiTheme, uiThemeMode, setUiThemeMode, locale = 'kr' }) {
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
          aria-label="언어 선택"
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
          aria-label="테마 선택"
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
    { label: '업로드', num: 1 },
    { label: '음성 인식', num: 2 },
    { label: '교정', num: 3 },
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
                ${currentStep > step.num ? 'bg-green-400' : 'nm-concave'}`}
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
  const [language, setLanguage] = useState('ko')
  const [transcriptionType, setTranscriptionType] = useState('conversation')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
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
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsLoaded, setRecordsLoaded] = useState(false)
  const [recordDrafts, setRecordDrafts] = useState({})
  const [draftLoadingCategory, setDraftLoadingCategory] = useState('')
  const [savingCategory, setSavingCategory] = useState('')

  const pollInterval = useRef(null)
  const fileInputRef = useRef(null)
  const pollStartTime = useRef(null)
  const pollTokenRef = useRef(0)
  const activeTaskIdRef = useRef('')
  const pollResultCommitTimerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const fileDurationProbeRef = useRef(0)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mallog24.com'
  const OURS_URL = process.env.NEXT_PUBLIC_OURS_URL || 'https://ours.mallog24.com'
  const OURS_PRIVACY_URL = `${OURS_URL}/privacy`
  const OURS_TERMS_URL = `${OURS_URL}/terms`
  const OURS_COMPANY_POLICY_URL = `${OURS_URL}/company-policy`
  const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'OURS'
  const BUSINESS_REG_NUMBER = process.env.NEXT_PUBLIC_BUSINESS_REG_NUMBER || '696-08-03518'
  const LANDLINE_PHONE = process.env.NEXT_PUBLIC_LANDLINE_PHONE || '준비중'
  const BUSINESS_ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '12735, 경기도 광주시 초월읍 무들로 28'
  const REPRESENTATIVE_NAME = process.env.NEXT_PUBLIC_REPRESENTATIVE_NAME || '김현우'
  const ECOMMERCE_REG_NUMBER = process.env.NEXT_PUBLIC_ECOMMERCE_REG_NUMBER || '통신판매업 신고 면제 대상'
  const AUTH_TOKEN_KEY = 'mallog24_access_token'
  const AUTH_TOKEN_EXP_LEEWAY_MS = 30 * 1000
  const WARMUP_TIMEOUT_MS = 4000
  const TRANSCRIBE_POLL_TIMEOUT_MS = 45 * 60 * 1000

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
        setError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
      } else {
        setAuthToken(oauthAccessToken)
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, oauthAccessToken)
        fetchBootstrap(oauthAccessToken)
        setNotice('소셜 로그인이 완료되었습니다.')
      }
    } else {
      const savedToken = window.sessionStorage.getItem(AUTH_TOKEN_KEY)
      if (savedToken) {
        if (isJwtExpired(savedToken)) {
          window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
        } else {
          setAuthToken(savedToken)
          fetchBootstrap(savedToken)
        }
      }
    }

    if (oauthError) {
      setError(`소셜 로그인 실패: ${oauthError}`)
    }
    if (oauthAccessToken || oauthError) {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
    }
    return () => {
      invalidatePollingSession()
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
      setHistoryLoaded(false)
      return
    }
    setHistoryLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/history`, {
        headers: getAuthHeaders(token),
      })
      if (!res.ok) throw new Error('변환 기록을 불러오지 못했습니다.')
      setHistory(await res.json())
      setHistoryLoaded(true)
    } catch (e) {
      console.error("Failed to fetch history", e)
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchBootstrap = async (token = authToken) => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/auth/bootstrap`, {
        headers: getAuthHeaders(token),
      })
      if (!res.ok) throw new Error('사용자 인증이 만료되었습니다.')
      const data = await res.json()
      setAuthUser(data.user || null)
      if (data.usage) {
        setUsage({
          plan_tier: data.usage.plan_tier || 'free',
          used_audio_seconds: Number(data.usage.used_audio_seconds) || 0,
          monthly_limit_seconds: Number(data.usage.monthly_limit_seconds) || FREE_MONTHLY_LIMIT_SECONDS,
          remaining_seconds: Number(data.usage.remaining_seconds) || 0,
          usage_percent: Number(data.usage.usage_percent) || 0,
        })
      } else {
        fetchUsage(token)
      }
    } catch (e) {
      setAuthToken('')
      setAuthUser(null)
      setUsage(null)
      setSavedRecords([])
      setRecordsLoaded(false)
      setHistory([])
      setHistoryLoaded(false)
      setResult(null)
      setRecordDrafts({})
      setShowHistory(false)
      setShowRecords(false)
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
      console.error('Failed to bootstrap auth state', e)
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
      if (!res.ok) throw new Error('사용량을 불러오지 못했습니다.')
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
    if (!token) {
      setSavedRecords([])
      setRecordsLoaded(false)
      return
    }
    setRecordsLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/records`, {
        headers: getAuthHeaders(token),
      })
      if (!res.ok) throw new Error('저장 기록을 불러오지 못했습니다.')
      const data = await res.json()
      setSavedRecords(Array.isArray(data) ? data : [])
      setRecordsLoaded(true)
    } catch (e) {
      console.error("Failed to fetch saved records", e)
    } finally {
      setRecordsLoading(false)
    }
  }

  useEffect(() => {
    if (!authToken || !showHistory || historyLoaded || historyLoading) return
    fetchHistory(authToken)
  }, [authToken, showHistory, historyLoaded, historyLoading])

  useEffect(() => {
    if (!authToken || !showRecords || recordsLoaded || recordsLoading) return
    fetchSavedRecords(authToken)
  }, [authToken, showRecords, recordsLoaded, recordsLoading])

  const clearPollResultCommitTimer = () => {
    if (pollResultCommitTimerRef.current) {
      window.clearTimeout(pollResultCommitTimerRef.current)
      pollResultCommitTimerRef.current = null
    }
  }

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current)
      pollInterval.current = null
    }
    pollStartTime.current = null
    clearPollResultCommitTimer()
  }

  const invalidatePollingSession = () => {
    pollTokenRef.current += 1
    activeTaskIdRef.current = ''
    stopPolling()
  }

  const validateAndSetFile = async (selectedFile) => {
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('파일 크기는 100MB 이하여야 합니다.')
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
        setError('남은 허용 시간을 초과하는 파일입니다.')
        setNotice(null)
        showToast('남은 허용 시간을 초과하는 파일입니다')
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
      setError(null)
      setNotice('브라우저에서 길이 확인에 실패해 업로드는 진행합니다. 서버에서 길이를 다시 검사합니다.')
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
    const pollToken = pollTokenRef.current
    activeTaskIdRef.current = taskId
    pollStartTime.current = Date.now()
    setCurrentStep(1)

    pollInterval.current = setInterval(async () => {
      try {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return

        const elapsed = Date.now() - pollStartTime.current
        if (elapsed > 3000) setCurrentStep(prev => Math.max(prev, 2))
        if (elapsed > TRANSCRIBE_POLL_TIMEOUT_MS) {
          stopPolling()
          activeTaskIdRef.current = ''
          setLoading(false)
          setCurrentStep(0)
          setError('처리 시간이 길어지고 있습니다. 잠시 후 히스토리에서 다시 확인해 주세요.')
          setNotice(`작업 ID: ${taskId}`)
          return
        }

        const res = await fetch(`${API_URL}/api/status/${taskId}`, {
          headers: getAuthHeaders(),
        })
        if (!res.ok) return

        const data = await res.json()
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return

        if (data.status === 'completed') {
          stopPolling()
          setCurrentStep(3)
          pollResultCommitTimerRef.current = window.setTimeout(() => {
            if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return
            setResult(data)
            setLoading(false)
            setCurrentStep(0)
            fetchHistory()
            fetchUsage()
            activeTaskIdRef.current = ''
            pollResultCommitTimerRef.current = null
          }, 800)
        } else if (data.status === 'error') {
          stopPolling()
          activeTaskIdRef.current = ''
          setError(data.error || '변환 중 오류가 발생했습니다.')
          setLoading(false)
          setCurrentStep(0)
        } else if (data.status === 'processing') {
          setCurrentStep(3)
        }
      } catch (e) {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return
        console.error("Polling error", e)
      }
    }, 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!authToken) {
      setError('파일 변환은 로그인 후 이용할 수 있습니다.')
      return
    }
    if (!file) {
      setError('파일을 선택해주세요.')
      return
    }
    if (uploadBlockedByQuota || fileExceedsRemainingQuota) {
      setError('남은 허용 시간을 초과하는 파일입니다.')
      showToast('남은 허용 시간을 초과하는 파일입니다')
      return
    }

    invalidatePollingSession()
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
      formData.append('correction_mode', 'normal')

      const response = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || '변환 실패')
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
      setError(err.message || '오류가 발생했습니다.')
      setLoading(false)
      setCurrentStep(0)
    }
  }

  const handleLoadHistory = async (taskId) => {
    invalidatePollingSession()
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
        setError('해당 기록을 불러올 수 없습니다.')
      }
    } catch (e) {
      setError('불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, label) => {
    const safeText = String(text || '').trim()
    if (!safeText) return
    navigator.clipboard.writeText(safeText)
      .then(() => {
        setCopied(label)
        setTimeout(() => setCopied(null), 2000)
      })
      .catch(() => setError('클립보드 복사에 실패했습니다.'))
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
        throw new Error(data.detail || '인증 처리에 실패했습니다.')
      }

      if (data.access_token) {
        setAuthToken(data.access_token)
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
        setAuthUser(data.user || null)
        setHistory([])
        setSavedRecords([])
        setHistoryLoaded(false)
        setRecordsLoaded(false)
        setShowHistory(false)
        setShowRecords(false)
        fetchBootstrap(data.access_token)
        setNotice(authMode === 'signup' ? '회원가입 및 로그인이 완료되었습니다.' : '로그인되었습니다.')
      } else {
        setNotice(data.message || '회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.')
      }

      setAuthPassword('')
      if (authMode === 'signup') setAuthMode('login')
    } catch (err) {
      setError(err.message || '인증 오류가 발생했습니다.')
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
        throw new Error(data.detail || '소셜 로그인 URL 요청에 실패했습니다.')
      }
      window.location.href = data.auth_url
    } catch (err) {
      setError(err.message || '소셜 로그인 오류가 발생했습니다.')
      setSocialLoading('')
    }
  }

  const handleLogout = () => {
    invalidatePollingSession()
    setAuthToken('')
    setAuthUser(null)
    setUsage(null)
    setSavedRecords([])
    setRecordsLoaded(false)
    setRecordsLoading(false)
    setHistory([])
    setHistoryLoaded(false)
    setHistoryLoading(false)
    setResult(null)
    setFile(null)
    setFileDurationSeconds(0)
    setRecordDrafts({})
    setShowHistory(false)
    setShowRecords(false)
    setError(null)
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
    setNotice('로그아웃되었습니다.')
  }

  const exportAsTxt = () => {
    if (!result) return
    const text = (result.corrected_text || result.raw_text || '').trim()
    if (!text) return
    const filename = `${sanitizeFileName(`녹취록_${new Date().toISOString().slice(0, 10)}`)}.txt`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    triggerBlobDownload(blob, filename)
  }

  const exportAsDocx = () => {
    if (!result) return
    const text = (result.corrected_text || result.raw_text || '').trim()
    if (!text) return
    const filename = `${sanitizeFileName(`녹취록_${new Date().toISOString().slice(0, 10)}`)}.docx`
    const blob = buildDocxBlob('녹취록', text)
    triggerBlobDownload(blob, filename)
  }

  const exportTextByLabel = (text, label, ext = 'txt') => {
    const safeText = String(text || '').trim()
    if (!safeText) return
    const filename = `${sanitizeFileName(`${label}_${new Date().toISOString().slice(0, 10)}`)}.${ext}`
    if (ext === 'docx') {
      const blob = buildDocxBlob(label, safeText)
      triggerBlobDownload(blob, filename)
      return
    }
    const blob = new Blob([safeText], { type: 'text/plain;charset=utf-8' })
    triggerBlobDownload(blob, filename)
  }

  const handleSummarize = async () => {
    if (!result?.corrected_text && !result?.raw_text) return
    if (!authToken) {
      setError('요약은 로그인 후 이용할 수 있습니다.')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const normalizedType = result?.transcription_type || transcriptionType || 'conversation'
      const formData = new FormData()
      formData.append('text', result.corrected_text || result.raw_text)
      formData.append('summary_type', 'short')
      formData.append('transcription_type', normalizedType)
      formData.append('language', language || 'ko')

      const response = await fetch(`${API_URL}/api/summarize`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || '요약 실패')
      }
      setResult({ ...result, summary: data.summary })
    } catch (err) {
      setError(err.message || '요약 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRecordDraft = async (category) => {
    if (!result?.corrected_text && !result?.raw_text) return
    if (!authToken) {
      setError('기록본 초안 생성은 로그인 후 이용할 수 있습니다.')
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
        throw new Error(data.detail || '기록본 초안 생성에 실패했습니다.')
      }

      setRecordDrafts((prev) => ({ ...prev, [category]: data.content || '' }))
      setNotice(`${data.category_label || '기록본'} 초안을 생성했습니다.`)
    } catch (err) {
      setError(err.message || '기록본 초안 생성 실패')
    } finally {
      setDraftLoadingCategory('')
    }
  }

  const handleRecordDraftChange = (category, value) => {
    setRecordDrafts((prev) => ({ ...prev, [category]: value }))
  }

  const handleSaveRecord = async (category) => {
    if (!authToken) {
      setError('기록본 저장은 로그인 후 이용할 수 있습니다.')
      return
    }

    const content = (recordDrafts[category] || '').trim()
    if (!content) {
      setError('저장할 기록본 내용이 없습니다.')
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
        throw new Error(data.detail || '기록본 저장 실패')
      }

      setNotice('기록본이 별도 저장되었습니다.')
      fetchSavedRecords()
      setShowRecords(true)
    } catch (err) {
      setError(err.message || '기록본 저장 실패')
    } finally {
      setSavingCategory('')
    }
  }

  const typeLabels = { sermon: '설교 녹취', phonecall: '통화 기록', conversation: '대화/회의 기록' }
  const summaryActionLabels = {
    sermon: '설교 기록 요약 생성',
    phonecall: '통화 기록 요약 생성',
    conversation: '회의 기록 요약 생성',
  }
  const summaryTitleLabels = {
    sermon: '설교 기록 요약',
    phonecall: '통화 기록 요약',
    conversation: '회의 기록 요약',
  }
  const transcriptionTypeHints = {
    sermon: '설교 흐름(본론/결론/기도) 중심으로 정리합니다.',
    phonecall: '통화 화자를 A/B로 분리하여 정리합니다.',
    conversation: '회의 참석자 발언을 분리하고 안건/결정/후속 조치 하며 구조화 합니다.',
  }
  const recordTypeLabels = {
    meeting_keywords: '회의 중요 키워드',
    clinical_notes: '진료 도움 기록',
    sermon_core_summary: '설교 핵심 요약',
  }
  const recordCategories = [
    { key: 'meeting_keywords', label: '회의 중요 키워드' },
    { key: 'clinical_notes', label: '진료 도움 기록' },
    { key: 'sermon_core_summary', label: '설교 핵심 요약' },
  ]
  const socialProviders = [
    { key: 'google', label: 'Google로 계속하기', icon: 'G', iconClass: 'bg-white text-slate-700' },
    { key: 'kakao', label: 'Kakao로 계속하기', icon: 'K', iconClass: 'bg-yellow-300 text-slate-900' },
  ]
  const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치',
    'Main Body', 'Conclusion', 'Prayer', 'Summary', 'Key Points', 'Agenda Items', 'Decisions', 'Action Items']

  return (
    <div className="min-h-screen pb-12">
      <Head>
        <title>mallog24 - AI Speech to Text</title>
        <meta
          name="description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 AI 녹취 서비스. 무료 월 10시간, Pro 월 8,000원 무제한."
        />
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
            locale="kr"
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6">
        {!authToken && (
          <section className="space-y-4 mb-5 animate-nm-card-in">
            <div className="nm-raised p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold nm-concave text-nm-text-secondary">
                  무료 월 10시간
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold nm-concave text-nm-text-secondary">
                  Pro 월 8,000원 무제한
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold nm-concave text-nm-text-secondary">
                  오픈 베타
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-nm-text-primary leading-tight">
                녹음만 올리세요. 바로 쓰는 구조화 녹취 문서가 나옵니다.
              </h1>
              <p className="mt-2 text-sm text-nm-text-secondary leading-relaxed">
                설교, 통화, 회의에 맞춰 AI가 듣고 교정하고 요약합니다.
                결과는 TXT/DOCX와 기록본으로 바로 저장할 수 있습니다.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="nm-concave p-4">
                  <p className="text-[11px] font-semibold text-nm-text-secondary mb-2">Before</p>
                  <p className="text-sm text-nm-text-secondary leading-relaxed">
                    "이번 주 광고 예산이 15% 초과됐고, 다음 주 수정안을 다시 공유해 주세요."
                  </p>
                </div>
                <div className="nm-concave p-4">
                  <p className="text-[11px] font-semibold text-nm-text-secondary mb-2">After</p>
                  <p className="text-sm font-semibold text-nm-text-primary">회의 기록 요약</p>
                  <ul className="mt-2 text-xs text-nm-text-secondary space-y-1 leading-relaxed">
                    <li>- 안건: 예산 초과 15%</li>
                    <li>- 결정: 수정안 재공유</li>
                    <li>- 후속 조치: 일정/담당 재배정</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <Link
                  href={UPGRADE_CONTACT_URL}
                  className="nm-btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold"
                >
                  요금제 보기
                </Link>
                <a
                  href={OURS_URL}
                  className="nm-btn inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-nm-text-primary"
                >
                  OURS 소개 보기
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="nm-raised p-4">
                <p className="text-sm font-semibold text-nm-text-primary">전문 용어 정확도</p>
                <p className="text-xs text-nm-text-secondary mt-1">도메인 용어 사전 + 문맥 교정으로 오인식을 줄입니다.</p>
              </div>
              <div className="nm-raised p-4">
                <p className="text-sm font-semibold text-nm-text-primary">구조화된 문서 출력</p>
                <p className="text-xs text-nm-text-secondary mt-1">요약, 핵심 포인트, 후속 조치까지 바로 쓰는 형태로 제공합니다.</p>
              </div>
              <div className="nm-raised p-4">
                <p className="text-sm font-semibold text-nm-text-primary">2단계 엔진</p>
                <p className="text-xs text-nm-text-secondary mt-1">Whisper 전사 + Gemini 교정으로 속도와 품질을 함께 확보합니다.</p>
              </div>
            </div>

            <div className="nm-raised p-4">
              <p className="text-xs font-semibold text-nm-accent mb-2">베타 사용자 피드백</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="nm-concave p-3">
                  <p className="text-xs text-nm-text-primary">"회의록 정리 시간이 훨씬 단축됐어요."</p>
                </div>
                <div className="nm-concave p-3">
                  <p className="text-xs text-nm-text-primary">"설교 요약본을 바로 저장할 수 있어 편합니다."</p>
                </div>
                <div className="nm-concave p-3">
                  <p className="text-xs text-nm-text-primary">"전문 용어가 이전보다 덜 깨집니다."</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 인증 카드 */}
        <div className="nm-raised p-5 sm:p-6 mb-5 animate-nm-card-in">
          {!authToken ? (
            <>
              <div className="mb-4">
                <p className="text-base font-bold text-nm-text-primary">로그인 후 바로 파일 업로드를 시작하세요.</p>
                <p className="mt-1 text-xs text-nm-text-secondary">이메일 또는 Google/Kakao로 1분 안에 시작할 수 있습니다.</p>
                <div className="nm-segment-group mt-3">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`nm-segment-item ${authMode === 'login' ? 'active' : ''}`}
                  >
                    로그인
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className={`nm-segment-item ${authMode === 'signup' ? 'active' : ''}`}
                  >
                    회원가입
                  </button>
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {authMode === 'signup' && (
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="이름"
                    className="w-full nm-input"
                  />
                )}
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="이메일"
                  required
                  className="w-full nm-input"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="비밀번호 (8자 이상)"
                  required
                  minLength={8}
                  className="w-full nm-input"
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full nm-btn-primary py-2.5 text-sm font-semibold"
                >
                  {authLoading
                    ? '처리 중...'
                    : authMode === 'signup'
                      ? '회원가입하기'
                      : '로그인하기'}
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
                      className="nm-btn w-full h-11 px-3 text-sm font-semibold text-nm-text-primary inline-flex items-center justify-center gap-2"
                    >
                      <span className={`w-5 h-5 rounded-full text-[11px] font-bold inline-flex items-center justify-center ${provider.iconClass}`}>
                        {provider.icon}
                      </span>
                      {socialLoading === provider.key ? '이동 중...' : provider.label}
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
                <p className="text-xs text-nm-text-secondary">로그인 사용자</p>
                <p className="text-sm font-semibold text-nm-text-primary">
                  {authUser?.email || '인증된 사용자'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="nm-btn inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-nm-text-primary"
              >
                로그아웃
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
                    <p className="text-xs text-nm-text-secondary">이번 달 사용량</p>
                    <p className="text-sm font-semibold text-nm-text-primary">
                      {isFreeTier
                        ? `${formatSecondsToHourMinute(usage.used_audio_seconds)} / ${formatSecondsToHourMinute(monthlyLimitSeconds)}`
                        : `${formatSecondsToHourMinute(usage.used_audio_seconds)} / 무제한`}
                    </p>
                    {isFreeTier && (
                      <p className="text-[11px] text-nm-text-secondary mt-1">
                        남은 시간: {formatSecondsToHourMinute(remainingQuotaSeconds)}
                      </p>
                    )}
                  </div>
                  <a
                    href={UPGRADE_CONTACT_URL}
                    className="nm-btn-primary inline-flex items-center justify-center px-4 py-2 text-xs font-semibold"
                  >
                    구독 업그레이드하기
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

            <div className="nm-flat p-4 mb-5 animate-nm-card-in">
              <p className="text-xs sm:text-sm text-nm-accent font-medium">
                mallog24는 공식적으로 배포된 음성 파일의 사용을 권장 합니다. <br />부정적인 방법으로 사용 중 외부에 적발시 법적인 책임이 없음을 알립니다.
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
                        file ? 'nm-raised' :
                          'nm-concave'}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => {
                    if (uploadBlockedByQuota) {
                      showToast('이번 달 무료 제공량(10시간)을 모두 사용했습니다. 요금제를 업그레이드해 주세요.')
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
                      <div className="w-11 h-11 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-nm-text-primary">{file.name}</p>
                      <p className="text-xs text-nm-text-secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      {fileDurationSeconds > 0 && (
                        <p className="text-xs text-nm-text-secondary">길이: {formatSecondsToHourMinute(fileDurationSeconds)}</p>
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
                        파일 변경
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-11 h-11 mx-auto rounded-full nm-flat flex items-center justify-center">
                        <svg className="w-5 h-5 text-nm-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-sm text-nm-text-secondary">
                        파일을 끌어다 놓거나 <span className="text-nm-accent font-medium">클릭</span>하여 선택
                      </p>
                      <p className="text-xs text-nm-text-secondary">MP3, WAV, M4A, OGG, FLAC (최대 100MB)</p>
                    </div>
                  )}
                </div>

                {/* 설정 */}
                <div className="mt-4 flex gap-3">
                  <div className="flex-1 relative">
                    <label className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">언어</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="ko">한국어</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="flex-1 relative">
                    <label className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">유형</label>
                    <select
                      value={transcriptionType}
                      onChange={(e) => setTranscriptionType(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="sermon">설교 녹취</option>
                      <option value="phonecall">통화 기록</option>
                      <option value="conversation">대화/회의 기록</option>
                    </select>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-nm-text-secondary">
                  {transcriptionTypeHints[transcriptionType]}
                </p>
                {fileExceedsRemainingQuota && (
                  <p className="mt-2 text-[12px] text-red-600 font-medium">
                    남은 허용 시간을 초과하는 파일입니다.
                  </p>
                )}

                {/* 변환 버튼 */}
                <button
                  type="submit"
                  disabled={loading || !file || !authToken || uploadBlockedByQuota || fileExceedsRemainingQuota}
                  className="w-full nm-btn-primary mt-5 py-3.5 font-semibold text-sm"
                >
                  {loading
                    ? '변환 중...'
                    : uploadBlockedByQuota
                      ? '무료 한도 초과 (업그레이드 필요)'
                      : fileExceedsRemainingQuota
                        ? '남은 허용 시간 초과'
                        : authToken
                          ? '변환하기'
                          : '로그인 후 변환하기'}
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
              <div className="nm-raised p-6 mb-5 animate-slide-up">
                <StepIndicator currentStep={currentStep} />
                <div className="progress-bar mt-5">
                  <div
                    className="progress-bar-fill"
                    style={{ width: currentStep === 1 ? '20%' : currentStep === 2 ? '55%' : '85%' }}
                  />
                </div>
                <p className="text-center text-xs text-nm-text-secondary mt-3">
                  {currentStep === 1 && '파일을 업로드하고 있습니다...'}
                  {currentStep === 2 && 'AI가 음성을 인식하고 있습니다...'}
                  {currentStep === 3 && '텍스트를 교정하고 구조화하고 있습니다...'}
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
                      <h2 className="text-base font-bold text-nm-text-primary">변환 결과</h2>
                      {result.transcription_type && result.transcription_type !== 'sermon' && (
                        <span className="nm-flat px-2 py-0.5 text-[11px] font-medium text-nm-accent">
                          {typeLabels[result.transcription_type] || result.transcription_type}
                        </span>
                      )}
                    </div>
                    <span className="nm-flat px-2 py-0.5 text-[11px] font-medium text-green-600">
                      {result.characters?.toLocaleString()} 자
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
                              <div key={i} className="text-sm font-bold text-nm-accent border-b border-nm-dark/20 pb-1 mt-7 mb-3">
                                {trimmed}
                              </div>
                            )
                          }
                          const speakerMatch = trimmed.match(/^(화자\s*(?:[A-Z]|\d+)(?:\s*\([^)]*\))?|참석자\s*\d+(?:\s*\([^)]*\))?|Speaker\s*(?:[A-Z]|\d+)(?:\s*\([^)]*\))?|Participant\s*\d+(?:\s*\([^)]*\))?)\s*[:：]/)
                          if (speakerMatch) {
                            return (
                              <p key={i} className="mb-1.5">
                                <span className="inline-block px-2 py-0.5 mr-1.5 text-[11px] font-semibold rounded-md nm-flat text-nm-accent">
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
                      {copied === 'text' ? '복사됨' : '복사'}
                    </button>
                    <button onClick={exportAsTxt} className="action-btn">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      TXT
                    </button>
                    <button onClick={exportAsDocx} className="action-btn">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      DOCX
                    </button>
                  </div>
                </div>

                {/* 요약 섹션 (유형별) */}
                {(() => {
                  const summaryType = result.transcription_type || transcriptionType || 'conversation'
                  const summaryCopyKey = `summary-${summaryType}`
                  return (
                  !result.summary ? (
                    <button
                      onClick={handleSummarize}
                      disabled={loading}
                      className="w-full nm-btn p-4 text-sm font-medium text-nm-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? '요약 생성 중...' : (summaryActionLabels[summaryType] || summaryActionLabels.sermon)}
                    </button>
                  ) : (
                    <div className="nm-raised p-5 sm:p-6 animate-nm-card-in">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-nm-text-primary">
                          {summaryTitleLabels[summaryType] || summaryTitleLabels.sermon}
                        </h3>
                        <button
                          onClick={() => copyToClipboard(result.summary, summaryCopyKey)}
                          className="text-xs text-nm-accent hover:opacity-80 font-medium"
                        >
                          {copied === summaryCopyKey ? '복사됨' : '복사'}
                        </button>
                      </div>
                      <div className="nm-concave p-4">
                        <p className="whitespace-pre-wrap text-[13px] text-nm-text-primary leading-relaxed">
                          {result.summary}
                        </p>
                      </div>
                    </div>
                  )
                  )
                })()}

                {/* 기록본 생성/저장 */}
                <div className="nm-raised p-5 sm:p-6 animate-nm-card-in">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-nm-text-primary">별도 기록본</h3>
                    <span className="text-[11px] text-nm-text-secondary">
                      회의/진료/설교 포맷
                    </span>
                  </div>
                  <p className="text-xs text-nm-text-secondary mb-4">
                    결과 텍스트를 기반으로 전용 기록본 초안을 생성한 뒤, 로그인 사용자 계정으로 별도 저장할 수 있습니다.
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
                        {draftLoadingCategory === recordCategory.key ? '생성 중...' : recordCategory.label}
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
                              className="nm-btn-primary text-[11px] px-2.5 py-1"
                            >
                              {savingCategory === recordCategory.key ? '저장 중...' : '저장'}
                            </button>
                          </div>
                          <textarea
                            value={recordDrafts[recordCategory.key]}
                            onChange={(e) => handleRecordDraftChange(recordCategory.key, e.target.value)}
                            rows={6}
                            className="nm-input w-full text-xs leading-relaxed max-h-56 overflow-y-auto"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(recordDrafts[recordCategory.key], `record-draft-${recordCategory.key}`)}
                              className="action-btn"
                            >
                              {copied === `record-draft-${recordCategory.key}` ? '복사됨' : '복사'}
                            </button>
                            <button
                              type="button"
                              onClick={() => exportTextByLabel(recordDrafts[recordCategory.key], recordCategory.label, 'txt')}
                              className="action-btn"
                            >
                              TXT
                            </button>
                            <button
                              type="button"
                              onClick={() => exportTextByLabel(recordDrafts[recordCategory.key], recordCategory.label, 'docx')}
                              className="action-btn"
                            >
                              DOCX
                            </button>
                          </div>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>

                {/* 원본 텍스트 */}
                {result.corrected_text && (
                  <details className="nm-raised overflow-hidden">
                    <summary className="p-4 cursor-pointer text-sm text-nm-text-secondary hover:text-nm-text-primary font-medium select-none transition-colors">
                      원본 텍스트 보기
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
            {authToken && (
              <div className="mt-8">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-sm font-medium text-nm-text-secondary hover:text-nm-text-primary mb-3 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistory ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  최근 변환 기록 {historyLoaded ? `(${history.length})` : ''}
                </button>

                {showHistory && (
                  <div className="nm-raised overflow-hidden animate-slide-up">
                    {historyLoading ? (
                      <p className="text-sm text-nm-text-secondary p-4">기록 불러오는 중...</p>
                    ) : history.length === 0 ? (
                      <p className="text-sm text-nm-text-secondary p-4">아직 변환 기록이 없습니다.</p>
                    ) : (
                      <ul className="divide-y divide-nm-dark/20">
                        {history.map((item) => (
                          <li key={item.task_id}>
                            <button
                              onClick={() => handleLoadHistory(item.task_id)}
                              className="w-full text-left p-4 hover:bg-nm-light/30 transition-colors group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.status === 'completed' ? 'bg-green-500' :
                                      item.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                                      }`} />
                                    <span className="text-[11px] text-nm-text-secondary">
                                      {new Date(item.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {item.transcription_type && item.transcription_type !== 'sermon' && (
                                      <span className="nm-flat px-2 py-0.5 text-[11px] text-nm-text-secondary font-medium">
                                        {item.transcription_type === 'phonecall' ? '통화' : '회의'}
                                      </span>
                                    )}
                                    {item.characters > 0 && (
                                      <span className="text-[11px] text-nm-text-secondary">
                                        {item.characters?.toLocaleString()}자
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-nm-text-primary truncate group-hover:text-nm-accent transition-colors">
                                    {item.summary_preview || '완료된 전사 결과를 열어 확인하세요.'}
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
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 저장된 기록본 */}
            {authToken && (
              <div className="mt-8">
                <button
                  onClick={() => setShowRecords(!showRecords)}
                  className="flex items-center gap-2 text-sm font-medium text-nm-text-secondary hover:text-nm-text-primary mb-3 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showRecords ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  내 저장 기록본 ({savedRecords.length})
                </button>

                {showRecords && (
                  <div className="nm-raised overflow-hidden animate-slide-up">
                    {recordsLoading ? (
                      <p className="text-sm text-nm-text-secondary p-4">저장 기록을 불러오는 중...</p>
                    ) : savedRecords.length === 0 ? (
                      <p className="text-sm text-nm-text-secondary p-4">아직 저장된 기록본이 없습니다.</p>
                    ) : (
                      <ul className="divide-y divide-nm-dark/20">
                        {savedRecords.map((item) => (
                          <li key={item.id} className="p-4">
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <p className="text-sm font-semibold text-nm-text-primary">
                                {recordTypeLabels[item.category] || item.title || item.category}
                              </p>
                              <span className="text-[11px] text-nm-text-secondary">
                                {item.created_at
                                  ? new Date(item.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              <p className="text-xs text-nm-text-secondary whitespace-pre-wrap leading-relaxed">
                                {item.content}
                              </p>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.content, `saved-record-${item.id}`)}
                                className="action-btn"
                              >
                                {copied === `saved-record-${item.id}` ? '복사됨' : '복사'}
                              </button>
                              <button
                                type="button"
                                onClick={() => exportTextByLabel(item.content, item.title || item.category || '기록본', 'txt')}
                                className="action-btn"
                              >
                                TXT
                              </button>
                              <button
                                type="button"
                                onClick={() => exportTextByLabel(item.content, item.title || item.category || '기록본', 'docx')}
                                className="action-btn"
                              >
                                DOCX
                              </button>
                            </div>
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
          <div className="mb-2 flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <a href={OURS_PRIVACY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              개인정보처리방침
            </a>
            <span className="text-nm-text-secondary">·</span>
            <a href={OURS_TERMS_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              이용약관
            </a>
            <span className="text-nm-text-secondary">·</span>
            <a href={OURS_COMPANY_POLICY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              회사 정책
            </a>
          </div>
          <div className="space-y-1 text-[11px] text-nm-text-secondary mb-2">
            <p>상호: {BUSINESS_NAME}</p>
            <p>사업자등록번호: {BUSINESS_REG_NUMBER}</p>
            <p>유선전화번호: {LANDLINE_PHONE}</p>
            <p>사업장주소: {BUSINESS_ADDRESS}</p>
            <p>대표: {REPRESENTATIVE_NAME}</p>
            <p>통신판매신고번호: {ECOMMERCE_REG_NUMBER}</p>
          </div>
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
