import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAudioDurationSecondsInBrowser } from '../utils/audio'
import { buildDocxBlob } from '../utils/docx'
import { sanitizeFileName, triggerBlobDownload } from '../utils/format'
import useProtectedAccess from './useProtectedAccess'
import {
  EMPTY_TRANSCRIPTION_PROGRESS,
  normalizeTranscriptionProgress,
} from '../utils/transcriptionProgress'
import {
  buildLogFrequencyBands,
  calculateSignalRms,
  createEmptyRecordingSignal,
  detectSignalPitch,
  downsampleWaveform,
} from '../utils/recordingSignal'

const RECORDING_DEVICE_STORAGE_KEY = 'mallog24_recording_device_id'
const TRANSCRIBE_POLL_TIMEOUT_MS = 2 * 60 * 60 * 1000
const STATUS_POLL_INTERVAL_MS = 3000
const STATUS_POLL_REQUEST_TIMEOUT_MS = 30000
const HISTORY_DELETE_CONFIRM_WINDOW_MS = 5000

function createUploadRequestId() {
  const generated = typeof window !== 'undefined' && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  return `upload-${generated}`
}

function resolveRecordingMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || ''
}

function resolveRecordingExtension(mimeType) {
  if (String(mimeType || '').includes('mp4')) return 'm4a'
  if (String(mimeType || '').includes('ogg')) return 'ogg'
  return 'webm'
}

function buildRecordingFilename(extension) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
  return `mallog24-recording-${stamp}.${extension}`
}

const TRANSCRIPTION_MESSAGES = {
  ko: {
    fileSizeExceeded: '파일 크기는 100MB 이하여야 합니다.',
    browserDurationFallback: '브라우저에서 길이 확인에 실패해 업로드는 진행합니다. 서버에서 길이를 다시 검사합니다.',
    pollingSlow: '상태 확인 응답이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.',
    pollingNetwork: '네트워크 오류로 상태 확인이 불안정합니다. 잠시 후 다시 확인해 주세요.',
    pollingFailed: '상태 확인이 반복해서 실패했습니다. 잠시 후 새 변환으로 다시 시도해 주세요.',
    processingSlow: '처리 시간이 길어지고 있습니다. 잠시 후 히스토리에서 다시 확인해 주세요.',
    taskNotFound: '작업 상태를 찾을 수 없습니다. 새로 변환을 다시 시도해 주세요.',
    taskIdLabel: '작업 ID',
    signinRequired: '파일 변환은 로그인 후 이용할 수 있습니다.',
    selectFile: '파일을 선택해주세요.',
    recordingUnsupported: '이 브라우저에서는 녹음 기능을 사용할 수 없습니다. 최신 Chrome, Edge, Safari를 사용하거나 파일 업로드를 이용해 주세요.',
    recordingPermissionDenied: '마이크 권한이 필요합니다. 브라우저 주소창과 운영체제의 개인정보 보호·마이크 설정에서 접근을 허용해 주세요.',
    recordingStartFailed: '녹음을 시작하지 못했습니다. 마이크 권한과 입력 장치를 확인해 주세요.',
    recordingDeviceFallback: '선택한 마이크를 사용할 수 없어 시스템 기본 마이크로 연결했습니다.',
    recordingMicrophoneFallback: '마이크',
    recordingStopFailed: '녹음을 저장하지 못했습니다. 다시 시도해 주세요.',
    recordingEmpty: '녹음된 음성이 없습니다. 조금 더 길게 녹음한 뒤 다시 시도해 주세요.',
    recordingReady: '녹음 파일이 준비되었습니다. 변환하기를 눌러 진행해 주세요.',
    recordingCanceled: '녹음을 취소했습니다.',
    uploadRetrying: '네트워크 연결이 불안정해 파일 업로드를 안전하게 다시 시도하고 있습니다.',
    duplicateActiveJob: '동일한 파일의 기존 변환 작업을 이어서 확인합니다. 변환 버튼을 다시 누르지 않아도 됩니다.',
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
    recordUpdateFailed: '기록본 수정 실패',
    recordUpdateSuccess: '기록본을 수정했습니다.',
    correctionLoginRequired: '수정 결과 저장은 로그인 후 이용할 수 있습니다.',
    correctionEmpty: '저장할 수정 텍스트가 없습니다.',
    correctionNoChanges: '저장할 변경 사항이 없습니다.',
    correctionSaveFailed: '수정 결과 저장 실패',
    correctionSaveSuccess: '수정 결과를 저장했습니다.',
    correctionAppliedNoTraining: '수정 결과를 화면에 반영했습니다. 학습 데이터로는 저장하지 않았습니다.',
    transcriptTitle: '녹취록',
    transcriptFilename: '녹취록',
    copyFailed: '클립보드 복사에 실패했습니다.',
    resolveStyleMeetingFallback: 'conversation',
    defaultLanguage: 'ko',
  },
  en: {
    fileSizeExceeded: 'File size must be 100MB or less.',
    browserDurationFallback: 'Could not read duration in browser. Upload continues and the server will validate duration.',
    pollingSlow: 'Status checks are delayed. Please try again shortly.',
    pollingNetwork: 'Network errors are interrupting status checks. Please try again shortly.',
    pollingFailed: 'Status checks failed repeatedly. Please try a new transcription shortly.',
    processingSlow: 'This task is taking longer than expected. Please check it again from History shortly.',
    taskNotFound: 'Task status was not found. Please try a new transcription.',
    taskIdLabel: 'Task ID',
    signinRequired: 'Sign in is required before transcription.',
    selectFile: 'Please select an audio file.',
    recordingUnsupported: 'Recording is not available in this browser. Please use the latest Chrome, Edge, Safari, or upload a file instead.',
    recordingPermissionDenied: 'Microphone permission is required. Allow access in both the browser and the operating system microphone privacy settings.',
    recordingStartFailed: 'Could not start recording. Please check microphone permission and input device.',
    recordingDeviceFallback: 'The selected microphone was unavailable, so the system default microphone was connected.',
    recordingMicrophoneFallback: 'Microphone',
    recordingStopFailed: 'Could not save the recording. Please try again.',
    recordingEmpty: 'No audio was recorded. Please record a little longer and try again.',
    recordingReady: 'Recording is ready. Press Start Transcription to continue.',
    recordingCanceled: 'Recording canceled.',
    uploadRetrying: 'The connection is unstable. Retrying the file upload safely.',
    duplicateActiveJob: 'Continuing the existing job for this file. You do not need to press the transcription button again.',
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
    recordUpdateFailed: 'Failed to update record.',
    recordUpdateSuccess: 'Record updated.',
    correctionLoginRequired: 'Please log in to save corrections.',
    correctionEmpty: 'Edited transcript is empty.',
    correctionNoChanges: 'No transcript changes to save.',
    correctionSaveFailed: 'Failed to save correction.',
    correctionSaveSuccess: 'Correction saved.',
    correctionAppliedNoTraining: 'Correction applied locally. It was not saved as training data.',
    transcriptTitle: 'Transcript',
    transcriptFilename: 'transcript',
    copyFailed: 'Failed to copy to clipboard.',
    resolveStyleMeetingFallback: 'conversation',
    defaultLanguage: 'en',
  },
}

