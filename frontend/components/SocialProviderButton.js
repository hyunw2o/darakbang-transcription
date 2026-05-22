function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px] shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.9 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.31-1.58-5.01-3.7H1.97v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.99 10.71A5.41 5.41 0 0 1 3.71 9c0-.59.1-1.16.28-1.71V4.96H1.97A9 9 0 0 0 1 9c0 1.45.35 2.82.97 4.04l2.02-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.33l2.57-2.57C13.46.89 11.42 0 9 0A9 9 0 0 0 1.97 4.96l2.02 2.33c.7-2.12 2.67-3.71 5.01-3.71Z" />
    </svg>
  )
}

function KakaoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px] shrink-0">
      <path fill="#191919" d="M9 2.2c-3.88 0-7.02 2.43-7.02 5.43 0 1.93 1.32 3.63 3.3 4.59l-.84 3.08a.27.27 0 0 0 .4.31l3.66-2.43c.16.01.33.02.5.02 3.88 0 7.02-2.43 7.02-5.43S12.88 2.2 9 2.2Z" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px] shrink-0" fill="currentColor">
      <path d="M13.65 9.55c-.02-1.82 1.5-2.7 1.57-2.74-.86-1.24-2.19-1.41-2.65-1.43-1.11-.12-2.19.66-2.75.66-.57 0-1.43-.64-2.36-.62-1.2.02-2.33.71-2.95 1.79-1.27 2.2-.32 5.43.89 7.2.6.86 1.31 1.82 2.24 1.78.9-.04 1.24-.57 2.34-.57 1.09 0 1.4.57 2.35.55.98-.02 1.59-.86 2.18-1.72.7-.99.98-1.96.99-2.01-.02-.01-1.87-.71-1.9-2.89ZM11.84 4.2c.49-.62.82-1.45.74-2.29-.71.03-1.59.48-2.1 1.09-.45.53-.86 1.4-.75 2.22.79.06 1.6-.4 2.11-1.02Z" />
    </svg>
  )
}

const PROVIDER_CONFIG = {
  apple: {
    className:
      "border border-[#1A1916] bg-[#1A1916] text-white hover:bg-[#2D2B27] focus-visible:outline-[#1A1916]",
    icon: <AppleMark />,
  },
  google: {
    className:
      "border border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa] focus-visible:outline-[#4285F4]",
    icon: <GoogleMark />,
  },
  kakao: {
    className:
      "border border-[#e6cf00] bg-[#FEE500] text-[#191919] hover:bg-[#f8dd00] focus-visible:outline-[#191919]",
    icon: <KakaoMark />,
  },
}

export default function SocialProviderButton({ provider, label, loadingLabel, disabled, onClick }) {
  const config = PROVIDER_CONFIG[provider]
  if (!config) return null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[44px] rounded-full px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${config.className}`}
    >
      {config.icon}
      <span>{loadingLabel || label}</span>
    </button>
  )
}
