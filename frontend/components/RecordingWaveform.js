const FALLBACK_SPECTRUM = [
  0.12, 0.18, 0.22, 0.28, 0.34, 0.31, 0.26, 0.22,
  0.18, 0.16, 0.14, 0.12, 0.1, 0.09, 0.08, 0.07,
  0.06, 0.055, 0.05, 0.045, 0.04, 0.035, 0.03, 0.025,
]

function clampLevel(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function buildWaveformPoints(samples, level) {
  const values = Array.isArray(samples) && samples.length > 1
    ? samples
    : FALLBACK_SPECTRUM.map((weight, index) => Math.sin(index * 1.35) * weight * level)

  return values
    .map((sample, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100
      const y = 20 - Math.max(-1, Math.min(1, Number(sample) || 0)) * 15
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export default function RecordingWaveform({
  active = false,
  level = 0,
  signal,
  label = '',
}) {
  const normalizedLevel = active ? Math.max(0.025, clampLevel(level)) : 0
  const spectrum = Array.isArray(signal?.spectrum) && signal.spectrum.length
    ? signal.spectrum
    : FALLBACK_SPECTRUM
  const waveformPoints = buildWaveformPoints(signal?.waveform, normalizedLevel)
  const pitch = signal?.pitch || {}
  const pitchVisible = active && Number(pitch.confidence) >= 0.28 && Number(pitch.hz) > 0
  const pitchY = 34 - clampLevel(pitch.normalized) * 28

  return (
    <div className="recording-signal-row">
      <div className="recording-signal-track" aria-hidden="true">
        <div className="recording-spectrum">
          {spectrum.map((band, index) => {
            const energy = active ? clampLevel(band) : 0
            return (
              <span
                key={`recording-band-${index}`}
                className="recording-spectrum-bar"
                style={{
                  height: `${4 + Math.round(energy * 32)}px`,
                  opacity: 0.08 + energy * 0.42,
                }}
              />
            )
          })}
        </div>
        <svg
          className="recording-signal-svg"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          <line className="recording-signal-centerline" x1="0" y1="20" x2="100" y2="20" />
          <polyline className="recording-waveform-line" points={waveformPoints} />
          {pitchVisible ? (
            <>
              <line className="recording-pitch-guide" x1="88" y1={pitchY} x2="98" y2={pitchY} />
              <circle className="recording-pitch-dot" cx="94" cy={pitchY} r="1.8" />
            </>
          ) : null}
        </svg>
      </div>
      {label ? <p className="recording-signal-label">{label}</p> : null}
    </div>
  )
}
