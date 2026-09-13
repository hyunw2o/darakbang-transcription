import { useEffect, useMemo, useRef, useState } from 'react'
import { abortError, apiFetch, apiFetchWithNetworkRetry, safeReadJson, subscribeUnauthorized } from '../utils/network'

// Every callback retains its own access generation, including cookie sessions whose token is constant.
export default function useProtectedAccess({ apiUrl, authToken, accessEnabled = false, authSessionRevision = 0 }) {
  const current = useRef(null)
  const [effectRevision, setEffectRevision] = useState(0)
  const access = useMemo(() => {
    const responseSignals = new WeakMap()
    const scope = {
      controller: new AbortController(),
      isCurrent: () => Boolean(accessEnabled && authToken && current.current === scope && !scope.controller.signal.aborted),
      assertCurrent: () => {
        if (!scope.isCurrent()) throw abortError()
      },
      readJson: async (response) => {
        scope.assertCurrent()
        const data = await safeReadJson(response)
        scope.assertCurrent()
        if (responseSignals.get(response)?.aborted) throw abortError()
        return data
      },
      request: async (url, options = {}, retry = null) => {
        scope.assertCurrent()
        const controller = new AbortController()
        const abort = () => controller.abort()
        const originalOptions = typeof options === 'function' ? options : () => options
        const externalSignal = typeof options === 'function' ? null : options.signal
        const sessionSignal = scope.controller.signal
        sessionSignal.addEventListener('abort', abort, { once: true })
        externalSignal?.addEventListener('abort', abort, { once: true })
        if (externalSignal?.aborted) controller.abort()
        const makeOptions = (attempt) => {
          scope.assertCurrent()
          return { ...originalOptions(attempt), credentials: 'include', protectedRequest: true, signal: controller.signal }
        }
        try {
          const response = retry
            ? await apiFetchWithNetworkRetry(url, makeOptions, retry)
            : await apiFetch(url, makeOptions(1))
          scope.assertCurrent()
          if (sessionSignal.aborted) throw abortError()
          responseSignals.set(response, sessionSignal)
          return response
        } finally {
          sessionSignal.removeEventListener('abort', abort)
          externalSignal?.removeEventListener('abort', abort)
        }
      },
    }
    return scope
  }, [apiUrl, authToken, accessEnabled, authSessionRevision, effectRevision])
  current.current = access

  useEffect(() => {
    // Never revive an aborted generation when Strict Mode replays effects.
    if (access.controller.signal.aborted) {
      setEffectRevision((revision) => revision + 1)
      return undefined
    }
    const unsubscribe = subscribeUnauthorized((url) => {
      if (String(url).startsWith(`${apiUrl}/`)) access.controller.abort()
    })
    return () => {
      unsubscribe()
      access.controller.abort()
    }
  }, [access, apiUrl])

  return access
}
