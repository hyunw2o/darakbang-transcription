export const getAudioDurationSecondsInBrowser = async (file) => {
  const fromMetadata = () =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.src = objectUrl

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl)
        audio.removeAttribute('src')
      }

      const timeoutId = window.setTimeout(() => {
        cleanup()
        reject(new Error('metadata-timeout'))
      }, 6000)

      audio.onloadedmetadata = () => {
        window.clearTimeout(timeoutId)
        const duration = Number(audio.duration)
        cleanup()
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error('invalid-metadata-duration'))
          return
        }
        resolve(Math.max(1, Math.ceil(duration)))
      }

      audio.onerror = () => {
        window.clearTimeout(timeoutId)
        cleanup()
        reject(new Error('metadata-error'))
      }
    })

  const fromDecode = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      throw new Error('audio-context-unavailable')
    }

    const audioContext = new AudioContextClass()
    try {
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      const duration = Number(decoded.duration)
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error('invalid-decoded-duration')
      }
      return Math.max(1, Math.ceil(duration))
    } finally {
      if (typeof audioContext.close === 'function') {
        audioContext.close().catch(() => {})
      }
    }
  }

  try {
    return await fromMetadata()
  } catch {
    return fromDecode()
  }
}
