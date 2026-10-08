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

const unauthorizedListeners = new Set()

export const subscribeUnauthorized = (listener) => {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

export const abortError = () => new DOMException('Access is no longer enabled.', 'AbortError')

export const apiFetch = async (url, options = {}) => {
  const { headers = {}, credentials = 'include', protectedRequest = false, timeoutMs = 0, readResponse, ...rest } = options
  if (rest.signal?.aborted) throw abortError()
  const controller = timeoutMs > 0 ? new AbortController() : null
  let timedOut = false
  const abort = () => controller?.abort()
  const timer = controller ? setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs) : null
  if (controller) rest.signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(url, {
      credentials,
      headers,
      ...rest,
      signal: controller?.signal || rest.signal,
    })
    if (rest.signal?.aborted) throw abortError()
    if (timedOut) throw new DOMException('Request timed out.', 'TimeoutError')
    if (protectedRequest && response.status === 401) {
      unauthorizedListeners.forEach((listener) => listener(url))
    }
    const result = readResponse ? await readResponse(response) : response
    if (rest.signal?.aborted) throw abortError()
    if (timedOut) throw new DOMException('Request timed out.', 'TimeoutError')
    return result
  } catch (error) {
    if (rest.signal?.aborted) throw abortError()
    if (timedOut) throw new DOMException('Request timed out.', 'TimeoutError')
    throw error
  } finally {
    clearTimeout(timer)
    rest.signal?.removeEventListener('abort', abort)
  }
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const sleep = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(abortError())
    return
  }
  const onAbort = () => {
    clearTimeout(timer)
    reject(abortError())
  }
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, milliseconds)
  signal?.addEventListener('abort', onAbort, { once: true })
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

// Cold starts can outlast authentication timeouts. Retry only this public GET,
// never replay a password submission while an earlier request may still succeed.
export const waitForAuthServer = async (
  apiUrl,
  { signal, timeoutMs = 90000, attemptTimeoutMs = 15000, retryDelayMs = 1000 } = {}
) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal?.aborted) throw abortError()
    const requestBudget = deadline - Date.now()
    if (requestBudget <= 0) break
    let response
    try {
      response = await apiFetch(`${apiUrl}/health`, {
        signal, credentials: 'omit', cache: 'no-store',
        timeoutMs: Math.min(attemptTimeoutMs, requestBudget),
        readResponse: async res => {
          if (res.ok) {
            const data = await res.json()
            if (data?.status !== 'healthy') throw new Error('Server is not ready.')
          } else await res.body?.cancel?.().catch(() => {})
          return res
        },
      })
      if (signal?.aborted) throw abortError()
      if (response.ok) return
      if (!RETRYABLE_HTTP_STATUSES.has(response.status)) {
        throw new Error(`Server readiness check failed (${response.status}).`)
      }
    } catch (error) {
      if (signal?.aborted) throw abortError()
      if (error?.name !== 'TimeoutError' && !isNetworkFetchError(error)) throw error
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await sleep(Math.min(resolveRetryDelay(response, 1, retryDelayMs), remaining), signal)
  }
  if (signal?.aborted) throw abortError()
  throw new DOMException('Server startup timed out.', 'TimeoutError')
}

export const apiFetchWithNetworkRetry = async (
  url,
  optionsFactory,
  { maxAttempts = 3, baseDelayMs = 1500, onRetry } = {}
) => {
  const attempts = Math.max(1, Number(maxAttempts) || 1)
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const options = optionsFactory(attempt)
    try {
      const response = await apiFetch(url, options)
      if (!RETRYABLE_HTTP_STATUSES.has(response.status) || attempt >= attempts) {
        return response
      }

      onRetry?.({ attempt: attempt + 1, maxAttempts: attempts, status: response.status })
      await response.body?.cancel?.().catch(() => {})
      await sleep(resolveRetryDelay(response, attempt, baseDelayMs), options.signal)
    } catch (error) {
      lastError = error
      if (!isNetworkFetchError(error) || attempt >= attempts) {
        throw error
      }

      onRetry?.({ attempt: attempt + 1, maxAttempts: attempts, error })
      await sleep(resolveRetryDelay(null, attempt, baseDelayMs), options.signal)
    }
  }

  throw lastError || new Error('Network request failed.')
}