export default function useMallogTranscription({
  apiUrl,
  locale = 'ko',
  authToken,
  accessEnabled = false,
  authSessionRevision = 0,
  getAuthHeaders,
  fetchUsage,
  setError,
  setNotice,
  showToast,
  recordTypeLabels,
}) {
  const messages = TRANSCRIPTION_MESSAGES[locale] || TRANSCRIPTION_MESSAGES.ko
  const access = useProtectedAccess({ apiUrl, authToken, accessEnabled, authSessionRevision })
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
  const [processingProgress, setProcessingProgress] = useState(EMPTY_TRANSCRIPTION_PROGRESS)
  const [dragOver, setDragOver] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRecords, setShowRecords] = useState(false)
  const [savedRecords, setSavedRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsLoaded, setRecordsLoaded] = useState(false)
  const [savedRecordEditDrafts, setSavedRecordEditDrafts] = useState({})
  const [savedRecordSavingId, setSavedRecordSavingId] = useState('')
  const [recordDrafts, setRecordDrafts] = useState({})
  const [recordDraftSources, setRecordDraftSources] = useState({})
  const [draftLoadingCategory, setDraftLoadingCategory] = useState('')
  const [savingCategory, setSavingCategory] = useState('')
  const [transcriptEditText, setTranscriptEditText] = useState('')
  const [transcriptEditSaving, setTranscriptEditSaving] = useState(false)
  const [trainingDataConsent, setTrainingDataConsent] = useState(false)
  const [fileDurationSeconds, setFileDurationSeconds] = useState(0)
  const [recordingState, setRecordingState] = useState('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordingLevel, setRecordingLevel] = useState(0)
  const [recordingSignal, setRecordingSignal] = useState(() => createEmptyRecordingSignal())
  const [recordingDevices, setRecordingDevices] = useState([])
  const [selectedRecordingDeviceId, setSelectedRecordingDeviceId] = useState('')
  const [activeRecordingDeviceLabel, setActiveRecordingDeviceLabel] = useState('')
  const [recordingInputState, setRecordingInputState] = useState('idle')
  const pollInterval = useRef(null)
  const fileInputRef = useRef(null)
  const pollStartTime = useRef(null)
  const pollTokenRef = useRef(0)
  const activeTaskIdRef = useRef('')
  const pollResultCommitTimerRef = useRef(null)
  const pollFailureCountRef = useRef(0)
  const pollInFlightRef = useRef(false)
  const fileDurationProbeRef = useRef(0)
  const resultEpochRef = useRef(0)
  const historyDeleteConfirmTimerRef = useRef(null)
  const historyDeleteAllConfirmTimerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingStreamRef = useRef(null)
  const recordingChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const recordingStartedAtRef = useRef(0)
  const recordingAudioContextRef = useRef(null)
  const recordingSourceNodeRef = useRef(null)
  const recordingAnalyserRef = useRef(null)
  const recordingLevelDataRef = useRef(null)
  const recordingByteLevelDataRef = useRef(null)
  const recordingFrequencyDataRef = useRef(null)
  const recordingSignalRef = useRef(createEmptyRecordingSignal())
  const recordingMeterFrameRef = useRef(null)
  const recordingNoSignalTimerRef = useRef(null)
  const recordingInputStateRef = useRef('idle')
  const discardRecordingRef = useRef(false)

  const updateRecordingInputState = useCallback((nextState) => {
    if (!nextState || recordingInputStateRef.current === nextState) return
    recordingInputStateRef.current = nextState
    setRecordingInputState(nextState)
  }, [])

  const selectRecordingDevice = useCallback((deviceId) => {
    if (!access.isCurrent()) return
    const normalizedId = String(deviceId || '')
    setSelectedRecordingDeviceId(normalizedId)
    if (typeof window === 'undefined') return
    if (normalizedId) {
      window.localStorage.setItem(RECORDING_DEVICE_STORAGE_KEY, normalizedId)
    } else {
      window.localStorage.removeItem(RECORDING_DEVICE_STORAGE_KEY)
    }
  }, [access])

  const resumeRecordingAnalysis = useCallback(async () => {
    if (!access.isCurrent()) return
    const audioContext = recordingAudioContextRef.current
    if (!audioContext?.resume) return false

    try {
      await audioContext.resume()
      if (!access.isCurrent()) return false
      if (audioContext.state === 'running') {
        updateRecordingInputState('listening')
        return true
      }
    } catch {
      if (!access.isCurrent()) return
      // The visible input state remains actionable for another user gesture.
    }
    updateRecordingInputState('analysis-blocked')
    return false
  }, [access, updateRecordingInputState])

  const refreshRecordingDevices = useCallback(async () => {
    if (!access.isCurrent()) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return []

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      if (!access.isCurrent()) return []
      const audioInputs = devices
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          groupId: device.groupId,
          label: device.label || `${messages.recordingMicrophoneFallback} ${index + 1}`,
        }))
      setRecordingDevices(audioInputs)
      setSelectedRecordingDeviceId((currentId) => {
        if (!currentId || audioInputs.some((device) => device.deviceId === currentId)) return currentId
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(RECORDING_DEVICE_STORAGE_KEY)
        }
        return ''
      })
      return audioInputs
    } catch {
      if (!access.isCurrent()) return
      return []
    }
  }, [access, messages.recordingMicrophoneFallback])

  useEffect(() => {
    if (!access.isCurrent()) return undefined
    if (typeof window !== 'undefined') {
      setSelectedRecordingDeviceId(window.localStorage.getItem(RECORDING_DEVICE_STORAGE_KEY) || '')
    }
    refreshRecordingDevices()

    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null
    if (!mediaDevices?.addEventListener) return undefined
    mediaDevices.addEventListener('devicechange', refreshRecordingDevices)
    return () => mediaDevices.removeEventListener('devicechange', refreshRecordingDevices)
  }, [access, refreshRecordingDevices])

  const readResponseData = useCallback(async (response, fallbackMessage) => {
    const data = await access.readJson(response)
    if (!response.ok) {
      throw new Error(data?.detail || fallbackMessage)
    }
    return data || {}
  }, [access])

  const transcriptSourceText = useMemo(
    () => String(result?.corrected_text || result?.raw_text || ''),
    [result?.corrected_text, result?.raw_text]
  )

  const compactTranscriptText = useCallback((value) => String(value || '').trim().replace(/\s+/g, ' '), [])

  const transcriptHasUnsavedEdit = useMemo(
    () => Boolean(result) && compactTranscriptText(transcriptSourceText) !== compactTranscriptText(transcriptEditText),
    [compactTranscriptText, result, transcriptEditText, transcriptSourceText]
  )

  const getActiveTranscriptText = useCallback(
    () => String(transcriptEditText || transcriptSourceText || '').trim(),
    [transcriptEditText, transcriptSourceText]
  )

  useEffect(() => {
    setTranscriptEditText(transcriptSourceText)
  }, [result?.task_id, transcriptSourceText])

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
    pollInFlightRef.current = false
    pollStartTime.current = null
    clearPollResultCommitTimer()
  }, [clearPollResultCommitTimer])

  const failPolling = useCallback((taskId, message) => {
    stopPolling()
    activeTaskIdRef.current = ''
    setLoading(false)
    setCurrentStep(0)
    setProcessingProgress(normalizeTranscriptionProgress(null, 'error'))
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
    setRecordDraftSources({})
    setTranscriptEditText('')
    setTranscriptEditSaving(false)
    return resultEpochRef.current
  }, [])

  const resetState = useCallback(() => {
    invalidatePollingSession()
    fileDurationProbeRef.current += 1
    resultEpochRef.current += 1
    setDragOver(false)
    setTrainingDataConsent(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    clearPendingDeleteTask()
    clearPendingDeleteAll()
    setLoading(false)
    setCurrentStep(0)
    setProcessingProgress(EMPTY_TRANSCRIPTION_PROGRESS)
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
    setSavedRecordEditDrafts({})
    setSavedRecordSavingId('')
    setRecordDrafts({})
    setRecordDraftSources({})
    setDraftLoadingCategory('')
    setSavingCategory('')
    setTranscriptEditText('')
    setTranscriptEditSaving(false)
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
    if (!access.isCurrent()) return
    if (!token) {
      setHistory([])
      setHistoryLoaded(false)
      return
    }

    setHistoryLoading(true)
    try {
      const res = await access.request(`${apiUrl}/api/history`, {
        headers: getAuthHeaders(token),
      })
      const data = await readResponseData(
        res,
        locale === 'en' ? 'Failed to load transcription history.' : '변환 기록을 불러오지 못했습니다.'
      )
      setHistory(Array.isArray(data) ? data : [])
      setHistoryLoaded(true)
    } catch (error) {
      if (!access.isCurrent()) return
      console.error('Failed to fetch history', error)
    } finally {
      if (!access.isCurrent()) return
      setHistoryLoading(false)
    }
  }, [access, apiUrl, authToken, getAuthHeaders, locale, readResponseData])

  const fetchSavedRecords = useCallback(async (token = authToken) => {
    if (!access.isCurrent()) return
    if (!token) {
      setSavedRecords([])
      setRecordsLoaded(false)
      return
    }

    setRecordsLoading(true)
    try {
      const res = await access.request(`${apiUrl}/api/records`, {
        headers: getAuthHeaders(token),
      })
      const data = await readResponseData(
        res,
        locale === 'en' ? 'Failed to load saved records.' : '저장 기록을 불러오지 못했습니다.'
      )
      setSavedRecords(Array.isArray(data) ? data : [])
      setRecordsLoaded(true)
    } catch (error) {
      if (!access.isCurrent()) return
      console.error('Failed to fetch saved records', error)
    } finally {
      if (!access.isCurrent()) return
      setRecordsLoading(false)
    }
  }, [access, apiUrl, authToken, getAuthHeaders, locale, readResponseData])

  useEffect(() => {
    if (!access.isCurrent() || !showHistory || historyLoaded || historyLoading) return
    fetchHistory(authToken)
  }, [access, authToken, fetchHistory, historyLoaded, historyLoading, showHistory])

  useEffect(() => {
    if (!access.isCurrent() || !showRecords || recordsLoaded || recordsLoading) return
    fetchSavedRecords(authToken)
  }, [access, authToken, fetchSavedRecords, recordsLoaded, recordsLoading, showRecords])

  const validateAndSetFile = useCallback(async (selectedFile, usage) => {
    if (!access.isCurrent()) return
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError(messages.fileSizeExceeded)
      return false
    }

    const probeId = fileDurationProbeRef.current + 1
    fileDurationProbeRef.current = probeId

    try {
      const durationSeconds = await getAudioDurationSecondsInBrowser(selectedFile)
      if (!access.isCurrent()) return false
      if (fileDurationProbeRef.current !== probeId) return false

      setFile(selectedFile)
      setFileDurationSeconds(durationSeconds)
      setError(null)
      setNotice(null)
      resetResultWorkspace(true)
      return true
    } catch {
      if (!access.isCurrent()) return
      if (fileDurationProbeRef.current !== probeId) return false
      setFile(selectedFile)
      setFileDurationSeconds(0)
      setError(null)
      setNotice(messages.browserDurationFallback)
      resetResultWorkspace(true)
      return true
    }
  }, [access, authToken, messages.browserDurationFallback, messages.fileSizeExceeded, resetResultWorkspace, setError, setNotice, showToast])

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }, [])

  const stopRecordingMeter = useCallback(() => {
    if (recordingMeterFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(recordingMeterFrameRef.current)
      recordingMeterFrameRef.current = null
    }
    if (recordingNoSignalTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(recordingNoSignalTimerRef.current)
      recordingNoSignalTimerRef.current = null
    }
    recordingSourceNodeRef.current?.disconnect?.()
    recordingSourceNodeRef.current = null
    recordingAnalyserRef.current = null
    recordingLevelDataRef.current = null
    recordingByteLevelDataRef.current = null
    recordingFrequencyDataRef.current = null
    recordingSignalRef.current = createEmptyRecordingSignal()
    const audioContext = recordingAudioContextRef.current
    recordingAudioContextRef.current = null
    if (audioContext) audioContext.onstatechange = null
    audioContext?.close?.().catch?.(() => {})
    setRecordingLevel(0)
    setRecordingSignal(recordingSignalRef.current)
  }, [])

  const startRecordingMeter = useCallback(async (stream, preparedAudioContext = null, preparedResume = null) => {
    if (!access.isCurrent()) return
    if (!preparedAudioContext) stopRecordingMeter()
    if (typeof window === 'undefined') return

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) {
      updateRecordingInputState('analysis-blocked')
      return
    }

    try {
      const audioContext = preparedAudioContext || new AudioContextConstructor()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.68
      analyser.minDecibels = -90
      analyser.maxDecibels = -12
      const sourceNode = audioContext.createMediaStreamSource(stream)
      sourceNode.connect(analyser)

      const data = new Float32Array(analyser.fftSize)
      const byteData = new Uint8Array(analyser.fftSize)
      const frequencyData = new Uint8Array(analyser.frequencyBinCount)
      recordingAudioContextRef.current = audioContext
      recordingSourceNodeRef.current = sourceNode
      recordingAnalyserRef.current = analyser
      recordingLevelDataRef.current = data
      recordingByteLevelDataRef.current = byteData
      recordingFrequencyDataRef.current = frequencyData

      const scheduleNoSignalCheck = () => {
        if (recordingNoSignalTimerRef.current) {
          window.clearTimeout(recordingNoSignalTimerRef.current)
        }
        recordingNoSignalTimerRef.current = window.setTimeout(() => {
          if (!access.isCurrent()) return
          if (recordingInputStateRef.current === 'listening') {
            updateRecordingInputState('no-signal')
          }
        }, 3000)
      }

      audioContext.onstatechange = () => {
        if (!access.isCurrent()) return
        if (audioContext.state === 'running') {
          if (recordingInputStateRef.current === 'analysis-blocked') {
            updateRecordingInputState('listening')
          }
          scheduleNoSignalCheck()
        } else if (audioContext.state === 'suspended') {
          updateRecordingInputState('analysis-blocked')
        }
      }

      try {
        await (preparedResume || audioContext.resume?.())
        if (!access.isCurrent()) return
      } catch {
        if (!access.isCurrent()) return
        updateRecordingInputState('analysis-blocked')
      }
      if (audioContext.state === 'running') {
        scheduleNoSignalCheck()
      } else {
        updateRecordingInputState('analysis-blocked')
      }

      let lastLevel = 0
      let lastAnalysisAt = 0
      let lastPitchAt = 0
      let currentPitch = recordingSignalRef.current.pitch
      const updateMeter = (timestamp = 0) => {
        if (!access.isCurrent()) return
        const activeAnalyser = recordingAnalyserRef.current
        const activeData = recordingLevelDataRef.current
        const activeByteData = recordingByteLevelDataRef.current
        const activeFrequencyData = recordingFrequencyDataRef.current
        if (!activeAnalyser || !activeData || !activeByteData || !activeFrequencyData) return

        if (timestamp - lastAnalysisAt < 48) {
          recordingMeterFrameRef.current = window.requestAnimationFrame(updateMeter)
          return
        }
        lastAnalysisAt = timestamp

        if (typeof activeAnalyser.getFloatTimeDomainData === 'function') {
          activeAnalyser.getFloatTimeDomainData(activeData)
        } else {
          activeAnalyser.getByteTimeDomainData(activeByteData)
          for (let index = 0; index < activeByteData.length; index += 1) {
            activeData[index] = (activeByteData[index] - 128) / 128
          }
        }
        activeAnalyser.getByteFrequencyData(activeFrequencyData)
        const rms = calculateSignalRms(activeData)
        const nextLevel = Math.max(0, Math.min(1, rms * 4.8))
        if (rms >= 0.004 && recordingInputStateRef.current !== 'detected') {
          updateRecordingInputState('detected')
        }
        const previousSignal = recordingSignalRef.current
        const spectrum = buildLogFrequencyBands(
          activeFrequencyData,
          audioContext.sampleRate,
          previousSignal.spectrum
        )

        if (timestamp - lastPitchAt >= 96) {
          currentPitch = detectSignalPitch(activeData, audioContext.sampleRate)
          lastPitchAt = timestamp
        }

        const nextSignal = {
          waveform: downsampleWaveform(activeData),
          spectrum,
          pitch: currentPitch,
        }
        recordingSignalRef.current = nextSignal
        setRecordingSignal(nextSignal)

        if (Math.abs(nextLevel - lastLevel) > 0.01) {
          lastLevel = nextLevel
          setRecordingLevel(nextLevel)
        }
        recordingMeterFrameRef.current = window.requestAnimationFrame(updateMeter)
      }

      recordingMeterFrameRef.current = window.requestAnimationFrame(updateMeter)
    } catch {
      if (!access.isCurrent()) return
      stopRecordingMeter()
      updateRecordingInputState('analysis-blocked')
    }
  }, [access, stopRecordingMeter, updateRecordingInputState])

  const stopRecordingStream = useCallback(() => {
    stopRecordingMeter()
    recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    recordingStreamRef.current = null
    setActiveRecordingDeviceLabel('')
    updateRecordingInputState('idle')
  }, [stopRecordingMeter, updateRecordingInputState])

  const startRecording = useCallback(async (uploadBlockedByQuota) => {
    if (!access.isCurrent()) return
    if (loading || recordingState === 'recording' || recordingState === 'requesting' || recordingState === 'stopping') return

    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      setError(messages.recordingUnsupported)
      return
    }

    setRecordingState('requesting')
    setRecordingSeconds(0)
    setError(null)
    setNotice(null)

    stopRecordingMeter()
    let preparedAudioContext = null
    let preparedAudioContextResume = null
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (AudioContextConstructor) {
      try {
        preparedAudioContext = new AudioContextConstructor()
        recordingAudioContextRef.current = preparedAudioContext
        preparedAudioContextResume = preparedAudioContext.resume?.()
        preparedAudioContextResume?.catch(() => {})
      } catch {
        if (!access.isCurrent()) return
        preparedAudioContext = null
        preparedAudioContextResume = null
      }
    }

    try {
      const baseAudioConstraints = {
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      }
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedRecordingDeviceId
            ? { ...baseAudioConstraints, deviceId: { exact: selectedRecordingDeviceId } }
            : baseAudioConstraints,
        })
      } catch (deviceError) {
        if (!access.isCurrent()) return
        const canRetryDefault = selectedRecordingDeviceId && [
          'AbortError',
          'NotFoundError',
          'NotReadableError',
          'OverconstrainedError',
        ].includes(deviceError?.name)
        if (!canRetryDefault) throw deviceError

        selectRecordingDevice('')
        stream = await navigator.mediaDevices.getUserMedia({ audio: baseAudioConstraints })
        if (access.isCurrent()) setNotice(messages.recordingDeviceFallback)
      }

      if (!access.isCurrent()) {
        stream.getTracks?.().forEach((track) => track.stop())
        return
      }

      const audioTrack = stream.getAudioTracks?.()[0]
      if (!audioTrack || audioTrack.readyState !== 'live') {
        stream.getTracks?.().forEach((track) => track.stop())
        throw new Error('No live microphone track')
      }

      const mimeType = resolveRecordingMimeType()
      const recorder = mimeType ? new window.MediaRecorder(stream, { mimeType }) : new window.MediaRecorder(stream)

      discardRecordingRef.current = false
      recordingStreamRef.current = stream
      mediaRecorderRef.current = recorder
      recordingChunksRef.current = []
      const availableDevices = await refreshRecordingDevices()
      if (!access.isCurrent()) {
        stream.getTracks?.().forEach((track) => track.stop())
        return
      }
      const activeDeviceId = audioTrack.getSettings?.().deviceId || ''
      const activeDevice = availableDevices.find((device) => device.deviceId === activeDeviceId)
      setActiveRecordingDeviceLabel(
        audioTrack.label || activeDevice?.label || messages.recordingMicrophoneFallback
      )
      updateRecordingInputState(audioTrack.muted ? 'muted' : 'listening')
      audioTrack.addEventListener?.('mute', () => access.isCurrent() && updateRecordingInputState('muted'))
      audioTrack.addEventListener?.('unmute', () => access.isCurrent() && updateRecordingInputState('listening'))
      audioTrack.addEventListener?.('ended', () => access.isCurrent() && updateRecordingInputState('ended'))
      await startRecordingMeter(stream, preparedAudioContext, preparedAudioContextResume)
      if (!access.isCurrent()) {
        stream.getTracks?.().forEach((track) => track.stop())
        return
      }
      fileDurationProbeRef.current += 1
      setFile(null)
      setFileDurationSeconds(0)
      resetResultWorkspace(true)

      recorder.ondataavailable = (event) => {
        if (!access.isCurrent()) return
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data)
        }
      }
      recorder.onerror = () => {
        if (!access.isCurrent()) return
        clearRecordingTimer()
        stopRecordingStream()
        setRecordingState('idle')
        setError(messages.recordingStartFailed)
      }
      recorder.start(1000)
      recordingStartedAtRef.current = Date.now()
      recordingTimerRef.current = window.setInterval(() => {
        if (!access.isCurrent()) return
        setRecordingSeconds(Math.max(1, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)))
      }, 500)
      setRecordingState('recording')
    } catch (error) {
      if (!access.isCurrent()) return
      clearRecordingTimer()
      stopRecordingStream()
      mediaRecorderRef.current = null
      setRecordingState('idle')
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
      setError(denied ? messages.recordingPermissionDenied : messages.recordingStartFailed)
    }
  }, [access, clearRecordingTimer, loading, messages.recordingDeviceFallback, messages.recordingMicrophoneFallback, messages.recordingPermissionDenied, messages.recordingStartFailed, messages.recordingUnsupported, recordingState, refreshRecordingDevices, resetResultWorkspace, selectRecordingDevice, selectedRecordingDeviceId, setError, setFileDurationSeconds, setNotice, showToast, startRecordingMeter, stopRecordingMeter, stopRecordingStream, updateRecordingInputState])

  const stopRecording = useCallback(async (usage) => {
    if (!access.isCurrent()) return
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    setRecordingState('stopping')
    clearRecordingTimer()

    try {
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve
      })
      recorder.requestData?.()
      recorder.stop()
      await stopped
      if (!access.isCurrent()) return

      stopRecordingStream()
      mediaRecorderRef.current = null

      if (discardRecordingRef.current) {
        recordingChunksRef.current = []
        discardRecordingRef.current = false
        setRecordingSeconds(0)
        setRecordingState('idle')
        setNotice(messages.recordingCanceled)
        return
      }

      const mimeType = recorder.mimeType || resolveRecordingMimeType() || 'audio/webm'
      const blob = new Blob(recordingChunksRef.current, { type: mimeType })
      recordingChunksRef.current = []

      if (!blob.size) {
        setRecordingSeconds(0)
        setRecordingState('idle')
        setError(messages.recordingEmpty)
        return
      }

      const extension = resolveRecordingExtension(mimeType)
      const filename = buildRecordingFilename(extension)
      const recordedFile = typeof File === 'function'
        ? new File([blob], filename, { type: mimeType, lastModified: Date.now() })
        : Object.assign(blob, { name: filename, lastModified: Date.now() })

      const accepted = await validateAndSetFile(recordedFile, usage)
      if (!access.isCurrent()) return
      setRecordingState('idle')
      if (accepted) {
        setNotice(messages.recordingReady)
      }
    } catch (error) {
      if (!access.isCurrent()) return
      stopRecordingStream()
      mediaRecorderRef.current = null
      recordingChunksRef.current = []
      setRecordingSeconds(0)
      setRecordingState('idle')
      setError(messages.recordingStopFailed)
    }
  }, [access, clearRecordingTimer, messages.recordingCanceled, messages.recordingEmpty, messages.recordingReady, messages.recordingStopFailed, setError, setNotice, stopRecordingStream, validateAndSetFile])

  const cancelRecording = useCallback(async () => {
    if (!access.isCurrent()) return
    const recorder = mediaRecorderRef.current
    discardRecordingRef.current = true
    if (recorder && recorder.state !== 'inactive') {
      await stopRecording(null)
      return
    }

    clearRecordingTimer()
    stopRecordingStream()
    recordingChunksRef.current = []
    mediaRecorderRef.current = null
    discardRecordingRef.current = false
    setRecordingSeconds(0)
    setRecordingState('idle')
    setNotice(messages.recordingCanceled)
  }, [access, clearRecordingTimer, messages.recordingCanceled, setNotice, stopRecording, stopRecordingStream])

  useEffect(() => {
    const clearAccessState = () => {
      resetState()
      clearRecordingTimer()
      const recorder = mediaRecorderRef.current
      mediaRecorderRef.current = null
      if (recorder) {
        recorder.ondataavailable = null
        recorder.onerror = null
        if (recorder.state !== 'inactive') recorder.stop()
      }
      stopRecordingStream()
      recordingChunksRef.current = []
      discardRecordingRef.current = true
      setRecordingState('idle')
      setRecordingSeconds(0)
      setRecordingDevices([])
    }
    clearAccessState()
    const signal = access.controller.signal
    signal.addEventListener('abort', clearAccessState, { once: true })
    return () => {
      signal.removeEventListener('abort', clearAccessState)
      clearAccessState()
    }
  }, [access, clearRecordingTimer, resetState, stopRecordingStream])

  const handleFileChange = useCallback((event, usage) => {
    if (!access.isCurrent()) return
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile, usage)
    }
  }, [access, validateAndSetFile])

  const triggerFilePicker = useCallback((uploadBlockedByQuota) => {
    if (!access.isCurrent()) return
    fileInputRef.current?.click()
  }, [access, showToast])

  const handleUploadZoneKeyDown = useCallback((event, uploadBlockedByQuota) => {
    if (!access.isCurrent()) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      triggerFilePicker(uploadBlockedByQuota)
    }
  }, [access, triggerFilePicker])

  const handleDrop = useCallback((event, usage) => {
    event.preventDefault()
    if (!access.isCurrent()) return
    setDragOver(false)
    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile, usage)
    }
  }, [access, validateAndSetFile])

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    if (!access.isCurrent()) return
    setDragOver(true)
  }, [access])

  const handleDragLeave = useCallback(() => {
    if (!access.isCurrent()) return
    setDragOver(false)
  }, [access])

  const startPolling = useCallback((taskId, resultEpoch) => {
    if (!access.isCurrent()) return
    stopPolling()
    const pollToken = pollTokenRef.current
    activeTaskIdRef.current = taskId
    pollStartTime.current = Date.now()
    pollFailureCountRef.current = 0
    setCurrentStep(2)
    setProcessingProgress(normalizeTranscriptionProgress(null, 'queued'))

    pollInterval.current = window.setInterval(async () => {
      if (!access.isCurrent() || pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        if (!access.isCurrent() || pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return

        const elapsed = Date.now() - pollStartTime.current
        if (elapsed > 3000) {
          setCurrentStep((prev) => Math.max(prev, 2))
        }
        if (elapsed > TRANSCRIBE_POLL_TIMEOUT_MS) {
          stopPolling()
          activeTaskIdRef.current = ''
          setLoading(false)
          setCurrentStep(0)
          setProcessingProgress(normalizeTranscriptionProgress(null, 'error'))
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
          res = await access.request(`${apiUrl}/api/status/${taskId}`, {
            headers: getAuthHeaders(),
            signal: controller?.signal,
          })
        } finally {
          if (timeoutId) {
            window.clearTimeout(timeoutId)
          }
        }

        if (!res.ok) {
          const data = await access.readJson(res)
          const detail = data?.detail || data?.message || ''
          if ([401, 403, 404].includes(res.status)) {
            failPolling(taskId, detail || messages.taskNotFound)
            return
          }
          pollFailureCountRef.current += 1
          if (pollFailureCountRef.current === 3 || pollFailureCountRef.current % 10 === 0) {
            showToast(messages.pollingSlow)
          }
          return
        }

        const data = await readResponseData(
          res,
          locale === 'en' ? 'Failed to fetch status.' : '상태를 확인하지 못했습니다.'
        )
        if (pollFailureCountRef.current > 0) {
          setNotice(null)
        }
        pollFailureCountRef.current = 0
        if (!access.isCurrent() || pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return

        setProcessingProgress(normalizeTranscriptionProgress(
          data.progress,
          data.status === 'processing' ? 'transcribing' : data.status
        ))

        if (data.status === 'queued') {
          setCurrentStep(2)
        } else if (data.status === 'completed') {
          stopPolling()
          setCurrentStep(3)
          pollResultCommitTimerRef.current = window.setTimeout(() => {
            if (!access.isCurrent() || pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return
            if (resultEpoch !== resultEpochRef.current) return
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
          setError(data.error || messages.transcribeFailed)
          setLoading(false)
          setCurrentStep(0)
          setProcessingProgress(normalizeTranscriptionProgress(data.progress, 'error'))
        } else if (data.status === 'processing') {
          setCurrentStep(3)
        } else if (data.status === 'not_found') {
          failPolling(taskId, messages.taskNotFound)
        }
      } catch (error) {
        if (!access.isCurrent()) return
        if (!access.isCurrent() || pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return
        pollFailureCountRef.current += 1
        if (pollFailureCountRef.current === 3 || pollFailureCountRef.current % 10 === 0) {
          showToast(messages.pollingNetwork)
        }
        console.error('Polling error', error)
      } finally {
        if (access.isCurrent() && pollToken === pollTokenRef.current) pollInFlightRef.current = false
      }
    }, STATUS_POLL_INTERVAL_MS)
  }, [access, apiUrl, authToken, failPolling, fetchHistory, fetchUsage, getAuthHeaders, locale, messages.pollingNetwork, messages.pollingSlow, messages.processingSlow, messages.taskIdLabel, messages.taskNotFound, messages.transcribeFailed, readResponseData, setError, setNotice, showToast, stopPolling])

  const handleSubmit = useCallback(async (event, usage) => {
    event.preventDefault()
    if (!access.isCurrent()) return
    if (!file) {
      setError(messages.selectFile)
      return
    }

    invalidatePollingSession()
    const submitEpoch = resetResultWorkspace(true)
    setLoading(true)
    setError(null)
    setNotice(null)
    setCurrentStep(1)
    setProcessingProgress(normalizeTranscriptionProgress(null, 'uploading'))

    try {
      const uploadRequestId = createUploadRequestId()
      const response = await access.request(
        `${apiUrl}/api/transcribe`,
        () => {
          const formData = new FormData()
          formData.append('language', language)
          formData.append('correct', 'true')
          formData.append('transcription_type', transcriptionType)
          formData.append('correction_mode', 'normal')
          formData.append('expected_size_bytes', String(Number(file.size) || 0))
          formData.append('file', file)
          return {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'X-Mallog24-Upload-Id': uploadRequestId,
            },
            body: formData,
          }
        },
        {
          maxAttempts: 4,
          onRetry: () => {
            if (!access.isCurrent()) return
            setNotice(messages.uploadRetrying)
            setProcessingProgress(normalizeTranscriptionProgress(null, 'uploading'))
          },
        }
      )
      const data = await readResponseData(response, messages.transcribeFailed)
      if (!access.isCurrent() || submitEpoch !== resultEpochRef.current) return
      setNotice(data?.duplicate_active_job ? messages.duplicateActiveJob : null)

      if (data.status === 'queued' || data.status === 'processing') {
        setCurrentStep(2)
        setProcessingProgress(normalizeTranscriptionProgress(
          data.progress,
          data.status === 'processing' ? 'transcribing' : 'queued'
        ))
        startPolling(data.task_id, submitEpoch)
      } else if (data.status === 'error') {
        throw new Error(data.error || messages.transcribeFailed)
      } else {
        if (submitEpoch !== resultEpochRef.current) return
        setResult(data)
        setLoading(false)
        setCurrentStep(0)
        setProcessingProgress(normalizeTranscriptionProgress(data.progress, 'completed'))
        fetchUsage()
      }
    } catch (error) {
      if (!access.isCurrent()) return
      setError(error?.message || messages.transcribeFailed)
      setLoading(false)
      setCurrentStep(0)
      setProcessingProgress(normalizeTranscriptionProgress(null, 'error'))
    }
  }, [access, apiUrl, authToken, fetchUsage, file, fileDurationSeconds, getAuthHeaders, invalidatePollingSession, language, messages.selectFile, messages.transcribeFailed, messages.uploadRetrying, readResponseData, resetResultWorkspace, setError, setNotice, showToast, startPolling, transcriptionType])

  const handleLoadHistory = useCallback(async (taskId) => {
    if (!access.isCurrent()) return
    invalidatePollingSession()
    const loadEpoch = resetResultWorkspace(true)
    setLoading(true)
    setError(null)
    setNotice(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      const res = await access.request(`${apiUrl}/api/status/${taskId}`, {
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
      if (!access.isCurrent()) return
      setError(messages.loadHistoryGeneric)
    } finally {
      if (!access.isCurrent()) return
      setLoading(false)
    }
  }, [access, apiUrl, getAuthHeaders, invalidatePollingSession, messages.loadHistoryFailed, messages.loadHistoryGeneric, readResponseData, resetResultWorkspace, setError, setNotice])

  const handleDeleteHistory = useCallback(async (taskId) => {
    if (!access.isCurrent()) {
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
        await access.request(`${apiUrl}/api/history/${taskId}`, {
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
      if (!access.isCurrent()) return
      setError(error?.message || messages.deleteHistoryFailed)
    } finally {
      if (!access.isCurrent()) return
      setHistoryDeletingTaskId('')
    }
  }, [access, apiUrl, armPendingDeleteTask, authToken, clearPendingDeleteTask, getAuthHeaders, messages.deleteHistoryConfirmPrompt, messages.deleteHistoryFailed, messages.deleteHistorySuccess, messages.signinRequired, pendingDeleteTaskId, readResponseData, resetResultWorkspace, result?.task_id, setError, setNotice, showToast])

  const handleDeleteAllHistory = useCallback(async () => {
    if (!access.isCurrent()) {
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
        await access.request(`${apiUrl}/api/history`, {
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
      if (!access.isCurrent()) return
      setError(error?.message || messages.deleteAllHistoryFailed)
    } finally {
      if (!access.isCurrent()) return
      setHistoryBulkDeleting(false)
    }
  }, [access, apiUrl, armPendingDeleteAll, authToken, clearPendingDeleteAll, getAuthHeaders, messages.deleteAllHistoryConfirmPrompt, messages.deleteAllHistoryFailed, messages.deleteAllHistoryPartial, messages.deleteAllHistorySuccess, messages.signinRequired, pendingDeleteAll, readResponseData, resetResultWorkspace, result?.task_id, setError, setNotice, showToast])

  const exportAsTxt = useCallback(() => {
    if (!access.isCurrent()) return
    if (!result) return
    const text = getActiveTranscriptText()
    if (!text) return
    const filename = `${sanitizeFileName(`${messages.transcriptFilename}_${new Date().toISOString().slice(0, 10)}`)}.txt`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    triggerBlobDownload(blob, filename)
  }, [access, getActiveTranscriptText, messages.transcriptFilename, result])

  const exportAsDocx = useCallback(() => {
    if (!access.isCurrent()) return
    if (!result) return
    const text = getActiveTranscriptText()
    if (!text) return
    const filename = `${sanitizeFileName(`${messages.transcriptFilename}_${new Date().toISOString().slice(0, 10)}`)}.docx`
    const blob = buildDocxBlob(messages.transcriptTitle, text)
    triggerBlobDownload(blob, filename)
  }, [access, getActiveTranscriptText, messages.transcriptFilename, messages.transcriptTitle, result])

  const exportTextByLabel = useCallback((text, label, ext = 'txt') => {
    if (!access.isCurrent()) return
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
  }, [access])

  const handleSummarize = useCallback(async () => {
    const sourceText = getActiveTranscriptText()
    if (!sourceText) return
    if (!access.isCurrent()) {
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
      formData.append('text', sourceText)
      formData.append('summary_type', 'short')
      formData.append('transcription_type', normalizedType)
      formData.append('content_style', normalizedStyle)
      formData.append('language', result?.language || language || messages.defaultLanguage)

      const response = await access.request(`${apiUrl}/api/summarize`, {
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
      if (!access.isCurrent()) return
      setError(error?.message || messages.summarizeFailed)
    } finally {
      if (!access.isCurrent()) return
      setLoading(false)
    }
  }, [access, apiUrl, authToken, getActiveTranscriptText, getAuthHeaders, language, messages.defaultLanguage, messages.summarizeFailed, messages.summarizeLoginRequired, readResponseData, resolveContentStyle, result, setError, setNotice, transcriptionType])

  const handleGenerateRecordDraft = useCallback(async (category) => {
    const sourceText = getActiveTranscriptText()
    if (!sourceText) return
    if (!access.isCurrent()) {
      setError(messages.draftLoginRequired)
      return
    }

    setError(null)
    setNotice(null)
    setDraftLoadingCategory(category)
    const draftEpoch = resultEpochRef.current

    try {
      const formData = new FormData()
      formData.append('text', sourceText)
      formData.append('category', category)
      formData.append('language', result?.language || language || messages.defaultLanguage)

      const response = await access.request(`${apiUrl}/api/records/draft`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await readResponseData(response, messages.draftFailed)
      if (draftEpoch !== resultEpochRef.current) return
      const draftContent = data.content || ''
      setRecordDrafts((prev) => ({ ...prev, [category]: draftContent }))
      setRecordDraftSources((prev) => ({
        ...prev,
        [category]: {
          originalText: draftContent,
          sourceText,
          taskId: result?.task_id || '',
          language: result?.language || language || messages.defaultLanguage,
          transcriptionType: result?.transcription_type || transcriptionType,
        },
      }))
      setNotice(`${data.category_label || messages.recordDefaultLabel} ${messages.draftCreatedSuffix}`)
    } catch (error) {
      if (!access.isCurrent()) return
      setError(error?.message || messages.draftFailedGeneric)
    } finally {
      if (!access.isCurrent()) return
      setDraftLoadingCategory('')
    }
  }, [access, apiUrl, authToken, getActiveTranscriptText, getAuthHeaders, language, messages.defaultLanguage, messages.draftCreatedSuffix, messages.draftFailed, messages.draftFailedGeneric, messages.draftLoginRequired, messages.recordDefaultLabel, readResponseData, result, setError, setNotice, transcriptionType])

  const handleRecordDraftChange = useCallback((category, value) => {
    if (!access.isCurrent()) return
    setRecordDrafts((prev) => ({ ...prev, [category]: value }))
  }, [access])

  const handleResetTranscriptEdit = useCallback(() => {
    if (!access.isCurrent()) return
    setTranscriptEditText(transcriptSourceText)
  }, [access, transcriptSourceText])

  const handleSaveTranscriptCorrection = useCallback(async () => {
    if (!access.isCurrent()) {
      setError(messages.correctionLoginRequired)
      return
    }

    const originalText = transcriptSourceText.trim()
    const editedText = String(transcriptEditText || '').trim()
    if (!originalText || !editedText) {
      setError(messages.correctionEmpty)
      return
    }
    if (compactTranscriptText(originalText) === compactTranscriptText(editedText)) {
      setNotice(messages.correctionNoChanges)
      return
    }

    setTranscriptEditSaving(true)
    setError(null)
    setNotice(null)

    try {
      let data = { stored: false }
      if (trainingDataConsent) {
        const response = await access.request(`${apiUrl}/api/corrections`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_type: 'transcript_edit',
            category: result?.transcription_type || transcriptionType,
            language: result?.language || language || messages.defaultLanguage,
            task_id: result?.task_id || '',
            original_text: originalText,
            edited_text: editedText,
            consent_for_training: true,
            metadata: {
              content_style: resolveContentStyle(result),
              source: 'web_transcript_editor',
              consent_for_training: true,
              consent_scope: 'text_correction_only',
              audio_training_consent: false,
            },
          }),
        })
        data = await readResponseData(response, messages.correctionSaveFailed)
      }
      setResult((prev) => {
        if (!prev) return prev
        if (result?.task_id && prev.task_id && prev.task_id !== result.task_id) return prev
        return {
          ...prev,
          corrected_text: editedText,
          characters: editedText.length,
        }
      })
      setTranscriptEditText(editedText)
      setNotice(
        trainingDataConsent
          ? (data?.stored === false ? messages.correctionNoChanges : messages.correctionSaveSuccess)
          : messages.correctionAppliedNoTraining
      )
    } catch (error) {
      if (!access.isCurrent()) return
      setError(error?.message || messages.correctionSaveFailed)
    } finally {
      if (!access.isCurrent()) return
      setTranscriptEditSaving(false)
    }
  }, [access, apiUrl, authToken, compactTranscriptText, getAuthHeaders, language, messages.correctionAppliedNoTraining, messages.correctionEmpty, messages.correctionLoginRequired, messages.correctionNoChanges, messages.correctionSaveFailed, messages.correctionSaveSuccess, messages.defaultLanguage, readResponseData, resolveContentStyle, result, setError, setNotice, trainingDataConsent, transcriptEditText, transcriptSourceText, transcriptionType])

  const handleSaveRecord = useCallback(async (category) => {
    if (!access.isCurrent()) {
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
      const draftSource = recordDraftSources[category] || {}
      const originalDraftText = String(draftSource.originalText || '').trim()
      const shouldCaptureCorrection = trainingDataConsent && originalDraftText && originalDraftText !== content
      const formData = new FormData()
      formData.append('category', category)
      formData.append('title', recordTypeLabels[category] || category)
      formData.append('content', content)
      formData.append('task_id', result?.task_id || '')
      formData.append('source_type', result?.transcription_type || '')
      if (shouldCaptureCorrection) {
        formData.append('correction_original_text', originalDraftText)
        formData.append('correction_language', draftSource.language || result?.language || language || messages.defaultLanguage)
        formData.append('correction_metadata_json', JSON.stringify({
          transcription_type: draftSource.transcriptionType || result?.transcription_type || transcriptionType,
          source_text_preview: String(draftSource.sourceText || '').slice(0, 1000),
          consent_for_training: true,
          consent_scope: 'text_correction_only',
          audio_training_consent: false,
        }))
      }

      const response = await access.request(`${apiUrl}/api/records`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      const data = await readResponseData(response, messages.saveFailed)

      const correctionSample = data?.correction_sample
      if (shouldCaptureCorrection && (!correctionSample || correctionSample.success === false)) {
        try {
          await access.request(`${apiUrl}/api/corrections`, {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              source_type: 'record_draft',
              category,
              language: draftSource.language || result?.language || language || messages.defaultLanguage,
              task_id: draftSource.taskId || result?.task_id || '',
              original_text: originalDraftText,
              edited_text: content,
              consent_for_training: true,
              metadata: {
                transcription_type: draftSource.transcriptionType || result?.transcription_type || transcriptionType,
                source_text_preview: String(draftSource.sourceText || '').slice(0, 1000),
                consent_for_training: true,
                consent_scope: 'text_correction_only',
                audio_training_consent: false,
              },
            }),
          })
        } catch (correctionError) {
          if (!access.isCurrent()) return
          console.warn('Correction sample save failed:', correctionError?.message || correctionError)
        }
      }

      if (!access.isCurrent()) return
      setNotice(messages.saveSuccess)
      fetchSavedRecords()
      setShowRecords(true)
    } catch (error) {
      if (!access.isCurrent()) return
      setError(error?.message || messages.saveFailed)
    } finally {
      if (!access.isCurrent()) return
      setSavingCategory('')
    }
  }, [access, apiUrl, authToken, fetchSavedRecords, getAuthHeaders, language, messages.defaultLanguage, messages.saveEmpty, messages.saveFailed, messages.saveLoginRequired, messages.saveSuccess, readResponseData, recordDrafts, recordDraftSources, recordTypeLabels, result, setError, setNotice, trainingDataConsent, transcriptionType])

  const handleStartSavedRecordEdit = useCallback((record) => {
    if (!access.isCurrent()) return
    const recordId = String(record?.id || '')
    if (!recordId) return
    setSavedRecordEditDrafts((prev) => ({
      ...prev,
      [recordId]: String(record?.content || ''),
    }))
  }, [access])

  const handleSavedRecordEditChange = useCallback((recordId, value) => {
    if (!access.isCurrent()) return
    const normalizedRecordId = String(recordId || '')
    if (!normalizedRecordId) return
    setSavedRecordEditDrafts((prev) => ({
      ...prev,
      [normalizedRecordId]: value,
    }))
  }, [access])

  const handleCancelSavedRecordEdit = useCallback((recordId) => {
    if (!access.isCurrent()) return
    const normalizedRecordId = String(recordId || '')
    if (!normalizedRecordId) return
    setSavedRecordEditDrafts((prev) => {
      const next = { ...prev }
      delete next[normalizedRecordId]
      return next
    })
  }, [access])

  const handleUpdateSavedRecord = useCallback(async (record) => {
    if (!access.isCurrent()) {
      setError(messages.saveLoginRequired)
      return
    }

    const recordId = String(record?.id || '')
    if (!recordId) {
      setError(messages.recordUpdateFailed)
      return
    }

    const content = String(savedRecordEditDrafts[recordId] || '').trim()
    if (!content) {
      setError(messages.saveEmpty)
      return
    }

    const originalText = String(record?.content || '').trim()
    if (compactTranscriptText(originalText) === compactTranscriptText(content)) {
      handleCancelSavedRecordEdit(recordId)
      setNotice(messages.correctionNoChanges)
      return
    }

    setSavedRecordSavingId(recordId)
    setError(null)
    setNotice(null)

    try {
      const response = await access.request(`${apiUrl}/api/records/${encodeURIComponent(recordId)}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: record?.title || recordTypeLabels[record?.category] || record?.category || messages.recordDefaultLabel,
          content,
          language: result?.language || language || messages.defaultLanguage,
          capture_correction_sample: trainingDataConsent,
          correction_metadata: trainingDataConsent
            ? {
                consent_for_training: true,
                consent_scope: 'text_correction_only',
                audio_training_consent: false,
                source: 'web_saved_record_editor',
              }
            : {},
        }),
      })
      const data = await readResponseData(response, messages.recordUpdateFailed)
      const updatedRecord = data?.record || { ...record, content }
      setSavedRecords((prev) => prev.map((item) => (String(item.id || '') === recordId ? updatedRecord : item)))
      handleCancelSavedRecordEdit(recordId)

      setNotice(messages.recordUpdateSuccess)
    } catch (error) {
      if (!access.isCurrent()) return
      setError(error?.message || messages.recordUpdateFailed)
    } finally {
      if (!access.isCurrent()) return
    setSavedRecordSavingId('')
    }
  }, [access, apiUrl, authToken, compactTranscriptText, getAuthHeaders, handleCancelSavedRecordEdit, language, messages.correctionNoChanges, messages.defaultLanguage, messages.recordDefaultLabel, messages.recordUpdateFailed, messages.recordUpdateSuccess, messages.saveEmpty, messages.saveLoginRequired, readResponseData, recordTypeLabels, result?.language, savedRecordEditDrafts, setError, setNotice, trainingDataConsent])

  const usageState = useMemo(() => (usage) => ({
    isFreeTier: true,
    planTier: usage?.plan_tier || 'free',
    monthlyLimitSeconds: null,
    remainingQuotaSeconds: Number.MAX_SAFE_INTEGER,
    fileExceedsRemainingQuota: false,
    uploadBlockedByQuota: !access.isCurrent(),
  }), [access])

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
    processingProgress,
    dragOver,
    showHistory,
    setShowHistory,
    showRecords,
    setShowRecords,
    savedRecords,
    recordsLoading,
    recordsLoaded,
    savedRecordEditDrafts,
    savedRecordSavingId,
    recordDrafts,
    draftLoadingCategory,
    savingCategory,
    transcriptEditText,
    setTranscriptEditText,
    transcriptEditSaving,
    transcriptHasUnsavedEdit,
    trainingDataConsent,
    setTrainingDataConsent,
    fileDurationSeconds,
    recordingState,
    recordingSeconds,
    recordingLevel,
    recordingSignal,
    recordingDevices,
    selectedRecordingDeviceId,
    selectRecordingDevice,
    resumeRecordingAnalysis,
    activeRecordingDeviceLabel,
    recordingInputState,
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
    startRecording,
    stopRecording,
    cancelRecording,
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
    handleStartSavedRecordEdit,
    handleSavedRecordEditChange,
    handleCancelSavedRecordEdit,
    handleUpdateSavedRecord,
    handleResetTranscriptEdit,
    handleSaveTranscriptCorrection,
    copyFailedMessage: messages.copyFailed,
  }
}
