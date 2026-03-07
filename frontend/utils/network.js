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
