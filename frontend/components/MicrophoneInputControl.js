const STATUS_TONES = {
  idle: 'bg-nm-text-secondary/40',
  listening: 'bg-blue-500 animate-pulse',
  detected: 'bg-emerald-500',
  'no-signal': 'bg-amber-500',
  muted: 'bg-red-500',
  ended: 'bg-red-500',
  'analysis-blocked': 'bg-amber-500',
}

export default function MicrophoneInputControl({
  devices = [],
  selectedDeviceId = '',
  onSelectDevice,
  onResumeAnalysis,
  disabled = false,
  activeDeviceLabel = '',
  inputState = 'idle',
  labels,
}) {
  const stateLabel = labels.states[inputState] || labels.states.idle
  const statusText = activeDeviceLabel
    ? `${activeDeviceLabel} · ${stateLabel}`
    : stateLabel

  return (
    <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
      <label className="min-w-0">
        <span className="mb-1 block text-[10px] font-semibold text-nm-text-secondary">
          {labels.inputLabel}
        </span>
        <select
          value={selectedDeviceId}
          onChange={(event) => onSelectDevice(event.target.value)}
          disabled={disabled}
          className="nm-input w-full min-w-0 text-xs disabled:cursor-not-allowed disabled:opacity-55"
        >
          <option value="">{labels.systemDefault}</option>
          {devices.map((device, index) => (
            <option key={device.deviceId || `microphone-${index}`} value={device.deviceId}>
              {device.label || `${labels.microphoneFallback} ${index + 1}`}
            </option>
          ))}
        </select>
      </label>

      <div className="min-w-0 sm:self-end">
        <span className="mb-1 block text-[10px] font-semibold text-nm-text-secondary">
          {labels.statusLabel}
        </span>
        <div
          className="nm-input flex min-w-0 items-center gap-2 text-xs"
          title={statusText}
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_TONES[inputState] || STATUS_TONES.idle}`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{statusText}</span>
          {inputState === 'analysis-blocked' ? (
            <button
              type="button"
              onClick={onResumeAnalysis}
              className="shrink-0 font-semibold text-nm-accent hover:opacity-75"
            >
              {labels.resumeAnalysis}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
