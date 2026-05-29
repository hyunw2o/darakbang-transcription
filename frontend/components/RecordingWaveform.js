const WAVEFORM_BAR_WEIGHTS = [0.18, 0.42, 0.72, 0.5, 0.95, 0.62, 0.82, 0.36, 0.68, 0.28, 0.88, 0.48]

function clampLevel(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

export default function RecordingWaveform({ active = false, level = 0, label = '' }) {
  const normalizedLevel = active ? Math.max(0.04, clampLevel(level)) : 0

  return (
    <div className="mt-3 flex items-center gap-3">
      <div
        className="h-10 flex flex-1 items-center justify-center gap-1 rounded-full border border-red-500/10 bg-red-500/[0.035] px-3 overflow-hidden"
        aria-hidden="true"
      >
        {WAVEFORM_BAR_WEIGHTS.map((weight, index) => {
          const height = 6 + Math.round((0.14 + normalizedLevel * weight) * 28)
          const opacity = active ? 0.16 + normalizedLevel * 0.5 : 0.1
          return (
            <span
              key={`waveform-bar-${index}`}
              className="w-1.5 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.36)] transition-all duration-100 ease-out"
              style={{
                height: `${height}px`,
                opacity,
              }}
            />
          )
        })}
      </div>
      {label ? <p className="shrink-0 text-xs font-semibold text-red-500">{label}</p> : null}
    </div>
  )
}
