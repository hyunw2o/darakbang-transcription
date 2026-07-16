export const RECORDING_WAVEFORM_SAMPLE_COUNT = 48
export const RECORDING_SPECTRUM_BAND_COUNT = 24

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function createEmptyRecordingSignal() {
  return {
    waveform: Array(RECORDING_WAVEFORM_SAMPLE_COUNT).fill(0),
    spectrum: Array(RECORDING_SPECTRUM_BAND_COUNT).fill(0),
    pitch: {
      hz: 0,
      normalized: 0.5,
      confidence: 0,
    },
  }
}

export function calculateSignalRms(samples) {
  if (!samples?.length) return 0

  let sumSquares = 0
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Number(samples[index]) || 0
    sumSquares += sample * sample
  }
  return Math.sqrt(sumSquares / samples.length)
}

export function downsampleWaveform(samples, outputCount = RECORDING_WAVEFORM_SAMPLE_COUNT) {
  const count = Math.max(2, Math.floor(outputCount))
  if (!samples?.length) return Array(count).fill(0)

  const result = []
  const bucketSize = samples.length / count
  for (let bucket = 0; bucket < count; bucket += 1) {
    const start = Math.floor(bucket * bucketSize)
    const end = Math.max(start + 1, Math.floor((bucket + 1) * bucketSize))
    let peak = 0

    for (let index = start; index < end && index < samples.length; index += 1) {
      const sample = Number(samples[index]) || 0
      if (Math.abs(sample) > Math.abs(peak)) peak = sample
    }

    result.push(clamp(peak * 2.25, -1, 1))
  }
  return result
}

export function buildLogFrequencyBands(
  frequencyData,
  sampleRate,
  previousBands = [],
  bandCount = RECORDING_SPECTRUM_BAND_COUNT
) {
  const count = Math.max(3, Math.floor(bandCount))
  if (!frequencyData?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return Array(count).fill(0)
  }

  const nyquist = sampleRate / 2
  const lowFrequency = 70
  const highFrequency = Math.min(8000, nyquist)
  const binHz = nyquist / frequencyData.length
  const bands = []

  for (let band = 0; band < count; band += 1) {
    const startRatio = band / count
    const endRatio = (band + 1) / count
    const startHz = lowFrequency * Math.pow(highFrequency / lowFrequency, startRatio)
    const endHz = lowFrequency * Math.pow(highFrequency / lowFrequency, endRatio)
    const startBin = clamp(Math.floor(startHz / binHz), 0, frequencyData.length - 1)
    const endBin = clamp(Math.ceil(endHz / binHz), startBin + 1, frequencyData.length)
    let sumSquares = 0

    for (let index = startBin; index < endBin; index += 1) {
      const magnitude = (Number(frequencyData[index]) || 0) / 255
      sumSquares += magnitude * magnitude
    }

    const energy = Math.sqrt(sumSquares / Math.max(1, endBin - startBin))
    const noiseReduced = clamp((energy - 0.025) * 1.3, 0, 1)
    const previous = Number(previousBands[band]) || 0
    bands.push(clamp(previous * 0.56 + noiseReduced * 0.44, 0, 1))
  }

  return bands
}

export function detectSignalPitch(samples, sampleRate) {
  const silentPitch = { hz: 0, normalized: 0.5, confidence: 0 }
  if (!samples?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return silentPitch

  const rms = calculateSignalRms(samples)
  if (rms < 0.012) return silentPitch

  const minimumPitch = 70
  const maximumPitch = 520
  const minimumLag = Math.max(2, Math.floor(sampleRate / maximumPitch))
  const maximumLag = Math.min(samples.length - 2, Math.ceil(sampleRate / minimumPitch))
  const correlations = new Float32Array(maximumLag + 1)
  let bestLag = -1
  let bestCorrelation = 0

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let cross = 0
    let energyA = 0
    let energyB = 0
    const comparisonLength = samples.length - lag

    for (let index = 0; index < comparisonLength; index += 1) {
      const a = samples[index]
      const b = samples[index + lag]
      cross += a * b
      energyA += a * a
      energyB += b * b
    }

    const correlation = cross / Math.sqrt(Math.max(1e-12, energyA * energyB))
    correlations[lag] = correlation
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation
      bestLag = lag
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.62) return silentPitch

  const left = correlations[Math.max(minimumLag, bestLag - 1)]
  const center = correlations[bestLag]
  const right = correlations[Math.min(maximumLag, bestLag + 1)]
  const denominator = left - 2 * center + right
  const offset = Math.abs(denominator) > 1e-6 ? 0.5 * (left - right) / denominator : 0
  const refinedLag = bestLag + clamp(offset, -0.5, 0.5)
  const hz = sampleRate / refinedLag
  const normalized = clamp(
    Math.log(hz / minimumPitch) / Math.log(maximumPitch / minimumPitch),
    0,
    1
  )

  return {
    hz: Math.round(hz),
    normalized,
    confidence: clamp((bestCorrelation - 0.62) / 0.3, 0, 1),
  }
}
