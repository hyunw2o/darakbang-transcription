import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAudioDurationSecondsInBrowser } from '../utils/audio'
import { buildDocxBlob } from '../utils/docx'
import { sanitizeFileName, triggerBlobDownload } from '../utils/format'
import { apiFetch, safeReadJson } from '../utils/network'

const FREE_MONTHLY_LIMIT_SECONDS = 36000
const GUEST_MONTHLY_LIMIT_SECONDS = 1800
const GUEST_MAX_AUDIO_SECONDS = 600
const GUEST_SESSION_STORAGE_KEY = 'mallog24_guest_session_id'
const TRANSCRIBE_POLL_TIMEOUT_MS = 45 * 60 * 1000
const STATUS_POLL_INTERVAL_MS = 3000
const STATUS_POLL_REQUEST_TIMEOUT_MS = 12000
const STATUS_POLL_MAX_FAILURES = 5
const HISTORY_DELETE_CONFIRM_WINDOW_MS = 5000

const TRANSCRIPTION_MESSAGES = {
  ko: {
    fileSizeExceeded: '파일 크기는 100MB 이하여야 합니다.',
    quotaExceeded: '남은 허용 시간을 초과하는 파일입니다.',
    browserDurationFallback: '브라우저에서 길이 확인에 실패해 업로드는 진행합니다. 서버에서 길이를 다시 검사합니다.',
    pollingSlow: '상태 확인 응답이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.',
    pollingNetwork: '네트워크 오류로 상태 확인이 불안정합니다. 잠시 후 다시 확인해 주세요.',
    pollingFailed: '상태 확인이 반복해서 실패했습니다. 잠시 후 새 변환으로 다시 시도해 주세요.',
    processingSlow: '처리 시간이 길어지고 있습니다. 잠시 후 히스토리에서 다시 확인해 주세요.',
    taskNotFound: '작업 상태를 찾을 수 없습니다. 새로 변환을 다시 시도해 주세요.',
    taskIdLabel: '작업 ID',
    signinRequired: '파일 변환은 로그인 후 이용할 수 있습니다.',
    guestTranscribeHint: '비로그인 체험은 파일 1개당 최대 10분, 총 30분까지 가능합니다.',
    guestTranscribeStart: '비로그인 체험 변환하기',
    selectFile: '파일을 선택해주세요.',
    transcribeFailed: '변환 실패',
    loadHistoryFailed: '해당 기록을 불러올 수 없습니다.',
    loadHistoryGeneric: '불러오기 실패',
    deleteHistoryFailed: '기록 삭제 실패',
    deleteAllHistoryFailed: '전체 기록 삭제 실패',
    deleteHistorySuccess: '변환 기록을 삭제했습니다.',
    deleteAllHistorySuccess: '삭제 가능한 기록을 모두 삭제했습니다.',
    deleteAllHistoryPartial: '삭제 가능한 기록 {deletedCount}건을 삭제했습니다. 진행 중인 {skippedCount}건은 유지했습니다.',
    deleteHistoryConfirmPrompt: '삭제를 한 번 더 누르면 이 기록이 제거됩니다.',
    deleteAllHistoryConfirmPrompt: '전체 삭제를 한 번 더 누르면 삭제 가능한 기록이 제거됩니다.',
    summarizeLoginRequired: '요약은 로그인 후 이용할 수 있습니다.',
    summarizeFailed: '요약 실패',
    draftLoginRequired: '기록본 초안 생성은 로그인 후 이용할 수 있습니다.',
    draftFailed: '기록본 초안 생성에 실패했습니다.',
    draftFailedGeneric: '기록본 초안 생성 실패',
    draftCreatedSuffix: '초안을 생성했습니다.',
    recordDefaultLabel: '기록본',
    saveLoginRequired: '기록본 저장은 로그인 후 이용할 수 있습니다.',
    saveEmpty: '저장할 기록본 내용이 없습니다.',
    saveFailed: '기록본 저장 실패',
    saveSuccess: '기록본이 별도 저장되었습니다.',
    transcriptTitle: '녹취록',
    transcriptFilename: '녹취록',
    copyFailed: '클립보드 복사에 실패했습니다.',
    usageLimitToast: '이번 달 무료 제공량(10시간)을 모두 사용했습니다. 요금제를 업그레이드해 주세요.',
    resolveStyleMeetingFallback: 'conversation',
    defaultLanguage: 'ko',
  },
  en: {
    fileSizeExceeded: 'File size must be 100MB or less.',
    quotaExceeded: 'This file exceeds your remaining free allowance.',
    browserDurationFallback: 'Could not read duration in browser. Upload continues and the server will validate duration.',
    pollingSlow: 'Status checks are delayed. Please try again shortly.',
    pollingNetwork: 'Network errors are interrupting status checks. Please try again shortly.',
    pollingFailed: 'Status checks failed repeatedly. Please try a new transcription shortly.',
    processingSlow: 'This task is taking longer than expected. Please check it again from History shortly.',
    taskNotFound: 'Task status was not found. Please try a new transcription.',
    taskIdLabel: 'Task ID',
    signinRequired: 'Sign in is required before transcription.',
    guestTranscribeHint: 'Guest trial supports up to 10 minutes per file and 30 minutes total.',
    guestTranscribeStart: 'Start Guest Trial',
    selectFile: 'Please select an audio file.',
    transcribeFailed: 'Transcription failed.',
    loadHistoryFailed: 'Unable to load this record.',
    loadHistoryGeneric: 'Failed to load record.',
    deleteHistoryFailed: 'Failed to delete history item.',
    deleteAllHistoryFailed: 'Failed to delete all history items.',
    deleteHistorySuccess: 'Transcription history item deleted.',
    deleteAllHistorySuccess: 'All deletable history items were removed.',
    deleteAllHistoryPartial: 'Deleted {deletedCount} history item(s). Kept {skippedCount} active item(s).',
    deleteHistoryConfirmPrompt: 'Press Delete once more to remove this history item.',
    deleteAllHistoryConfirmPrompt: 'Press Delete all once more to remove every deletable history item.',
    summarizeLoginRequired: 'Please log in to generate summaries.',
    summarizeFailed: 'Summary generation failed.',
    draftLoginRequired: 'Please log in to generate record drafts.',
    draftFailed: 'Failed to generate record draft.',
    draftFailedGeneric: 'Failed to generate record draft.',
    draftCreatedSuffix: 'draft generated.',
    recordDefaultLabel: 'Record',
    saveLoginRequired: 'Please log in to save records.',
    saveEmpty: 'Record content is empty.',
    saveFailed: 'Failed to save record.',
    saveSuccess: 'Record saved separately.',
    transcriptTitle: 'Transcript',
    transcriptFilename: 'transcript',
    copyFailed: 'Failed to copy to clipboard.',
    usageLimitToast: 'You have used all 10 free hours for this month. Please upgrade your plan.',
    resolveStyleMeetingFallback: 'conversation',
    defaultLanguage: 'en',
  },
}

