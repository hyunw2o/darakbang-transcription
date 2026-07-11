import {
  normalizeTranscriptionProgress,
  resolveProcessStepIndex,
  TRANSCRIPTION_PROCESS_STEPS,
} from '../utils/transcriptionProgress'

export default function StepIndicator({ currentStep, processingProgress, locale = 'kr' }) {
  const normalizedLocale = locale === 'en' ? 'en' : 'ko'
  const steps = TRANSCRIPTION_PROCESS_STEPS[normalizedLocale]
  const progress = normalizeTranscriptionProgress(
    processingProgress,
    Number(currentStep) <= 1 ? 'uploading' : Number(currentStep) === 2 ? 'queued' : 'correcting_text'
  )
  const activeIndex = resolveProcessStepIndex(progress.stage, currentStep, normalizedLocale)
  const allCompleted = progress.stage === 'completed'

  return (
    <ol
      className="mallog-step-indicator"
      aria-label={normalizedLocale === 'en' ? 'Detailed transcription progress' : '상세 변환 진행 상태'}
    >
      {steps.map((step, index) => {
        const isCompleted = allCompleted || activeIndex > index
        const isActive = !allCompleted && activeIndex === index

        return (
          <li
            key={step.id}
            className={`mallog-step-item ${
              isCompleted ? 'is-completed' : isActive ? 'is-active' : 'is-waiting'
            }`}
            aria-current={isActive ? 'step' : undefined}
          >
            <div className="mallog-step-dot" aria-hidden="true">
              {isCompleted ? (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : isActive ? (
                <span className="mallog-step-pulse" />
              ) : (
                index + 1
              )}
            </div>
            <div className="min-w-0">
              <p className="mallog-step-label">{step.label}</p>
              <p className="mallog-step-caption">{step.caption}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
