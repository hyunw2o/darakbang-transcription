import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import HeaderMenuControls from './HeaderMenuControls'
import MallogAuthPanel from './MallogAuthPanel'
import MallogWorkspaceNav from './MallogWorkspaceNav'
import { AudioLines, Check, Upload, Mic, Square, X } from 'lucide-react'
import Mallog24Logo from './Mallog24Logo'
import MicrophoneInputControl from './MicrophoneInputControl'
import RecordingWaveform from './RecordingWaveform'
import StepIndicator from './StepIndicator'
import UserGlossaryPanel from './UserGlossaryPanel'
import { formatSecondsCompact, formatSecondsToHourMinute } from '../utils/format'
import {
  getTranscriptionProgressText,
  normalizeTranscriptionProgress,
} from '../utils/transcriptionProgress'

const MICROPHONE_INPUT_LABELS = {
  inputLabel: '입력 마이크',
  systemDefault: '시스템 기본 마이크',
  microphoneFallback: '마이크',
  statusLabel: '입력 상태',
  resumeAnalysis: '다시 켜기',
  states: {
    idle: '연결 대기',
    listening: '입력 대기 중',
    detected: '마이크 입력 감지됨',
    'no-signal': '입력 신호 없음',
    muted: '마이크 음소거됨',
    ended: '마이크 연결 종료됨',
    'analysis-blocked': '파형 분석이 일시정지됨',
  },
}

