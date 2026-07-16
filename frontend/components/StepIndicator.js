import {
  normalizeTranscriptionProgress,
  resolveProcessStepIndex,
  TRANSCRIPTION_PROCESS_STEPS,
} from '../utils/transcriptionProgress'

const COPY = {
  ko: {
    currentStage: '현재 처리 단계',
    progressLabel: '음성 변환 진행률',
  },
  en: {
    currentStage: 'Current stage',
    progressLabel: 'Transcription progress',
  },
}

export default function StepIndicator({
  currentStep,
  processingProgress,
  statusText,
  locale = 'kr',
}) {
  const normalizedLocale = locale === 'en' ? 'en' : 'ko'
  const steps = TRANSCRIPTION_PROCESS_STEPS[normalizedLocale]
  const progress = normalizeTranscriptionProgress(
    processingProgress,
    Number(currentStep) <= 1 ? 'uploading' : Number(currentStep) === 2 ? 'queued' : 'correcting_text'
  )
  const resolvedIndex = resolveProcessStepIndex(progress.stage, currentStep, normalizedLocale)
  const activeIndex = Math.max(0, Math.min(steps.length - 1, resolvedIndex))
  const allCompleted = progress.stage === 'completed'
  const current = steps[activeIndex]
  const windowStart = Math.min(
    Math.max(activeIndex - 1, 0),
    Math.max(steps.length - 3, 0)
  )
  const visibleSteps = steps.slice(windowStart, windowStart + 3)

  const resolveState = (index) => {
    if (allCompleted || index < activeIndex) return 'completed'
    if (index === activeIndex) return 'active'
    return 'waiting'
  }

  return (
    <div
      className={`mallog-flow-process ${progress.stage === 'error' ? 'is-error' : ''}`}
      aria-label={COPY[normalizedLocale].progressLabel}
    >
      <div className="mallog-flow-header">
        <div className="mallog-flow-current">
          <span className="mallog-flow-live-dot" aria-hidden="true" />
          <div className="min-w-0">
            <p className="mallog-flow-eyebrow">{COPY[normalizedLocale].currentStage}</p>
            <p className="mallog-flow-title">{current.label}</p>
          </div>
        </div>
        <span className="mallog-flow-percent" aria-hidden="true">
          {progress.percent}%
        </span>
      </div>

      <p className="mallog-flow-status" role="status" aria-live="polite">
        {statusText || current.caption}
      </p>

      <ol className="mallog-flow-context" aria-label={COPY[normalizedLocale].currentStage}>
        {visibleSteps.map((step, offset) => {
          const index = windowStart + offset
          const state = resolveState(index)

          return (
            <li
              key={step.id}
              className={`mallog-flow-context-item is-${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="mallog-flow-context-icon" aria-hidden="true">
                {state === 'completed' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  </svg>
                ) : (
                  <span />
                )}
              </span>
              <span className="mallog-flow-context-copy">
                <span className="mallog-flow-context-label">{step.label}</span>
                <span className="mallog-flow-context-caption">{step.caption}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mallog-flow-rail-wrap">
        <div
          className="mallog-flow-rail"
          role="progressbar"
          aria-label={COPY[normalizedLocale].progressLabel}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress.percent}
        >
          <div className="mallog-flow-fill" style={{ width: `${progress.percent}%` }}>
            <svg
              className="mallog-flow-wave"
              viewBox="0 0 120 12"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className="mallog-flow-wave-path"
                d="M0 6 C10 1 20 11 30 6 S50 1 60 6 S80 11 90 6 S110 1 120 6"
              />
            </svg>
            <span className="mallog-flow-head" aria-hidden="true" />
          </div>
        </div>
        <ol className="mallog-flow-markers" aria-hidden="true">
          {steps.map((step, index) => (
            <li key={step.id} className={`is-${resolveState(index)}`}>
              <span />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