export default function useMallogTranscription({
  apiUrl,
  locale = 'ko',
  authToken,
  getAuthHeaders,
  fetchUsage,
  setError,
  setNotice,
  showToast,
  recordTypeLabels,
}) {
  const messages = TRANSCRIPTION_MESSAGES[locale] || TRANSCRIPTION_MESSAGES.ko
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState(messages.defaultLanguage)
  const [transcriptionType, setTranscriptionType] = useState('conversation')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyDeletingTaskId, setHistoryDeletingTaskId] = useState('')
  const [historyBulkDeleting, setHistoryBulkDeleting] = useState(false)
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState('')
  const [pendingDeleteAll, setPendingDeleteAll] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRecords, setShowRecords] = useState(false)
  const [savedRecords, setSavedRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsLoaded, setRecordsLoaded] = useState(false)
  const [recordDrafts, setRecordDrafts] = useState({})
  const [draftLoadingCategory, setDraftLoadingCategory] = useState('')
  const [savingCategory, setSavingCategory] = useState('')
  const [fileDurationSeconds, setFileDurationSeconds] = useState(0)
  const [guestSessionId, setGuestSessionId] = useState('')
  const [guestUsage, setGuestUsage] = useState({
    plan_tier: 'guest',
    used_audio_seconds: 0,
    monthly_limit_seconds: GUEST_MONTHLY_LIMIT_SECONDS,
    remaining_seconds: GUEST_MONTHLY_LIMIT_SECONDS,
    usage_percent: 0,
    max_audio_seconds: GUEST_MAX_AUDIO_SECONDS,
  })

  const pollInterval = useRef(null)
  const fileInputRef = useRef(null)
  const pollStartTime = useRef(null)
  const pollTokenRef = useRef(0)
  const activeTaskIdRef = useRef('')
  const pollResultCommitTimerRef = useRef(null)
  const pollFailureCountRef = useRef(0)
  const fileDurationProbeRef = useRef(0)
  const resultEpochRef = useRef(0)
  const historyDeleteConfirmTimerRef = useRef(null)
  const historyDeleteAllConfirmTimerRef = useRef(null)

  const readResponseData = useCallback(async (response, fallbackMessage) => {
    const data = await safeReadJson(response)
    if (!response.ok) {
      throw new Error(data?.detail || fallbackMessage)
    }
    return data || {}
  }, [])

  const ensureGuestSessionId = useCallback(() => {
    if (typeof window === 'undefined') return ''
    const existing = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY)
    if (existing) return existing

    const generated = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    const guestId = `guest-${generated}`
    window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, guestId)
    return guestId
  }, [])

  useEffect(() => {
    const resolvedGuestId = ensureGuestSessionId()
    if (resolvedGuestId) {
      setGuestSessionId(resolvedGuestId)
    }
  }, [ensureGuestSessionId])

  const getTranscriptionHeaders = useCallback((token = authToken) => {
    const headers = { ...getAuthHeaders(token) }
    if (token) {
      return headers
    }
    const resolvedGuestId = guestSessionId || ensureGuestSessionId()
    if (resolvedGuestId) {
      headers['X-Guest-Session-Id'] = resolvedGuestId
    }
    return headers
  }, [authToken, ensureGuestSessionId, getAuthHeaders, guestSessionId])

  const fetchGuestUsage = useCallback(async () => {
    const resolvedGuestId = guestSessionId || ensureGuestSessionId()
    if (!resolvedGuestId) return null
    try {
      const res = await apiFetch(`${apiUrl}/api/guest/usage`, {
        headers: { 'X-Guest-Session-Id': resolvedGuestId },
        credentials: 'omit',
      })
      const data = await readResponseData(res, messages.quotaExceeded)
      setGuestUsage(data)
      return data
    } catch (error) {
      console.error('Failed to fetch guest usage', error)
      return null
    }
  }, [apiUrl, ensureGuestSessionId, guestSessionId, messages.quotaExceeded, readResponseData])

  useEffect(() => {
    if (authToken) return
    fetchGuestUsage()
  }, [authToken, fetchGuestUsage])

  const resolveContentStyle = useCallback((data) => {
    const explicit = String(data?.content_style || '').trim().toLowerCase()
    if (explicit) return explicit === 'conversation' ? 'meeting' : explicit
    const fallbackType = String(data?.transcription_type || transcriptionType || messages.resolveStyleMeetingFallback).trim().toLowerCase()
    if (fallbackType === 'conversation') return 'meeting'
    return fallbackType
  }, [messages.resolveStyleMeetingFallback, transcriptionType])

  const clearPollResultCommitTimer = useCallback(() => {
    if (pollResultCommitTimerRef.current) {
      window.clearTimeout(pollResultCommitTimerRef.current)
      pollResultCommitTimerRef.current = null
    }
  }, [])

  const clearPendingDeleteTask = useCallback(() => {
    if (historyDeleteConfirmTimerRef.current) {
      window.clearTimeout(historyDeleteConfirmTimerRef.current)
      historyDeleteConfirmTimerRef.current = null
    }
    setPendingDeleteTaskId('')
  }, [])

  const clearPendingDeleteAll = useCallback(() => {
    if (historyDeleteAllConfirmTimerRef.current) {
      window.clearTimeout(historyDeleteAllConfirmTimerRef.current)
      historyDeleteAllConfirmTimerRef.current = null
    }
    setPendingDeleteAll(false)
  }, [])

  const armPendingDeleteTask = useCallback((taskId) => {
    clearPendingDeleteAll()
    clearPendingDeleteTask()
    setPendingDeleteTaskId(taskId)
    historyDeleteConfirmTimerRef.current = window.setTimeout(() => {
      setPendingDeleteTaskId('')
      historyDeleteConfirmTimerRef.current = null
    }, HISTORY_DELETE_CONFIRM_WINDOW_MS)
  }, [clearPendingDeleteAll, clearPendingDeleteTask])

  const armPendingDeleteAll = useCallback(() => {
    clearPendingDeleteTask()
    clearPendingDeleteAll()
    setPendingDeleteAll(true)
    historyDeleteAllConfirmTimerRef.current = window.setTimeout(() => {
      setPendingDeleteAll(false)
      historyDeleteAllConfirmTimerRef.current = null
    }, HISTORY_DELETE_CONFIRM_WINDOW_MS)
  }, [clearPendingDeleteAll, clearPendingDeleteTask])

  const stopPolling = useCallback(() => {
    if (pollInterval.current) {
      window.clearInterval(pollInterval.current)
      pollInterval.current = null
    }
    pollStartTime.current = null
    clearPollResultCommitTimer()
  }, [clearPollResultCommitTimer])

  const failPolling = useCallback((taskId, message) => {
    stopPolling()
    activeTaskIdRef.current = ''
    setLoading(false)
    setCurrentStep(0)
    setError(message)
    setNotice(`${messages.taskIdLabel}: ${taskId}`)
  }, [messages.taskIdLabel, setError, setNotice, stopPolling])

  const invalidatePollingSession = useCallback(() => {
    pollTokenRef.current += 1
    activeTaskIdRef.current = ''
    stopPolling()
  }, [stopPolling])

  const resetResultWorkspace = useCallback((bumpEpoch = true) => {
    if (bumpEpoch) {
      resultEpochRef.current += 1
    }
    setResult(null)
    setRecordDrafts({})
    return resultEpochRef.current
  }, [])

  const resetState = useCallback(() => {
    invalidatePollingSession()
    clearPendingDeleteTask()
    clearPendingDeleteAll()
    setLoading(false)
    setCurrentStep(0)
    setResult(null)
    setFile(null)
    setFileDurationSeconds(0)
    setHistory([])
    setHistoryLoaded(false)
    setHistoryLoading(false)
    setHistoryDeletingTaskId('')
    setHistoryBulkDeleting(false)
    setSavedRecords([])
    setRecordsLoaded(false)
    setRecordsLoading(false)
    setRecordDrafts({})
    setDraftLoadingCategory('')
    setSavingCategory('')
    setShowHistory(false)
    setShowRecords(false)
  }, [clearPendingDeleteAll, clearPendingDeleteTask, invalidatePollingSession])

  useEffect(() => {
    return () => {
      stopPolling()
      clearPendingDeleteTask()
      clearPendingDeleteAll()
    }
  }, [clearPendingDeleteAll, clearPendingDeleteTask, stopPolling])

  const fetchHistory = useCallback(async (token = authToken) => {
    if (!token) {
      setHistory([])
      setHistoryLoaded(false)
      return
    }

    setHistoryLoading(true)
    try {
      const res = await apiFetch(`${apiUrl}/api/history`, {
        headers: getAuthHeaders(token),
      })
      const data = await readResponseData(
        res,
        locale === 'en' ? 'Failed to load transcription history.' : '변환 기록을 불러오지 못했습니다.'
      )
      setHistory(Array.isArray(data) ? data : [])
      setHistoryLoaded(true)
    } catch (error) {
      console.error('Failed to fetch history', error)
    } finally {
      setHistoryLoading(false)
    }
  }, [apiUrl, authToken, getAuthHeaders, locale, readResponseData])

  const fetchSavedRecords = useCallback(async (token = authToken) => {
    if (!token) {
      setSavedRecords([])
      setRecordsLoaded(false)
      return
    }

    setRecordsLoading(true)
    try {
      const res = await apiFetch(`${apiUrl}/api/records`, {
        headers: getAuthHeaders(token),
      })
      const data = await readResponseData(
        res,
        locale === 'en' ? 'Failed to load saved records.' : '저장 기록을 불러오지 못했습니다.'
      )
      setSavedRecords(Array.isArray(data) ? data : [])
      setRecordsLoaded(true)
    } catch (error) {
      console.error('Failed to fetch saved records', error)
    } finally {
      setRecordsLoading(false)
    }
  }, [apiUrl, authToken, getAuthHeaders, locale, readResponseData])

  useEffect(() => {
    if (!authToken || !showHistory || historyLoaded || historyLoading) return
    fetchHistory(authToken)
  }, [authToken, fetchHistory, historyLoaded, historyLoading, showHistory])

  useEffect(() => {
    if (!authToken || !showRecords || recordsLoaded || recordsLoading) return
    fetchSavedRecords(authToken)
  }, [authToken, fetchSavedRecords, recordsLoaded, recordsLoading, showRecords])

  const validateAndSetFile = useCallback(async (selectedFile, usage) => {
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError(messages.fileSizeExceeded)
      return
    }

    const currentUsage = usage || null
    const planTier = currentUsage?.plan_tier || (authToken ? 'free' : 'guest')
    const isLimitedTier = planTier === 'free' || planTier === 'guest'
    const monthlyLimitSeconds = currentUsage?.monthly_limit_seconds || (planTier === 'guest' ? GUEST_MONTHLY_LIMIT_SECONDS : FREE_MONTHLY_LIMIT_SECONDS)
    const maxAudioSeconds = Number(currentUsage?.max_audio_seconds) || (planTier === 'guest' ? GUEST_MAX_AUDIO_SECONDS : 0)
    const remainingQuotaSeconds = isLimitedTier
      ? Math.max(0, currentUsage?.remaining_seconds ?? monthlyLimitSeconds)
      : Number.MAX_SAFE_INTEGER

    const probeId = fileDurationProbeRef.current + 1
    fileDurationProbeRef.current = probeId

    try {
      const durationSeconds = await getAudioDurationSecondsInBrowser(selectedFile)
      if (fileDurationProbeRef.current !== probeId) return

      if (planTier === 'guest' && maxAudioSeconds > 0 && durationSeconds > maxAudioSeconds) {
        setFile(null)
        setFileDurationSeconds(0)
        setError(messages.guestTranscribeHint)
        setNotice(null)
        showToast(messages.guestTranscribeHint)
        return
      }

      if (isLimitedTier && durationSeconds > remainingQuotaSeconds) {
        setFile(null)
        setFileDurationSeconds(0)
        setError(messages.quotaExceeded)
        setNotice(null)
        showToast(messages.quotaExceeded)
        return
      }

      setFile(selectedFile)
      setFileDurationSeconds(durationSeconds)
      setError(null)
      setNotice(null)
      resetResultWorkspace(true)
    } catch {
      if (fileDurationProbeRef.current !== probeId) return
      setFile(selectedFile)
      setFileDurationSeconds(0)
      setError(null)
      setNotice(messages.browserDurationFallback)
      resetResultWorkspace(true)
    }
  }, [authToken, messages.browserDurationFallback, messages.fileSizeExceeded, messages.guestTranscribeHint, messages.quotaExceeded, resetResultWorkspace, setError, setNotice, showToast])

  const handleFileChange = useCallback((event, usage) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile, usage)
    }
  }, [validateAndSetFile])

  const triggerFilePicker = useCallback((uploadBlockedByQuota) => {
    if (uploadBlockedByQuota) {
      showToast(messages.usageLimitToast)
      return
    }
    fileInputRef.current?.click()
  }, [messages.usageLimitToast, showToast])

  const handleUploadZoneKeyDown = useCallback((event, uploadBlockedByQuota) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      triggerFilePicker(uploadBlockedByQuota)
    }
  }, [triggerFilePicker])

  const handleDrop = useCallback((event, usage) => {
    event.preventDefault()
    setDragOver(false)
    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile, usage)
    }
  }, [validateAndSetFile])

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const startPolling = useCallback((taskId, resultEpoch) => {
    stopPolling()
    const pollToken = pollTokenRef.current
    activeTaskIdRef.current = taskId
    pollStartTime.current = Date.now()
    pollFailureCountRef.current = 0
    setCurrentStep(2)

    pollInterval.current = window.setInterval(async () => {
      try {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return

        const elapsed = Date.now() - pollStartTime.current
        if (elapsed > 3000) {
          setCurrentStep((prev) => Math.max(prev, 2))
        }
        if (elapsed > TRANSCRIBE_POLL_TIMEOUT_MS) {
          stopPolling()
          activeTaskIdRef.current = ''
          setLoading(false)
          setCurrentStep(0)
          setError(messages.processingSlow)
          setNotice(`${messages.taskIdLabel}: ${taskId}`)
          return
        }

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timeoutId = controller
          ? window.setTimeout(() => controller.abort(), STATUS_POLL_REQUEST_TIMEOUT_MS)
          : null
        let res
        try {
          res = await apiFetch(`${apiUrl}/api/status/${taskId}`, {
            headers: getTranscriptionHeaders(),
            credentials: authToken ? 'include' : 'omit',
            signal: controller?.signal,
          })
        } finally {
          if (timeoutId) {
            window.clearTimeout(timeoutId)
          }
        }

        if (!res.ok) {
          const data = await safeReadJson(res)
          const detail = data?.detail || data?.message || ''
          if ([401, 403, 404].includes(res.status)) {
            failPolling(taskId, detail || messages.taskNotFound)
            return
          }
          pollFailureCountRef.current += 1
          if (pollFailureCountRef.current >= STATUS_POLL_MAX_FAILURES) {
            failPolling(taskId, detail || messages.pollingFailed)
            return
          }
          if (pollFailureCountRef.current >= 3) {
            showToast(messages.pollingSlow)
          }
          return
        }

        const data = await readResponseData(
          res,
          locale === 'en' ? 'Failed to fetch status.' : '상태를 확인하지 못했습니다.'
        )
        pollFailureCountRef.current = 0
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return

        if (data.status === 'queued') {
          setCurrentStep(2)
        } else if (data.status === 'completed') {
          stopPolling()
          setCurrentStep(3)
          pollResultCommitTimerRef.current = window.setTimeout(() => {
            if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return
            if (resultEpoch !== resultEpochRef.current) return
            setResult(data)
            setLoading(false)
            setCurrentStep(0)
            if (authToken) {
              fetchHistory()
              fetchUsage()
            } else {
              fetchGuestUsage()
            }
            activeTaskIdRef.current = ''
            pollResultCommitTimerRef.current = null
          }, 800)
        } else if (data.status === 'error') {
          stopPolling()
          activeTaskIdRef.current = ''
          setError(data.error || messages.transcribeFailed)
          setLoading(false)
          setCurrentStep(0)
        } else if (data.status === 'processing') {
          setCurrentStep(3)
        } else if (data.status === 'not_found') {
          failPolling(taskId, messages.taskNotFound)
        }
      } catch (error) {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return
        pollFailureCountRef.current += 1
        if (pollFailureCountRef.current >= STATUS_POLL_MAX_FAILURES) {
          failPolling(taskId, messages.pollingFailed)
          return
        }
        if (pollFailureCountRef.current >= 3) {
          showToast(messages.pollingNetwork)
        }
        console.error('Polling error', error)
      }
    }, STATUS_POLL_INTERVAL_MS)
  }, [apiUrl, authToken, failPolling, fetchGuestUsage, fetchHistory, fetchUsage, getTranscriptionHeaders, locale, messages.pollingFailed, messages.pollingNetwork, messages.pollingSlow, messages.processingSlow, messages.taskIdLabel, messages.taskNotFound, messages.transcribeFailed, readResponseData, setError, setNotice, showToast, stopPolling])

  const handleSubmit = useCallback(async (event, usage) => {
    event.preventDefault()
    if (!file) {
      setError(messages.selectFile)
      return
    }

    const planTier = usage?.plan_tier || (authToken ? 'free' : 'guest')
    const isLimitedTier = planTier === 'free' || planTier === 'guest'
    const monthlyLimitSeconds = usage?.monthly_limit_seconds || (planTier === 'guest' ? GUEST_MONTHLY_LIMIT_SECONDS : FREE_MONTHLY_LIMIT_SECONDS)
    const maxAudioSeconds = Number(usage?.max_audio_seconds) || (planTier === 'guest' ? GUEST_MAX_AUDIO_SECONDS : 0)
    const remainingQuotaSeconds = isLimitedTier
      ? Math.max(0, usage?.remaining_seconds ?? monthlyLimitSeconds)
      : Number.MAX_SAFE_INTEGER
    const fileExceedsRemainingQuota = isLimitedTier && fileDurationSeconds > 0 && fileDurationSeconds > remainingQuotaSeconds
    const fileExceedsGuestMax = planTier === 'guest' && maxAudioSeconds > 0 && fileDurationSeconds > 0 && fileDurationSeconds > maxAudioSeconds
    const uploadBlockedByQuota = isLimitedTier && remainingQuotaSeconds <= 0

    if (fileExceedsGuestMax) {
      setError(messages.guestTranscribeHint)
      showToast(messages.guestTranscribeHint)
      return
    }

    if (uploadBlockedByQuota || fileExceedsRemainingQuota) {
      setError(messages.quotaExceeded)
      showToast(messages.quotaExceeded)
      return
    }

    invalidatePollingSession()
    const submitEpoch = resetResultWorkspace(true)
    setLoading(true)
    setError(null)
    setNotice(null)
    setCurrentStep(1)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', language)
      formData.append('correct', 'true')
      formData.append('transcription_type', transcriptionType)
      formData.append('correction_mode', 'normal')

      const response = await apiFetch(`${apiUrl}/api/transcribe`, {
        method: 'POST',
        headers: getTranscriptionHeaders(),
        credentials: authToken ? 'include' : 'omit',
        body: formData,
      })
      const data = await readResponseData(response, messages.transcribeFailed)
      if (!authToken && data?.quota) {
        setGuestUsage(data.quota)
      }

      if (data.status === 'queued') {
        setCurrentStep(2)
        startPolling(data.task_id, submitEpoch)
      } else {
        if (submitEpoch !== resultEpochRef.current) return
        setResult(data)
        setLoading(false)
        setCurrentStep(0)
        if (authToken) {
          fetchUsage()
        } else {
          fetchGuestUsage()
        }
      }
    } catch (error) {
      setError(error?.message || messages.transcribeFailed)
      setLoading(false)
      setCurrentStep(0)
    }
  }, [apiUrl, authToken, fetchGuestUsage, fetchUsage, file, fileDurationSeconds, getTranscriptionHeaders, invalidatePollingSession, language, messages.guestTranscribeHint, messages.quotaExceeded, messages.selectFile, messages.transcribeFailed, readResponseData, resetResultWorkspace, setError, setNotice, showToast, startPolling, transcriptionType])

  const handleLoadHistory = useCallback(async (taskId) => {
    invalidatePollingSession()
    const loadEpoch = resetResultWorkspace(true)
    setLoading(true)
    setError(null)
    setNotice(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      const res = await apiFetch(`${apiUrl}/api/status/${taskId}`, {
        headers: getAuthHeaders(),
      })
      const data = await readResponseData(res, messages.loadHistoryFailed)
      if (data.status === 'completed') {
        if (loadEpoch !== resultEpochRef.current) return
        setResult(data)
      } else {
        setError(messages.loadHistoryFailed)
      }
    } catch {
      setError(messages.loadHistoryGeneric)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, getAuthHeaders, invalidatePollingSession, messages.loadHistoryFailed, messages.loadHistoryGeneric, readResponseData, resetResultWorkspace, setError, setNotice])

  const handleDeleteHistory = useCallback(async (taskId) => {
    if (!authToken) {
      setError(messages.signinRequired)
      return
    }

    if (pendingDeleteTaskId !== taskId) {
      setError(null)
      setNotice(null)
      armPendingDeleteTask(taskId)
      showToast(messages.deleteHistoryConfirmPrompt)
      return
    }

    setHistoryDeletingTaskId(taskId)
    setError(null)
    setNotice(null)
    clearPendingDeleteTask()

    try {
      await readResponseData(
        await apiFetch(`${apiUrl}/api/history/${taskId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(authToken),
        }),
        messages.deleteHistoryFailed
      )

      setHistory((prev) => prev.filter((item) => item.task_id !== taskId))
      setHistoryLoaded(true)

      if ((result?.task_id || '') === taskId) {
        resetResultWorkspace(true)
        setCurrentStep(0)
        setLoading(false)
      }

      setNotice(messages.deleteHistorySuccess)
      showToast(messages.deleteHistorySuccess)
    } catch (error) {
      setError(error?.message || messages.deleteHistoryFailed)
    } finally {
      setHistoryDeletingTaskId('')
    }
  }, [apiUrl, armPendingDeleteTask, authToken, clearPendingDeleteTask, getAuthHeaders, messages.deleteHistoryConfirmPrompt, messages.deleteHistoryFailed, messages.deleteHistorySuccess, messages.signinRequired, pendingDeleteTaskId, readResponseData, resetResultWorkspace, result?.task_id, setError, setNotice, showToast])

  const handleDeleteAllHistory = useCallback(async () => {
    if (!authToken) {
      setError(messages.signinRequired)
      return
    }

    if (!pendingDeleteAll) {
      setError(null)
      setNotice(null)
      armPendingDeleteAll()
      showToast(messages.deleteAllHistoryConfirmPrompt)
      return
    }

    setHistoryBulkDeleting(true)
    setError(null)
    setNotice(null)
    clearPendingDeleteAll()

    try {
      const data = await readResponseData(
        await apiFetch(`${apiUrl}/api/history`, {
          method: 'DELETE',
          headers: getAuthHeaders(authToken),
        }),
        messages.deleteAllHistoryFailed
      )

      const deletedTaskIds = Array.isArray(data?.deleted_task_ids) ? data.deleted_task_ids : []
      const skippedActiveCount = Number(data?.skipped_active_count) || 0
      const deletedCount = Number(data?.deleted_count) || deletedTaskIds.length

      setHistory((prev) => prev.filter((item) => !deletedTaskIds.includes(item.task_id)))
      setHistoryLoaded(true)

      if (deletedTaskIds.includes(result?.task_id || '')) {
        resetResultWorkspace(true)
        setCurrentStep(0)
        setLoading(false)
      }

      const successMessage = skippedActiveCount > 0
        ? messages.deleteAllHistoryPartial
          .replace('{deletedCount}', String(deletedCount))
          .replace('{skippedCount}', String(skippedActiveCount))
        : messages.deleteAllHistorySuccess

      setNotice(successMessage)
      showToast(successMessage)
    } catch (error) {
      setError(error?.message || messages.deleteAllHistoryFailed)
    } finally {
      setHistoryBulkDeleting(false)
    }
  }, [apiUrl, armPendingDeleteAll, authToken, clearPendingDeleteAll, getAuthHeaders, messages.deleteAllHistoryConfirmPrompt, messages.deleteAllHistoryFailed, messages.deleteAllHistoryPartial, messages.deleteAllHistorySuccess, messages.signinRequired, pendingDeleteAll, readResponseData, resetResultWorkspace, result?.task_id, setError, setNotice, showToast])

  const exportAsTxt = useCallback(() => {
    if (!result) return
    const text = (result.corrected_text || result.raw_text || '').trim()
    if (!text) return
    const filename = `${sanitizeFileName(`${messages.transcriptFilename}_${new Date().toISOString().slice(0, 10)}`)}.txt`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    triggerBlobDownload(blob, filename)
  }, [messages.transcriptFilename, result])

  const exportAsDocx = useCallback(() => {
    if (!result) return
    const text = (result.corrected_text || result.raw_text || '').trim()
    if (!text) return
    const filename = `${sanitizeFileName(`${messages.transcriptFilename}_${new Date().toISOString().slice(0, 10)}`)}.docx`
    const blob = buildDocxBlob(messages.transcriptTitle, text)
    triggerBlobDownload(blob, filename)
  }, [messages.transcriptFilename, messages.transcriptTitle, result])

  const exportTextByLabel = useCallback((text, label, ext = 'txt') => {
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
  }, [])

  const handleSummarize = useCallback(async () => {
    if (!result?.corrected_text && !result?.raw_text) return
    if (!authToken) {
      setError(messages.summarizeLoginRequired)
      return
    }

    const summarizeEpoch = resultEpochRef.current
    const sourceTaskId = result?.task_id || ''
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const normalizedType = result?.transcription_type || transcriptionType || 'conversation'
      const normalizedStyle = resolveContentStyle(result)
      const formData = new FormData()
      formData.append('text', result.corrected_text || result.raw_text)
      formData.append('summary_type', 'short')
      formData.append('transcription_type', normalizedType)
      formData.append('content_style', normalizedStyle)
      formData.append('language', result?.language || language || messages.defaultLanguage)

      const response = await apiFetch(`${apiUrl}/api/summarize`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await readResponseData(response, messages.summarizeFailed)
      if (summarizeEpoch !== resultEpochRef.current) return
      setResult((prev) => {
        if (!prev) return prev
        if (sourceTaskId && prev.task_id && prev.task_id !== sourceTaskId) return prev
        return {
          ...prev,
          summary: data.summary,
          content_style: data.content_style || normalizedStyle,
        }
      })
    } catch (error) {
      setError(error?.message || messages.summarizeFailed)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, authToken, getAuthHeaders, language, messages.defaultLanguage, messages.summarizeFailed, messages.summarizeLoginRequired, readResponseData, resolveContentStyle, result, setError, setNotice, transcriptionType])

  const handleGenerateRecordDraft = useCallback(async (category) => {
    if (!result?.corrected_text && !result?.raw_text) return
    if (!authToken) {
      setError(messages.draftLoginRequired)
      return
    }

    setError(null)
    setNotice(null)
    setDraftLoadingCategory(category)
    const draftEpoch = resultEpochRef.current

    try {
      const formData = new FormData()
      formData.append('text', result.corrected_text || result.raw_text)
      formData.append('category', category)
      formData.append('language', result?.language || language || messages.defaultLanguage)

      const response = await apiFetch(`${apiUrl}/api/records/draft`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await readResponseData(response, messages.draftFailed)
      if (draftEpoch !== resultEpochRef.current) return
      setRecordDrafts((prev) => ({ ...prev, [category]: data.content || '' }))
      setNotice(`${data.category_label || messages.recordDefaultLabel} ${messages.draftCreatedSuffix}`)
    } catch (error) {
      setError(error?.message || messages.draftFailedGeneric)
    } finally {
      setDraftLoadingCategory('')
    }
  }, [apiUrl, authToken, getAuthHeaders, language, messages.defaultLanguage, messages.draftCreatedSuffix, messages.draftFailed, messages.draftFailedGeneric, messages.draftLoginRequired, messages.recordDefaultLabel, readResponseData, result, setError, setNotice])

  const handleRecordDraftChange = useCallback((category, value) => {
    setRecordDrafts((prev) => ({ ...prev, [category]: value }))
  }, [])

  const handleSaveRecord = useCallback(async (category) => {
    if (!authToken) {
      setError(messages.saveLoginRequired)
      return
    }

    const content = (recordDrafts[category] || '').trim()
    if (!content) {
      setError(messages.saveEmpty)
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

      const response = await apiFetch(`${apiUrl}/api/records`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      await readResponseData(response, messages.saveFailed)

      setNotice(messages.saveSuccess)
      fetchSavedRecords()
      setShowRecords(true)
    } catch (error) {
      setError(error?.message || messages.saveFailed)
    } finally {
      setSavingCategory('')
    }
  }, [apiUrl, authToken, fetchSavedRecords, getAuthHeaders, messages.saveEmpty, messages.saveFailed, messages.saveLoginRequired, messages.saveSuccess, readResponseData, recordDrafts, recordTypeLabels, result, setError, setNotice])

  const usageState = useMemo(() => {
    return (usage) => {
      const currentUsage = usage || null
      const planTier = currentUsage?.plan_tier || (authToken ? 'free' : 'guest')
      const isFreeTier = planTier === 'free' || planTier === 'guest'
      const monthlyLimitSeconds = currentUsage?.monthly_limit_seconds || (planTier === 'guest' ? GUEST_MONTHLY_LIMIT_SECONDS : FREE_MONTHLY_LIMIT_SECONDS)
      const maxAudioSeconds = Number(currentUsage?.max_audio_seconds) || (planTier === 'guest' ? GUEST_MAX_AUDIO_SECONDS : 0)
      const remainingQuotaSeconds = isFreeTier
        ? Math.max(0, currentUsage?.remaining_seconds ?? monthlyLimitSeconds)
        : Number.MAX_SAFE_INTEGER
      const fileExceedsRemainingQuota = isFreeTier && fileDurationSeconds > 0 && (
        fileDurationSeconds > remainingQuotaSeconds ||
        (planTier === 'guest' && maxAudioSeconds > 0 && fileDurationSeconds > maxAudioSeconds)
      )
      const uploadBlockedByQuota = isFreeTier && remainingQuotaSeconds <= 0

      return {
        isFreeTier,
        planTier,
        monthlyLimitSeconds,
        remainingQuotaSeconds,
        fileExceedsRemainingQuota,
        uploadBlockedByQuota,
      }
    }
  }, [authToken, fileDurationSeconds])

  return {
    file,
    setFile,
    setFileDurationSeconds,
    language,
    setLanguage,
    transcriptionType,
    setTranscriptionType,
    loading,
    result,
    history,
    historyLoading,
    historyLoaded,
    historyDeletingTaskId,
    historyBulkDeleting,
    pendingDeleteTaskId,
    pendingDeleteAll,
    currentStep,
    dragOver,
    showHistory,
    setShowHistory,
    showRecords,
    setShowRecords,
    savedRecords,
    recordsLoading,
    recordsLoaded,
    recordDrafts,
    draftLoadingCategory,
    savingCategory,
    fileDurationSeconds,
    guestUsage,
    guestTranscribeHint: messages.guestTranscribeHint,
    guestTranscribeStart: messages.guestTranscribeStart,
    isGuestMode: !authToken,
    fileInputRef,
    usageState,
    resolveContentStyle,
    resetState,
    fetchHistory,
    fetchSavedRecords,
    handleFileChange,
    triggerFilePicker,
    handleUploadZoneKeyDown,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleSubmit,
    handleLoadHistory,
    handleDeleteHistory,
    handleDeleteAllHistory,
    cancelPendingDeleteTask: clearPendingDeleteTask,
    cancelPendingDeleteAll: clearPendingDeleteAll,
    exportAsTxt,
    exportAsDocx,
    exportTextByLabel,
    handleSummarize,
    handleGenerateRecordDraft,
    handleRecordDraftChange,
    handleSaveRecord,
    copyFailedMessage: messages.copyFailed,
  }
}
