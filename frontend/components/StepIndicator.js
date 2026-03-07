const STEP_LABELS = {
  kr: [
    { label: '업로드', num: 1 },
    { label: '음성 인식', num: 2 },
    { label: '교정', num: 3 },
  ],
  en: [
    { label: 'Upload', num: 1 },
    { label: 'STT', num: 2 },
    { label: 'Refine', num: 3 },
  ],
}

export default function StepIndicator({ currentStep, locale = 'kr' }) {
  const steps = STEP_LABELS[locale] || STEP_LABELS.kr

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, i) => {
        const isCompleted = currentStep > step.num
        const isActive = currentStep === step.num

        return (
          <div key={step.num} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  isCompleted
                    ? 'nm-raised bg-green-500 text-white'
                    : isActive
                      ? 'nm-raised bg-nm-accent text-white animate-pulse-slow'
                      : 'nm-concave text-nm-text-secondary'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  isActive
                    ? 'text-nm-accent'
                    : isCompleted
                      ? 'text-green-600'
                      : 'text-nm-text-secondary'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 sm:w-14 h-0.5 mb-5 rounded-full transition-all duration-700 ${
                  currentStep > step.num ? 'bg-green-400' : 'nm-concave'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
