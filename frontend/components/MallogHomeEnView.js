import Head from 'next/head'
import Link from 'next/link'
import HeaderMenuControls from './HeaderMenuControls'
import MallogLandingSections from './MallogLandingSections'
import Mallog24Logo from './Mallog24Logo'
import SocialProviderButton from './SocialProviderButton'
import StepIndicator from './StepIndicator'
import { EN_MALLOG_LANDING_CONTENT } from '../content/mallogLandingContent'
import { formatSecondsToHourMinute } from '../utils/format'

export default function MallogHomeEnView(props) {
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
    UPGRADE_CONTACT_URL,
    APP_DOWNLOAD_URL,
    LANGUAGE_SELECT_ID,
    TYPE_SELECT_ID,
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
    triggerFilePicker,
    handleUploadZoneKeyDown,
    handleFileChange,
    handleDrop,
    handleSubmit,
  } = props

  return (
    <div className="min-h-screen pb-12">
      <Head>
        <title>mallog24 - AI Speech to Text</title>
        <meta
          name="description"
          content="AI transcription for sermons, calls, and meetings with structured output. Free 10 hours/month, Pro KRW 8,800/month (VAT included) unlimited."
        />
        <link rel="canonical" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="en" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="ko" href={ALTERNATE_URL} />
        <link rel="alternate" hrefLang="x-default" href={ALTERNATE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="mallog24 - AI Speech to Text" />
        <meta
          property="og:description"
          content="AI transcription for sermons, calls, and meetings with structured output. Free 10 hours/month, Pro KRW 8,800/month (VAT included) unlimited."
        />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="mallog24 - AI Speech to Text" />
        <meta
          name="twitter:description"
          content="AI transcription for sermons, calls, and meetings with structured output. Free 10 hours/month, Pro KRW 8,800/month (VAT included) unlimited."
        />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
      </Head>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-nm-bg shadow-nm-flat">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <a
              href={APP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex text-xs font-semibold text-nm-text-secondary hover:text-nm-accent transition-colors"
            >
              Download App
            </a>
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
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6">
        {!authToken && (
          <MallogLandingSections
            locale="en"
            content={EN_MALLOG_LANDING_CONTENT}
            pricingUrl={UPGRADE_CONTACT_URL}
            oursUrl={OURS_URL}
            stats={landingStats}
            appDownloadUrl={APP_DOWNLOAD_URL}
          />
        )}

        {/* Auth Card */}
        <div id="auth-card" className={`nm-raised p-5 sm:p-6 mb-5 animate-nm-card-in scroll-mt-20 ${!authToken ? 'max-w-2xl mx-auto' : ''}`}>
          {!authToken ? (
            <>
              <div className="mb-4">
                <p className="text-base font-bold text-nm-text-primary">Sign in and upload your first file right away.</p>
                <p className="mt-1 text-xs text-nm-text-secondary">Start in under a minute with email, Google, or Kakao.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {socialProviders.map((provider) => (
                    <SocialProviderButton
                      key={provider.key}
                      onClick={() => handleSocialLogin(provider.key)}
                      disabled={authLoading || Boolean(socialLoading)}
                      provider={provider.key}
                      label={provider.label}
                      loadingLabel={socialLoading === provider.key ? 'Redirecting...' : ''}
                    />
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
                <p className="text-[11px] text-nm-text-secondary mt-1">
                  Session expires in: {sessionRemainingLabel}
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
                        ? `${formatSecondsToHourMinute(usage.used_audio_seconds, 'en')} / ${formatSecondsToHourMinute(monthlyLimitSeconds, 'en')}`
                        : `${formatSecondsToHourMinute(usage.used_audio_seconds, 'en')} / Unlimited`}
                    </p>
                    {isFreeTier && (
                      <p className="text-[11px] text-nm-text-secondary mt-1">
                        Remaining: {formatSecondsToHourMinute(remainingQuotaSeconds, 'en')}
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
              <p className="text-xs sm:text-sm text-nm-accent font-medium leading-relaxed">
                mallog24 recommends the use of officially distributed audio files.
                <span className="block mt-1">
                  If unauthorized or improper use is identified by a third party, the resulting legal responsibility remains with the user.
                </span>
              </p>
            </div>
            {/* 업로드 카드 */}
            <div className="nm-raised p-5 sm:p-6 mb-5 animate-nm-card-in">
              <form onSubmit={handleSubmit}>

                {/* 드래그 앤 드롭 영역 */}
                <div
                  role="button"
                  tabIndex={uploadBlockedByQuota ? -1 : 0}
                  aria-label="Upload audio file"
                  className={`relative p-8 sm:p-10 text-center cursor-pointer transition-all duration-300
                ${uploadBlockedByQuota ? 'opacity-60 cursor-not-allowed nm-concave' :
                      dragOver ? 'nm-concave ring-2 ring-nm-accent scale-[1.01]' :
                        file ? 'nm-raised' : 'nm-concave'}`}
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
                      <div className="w-11 h-11 mx-auto rounded-full nm-raised bg-green-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-nm-text-primary">{file.name}</p>
                      <p className="text-xs text-nm-text-secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      {fileDurationSeconds > 0 && (
                        <p className="text-xs text-nm-text-secondary">Duration: {formatSecondsToHourMinute(fileDurationSeconds, 'en')}</p>
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
                    <label htmlFor={LANGUAGE_SELECT_ID} className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">Language</label>
                    <select
                      id={LANGUAGE_SELECT_ID}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="ko">Korean</option>
                      <option value="en">English</option>
                      <option value="ja">Japanese</option>
                    </select>
                  </div>
                  <div className="flex-1 relative">
                    <label htmlFor={TYPE_SELECT_ID} className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">Type</label>
                    <select
                      id={TYPE_SELECT_ID}
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
                <StepIndicator currentStep={currentStep} locale="en" />
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
                      <span className="nm-flat px-2 py-0.5 text-[11px] font-medium text-nm-accent">
                        {contentStyleLabels[resolveContentStyle(result)] || typeLabels[result.transcription_type] || result.transcription_type}
                      </span>
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
                    <button onClick={exportAsDocx} className="action-btn">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      DOCX
                    </button>
                  </div>
                </div>

                {/* Summary section (type-specific) */}
                {(() => {
                  const summaryType = resolveContentStyle(result)
                  const summaryCopyKey = `summary-${summaryType}`
                  return (
                  !result.summary ? (
                    <button
                      onClick={handleSummarize}
                      disabled={loading}
                      className="w-full nm-btn p-4 text-sm font-medium text-nm-accent
                    disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Generating summary...' : (summaryActionLabels[summaryType] || summaryActionLabels.meeting)}
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
                          {copied === summaryCopyKey ? 'Copied' : 'Copy'}
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
                            className="nm-input w-full text-xs leading-relaxed max-h-56 overflow-y-auto"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(recordDrafts[recordCategory.key], `record-draft-${recordCategory.key}`)}
                              className="action-btn"
                            >
                              {copied === `record-draft-${recordCategory.key}` ? 'Copied' : 'Copy'}
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

            {/* History */}
            {authToken && (
              <div className="mt-8">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-sm font-medium text-nm-text-secondary hover:text-nm-text-primary mb-3 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistory ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Recent Transcriptions {historyLoaded ? `(${history.length})` : ''}
                </button>

                {showHistory && (
                  <div className="nm-raised overflow-hidden animate-slide-up">
                    {historyLoading ? (
                      <p className="text-sm text-nm-text-secondary p-4">Loading transcription history...</p>
                    ) : history.length === 0 ? (
                      <p className="text-sm text-nm-text-secondary p-4">No transcriptions yet.</p>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3 px-4 py-3 border-b border-nm-text-secondary/10 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs leading-5 text-nm-text-secondary">
                              {pendingDeleteAll ? 'Press Delete all again to remove every deletable item while keeping active tasks.' : 'Deletes apply only to the currently signed-in account, and active tasks stay in place.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                            {pendingDeleteAll && !historyBulkDeleting && (
                              <button
                                type="button"
                                onClick={cancelPendingDeleteAll}
                                className="min-w-[84px] rounded-full px-3 py-1.5 text-xs font-semibold bg-nm-bg/60 text-nm-text-secondary hover:bg-nm-bg transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleDeleteAllHistory}
                              disabled={historyBulkDeleting}
                              className={`min-w-[96px] rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                historyBulkDeleting
                                  ? 'bg-nm-bg/60 text-nm-text-secondary cursor-not-allowed'
                                  : pendingDeleteAll
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            >
                              {historyBulkDeleting ? 'Deleting...' : pendingDeleteAll ? 'Confirm delete all' : 'Delete all'}
                            </button>
                          </div>
                        </div>
                        <ul className="divide-y divide-nm-text-secondary/10">
                        {history.map((item) => (
                          <li key={item.task_id}>
                            <div className="p-4">
                              <button
                                type="button"
                                onClick={() => handleLoadHistory(item.task_id)}
                                className="w-full text-left hover:bg-nm-bg/50 transition-colors group rounded-2xl"
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
                                      {item.summary_preview || 'Open the transcript to view details.'}
                                    </p>
                                  </div>
                                  <svg className="w-4 h-4 text-nm-text-secondary group-hover:text-nm-accent shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </button>
                              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-nm-text-secondary/10 pt-3">
                                {pendingDeleteTaskId === item.task_id && historyDeletingTaskId !== item.task_id && (
                                  <p className="mr-auto text-[11px] leading-4 text-red-500">Press Delete again to remove this item from your account history.</p>
                                )}
                                {pendingDeleteTaskId === item.task_id && historyDeletingTaskId !== item.task_id && (
                                  <button
                                    type="button"
                                    onClick={cancelPendingDeleteTask}
                                    className="min-w-[84px] shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold bg-nm-bg/60 text-nm-text-secondary hover:bg-nm-bg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHistory(item.task_id)}
                                  disabled={historyDeletingTaskId === item.task_id || ['queued', 'processing'].includes(item.status)}
                                  className={`min-w-[88px] shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    historyDeletingTaskId === item.task_id
                                      ? 'bg-nm-bg/60 text-nm-text-secondary cursor-wait'
                                      : ['queued', 'processing'].includes(item.status)
                                        ? 'bg-nm-bg/60 text-nm-text-secondary cursor-not-allowed'
                                        : pendingDeleteTaskId === item.task_id
                                          ? 'bg-red-600 text-white hover:bg-red-700'
                                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                                  }`}
                                >
                                  {historyDeletingTaskId === item.task_id ? 'Deleting...' : ['queued', 'processing'].includes(item.status) ? 'Active' : pendingDeleteTaskId === item.task_id ? 'Confirm delete' : 'Delete'}
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
                    {recordsLoading ? (
                      <p className="text-sm text-nm-text-secondary p-4">Loading saved records...</p>
                    ) : savedRecords.length === 0 ? (
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
                                {copied === `saved-record-${item.id}` ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                onClick={() => exportTextByLabel(item.content, item.title || item.category || 'Record', 'txt')}
                                className="action-btn"
                              >
                                TXT
                              </button>
                              <button
                                type="button"
                                onClick={() => exportTextByLabel(item.content, item.title || item.category || 'Record', 'docx')}
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
              Privacy Policy
            </a>
            <span className="text-nm-text-secondary">·</span>
            <a href={OURS_TERMS_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              Terms of Service
            </a>
            <span className="text-nm-text-secondary">·</span>
            <a href={OURS_COMPANY_POLICY_URL} className="text-nm-text-secondary hover:text-nm-accent transition-colors">
              Company Policy
            </a>
          </div>
          <div className="space-y-1 text-[11px] text-nm-text-secondary mb-2">
            <p>Company Name: {BUSINESS_NAME}</p>
            <p>Business Registration No.: {BUSINESS_REG_NUMBER}</p>
            {LANDLINE_PHONE && <p>Representative Phone: {LANDLINE_PHONE}</p>}
            <p>Business Address: {BUSINESS_ADDRESS}</p>
            <p>Representative (CEO): {REPRESENTATIVE_NAME}</p>
            <p>E-commerce Registration No.: {ECOMMERCE_REG_NUMBER}</p>
            <p>Trademark Application No.: {TRADEMARK_APPLICATION_NO}</p>
            <p>Copyright Registration No.: {COPYRIGHT_REGISTRATION_NO}</p>
            <p>Business Inquiry Email: {SUPPORT_EMAIL}</p>
            <p>1:1 Inquiry Email: {SUPPORT_EMAIL}</p>
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
