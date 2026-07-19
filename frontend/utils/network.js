export const safeReadJson = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  const fallbackResponse = response.clone()

  if (contentType.includes('application/json')) {
    try {
      return await response.json()
    } catch {
      // fall through to text parsing
    }
  }

  const text = await fallbackResponse.text().catch(() => '')
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { detail: text }
  }
}

export const apiFetch = (url, options = {}) => {
  const { headers = {}, credentials = 'include', ...rest } = options
  return fetch(url, {
    credentials,
    headers,
    ...rest,
  })
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const sleep = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

const isNetworkFetchError = (error) => {
  const message = String(error?.message || error || '').toLowerCase()
  return error instanceof TypeError || [
    'failed to fetch',
    'load failed',
    'networkerror',
    'network request failed',
    'internet connection appears to be offline',
  ].some((fragment) => message.includes(fragment))
}

const resolveRetryDelay = (response, attempt, baseDelayMs) => {
  const retryAfter = Number(response?.headers?.get?.('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(30000, retryAfter * 1000)
  }
  return Math.min(10000, baseDelayMs * (2 ** Math.max(0, attempt - 1)))
}

export const apiFetchWithNetworkRetry = async (
  url,
  optionsFactory,
  { maxAttempts = 3, baseDelayMs = 1500, onRetry } = {}
) => {
  const attempts = Math.max(1, Number(maxAttempts) || 1)
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await apiFetch(url, optionsFactory(attempt))
      if (!RETRYABLE_HTTP_STATUSES.has(response.status) || attempt >= attempts) {
        return response
      }

      onRetry?.({ attempt: attempt + 1, maxAttempts: attempts, status: response.status })
      await response.body?.cancel?.().catch(() => {})
      await sleep(resolveRetryDelay(response, attempt, baseDelayMs))
    } catch (error) {
      lastError = error
      if (!isNetworkFetchError(error) || attempt >= attempts) {
        throw error
      }

      onRetry?.({ attempt: attempt + 1, maxAttempts: attempts, error })
      await sleep(resolveRetryDelay(null, attempt, baseDelayMs))
    }
  }

  throw lastError || new Error('Network request failed.')
}
