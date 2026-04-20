import { useEffect, useState } from 'react'
import useMallogAuth from '../hooks/useMallogAuth'
import useMallogTranscription from '../hooks/useMallogTranscription'
import useUiFeedback from '../hooks/useUiFeedback'
import MallogHomeKoView from './MallogHomeKoView'
import MallogHomeEnView from './MallogHomeEnView'
import { apiFetch, safeReadJson } from '../utils/network'

const QUOTA_TOAST_MS = 2600

export default function MallogHomePageContainer({
  locale = 'ko',
  darkMode,
  setDarkMode,
  uiTheme,
  setUiTheme,
  uiThemeMode,
  setUiThemeMode,
}) {
  const isEnglish = locale === 'en'
  const [copied, setCopied] = useState(null)
  const [landingStats, setLandingStats] = useState(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mallog24.com'
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mallog24.com'
  const OURS_URL = process.env.NEXT_PUBLIC_OURS_URL || 'https://ours.mallog24.com'
  const APP_DOWNLOAD_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.mallog24.app&pcampaignid=web_share'
  const OURS_PRIVACY_URL = `${OURS_URL}/${isEnglish ? 'privacy-en' : 'privacy'}`
  const OURS_TERMS_URL = `${OURS_URL}/${isEnglish ? 'terms-en' : 'terms'}`
  const OURS_COMPANY_POLICY_URL = `${OURS_URL}/${isEnglish ? 'company-policy-en' : 'company-policy'}`
  const OG_IMAGE_URL = process.env.NEXT_PUBLIC_OG_IMAGE_URL || `${SITE_URL}/mallog24-app-icon.png`
  const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'OURS'
  const BUSINESS_REG_NUMBER = process.env.NEXT_PUBLIC_BUSINESS_REG_NUMBER || '696-08-03518'
  const LANDLINE_PHONE = process.env.NEXT_PUBLIC_REPRESENTATIVE_PHONE || process.env.NEXT_PUBLIC_LANDLINE_PHONE || '010-4798-3619'
  const BUSINESS_ADDRESS = isEnglish
    ? (
      process.env.NEXT_PUBLIC_BUSINESS_ADDRESS_EN ||
      process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ||
      '12735, 28 Mudeul-ro, Chowol-eup, Gwangju-si, Gyeonggi-do, Republic of Korea'
    )
    : (
      process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ||
      '12735, 경기도 광주시 초월읍 무들로 28'
    )
  const REPRESENTATIVE_NAME = isEnglish
    ? (
      process.env.NEXT_PUBLIC_REPRESENTATIVE_NAME_EN ||
      process.env.NEXT_PUBLIC_REPRESENTATIVE_NAME ||
      'Kim Hyunwoo'
    )
    : (
      process.env.NEXT_PUBLIC_REPRESENTATIVE_NAME ||
      '김현우'
    )
  const ECOMMERCE_REG_NUMBER = process.env.NEXT_PUBLIC_ECOMMERCE_REG_NUMBER || (isEnglish ? 'No. 2026-Gyeonggi Gwangju-0442' : '제 2026-경기광주-0442 호')
  const TRADEMARK_APPLICATION_NO = process.env.NEXT_PUBLIC_TRADEMARK_APPLICATION_NO || '40-2026-0040381'
  const rawCopyrightRegistrationNo = isEnglish
    ? (
      process.env.NEXT_PUBLIC_COPYRIGHT_REGISTRATION_NO_EN ||
      process.env.NEXT_PUBLIC_COPYRIGHT_REGISTRATION_NO ||
      'C-2026-013549'
    )
    : (
      process.env.NEXT_PUBLIC_COPYRIGHT_REGISTRATION_NO ||
      '제 C-2026-013549 호'
    )
  const COPYRIGHT_REGISTRATION_NO = isEnglish
    ? rawCopyrightRegistrationNo.replace(/^제\s*/u, '').replace(/\s*호$/u, '')
    : rawCopyrightRegistrationNo
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'ours113814@gmail.com'
  const CANONICAL_URL = isEnglish ? `${SITE_URL}/en` : SITE_URL
  const ALTERNATE_URL = isEnglish ? SITE_URL : `${SITE_URL}/en`
  const UPGRADE_CONTACT_URL = isEnglish ? '/pricing-en' : '/pricing'
  const LANGUAGE_SELECT_ID = isEnglish ? 'mallog24-language-en' : 'mallog24-language'
  const TYPE_SELECT_ID = isEnglish ? 'mallog24-type-en' : 'mallog24-type'
  const recordTypeLabels = isEnglish
    ? {
        meeting_keywords: 'Meeting Keywords',
        clinical_notes: 'Clinical Notes',
        sermon_core_summary: 'Sermon Core Summary',
      }
    : {
        meeting_keywords: '회의 중요 키워드',
        clinical_notes: '진료 도움 기록',
        sermon_core_summary: '설교 핵심 요약',
      }

  const { error, setError, notice, setNotice, toastMessage, showToast } = useUiFeedback(QUOTA_TOAST_MS)
  const auth = useMallogAuth({
    apiUrl: API_URL,
    locale,
    setError,
    setNotice,
  })
  const transcription = useMallogTranscription({
    apiUrl: API_URL,
    locale,
    authToken: auth.authToken,
    getAuthHeaders: auth.getAuthHeaders,
    fetchUsage: auth.fetchUsage,
    setError,
    setNotice,
    showToast,
    recordTypeLabels,
  })

  useEffect(() => {
    transcription.resetState()
  }, [auth.authToken])

  useEffect(() => {
    let cancelled = false

    const fetchLandingStats = async () => {
      try {
        const response = await apiFetch(`${API_URL}/api/stats`)
        const payload = await safeReadJson(response)
        if (!response.ok || !payload || cancelled) return
        setLandingStats({
          hoursProcessed: payload.hours_processed || '',
          betaUsers: payload.beta_users || '',
          avgTurnaround: payload.avg_turnaround?.[isEnglish ? 'en' : 'ko'] || '',
          timeSaving: payload.time_saving?.[isEnglish ? 'en' : 'ko'] || '',
          updatedAt: payload.updated_at || '',
        })
      } catch {
        if (!cancelled) {
          setLandingStats(null)
        }
      }
    }

    fetchLandingStats()
    return () => {
      cancelled = true
    }
  }, [API_URL, isEnglish])

  const {
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
    sessionRemainingLabel,
    handleAuthSubmit,
    handleSocialLogin,
    handleLogout,
    authUserFallbackLabel,
  } = auth

  const {
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
    guestTranscribeHint,
    guestTranscribeStart,
    isGuestMode,
    fileInputRef,
    usageState,
    resolveContentStyle,
    handleDragOver,
    handleDragLeave,
    handleLoadHistory,
    handleDeleteHistory,
    handleDeleteAllHistory,
    cancelPendingDeleteTask,
    cancelPendingDeleteAll,
    exportAsTxt,
    exportAsDocx,
    exportTextByLabel,
    handleSummarize,
    handleGenerateRecordDraft,
    handleRecordDraftChange,
    handleSaveRecord,
    copyFailedMessage,
    triggerFilePicker: openFilePicker,
    handleUploadZoneKeyDown: handleUploadKeyDownInternal,
    handleFileChange: handleFileChangeInternal,
    handleDrop: handleDropInternal,
    handleSubmit: handleSubmitInternal,
  } = transcription

  const effectiveUsage = authToken ? usage : guestUsage

  const {
    isFreeTier,
    monthlyLimitSeconds,
    remainingQuotaSeconds,
    fileExceedsRemainingQuota,
    uploadBlockedByQuota,
  } = usageState(effectiveUsage)

  const copyToClipboard = (text, label) => {
    const safeText = String(text || '').trim()
    if (!safeText) return
    navigator.clipboard.writeText(safeText)
      .then(() => {
        setCopied(label)
        setTimeout(() => setCopied(null), 2000)
      })
      .catch(() => setError(copyFailedMessage))
  }

  const handleFileChange = (event) => handleFileChangeInternal(event, effectiveUsage)
  const handleDrop = (event) => handleDropInternal(event, effectiveUsage)
  const handleSubmit = (event) => handleSubmitInternal(event, effectiveUsage)
  const triggerFilePicker = () => openFilePicker(uploadBlockedByQuota)
  const handleUploadZoneKeyDown = (event) => handleUploadKeyDownInternal(event, uploadBlockedByQuota)

  const typeLabels = isEnglish
    ? { sermon: 'Sermon Transcript', phonecall: 'Call Record', conversation: 'Meeting/Conversation Record' }
    : { sermon: '설교 녹취', phonecall: '통화 기록', conversation: '대화/회의 기록' }
  const contentStyleLabels = isEnglish
    ? { sermon: 'Sermon', lecture: 'Lecture', phonecall: 'Call', meeting: 'Meeting', forum: 'Forum', debate: 'Debate' }
    : { sermon: '설교', lecture: '강의', phonecall: '통화', meeting: '회의', forum: '포럼', debate: '토론' }
  const summaryActionLabels = isEnglish
    ? {
        sermon: 'Generate Sermon Summary',
        lecture: 'Generate Lecture Summary',
        phonecall: 'Generate Call Summary',
        meeting: 'Generate Meeting Summary',
        forum: 'Generate Forum Summary',
        debate: 'Generate Debate Summary',
      }
    : {
        sermon: '설교 기록 요약 생성',
        lecture: '강의 기록 요약 생성',
        phonecall: '통화 기록 요약 생성',
        meeting: '회의 기록 요약 생성',
        forum: '포럼 기록 요약 생성',
        debate: '토론 기록 요약 생성',
      }
  const summaryTitleLabels = isEnglish
    ? {
        sermon: 'Sermon Summary',
        lecture: 'Lecture Summary',
        phonecall: 'Call Summary',
        meeting: 'Meeting Summary',
        forum: 'Forum Summary',
        debate: 'Debate Summary',
      }
    : {
        sermon: '설교 기록 요약',
        lecture: '강의 기록 요약',
        phonecall: '통화 기록 요약',
        meeting: '회의 기록 요약',
        forum: '포럼 기록 요약',
        debate: '토론 기록 요약',
      }
  const transcriptionTypeHints = isEnglish
    ? {
        sermon: 'Structured by sermon flow (Main Body / Conclusion / Prayer) with stronger homophone correction (e.g., 3oneul/samoneul and forum-bang/forum-mang).',
        phonecall: 'Separates call speakers (A/B), reinforces clinical wording, and improves homophone correction (e.g., 3oneul/samoneul and forum-bang/forum-mang).',
        conversation: 'Separates meeting participants, structures agenda/decisions/actions, and improves homophone correction (e.g., 3oneul/samoneul and forum-bang/forum-mang).',
      }
    : {
        sermon: '설교 흐름(본론/결론/기도) 중심으로 정리합니다.',
        phonecall: '통화 화자를 A/B로 분리하여 정리합니다.',
        conversation: '회의 참석자 발언을 분리하고 안건/결정/후속 조치 하며 구조화 합니다.',
      }
  const recordCategories = isEnglish
    ? [
        { key: 'meeting_keywords', label: 'Meeting Keywords' },
        { key: 'clinical_notes', label: 'Clinical Notes' },
        { key: 'sermon_core_summary', label: 'Sermon Core Summary' },
      ]
    : [
        { key: 'meeting_keywords', label: '회의 중요 키워드' },
        { key: 'clinical_notes', label: '진료 도움 기록' },
        { key: 'sermon_core_summary', label: '설교 핵심 요약' },
      ]
  const socialProviders = isEnglish
    ? [
        { key: 'google', label: 'Sign in with Google' },
        { key: 'kakao', label: 'Log in with Kakao' },
      ]
    : [
        { key: 'google', label: 'Google로 로그인' },
        { key: 'kakao', label: '카카오로 로그인' },
      ]
  const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치', 'Main Body', 'Conclusion', 'Prayer', 'Summary', 'Key Points', 'Agenda Items', 'Decisions', 'Action Items']

  const ViewComponent = isEnglish ? MallogHomeEnView : MallogHomeKoView

  return (
    <ViewComponent
      locale={locale}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      uiTheme={uiTheme}
      setUiTheme={setUiTheme}
      uiThemeMode={uiThemeMode}
      setUiThemeMode={setUiThemeMode}
      copied={copied}
      error={error}
      notice={notice}
      toastMessage={toastMessage}
      landingStats={landingStats}
      API_URL={API_URL}
      SITE_URL={SITE_URL}
      OURS_URL={OURS_URL}
      OURS_PRIVACY_URL={OURS_PRIVACY_URL}
      OURS_TERMS_URL={OURS_TERMS_URL}
      OURS_COMPANY_POLICY_URL={OURS_COMPANY_POLICY_URL}
      OG_IMAGE_URL={OG_IMAGE_URL}
      BUSINESS_NAME={BUSINESS_NAME}
      BUSINESS_REG_NUMBER={BUSINESS_REG_NUMBER}
      LANDLINE_PHONE={LANDLINE_PHONE}
      BUSINESS_ADDRESS={BUSINESS_ADDRESS}
      REPRESENTATIVE_NAME={REPRESENTATIVE_NAME}
      ECOMMERCE_REG_NUMBER={ECOMMERCE_REG_NUMBER}
      TRADEMARK_APPLICATION_NO={TRADEMARK_APPLICATION_NO}
      COPYRIGHT_REGISTRATION_NO={COPYRIGHT_REGISTRATION_NO}
      SUPPORT_EMAIL={SUPPORT_EMAIL}
      CANONICAL_URL={CANONICAL_URL}
      ALTERNATE_URL={ALTERNATE_URL}
      UPGRADE_CONTACT_URL={UPGRADE_CONTACT_URL}
      APP_DOWNLOAD_URL={APP_DOWNLOAD_URL}
      LANGUAGE_SELECT_ID={LANGUAGE_SELECT_ID}
      TYPE_SELECT_ID={TYPE_SELECT_ID}
      authMode={authMode}
      setAuthMode={setAuthMode}
      authName={authName}
      setAuthName={setAuthName}
      authEmail={authEmail}
      setAuthEmail={setAuthEmail}
      authPassword={authPassword}
      setAuthPassword={setAuthPassword}
      authLoading={authLoading}
      socialLoading={socialLoading}
      authToken={authToken}
      authUser={authUser}
      usage={effectiveUsage}
      sessionRemainingLabel={sessionRemainingLabel}
      handleAuthSubmit={handleAuthSubmit}
      handleSocialLogin={handleSocialLogin}
      handleLogout={handleLogout}
      authUserFallbackLabel={authUserFallbackLabel}
      file={file}
      setFile={setFile}
      setFileDurationSeconds={setFileDurationSeconds}
      language={language}
      setLanguage={setLanguage}
      transcriptionType={transcriptionType}
      setTranscriptionType={setTranscriptionType}
      loading={loading}
      result={result}
      history={history}
      historyLoading={historyLoading}
      historyLoaded={historyLoaded}
      historyDeletingTaskId={historyDeletingTaskId}
      historyBulkDeleting={historyBulkDeleting}
      pendingDeleteTaskId={pendingDeleteTaskId}
      pendingDeleteAll={pendingDeleteAll}
      currentStep={currentStep}
      dragOver={dragOver}
      showHistory={showHistory}
      setShowHistory={setShowHistory}
      showRecords={showRecords}
      setShowRecords={setShowRecords}
      savedRecords={savedRecords}
      recordsLoading={recordsLoading}
      recordsLoaded={recordsLoaded}
      recordDrafts={recordDrafts}
      draftLoadingCategory={draftLoadingCategory}
      savingCategory={savingCategory}
      fileDurationSeconds={fileDurationSeconds}
      fileInputRef={fileInputRef}
      isGuestMode={isGuestMode}
      guestTranscribeHint={guestTranscribeHint}
      guestTranscribeStart={guestTranscribeStart}
      isFreeTier={isFreeTier}
      monthlyLimitSeconds={monthlyLimitSeconds}
      remainingQuotaSeconds={remainingQuotaSeconds}
      fileExceedsRemainingQuota={fileExceedsRemainingQuota}
      uploadBlockedByQuota={uploadBlockedByQuota}
      typeLabels={typeLabels}
      contentStyleLabels={contentStyleLabels}
      summaryActionLabels={summaryActionLabels}
      summaryTitleLabels={summaryTitleLabels}
      transcriptionTypeHints={transcriptionTypeHints}
      recordTypeLabels={recordTypeLabels}
      recordCategories={recordCategories}
      socialProviders={socialProviders}
      sectionHeaders={sectionHeaders}
      resolveContentStyle={resolveContentStyle}
      copyToClipboard={copyToClipboard}
      handleDragOver={handleDragOver}
      handleDragLeave={handleDragLeave}
      handleLoadHistory={handleLoadHistory}
      handleDeleteHistory={handleDeleteHistory}
      handleDeleteAllHistory={handleDeleteAllHistory}
      cancelPendingDeleteTask={cancelPendingDeleteTask}
      cancelPendingDeleteAll={cancelPendingDeleteAll}
      exportAsTxt={exportAsTxt}
      exportAsDocx={exportAsDocx}
      exportTextByLabel={exportTextByLabel}
      handleSummarize={handleSummarize}
      handleGenerateRecordDraft={handleGenerateRecordDraft}
      handleRecordDraftChange={handleRecordDraftChange}
      handleSaveRecord={handleSaveRecord}
      triggerFilePicker={triggerFilePicker}
      handleUploadZoneKeyDown={handleUploadZoneKeyDown}
      handleFileChange={handleFileChange}
      handleDrop={handleDrop}
      handleSubmit={handleSubmit}
    />
  )
}
