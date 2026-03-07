import Head from 'next/head'
import Link from 'next/link'
import HeaderMenuControls from './HeaderMenuControls'
import MallogLandingSections from './MallogLandingSections'
import Mallog24Logo from './Mallog24Logo'
import StepIndicator from './StepIndicator'
import { KO_MALLOG_LANDING_CONTENT } from '../content/mallogLandingContent'
import { formatSecondsToHourMinute } from '../utils/format'

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
    SUPPORT_EMAIL,
    CANONICAL_URL,
    ALTERNATE_URL,
    UPGRADE_CONTACT_URL,
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
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 AI 녹취 서비스. 무료 월 10시간, Pro 월 8,800원(VAT 포함) 무제한."
        />
        <link rel="canonical" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="ko" href={CANONICAL_URL} />
        <link rel="alternate" hrefLang="en" href={ALTERNATE_URL} />
        <link rel="alternate" hrefLang="x-default" href={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="mallog24 - AI Speech to Text" />
        <meta
          property="og:description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 AI 녹취 서비스. 무료 월 10시간, Pro 월 8,800원(VAT 포함) 무제한."
        />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="mallog24 - AI Speech to Text" />
        <meta
          name="twitter:description"
          content="설교, 통화, 회의 음성을 구조화된 문서로 변환하는 AI 녹취 서비스. 무료 월 10시간, Pro 월 8,800원(VAT 포함) 무제한."
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

      <main className="max-w-4xl mx-auto px-4 pt-6">
        {!authToken && (
          <MallogLandingSections
            locale="kr"
            content={KO_MALLOG_LANDING_CONTENT}
            pricingUrl={UPGRADE_CONTACT_URL}
            oursUrl={OURS_URL}
            stats={landingStats}
          />
        )}

        {/* 인증 카드 */}
        <div className={`nm-raised p-5 sm:p-6 mb-5 animate-nm-card-in ${!authToken ? 'max-w-2xl mx-auto' : ''}`}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {socialProviders.map((provider) => (
                    <button
                      key={provider.key}
                      type="button"
                      onClick={() => handleSocialLogin(provider.key)}
                      disabled={authLoading || Boolean(socialLoading)}
                      className="nm-btn w-full min-h-[44px] px-3 py-2 text-sm font-semibold text-nm-text-primary inline-flex items-center justify-center gap-2 text-center leading-snug"
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
                <p className="text-[11px] text-nm-text-secondary mt-1">
                  세션 남은 시간: {sessionRemainingLabel}
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
              <p className="text-xs sm:text-sm text-nm-accent font-medium leading-relaxed">
                mallog24는 공식적으로 배포된 음성 파일의 사용을 권장합니다.
                <span className="block mt-1">
                  비정상적이거나 권한 없는 방식으로 사용하다가 외부에 적발되는 경우, 그에 따른 법적 책임은 사용자에게 있습니다.
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
                  aria-label="오디오 파일 업로드"
                  className={`relative p-8 sm:p-10 text-center cursor-pointer transition-all duration-300
                ${uploadBlockedByQuota ? 'opacity-60 cursor-not-allowed nm-concave' :
                      dragOver ? 'nm-concave ring-2 ring-nm-accent scale-[1.01]' :
                        file ? 'nm-raised' :
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
                    <label htmlFor={LANGUAGE_SELECT_ID} className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">언어</label>
                    <select
                      id={LANGUAGE_SELECT_ID}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="ko">한국어</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="flex-1 relative">
                    <label htmlFor={TYPE_SELECT_ID} className="absolute -top-2 left-3 px-1 bg-nm-bg text-[10px] font-medium text-nm-text-secondary z-10">유형</label>
                    <select
                      id={TYPE_SELECT_ID}
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
                <StepIndicator currentStep={currentStep} locale="kr" />
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
            {LANDLINE_PHONE && <p>유선전화번호: {LANDLINE_PHONE}</p>}
            <p>사업장주소: {BUSINESS_ADDRESS}</p>
            <p>대표: {REPRESENTATIVE_NAME}</p>
            <p>통신판매신고번호: {ECOMMERCE_REG_NUMBER}</p>
            <p>비즈니스 문의 이메일: {SUPPORT_EMAIL}</p>
            <p>1:1 문의 이메일: {SUPPORT_EMAIL}</p>
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
