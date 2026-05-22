import { useCallback, useEffect, useState } from 'react'
import { apiFetch, safeReadJson } from '../utils/network'

const EMPTY_GLOSSARY_FORM = {
  term: '',
  meaning: '',
  aliases: '',
  contexts: '',
}

const GLOSSARY_MESSAGES = {
  ko: {
    loadFailed: '사용자 용어집을 불러오지 못했습니다.',
    saveFailed: '사용자 용어 저장에 실패했습니다.',
    updateFailed: '사용자 용어 수정에 실패했습니다.',
    deleteFailed: '사용자 용어 삭제에 실패했습니다.',
    termRequired: '저장할 용어를 입력해주세요.',
    saved: '사용자 용어를 저장했습니다.',
    updated: '사용자 용어를 업데이트했습니다.',
    deleted: '사용자 용어를 삭제했습니다.',
  },
  en: {
    loadFailed: 'Failed to load user glossary.',
    saveFailed: 'Failed to save user glossary term.',
    updateFailed: 'Failed to update user glossary term.',
    deleteFailed: 'Failed to delete user glossary term.',
    termRequired: 'Enter a term to save.',
    saved: 'User glossary term saved.',
    updated: 'User glossary term updated.',
    deleted: 'User glossary term deleted.',
  },
}

const readResponseData = async (response, fallbackMessage) => {
  const data = await safeReadJson(response)
  if (!response.ok) {
    throw new Error(data?.detail || fallbackMessage)
  }
  return data || {}
}

const parseListInput = (value) => (
  String(value || '')
    .split(/[\n,;]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
)

export default function useMallogGlossary({
  apiUrl,
  locale = 'ko',
  authToken,
  getAuthHeaders,
  setError,
  setNotice,
}) {
  const messages = GLOSSARY_MESSAGES[locale] || GLOSSARY_MESSAGES.ko
  const [glossaryTerms, setGlossaryTerms] = useState([])
  const [glossaryLoaded, setGlossaryLoaded] = useState(false)
  const [glossaryLoading, setGlossaryLoading] = useState(false)
  const [glossaryActionId, setGlossaryActionId] = useState('')
  const [glossaryForm, setGlossaryForm] = useState(EMPTY_GLOSSARY_FORM)

  const handleGlossaryFieldChange = useCallback((field, value) => {
    setGlossaryForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const fetchGlossary = useCallback(async ({ silent = false } = {}) => {
    if (!authToken) {
      setGlossaryTerms([])
      setGlossaryLoaded(false)
      return
    }

    setGlossaryLoading(true)
    try {
      const response = await apiFetch(`${apiUrl}/api/glossary`, {
        headers: getAuthHeaders(),
      })
      const data = await readResponseData(response, messages.loadFailed)
      setGlossaryTerms(Array.isArray(data?.terms) ? data.terms : [])
      setGlossaryLoaded(true)
    } catch (error) {
      setGlossaryLoaded(true)
      if (!silent) {
        setError(error?.message || messages.loadFailed)
      }
    } finally {
      setGlossaryLoading(false)
    }
  }, [apiUrl, authToken, getAuthHeaders, messages.loadFailed, setError])

  useEffect(() => {
    if (!authToken) {
      setGlossaryTerms([])
      setGlossaryLoaded(false)
      setGlossaryForm(EMPTY_GLOSSARY_FORM)
      return
    }
    if (!glossaryLoaded && !glossaryLoading) {
      fetchGlossary({ silent: true })
    }
  }, [authToken, fetchGlossary, glossaryLoaded, glossaryLoading])

  const handleCreateGlossaryTerm = useCallback(async () => {
    if (!authToken) return
    const term = glossaryForm.term.trim()
    if (!term) {
      setError(messages.termRequired)
      return
    }

    setGlossaryActionId('__create__')
    try {
      const response = await apiFetch(`${apiUrl}/api/glossary`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term,
          meaning: glossaryForm.meaning.trim(),
          aliases: parseListInput(glossaryForm.aliases),
          contexts: parseListInput(glossaryForm.contexts),
        }),
      })
      const data = await readResponseData(response, messages.saveFailed)
      const savedTerm = data?.term || null
      if (savedTerm) {
        setGlossaryTerms((prev) => {
          const savedId = savedTerm?.id == null ? '' : String(savedTerm.id)
          const savedKey = String(savedTerm?.term || '').trim().toLowerCase()
          const filtered = prev.filter((item) => {
            const itemId = item?.id == null ? '' : String(item.id)
            const itemKey = String(item?.term || '').trim().toLowerCase()
            return itemId !== savedId && itemKey !== savedKey
          })
          return [savedTerm, ...filtered]
        })
      }
      setGlossaryForm(EMPTY_GLOSSARY_FORM)
      setNotice(messages.saved)
    } catch (error) {
      setError(error?.message || messages.saveFailed)
    } finally {
      setGlossaryActionId('')
    }
  }, [apiUrl, authToken, getAuthHeaders, glossaryForm, messages.saveFailed, messages.saved, messages.termRequired, setError, setNotice])

  const handleToggleGlossaryTerm = useCallback(async (termId, nextActive) => {
    if (!authToken || !termId) return
    const actionId = String(termId)
    setGlossaryActionId(actionId)
    try {
      const response = await apiFetch(`${apiUrl}/api/glossary/${encodeURIComponent(actionId)}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: nextActive }),
      })
      const data = await readResponseData(response, messages.updateFailed)
      const updatedTerm = data?.term || null
      setGlossaryTerms((prev) => prev.map((item) => (
        String(item?.id) === actionId ? { ...item, ...(updatedTerm || {}), is_active: nextActive } : item
      )))
      setNotice(messages.updated)
    } catch (error) {
      setError(error?.message || messages.updateFailed)
    } finally {
      setGlossaryActionId('')
    }
  }, [apiUrl, authToken, getAuthHeaders, messages.updateFailed, messages.updated, setError, setNotice])

  const handleDeleteGlossaryTerm = useCallback(async (termId) => {
    if (!authToken || !termId) return
    const actionId = String(termId)
    setGlossaryActionId(actionId)
    try {
      const response = await apiFetch(`${apiUrl}/api/glossary/${encodeURIComponent(actionId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      await readResponseData(response, messages.deleteFailed)
      setGlossaryTerms((prev) => prev.filter((item) => String(item?.id) !== actionId))
      setNotice(messages.deleted)
    } catch (error) {
      setError(error?.message || messages.deleteFailed)
    } finally {
      setGlossaryActionId('')
    }
  }, [apiUrl, authToken, getAuthHeaders, messages.deleteFailed, messages.deleted, setError, setNotice])

  return {
    glossaryTerms,
    glossaryLoading,
    glossaryActionId,
    glossaryForm,
    handleGlossaryFieldChange,
    handleCreateGlossaryTerm,
    handleToggleGlossaryTerm,
    handleDeleteGlossaryTerm,
    fetchGlossary,
  }
}
