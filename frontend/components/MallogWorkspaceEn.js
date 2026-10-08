import { useState } from 'react'
import MallogWorkspaceNav from './MallogWorkspaceNav'
import { AudioLines, Check, Upload, Mic, Square, X } from 'lucide-react'
import MicrophoneInputControl from './MicrophoneInputControl'
import RecordingWaveform from './RecordingWaveform'
import StepIndicator from './StepIndicator'
import UserGlossaryPanel from './UserGlossaryPanel'
import { formatSecondsCompact, formatSecondsToHourMinute } from '../utils/format'
import { getTranscriptionProgressText, normalizeTranscriptionProgress } from '../utils/transcriptionProgress'

const MICROPHONE_INPUT_LABELS = {
  inputLabel: 'Input microphone',
  systemDefault: 'System default microphone',
  microphoneFallback: 'Microphone',
  statusLabel: 'Input status',
  resumeAnalysis: 'Resume',
  states: {
    idle: 'Waiting for connection',
    listening: 'Waiting for input',
    detected: 'Microphone input detected',
    'no-signal': 'No input signal',
    muted: 'Microphone muted',
    ended: 'Microphone disconnected',
    'analysis-blocked': 'Waveform analysis paused',
  },
}

export default function MallogWorkspaceEn(props) {
  const {
    copied,
    error,
    notice,
    LANGUAGE_SELECT_ID,
    TYPE_SELECT_ID,
    authToken,
    authUser,
    usage,
    handleLogout,
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
    fileExceedsRemainingQuota,
    uploadBlockedByQuota,
    typeLabels,
    contentStyleLabels,
    summaryActionLabels,
    summaryTitleLabels,
    recordTypeLabels,
    recordCategories,
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
  const selectTab = (tab) => {
    setActiveTab(tab)
    if (tab === 'history') setShowHistory(true)
    if (tab === 'records') setShowRecords(true)
  }
  const tabTitles = { convert: 'New transcription', history: 'Transcription history', records: 'Saved documents', glossary: 'My glossary' }

  const activeTranscriptText = result ? (transcriptEditText || result.corrected_text || result.raw_text || '') : ''
  const normalizedProcessingProgress = normalizeTranscriptionProgress(
    processingProgress,
    currentStep <= 1 ? 'uploading' : currentStep === 2 ? 'queued' : 'correcting_text'
  )
  const processingStatusText = getTranscriptionProgressText(normalizedProcessingProgress, 'en')

  return (
          <div className="mallog-workspace">
            <MallogWorkspaceNav locale="en" activeTab={activeTab} onChange={selectTab} authUser={authUser} usage={usage} handleLogout={handleLogout} busy={loading || recordingState !== 'idle'} />
            <div className="mallog-workspace-content">
              <div className="mallog-workspace-heading">
                <h1>{tabTitles[activeTab]}</h1>
                <span className="mallog-workspace-meta">{loading ? 'Transcription in progress' : 'Free access'}</span>
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
                  aria-label="Upload audio file"
                  className={`mallog-upload-zone relative text-center cursor-pointer transition-colors
                ${uploadBlockedByQuota ? 'opacity-60 cursor-not-allowed nm-concave' :
                      dragOver ? 'nm-concave ring-2 ring-nm-accent scale-[1.01]' :
                        file ? 'mallog-file-selected' : 'nm-concave'}`}
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
                      <span className="mallog-change-file">Choose a different file</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-11 h-11 mx-auto rounded-full nm-concave flex items-center justify-center">
                        <Upload size={23} aria-hidden="true" />
                      </div>
                      <p className="text-base font-semibold text-nm-text-primary">Audio file</p>
                      <p className="text-xs text-nm-text-secondary">MP3, WAV, M4A, OGG, FLAC (up to 100MB)</p>
                      <span className="mallog-change-file">Choose file</span>
                    </div>
                  )}
                </div>

                <div className="mallog-recorder">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-nm-text-primary">Record with microphone</p>

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
                            {recordingState === 'stopping' ? 'Saving...' : 'Stop recording'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelRecording}
                            disabled={recordingState === 'stopping'}
                            className="nm-btn px-4 py-2 text-xs font-semibold disabled:opacity-50"
                          >
                            <X size={15} aria-hidden="true" />Cancel
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
                          {recordingState === 'requesting' ? 'Checking permission...' : 'Start recording'}
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
                      label={`Recording · ${formatSecondsToHourMinute(recordingSeconds, 'en')}`}
                    />
                  )}
                </div>

                {/* 설정 */}
                </div>
                <div className="mallog-conversion-options">
                  <div className="flex-1 relative">
                    <label htmlFor={LANGUAGE_SELECT_ID} className="mallog-field-label">Language</label>
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
                    <label htmlFor={TYPE_SELECT_ID} className="mallog-field-label">Type</label>
                    <select
                      id={TYPE_SELECT_ID}
                      value={transcriptionType}
                      onChange={(e) => setTranscriptionType(e.target.value)}
                      className="nm-input w-full"
                    >
                      <option value="sermon">Sermon Transcript</option>
                      <option value="prayer">Prayer Transcript</option>
                      <option value="phonecall">Call Record</option>
                      <option value="conversation">Meeting/Conversation Record</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !file || uploadBlockedByQuota || fileExceedsRemainingQuota}
                  className="mallog-primary-action mallog-transcribe-action mt-5"
                >
                  <AudioLines size={18} aria-hidden="true" />
                  {loading ? 'Transcribing...' : 'Start transcription'}
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
              <div className="mallog-processing-card mb-5 animate-slide-up animate-nm-card-in">
                <div className="mallog-processing-inner">
                  <StepIndicator
                    currentStep={currentStep}
                    processingProgress={normalizedProcessingProgress}
                    statusText={processingStatusText}
                    locale="en"
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
                      {activeTranscriptText
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
                          const speakerMatch = trimmed.match(/^((?:화자|참석자|Speaker|Participant|話者|参加者)\s*(?:[A-Z]|\d+|\?)(?:\s*\([^)]*\))?)\s*[:：]/)
                          if (speakerMatch) {
                            return (
                              <p key={i} className="mb-1.5">
                                <span className="mallog-speaker-label nm-flat inline-block max-w-full break-words px-2 py-0.5 mr-1.5 text-[11px] font-semibold text-nm-accent">
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
                      <p className="text-xs font-semibold text-nm-text-primary">Edit Transcript</p>
                      <span className="text-[11px] text-nm-text-secondary">
                        {transcriptHasUnsavedEdit ? 'Changed' : 'Saved'}
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
                        Share edited text as mallog24 quality-improvement training data. This option does not store the original audio.
                      </span>
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveTranscriptCorrection}
                        disabled={transcriptEditSaving || !transcriptHasUnsavedEdit}
                        className="action-btn disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {transcriptEditSaving ? 'Saving...' : 'Save Correction'}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetTranscriptEdit}
                        disabled={!transcriptHasUnsavedEdit}
                        className="action-btn disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reset
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
                  <label className="mb-4 flex items-start gap-2 text-[11px] leading-relaxed text-nm-text-secondary">
                    <input
                      type="checkbox"
                      checked={trainingDataConsent}
                      onChange={(e) => setTrainingDataConsent(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-nm-accent"
                    />
                    <span>
                      Share record edits as quality-improvement training data.
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
                                onClick={() => { setActiveTab('convert'); handleLoadHistory(item.task_id) }}
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
                                          {typeLabels[item.transcription_type] || item.transcription_type}
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
                              {item.api_usage && (
                                <div className="mt-3 border-t border-nm-text-secondary/10 pt-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[11px] font-bold text-nm-text-primary">Admin-only API usage</p>
                                    <span className={`whitespace-nowrap text-[10px] font-semibold ${item.api_usage.complete_token_reporting ? 'text-green-600' : 'text-amber-600'}`}>
                                      {item.api_usage.complete_token_reporting ? 'Complete report' : 'Some usage unreported'}
                                    </span>
                                  </div>
                                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                                    {[
                                      ['Total tokens', Number(item.api_usage.total_reported_tokens || 0).toLocaleString('en-US')],
                                      ['OpenAI tokens', Number(item.api_usage.openai?.total_tokens || 0).toLocaleString('en-US')],
                                      ['Gemini tokens', Number(item.api_usage.gemini?.total_tokens || 0).toLocaleString('en-US')],
                                      ['API requests', Number(item.api_usage.total_requests || 0).toLocaleString('en-US')],
                                      ['Source audio', formatSecondsCompact(item.api_usage.source_audio_seconds, 'en')],
                                      ['Processed audio', formatSecondsCompact(item.api_usage.openai?.processed_seconds, 'en')],
                                      ['Extra processing', formatSecondsCompact(item.api_usage.additional_audio_processing_seconds, 'en')],
                                      ['Elapsed time', formatSecondsCompact(item.api_usage.wall_seconds, 'en')],
                                    ].map(([label, value]) => (
                                      <div key={label} className="min-w-0">
                                        <dt className="text-[10px] leading-4 text-nm-text-secondary">{label}</dt>
                                        <dd className="whitespace-nowrap text-xs font-semibold text-nm-text-primary">{value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              )}
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
            {activeTab === 'records' && (
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
                                    ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
                                      {savedRecordSavingId === recordId ? 'Saving...' : 'Save Edit'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelSavedRecordEdit(recordId)}
                                      disabled={savedRecordSavingId === recordId}
                                      className="action-btn"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartSavedRecordEdit(item)}
                                      className="action-btn"
                                    >
                                      Edit
                                    </button>
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
  )
}
