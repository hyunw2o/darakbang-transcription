import { useCallback, useEffect, useRef, useState } from 'react'

export default function useUiFeedback(toastDurationMs = 2600) {
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const toastTimerRef = useRef(null)

  const showToast = useCallback((message) => {
    if (!message) return
    setToastMessage(message)
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('')
      toastTimerRef.current = null
    }, toastDurationMs)
  }, [toastDurationMs])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  return {
    error,
    setError,
    notice,
    setNotice,
    toastMessage,
    showToast,
  }
}