function FooterInlineRow({ items, className = '' }) {
  const visibleItems = items.filter(Boolean)

  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${className}`}>
      {visibleItems.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-x-2">
          {index > 0 ? <span className="opacity-45">|</span> : null}
          <span>{item}</span>
        </span>
      ))}
    </p>
  )
}

export default function MallogHomeKoView(props) {
  const {
    darkMode,
    setDarkMode,
    uiTheme,
    setUiTheme,
    uiThemeMode,
    setUiThemeMode,
    copied,
    error,
    notice,
    toastMessage,
    landingStats,
    OURS_URL,
    OURS_PRIVACY_URL,
    OURS_TERMS_URL,
    OURS_COMPANY_POLICY_URL,
    OG_IMAGE_URL,
    BUSINESS_NAME,
    BUSINESS_REG_NUMBER,
    LANDLINE_PHONE,
    BUSINESS_ADDRESS,
    REPRESENTATIVE_NAME,
    ECOMMERCE_REG_NUMBER,
    TRADEMARK_APPLICATION_NO,
    COPYRIGHT_REGISTRATION_NO,
    SUPPORT_EMAIL,
    CANONICAL_URL,
    ALTERNATE_URL,
    SERVICE_INFO_URL,
    APP_DOWNLOAD_URL,
    IOS_APP_STORE_URL,
    LANGUAGE_SELECT_ID,
    TYPE_SELECT_ID,
    authPageMode,
    homeHref,
    recoveryHref,
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
    socialLoading,
    authToken,
    authUser,
    usage,
    sessionRemainingLabel,
    handleAuthSubmit,
    handleSocialLogin,
    handleLogout,
    authUserFallbackLabel,
    glossaryLabels,
    glossaryTerms,
    glossaryLoading,
    glossaryActionId,
    glossaryForm,
    handleGlossaryFieldChange,
    handleCreateGlossaryTerm,
    handleToggleGlossaryTerm,
    handleDeleteGlossaryTerm,
    fetchGlossary,
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
    isFreeTier,
    monthlyLimitSeconds,
    remainingQuotaSeconds,
    fileExceedsRemainingQuota,
    uploadBlockedByQuota,
    typeLabels,
    contentStyleLabels,
    summaryActionLabels,
    summaryTitleLabels,
    transcriptionTypeHints,
    recordTypeLabels,
    recordCategories,
    socialProviders,
    sectionHeaders,
    resolveContentStyle,
    copyToClipboard,
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
    handleStartSavedRecordEdit,
    handleSavedRecordEditChange,
    handleCancelSavedRecordEdit,
    handleUpdateSavedRecord,
    handleResetTranscriptEdit,
    handleSaveTranscriptCorrection,
    triggerFilePicker,
    handleUploadZoneKeyDown,
    handleFileChange,
    handleDrop,
    startRecording,
    stopRecording,
    cancelRecording,
    handleSubmit,
  } = props

  const [activeTab, setActiveTab] = useState('convert')
  const accessEnabled = Boolean(props.accessEnabled)
  const selectTab = (tab) => {
    setActiveTab(tab)
    if (tab === 'history') setShowHistory(true)
    if (tab === 'records') setShowRecords(true)
  }
  useEffect(() => {
    if (!accessEnabled) setActiveTab('convert')
  }, [accessEnabled])

  const navItems = [
    { label: '사용 가이드', href: '/guides' },
    { label: '무료 이용 안내', href: SERVICE_INFO_URL },
    { label: 'Android', href: APP_DOWNLOAD_URL, external: true },
    { label: 'iOS', href: IOS_APP_STORE_URL, external: true },
  ].filter(item => item.href)
  const tabTitles = {"convert":"새 변환","history":"변환 기록","records":"저장 기록","glossary":"사용자 용어집"}

  const footerBusinessRows = [
    [`상호: ${BUSINESS_NAME}`, `대표: ${REPRESENTATIVE_NAME}`, `사업자등록번호: ${BUSINESS_REG_NUMBER}`, `통신판매신고번호: ${ECOMMERCE_REG_NUMBER}`],
    [`사업장주소: ${BUSINESS_ADDRESS}`, LANDLINE_PHONE ? `대표자 전화번호: ${LANDLINE_PHONE}` : '', `비즈니스 문의 이메일: ${SUPPORT_EMAIL}`],
    [`상표 출원번호: ${TRADEMARK_APPLICATION_NO}`, `저작권 등록번호: ${COPYRIGHT_REGISTRATION_NO}`, `1:1 문의 이메일: ${SUPPORT_EMAIL}`],
  ]

  const activeTranscriptText = result ? (transcriptEditText || result.corrected_text || result.raw_text || '') : ''
  const normalizedProcessingProgress = normalizeTranscriptionProgress(
    processingProgress,
    currentStep <= 1 ? 'uploading' : currentStep === 2 ? 'queued' : 'correcting_text'
  )
  const processingStatusText = getTranscriptionProgressText(normalizedProcessingProgress, 'ko')

  return (
    <div className="mallog-app min-h-screen">
      <Head>
        <title>mallog24 - AI Speech to Text</title>
        <meta
          name="description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 무료 AI 녹취 서비스. 로그인 후 결제나 구독 없이 전체 변환 기능을 이용할 수 있습니다."
        />
        <link rel="canonical" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="ko" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="en" href={ALTERNATE_URL} />
        <link rel="alternate" hrefLang="x-default" href={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="mallog24 - AI Speech to Text" />
        <meta
          property="og:description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 무료 AI 녹취 서비스. 로그인 후 결제나 구독 없이 전체 변환 기능을 이용할 수 있습니다."
        />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="mallog24 - AI Speech to Text" />
        <meta
          name="twitter:description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 무료 AI 녹취 서비스입니다."
        />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
      </Head>

      <header className="mallog-topbar">
        <div className="mallog-topbar-inner">
          <Link href={homeHref} className="mallog-brand" aria-label="mallog24">
            <img src="/mallog24-app-icon.png" width="30" height="30" alt="" />
            <Mallog24Logo className="h-6 w-auto" />
          </Link>
          <HeaderMenuControls
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            uiTheme={uiTheme}
            setUiTheme={setUiTheme}
            uiThemeMode={uiThemeMode}
            setUiThemeMode={setUiThemeMode}
            locale="kr"
            navItems={navItems}
          />
        </div>
      </header>

      <main className={accessEnabled ? 'mallog-main' : 'mallog-main mallog-main-auth'}>
        {!accessEnabled ? (
          <MallogAuthPanel {...props} />
        ) : (
          <div className="mallog-workspace">
            <MallogWorkspaceNav locale="ko" activeTab={activeTab} onChange={selectTab} authUser={authUser} usage={usage} handleLogout={handleLogout} busy={loading || recordingState !== 'idle'} />
            <div className="mallog-workspace-content">
              <div className="mallog-workspace-heading">
                <h1>{tabTitles[activeTab]}</h1>
                <span className="mallog-workspace-meta">{loading ? '변환 진행 중' : '로그인 전용 · 무료'}</span>
              </div>
              {activeTab !== 'convert' && error && <p role="alert" className="mallog-feedback mallog-feedback-error">{error}</p>}
              {activeTab !== 'convert' && notice && <p role="status" className="mallog-feedback">{notice}</p>}
              <section hidden={activeTab !== 'glossary'} aria-label={tabTitles.glossary} className="mallog-workspace-panel">
            <UserGlossaryPanel
              labels={glossaryLabels}
              authToken={authToken}
              glossaryTerms={glossaryTerms}
              glossaryLoading={glossaryLoading}
              glossaryActionId={glossaryActionId}
              glossaryForm={glossaryForm}
              handleGlossaryFieldChange={handleGlossaryFieldChange}
              handleCreateGlossaryTerm={handleCreateGlossaryTerm}
              handleToggleGlossaryTerm={handleToggleGlossaryTerm}
              handleDeleteGlossaryTerm={handleDeleteGlossaryTerm}
              fetchGlossary={fetchGlossary}
            />
              </section>
              <section hidden={activeTab !== 'convert'} aria-label={tabTitles.convert} className="mallog-workspace-panel">
            <div className="mallog-upload-section">
              <form onSubmit={handleSubmit}>
                <div className="mallog-audio-inputs">

                {/* 드래그 앤 드롭 영역 */}
                <div
                  role="button"
                  tabIndex={uploadBlockedByQuota ? -1 : 0}
                  aria-label="오디오 파일 업로드"
                  className={`mallog-upload-zone relative text-center cursor-pointer transition-colors
                ${uploadBlockedByQuota ? 'opacity-60 cursor-not-allowed nm-concave' :
                      dragOver ? 'nm-concave ring-2 ring-nm-accent scale-[1.01]' :
                        file ? 'mallog-file-selected' :
                          'nm-concave'}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={triggerFilePicker}
                  onKeyDown={handleUploadZoneKeyDown}
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
                        <Check size={22} aria-hidden="true" />
                      </div>
                      <p className="text-sm font-medium text-nm-text-primary">{file.name}</p>
                      <p className="text-xs text-nm-text-secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      {fileDurationSeconds > 0 && (
                        <p className="text-xs text-nm-text-secondary">길이: {formatSecondsToHourMinute(fileDurationSeconds)}</p>
                      )}
                      <span className="mallog-change-file">다른 파일 선택</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-11 h-11 mx-auto rounded-full nm-flat flex items-center justify-center">
                        <Upload size={23} aria-hidden="true" />
                      </div>
                      <p className="text-base font-semibold text-nm-text-primary">오디오 파일</p>
                      <p className="text-xs text-nm-text-secondary">MP3, WAV, M4A, OGG, FLAC (최대 100MB)</p>
                      <span className="mallog-change-file">파일 선택</span>
                    </div>
                  )}
                </div>

                <div className="mallog-recorder">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-nm-text-primary">마이크로 바로 녹음</p>

                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recordingState === 'recording' || recordingState === 'stopping' ? (
                        <>
                          <button
                            type="button"
                            onClick={stopRecording}
                            disabled={recordingState === 'stopping'}
                            className="nm-btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
                          >
                            <Square size={15} aria-hidden="true" />
                            {recordingState === 'stopping' ? '저장 중...' : '녹음 중지'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelRecording}
                            disabled={recordingState === 'stopping'}
                            className="nm-btn px-4 py-2 text-xs font-semibold disabled:opacity-50"
                          >
                            <X size={15} aria-hidden="true" />취소
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          disabled={loading || uploadBlockedByQuota || recordingState === 'requesting'}
                          className="nm-btn px-4 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Mic size={16} aria-hidden="true" className="text-red-500" />
                          {recordingState === 'requesting' ? '권한 확인 중...' : '녹음 시작'}
                        </button>
                      )}
                    </div>
                  </div>
                  <MicrophoneInputControl
                    devices={recordingDevices}
                    selectedDeviceId={selectedRecordingDeviceId}
                    onSelectDevice={selectRecordingDevice}
                    onResumeAnalysis={resumeRecordingAnalysis}
                    disabled={loading || recordingState !== 'idle'}
                    activeDeviceLabel={activeRecordingDeviceLabel}
                    inputState={recordingInputState}
                    labels={MICROPHONE_INPUT_LABELS}
                  />
                  {recordingState === 'recording' && (
                    <RecordingWaveform
                      active
                      level={recordingLevel}
                      signal={recordingSignal}
                      label={`녹음 중 · ${formatSecondsToHourMinute(recordingSeconds)}`}
                    />
                  )}
                </div>

                {/* 설정 */}
                </div>
                <div className="mallog-conversion-options">
                  <div className="flex-1 relative">
                    <label htmlFor={LANGUAGE_SELECT_ID} className="mallog-field-label">언어</label>
                    <select
                      id={LANGUAGE_SELECT_ID}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="ko">한국어</option>
                      <option value="en">English</option>
                      <option value="ja">日本語</option>
                    </select>
                  </div>
                  <div className="flex-1 relative">
                    <label htmlFor={TYPE_SELECT_ID} className="mallog-field-label">유형</label>
                    <select
                      id={TYPE_SELECT_ID}
                      value={transcriptionType}
                      onChange={(e) => setTranscriptionType(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="sermon">설교 녹취</option>
                      <option value="prayer">기도문 전용</option>
                      <option value="phonecall">통화 기록</option>
                      <option value="conversation">대화/회의 기록</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !file || uploadBlockedByQuota || fileExceedsRemainingQuota}
                  className="mallog-primary-action mallog-transcribe-action mt-5"
                >
                  <AudioLines size={18} aria-hidden="true" />
                  {loading ? '변환 중...' : '변환 시작'}
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
              <div className="mallog-processing-card mb-5 animate-slide-up">
                <div className="mallog-processing-inner">
                  <StepIndicator
                    currentStep={currentStep}
                    processingProgress={normalizedProcessingProgress}
                    statusText={processingStatusText}
                    locale="kr"
                  />
                </div>
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
                      <span className="nm-flat px-2 py-0.5 text-[11px] font-medium text-nm-accent">
                        {contentStyleLabels[resolveContentStyle(result)] || typeLabels[result.transcription_type] || result.transcription_type}
                      </span>
                    </div>
                    <span className="nm-flat px-2 py-0.5 text-[11px] font-medium text-green-600">
                      {result.characters?.toLocaleString()} 자
                    </span>
                  </div>

                  <div className="nm-concave p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
                    <div className="text-[13px] leading-7 text-nm-text-primary">
                      {activeTranscriptText
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

                  <div className="mt-4 nm-concave p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-nm-text-primary">수정본 편집</p>
                      <span className="text-[11px] text-nm-text-secondary">
                        {transcriptHasUnsavedEdit ? '변경됨' : '저장됨'}
                      </span>
                    </div>
                    <textarea
                      value={transcriptEditText}
                      onChange={(e) => setTranscriptEditText(e.target.value)}
                      rows={8}
                      className="nm-input w-full text-xs leading-relaxed max-h-64 overflow-y-auto"
                    />
                    <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-nm-text-secondary">
                      <input
                        type="checkbox"
                        checked={trainingDataConsent}
                        onChange={(e) => setTrainingDataConsent(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 accent-nm-accent"
                      />
                      <span>
                        수정한 텍스트를 mallog24 품질 개선 학습 데이터로 제공합니다. 음성 원본은 이 선택만으로 저장하지 않습니다.
                      </span>
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveTranscriptCorrection}
                        disabled={transcriptEditSaving || !transcriptHasUnsavedEdit}
                        className="action-btn disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {transcriptEditSaving ? '저장 중...' : '수정 저장'}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetTranscriptEdit}
                        disabled={!transcriptHasUnsavedEdit}
                        className="action-btn disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        되돌리기
                      </button>
                    </div>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => copyToClipboard(activeTranscriptText, 'text')}
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
                  const summaryType = resolveContentStyle(result)
                  const summaryCopyKey = `summary-${summaryType}`
                  return (
                  !result.summary ? (
                    <button
                      onClick={handleSummarize}
                      disabled={loading}
                      className="w-full nm-btn p-4 text-sm font-medium text-nm-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? '요약 생성 중...' : (summaryActionLabels[summaryType] || summaryActionLabels.meeting)}
                    </button>
                  ) : (
                    <div className="nm-raised p-5 sm:p-6 animate-nm-card-in">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-nm-text-primary">
                          {summaryTitleLabels[summaryType] || summaryTitleLabels.meeting}
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
                  <label className="mb-4 flex items-start gap-2 text-[11px] leading-relaxed text-nm-text-secondary">
                    <input
                      type="checkbox"
                      checked={trainingDataConsent}
                      onChange={(e) => setTrainingDataConsent(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-nm-accent"
                    />
                    <span>
                      기록본을 직접 수정해 저장할 때 변경 내용을 품질 개선 학습 데이터로 제공합니다.
                    </span>
                  </label>

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
              </section>
            {activeTab === 'history' && (
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
                      <>
                        <div className="flex flex-col gap-3 px-4 py-3 border-b border-nm-dark/10 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs leading-5 text-nm-text-secondary">
                              {pendingDeleteAll ? '한 번 더 누르면 진행 중 항목을 제외한 삭제 가능한 기록이 모두 제거됩니다.' : '삭제는 현재 로그인한 계정의 기록에만 반영되며, 진행 중 작업은 유지됩니다.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                            {pendingDeleteAll && !historyBulkDeleting && (
                              <button
                                type="button"
                                onClick={cancelPendingDeleteAll}
                                className="min-w-[84px] rounded-full px-3 py-1.5 text-xs font-semibold bg-nm-light/40 text-nm-text-secondary hover:bg-nm-light/70 transition-colors"
                              >
                                취소
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleDeleteAllHistory}
                              disabled={historyBulkDeleting}
                              className={`min-w-[96px] rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                historyBulkDeleting
                                  ? 'bg-nm-light/40 text-nm-text-secondary cursor-not-allowed'
                                  : pendingDeleteAll
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            >
                              {historyBulkDeleting ? '삭제 중...' : pendingDeleteAll ? '전체 삭제 확인' : '전체 삭제'}
                            </button>
                          </div>
                        </div>
                        <ul className="divide-y divide-nm-dark/20">
                        {history.map((item) => (
                          <li key={item.task_id}>
                            <div className="p-4">
                              <button
                                type="button"
                                onClick={() => { setActiveTab('convert'); handleLoadHistory(item.task_id) }}
                                className="w-full text-left hover:bg-nm-light/20 transition-colors group rounded-2xl"
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
                                          {typeLabels[item.transcription_type] || item.transcription_type}
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
                              {item.api_usage && (
                                <div className="mt-3 border-t border-nm-dark/10 pt-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="break-keep text-[11px] font-bold text-nm-text-primary">관리자 전용 API 사용량</p>
                                    <span className={`whitespace-nowrap text-[10px] font-semibold ${item.api_usage.complete_token_reporting ? 'text-green-600' : 'text-amber-600'}`}>
                                      {item.api_usage.complete_token_reporting ? '전체 집계' : '일부 응답 미집계'}
                                    </span>
                                  </div>
                                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                                    {[
                                      ['총 토큰', Number(item.api_usage.total_reported_tokens || 0).toLocaleString('ko-KR')],
                                      ['OpenAI 토큰', Number(item.api_usage.openai?.total_tokens || 0).toLocaleString('ko-KR')],
                                      ['Gemini 토큰', Number(item.api_usage.gemini?.total_tokens || 0).toLocaleString('ko-KR')],
                                      ['API 요청', `${Number(item.api_usage.total_requests || 0).toLocaleString('ko-KR')}회`],
                                      ['원본 음성', formatSecondsCompact(item.api_usage.source_audio_seconds, 'ko')],
                                      ['처리된 음성', formatSecondsCompact(item.api_usage.openai?.processed_seconds, 'ko')],
                                      ['추가 처리', formatSecondsCompact(item.api_usage.additional_audio_processing_seconds, 'ko')],
                                      ['작업 소요', formatSecondsCompact(item.api_usage.wall_seconds, 'ko')],
                                    ].map(([label, value]) => (
                                      <div key={label} className="min-w-0">
                                        <dt className="break-keep text-[10px] leading-4 text-nm-text-secondary">{label}</dt>
                                        <dd className="whitespace-nowrap text-xs font-semibold text-nm-text-primary">{value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-nm-dark/10 pt-3">
                                {pendingDeleteTaskId === item.task_id && historyDeletingTaskId !== item.task_id && (
                                  <p className="mr-auto text-[11px] leading-4 text-red-500">다시 누르면 이 계정의 기록에서 바로 제거됩니다.</p>
                                )}
                                {pendingDeleteTaskId === item.task_id && historyDeletingTaskId !== item.task_id && (
                                  <button
                                    type="button"
                                    onClick={cancelPendingDeleteTask}
                                    className="min-w-[84px] shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold bg-nm-light/40 text-nm-text-secondary hover:bg-nm-light/70 transition-colors"
                                  >
                                    취소
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHistory(item.task_id)}
                                  disabled={historyDeletingTaskId === item.task_id || ['queued', 'processing'].includes(item.status)}
                                  className={`min-w-[88px] shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    historyDeletingTaskId === item.task_id
                                      ? 'bg-nm-light/40 text-nm-text-secondary cursor-wait'
                                      : ['queued', 'processing'].includes(item.status)
                                        ? 'bg-nm-light/40 text-nm-text-secondary cursor-not-allowed'
                                        : pendingDeleteTaskId === item.task_id
                                          ? 'bg-red-600 text-white hover:bg-red-700'
                                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                                  }`}
                                >
                                  {historyDeletingTaskId === item.task_id ? '삭제 중...' : ['queued', 'processing'].includes(item.status) ? '진행 중' : pendingDeleteTaskId === item.task_id ? '삭제 확인' : '삭제'}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 저장된 기록본 */}
            {activeTab === 'records' && (
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
                        {savedRecords.map((item) => {
                          const recordId = String(item.id || '')
                          const isEditing = Boolean(recordId && Object.prototype.hasOwnProperty.call(savedRecordEditDrafts, recordId))
                          const draftText = isEditing ? savedRecordEditDrafts[recordId] : String(item.content || '')
                          return (
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
                                {isEditing ? (
                                  <textarea
                                    value={draftText}
                                    onChange={(event) => handleSavedRecordEditChange(recordId, event.target.value)}
                                    className="w-full min-h-[160px] resize-y rounded-lg border border-nm-dark/15 bg-white/80 px-3 py-2 text-xs leading-relaxed text-nm-text-primary focus:outline-none focus:ring-2 focus:ring-nm-accent/25 dark:bg-nm-dark/20"
                                  />
                                ) : (
                                  <p className="text-xs text-nm-text-secondary whitespace-pre-wrap leading-relaxed">
                                    {item.content}
                                  </p>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateSavedRecord(item)}
                                      disabled={savedRecordSavingId === recordId}
                                      className="action-btn"
                                    >
                                      {savedRecordSavingId === recordId ? '저장 중...' : '수정 저장'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelSavedRecordEdit(recordId)}
                                      disabled={savedRecordSavingId === recordId}
                                      className="action-btn"
                                    >
                                      취소
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartSavedRecordEdit(item)}
                                      className="action-btn"
                                    >
                                      수정
                                    </button>
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
                                  </>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}

        {/* 푸터 */}
        <footer className="mallog-footer text-center">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
            <a href={OURS_PRIVACY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              개인정보처리방침
            </a>
            <span className="text-nm-text-secondary opacity-45">|</span>
            <a href={OURS_TERMS_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              이용약관
            </a>
            <span className="text-nm-text-secondary opacity-45">|</span>
            <a href={OURS_COMPANY_POLICY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              회사 정책
            </a>
          </div>
          <div className="mb-2 flex flex-col items-center gap-1 text-[11px] text-nm-text-secondary leading-relaxed">
            {footerBusinessRows.map((row, index) => (
              <FooterInlineRow key={`footer-business-${index}`} items={row} />
            ))}
          </div>
          <p className="text-[11px] text-nm-text-secondary">
            mallog24 &middot; Copyright 2026. OURS All rights reserved.
          </p>
        </footer>
      </main>
      {toastMessage && (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-16 right-4 z-[70] max-w-xs nm-raised px-4 py-3 border-l-4 border-amber-500"
        >
          <p className="text-xs text-nm-text-primary">{toastMessage}</p>
        </div>
      )}
    </div>
  )

}
