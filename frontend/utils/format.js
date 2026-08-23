export const formatSecondsToHourMinute = (seconds, locale = 'ko') => {
  const safe = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)

  if (locale === 'en') {
    return `${hours}h ${minutes}m`
  }

  return `${hours}시간 ${minutes}분`
}

export const formatSecondsCompact = (seconds, locale = 'ko') => {
  const safe = Math.max(0, Math.round(Number(seconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainingSeconds = safe % 60

  if (locale === 'en') {
    if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
    return `${remainingSeconds}s`
  }

  if (hours > 0) return `${hours}시간 ${minutes}분 ${remainingSeconds}초`
  if (minutes > 0) return `${minutes}분 ${remainingSeconds}초`
  return `${remainingSeconds}초`
}

export const sanitizeFileName = (input) =>
  String(input || 'mallog24')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 48)

export const triggerBlobDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
