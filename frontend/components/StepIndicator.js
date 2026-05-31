const STEP_LABELS = {
  kr: [
    { label: '업로드', caption: '파일 전송', num: 1 },
    { label: '음성 인식', caption: 'AI 전사', num: 2 },
    { label: '교정', caption: '문서 정리', num: 3 },
  ],
  en: [
    { label: 'Upload', caption: 'Transfer', num: 1 },
    { label: 'Speech', caption: 'AI transcript', num: 2 },
    { label: 'Refine', caption: 'Structure', num: 3 },
  ],
}

export default function StepIndicator({ currentStep, locale = 'kr' }) {
  const steps = STEP_LABELS[locale] || STEP_LABELS.kr
  const boundedStep = Math.max(1, Math.min(steps.length, Number(currentStep) || 1))

  return (
    <div
      className="mallog-step-indicator"
      aria-label={locale === 'en' ? 'Transcription progress' : '변환 진행 상태'}
    >
      {steps.map((step) => {
        const isCompleted = boundedStep > step.num
        const isActive = boundedStep === step.num

        return (
          <div
            key={step.num}
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
                step.num
              )}
            </div>
            <div className="min-w-0">
              <p className="mallog-step-label">{step.label}</p>
              <p className="mallog-step-caption">{step.caption}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
