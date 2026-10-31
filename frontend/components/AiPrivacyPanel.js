import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Trash2 } from 'lucide-react'
import { apiFetch, safeReadJson } from '../utils/network'

export const AI_CONSENT_VERSION = '2026-10-31'

export default function AiPrivacyPanel({ apiUrl, getAuthHeaders, onChange, onDeleted, locale = 'ko' }) {
  const en = locale === 'en'
  const [state, setState] = useState(null)
  const [checked, setChecked] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  const requestSequence = useRef(0)
  const callbacks = useRef({ onChange, onDeleted })
  callbacks.current = { onChange, onDeleted }

  const request = async (path, method = 'GET', body) => {
    const response = await apiFetch(`${apiUrl}${path}`, {
      method, headers: { ...getAuthHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, credentials: 'include', timeoutMs: method === 'DELETE' ? 60000 : 30000,
    })
    const data = await safeReadJson(response)
    if (!response.ok) throw new Error(data?.detail || (en ? 'Request failed. Please retry.' : '요청을 완료하지 못했습니다. 다시 시도해 주세요.'))
    return data
  }
  const refresh = async () => {
    const sequence = ++requestSequence.current
    setError('')
    try {
      const data = await request('/api/auth/privacy')
      if (!active.current || sequence !== requestSequence.current) return
      setState(data)
      callbacks.current.onChange(data.accepted === true && data.version === AI_CONSENT_VERSION)
    } catch (e) { if (active.current && sequence === requestSequence.current) { setError(e.message); callbacks.current.onChange(false) } }
  }
  useEffect(() => {
    active.current = true
    refresh()
    return () => { active.current = false; requestSequence.current += 1 }
  }, [])
  const save = async (accepted) => {
    if (busy || (accepted && !checked)) return
    requestSequence.current += 1
    setBusy(true); setError('')
    try {
      const data = await request('/api/auth/privacy', 'PUT', { accepted, version: AI_CONSENT_VERSION })
      if (!active.current) return
      setState(data); setChecked(false); callbacks.current.onChange(data.accepted === true && data.version === AI_CONSENT_VERSION)
    } catch (e) { if (active.current) setError(e.message) }
    finally { if (active.current) setBusy(false) }
  }
  const deleteAccount = async () => {
    if (!confirmDelete || busy) return
    requestSequence.current += 1
    setBusy(true); setError('')
    try {
      const data = await request('/api/auth/account', 'DELETE')
      if (!data?.success) throw new Error(en ? 'Deletion was not confirmed.' : '삭제 완료가 확인되지 않았습니다.')
      if (data.apple_revocation === 'manual_disconnect_required') window.alert(en
        ? 'Account deleted. Apple access was not revoked automatically. Manage Sign in with Apple in your Apple Account settings to disconnect mallog24.'
        : '계정은 삭제되었습니다. Apple 로그인 연결은 자동 해제되지 않았습니다. Apple 계정 설정의 Apple로 로그인 > mallog24에서 사용 중단을 선택해 주세요.')
      if (active.current) callbacks.current.onDeleted()
    } catch (e) { if (active.current) { setError(e.message); callbacks.current.onChange(false) } }
    finally { if (active.current) setBusy(false) }
  }
  return (
    <section id="privacy-settings" className="mallog-privacy-panel" aria-label={en ? 'Privacy settings' : '개인정보 설정'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck size={18} aria-hidden="true" />{en ? 'AI data transfer consent' : 'AI 전송 동의'}</h2>
        <a href={en ? '/privacy-en' : '/privacy'} className="text-sm underline">{en ? 'Privacy policy' : '개인정보처리방침'}</a>
      </div>
      {!state?.accepted ? <>
        <p>{en ? 'OpenAI receives audio, transcripts and relevant glossary terms for recognition and optional correction. Google (Gemini) receives audio, transcripts and relevant glossary terms for recognition, speaker separation, correction and summaries. Processing may take place outside Korea.' : 'OpenAI에 음성·전사문·관련 용어를 보내 인식 및 선택적 교정을 수행합니다. Google(Gemini)에도 음성·전사문·관련 용어를 보내 인식, 화자 구분, 교정 및 요약을 수행합니다. 국외 서버에서 처리될 수 있습니다.'}</p>
        <p>{en ? 'mallog24 removes temporary audio after processing; saved text remains until deletion. Provider security logs and retention follow their policies and project settings. This is separate from optional training-data contribution. You may decline or withdraw consent; sign-in, history and account deletion remain available.' : 'mallog24의 임시 음성은 처리 후 삭제하며 저장된 텍스트는 삭제 전까지 보관합니다. 외부 서비스의 보안 로그·보관 기간은 해당 정책과 프로젝트 설정에 따릅니다. 선택적 학습 데이터 제공과는 별도 동의입니다. 거부·철회해도 로그인, 기록 조회, 계정 삭제는 가능합니다.'}</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1" />
          <span>{en ? 'I agree to the AI data transfers described above.' : '위 수신자·목적·전송 항목을 확인했으며 AI 처리 전송에 동의합니다.'}</span>
        </label>
        <button type="button" onClick={() => save(true)} disabled={!checked || busy || !state || state.deletion_pending} className="mallog-privacy-action">{en ? 'Save consent' : '동의 저장'}</button>
      </> : <p>{en ? 'AI processing is enabled for this account.' : '이 계정의 AI 처리 전송에 동의한 상태입니다.'} <button type="button" className="underline" disabled={busy} onClick={() => save(false)}>{en ? 'Withdraw consent' : '동의 철회'}</button></p>}
      <details className="mt-3">
        <summary>{en ? 'Account deletion' : '계정 삭제'}</summary>
        <p>{en ? 'Deletes your account, transcripts, saved records, glossary and contributed training samples. This cannot be undone. Already sent AI requests cannot be recalled. If a job is stopping or cleanup fails, retry deletion; the account is not reported as deleted until cleanup succeeds.' : '계정, 변환 기록, 저장 기록본, 용어집, 제공한 학습 후보 데이터를 삭제합니다. 되돌릴 수 없습니다. 이미 전송된 AI 요청은 회수할 수 없습니다. 작업 중지 또는 삭제 실패 안내가 나오면 다시 삭제해 주세요. 정리가 끝나기 전에는 삭제 완료로 처리하지 않습니다.'}</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={confirmDelete} onChange={e => setConfirmDelete(e.target.checked)} className="mt-1" /><span>{en ? 'I understand and want to permanently delete my account.' : '위 내용을 확인했으며 계정 영구 삭제를 요청합니다.'}</span></label>
        <button type="button" onClick={deleteAccount} disabled={!confirmDelete || busy} className="mallog-privacy-action"><Trash2 size={16} aria-hidden="true" />{en ? 'Delete account' : '계정 삭제'}</button>
        <a className="ml-3 underline" href="/delete-account">{en ? 'Deletion help' : '삭제 요청 안내'}</a>
      </details>
      {busy && <p role="status">{en ? 'Saving...' : '처리 중...'}</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} className="underline" onClick={refresh}>{en ? 'Check again' : '다시 확인'}</button></div>}
    </section>
  )
}
