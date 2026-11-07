import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Download, FolderOpen, Headphones, Plus, RefreshCw, Save, SkipForward } from 'lucide-react'
import useMallogAuth from '../../hooks/useMallogAuth'
import useProtectedAccess from '../../hooks/useProtectedAccess'
import { pairTrainingFiles } from '../../utils/trainingReview.cjs'
import styles from '../../styles/trainingReview.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.mallog24.com'
const STATUS = { needs_review: '검수 대기', candidate: '검수 대기', approved: '검수 완료', rejected: '제외' }
const TAGS = { term: '용어', pronunciation: '발음', missing: '누락', duplicate: '중복', boundary: '구간 경계', language: '언어', other: '기타' }
const stamp = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
const empty = { start_seconds: 0, end_seconds: 20, final_result: '', notes: '', error_tags: [], language: 'ko', listened: false, verbatim_verified: false }

export default function TrainingReview() {
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [allowed, setAllowed] = useState(null)
  const [assets, setAssets] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [detail, setDetail] = useState(null)
  const [segmentId, setSegmentId] = useState(null)
  const [form, setForm] = useState(empty)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [pairs, setPairs] = useState([])
  const [rights, setRights] = useState(false)
  const [importing, setImporting] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioError, setAudioError] = useState(false)
  const [position, setPosition] = useState(0)
  const player = useRef(null)
  const folder = useRef(null)
  const files = useRef(null)
  const generation = useRef(0)
  const audioExpiry = useRef(0)
  const auth = useMallogAuth({ apiUrl: API, setError, setNotice })
  const access = useProtectedAccess({ apiUrl: API, authToken: auth.authToken,
    accessEnabled: Boolean(auth.authUser) && auth.authMode !== 'reset_password', authSessionRevision: auth.authSessionRevision })

  const request = useCallback(async (path, options = {}) => {
    const response = await access.request(`${API}/api/admin/training${path}`, {
      ...options, cache: 'no-store', timeoutMs: 120000,
      headers: { ...auth.getAuthHeaders(), ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    })
    const data = await access.readJson(response)
    if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : '요청을 처리하지 못했습니다.')
    return data
  }, [access, auth.getAuthHeaders])

  const list = useCallback(async (page = 0) => {
    const data = await request(`/assets?offset=${page}&limit=50`)
    setAssets(data.assets); setHasMore(data.has_more); setOffset(page)
  }, [request])

  useEffect(() => {
    setAllowed(null); setAssets([]); setDetail(null); setAudioUrl(''); setPairs([])
    generation.current += 1
    if (!auth.authUser || auth.authInitializing) return
    let active = true
    request('/access').then(() => {
      if (active) { setAllowed(true); return list() }
    }).catch(e => { if (active && e.name !== 'AbortError') { setAllowed(false); setError(e.message) } })
    return () => { active = false }
  }, [request, list, auth.authUser, auth.authInitializing])

  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (!audioUrl && player.current) {
      player.current.pause()
      player.current.removeAttribute('src')
      player.current.load()
      setPosition(0)
    }
  }, [audioUrl])

  const perform = async callback => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await callback() } catch (e) { if (e.name !== 'AbortError') setError(e.message) }
    finally { setBusy(false) }
  }
  const discard = () => !dirty || window.confirm('저장하지 않은 수정 사항을 버릴까요?')
  const edit = (key, value) => {
    if (key === 'start_seconds' || key === 'end_seconds') player.current?.pause()
    setForm(current => ({ ...current, [key]: value, ...(key === 'start_seconds' || key === 'end_seconds' ? { listened: false, verbatim_verified: false } : {}) }))
    setDirty(true)
  }
  const selectSegment = row => {
    player.current?.pause()
    setSegmentId(row?.id || null)
    setForm(row ? { ...row, notes: row.metadata?.notes || '', error_tags: row.metadata?.error_tags || [], listened: false, verbatim_verified: false }
      : { ...empty, end_seconds: Math.min(20, detail?.duration_seconds || 20) })
    setDirty(false)
  }
  const openAsset = async id => {
    const token = ++generation.current
    player.current?.pause(); setAudioUrl(''); setAudioError(false); audioExpiry.current = 0
    const data = await request(`/assets/${id}`)
    if (token !== generation.current) return
    setDetail(data); setSegmentId(null); setForm({ ...empty, end_seconds: Math.min(20, data.duration_seconds) }); setDirty(false)
  }
  const loadAudio = async () => {
    const id = detail.asset.id, token = generation.current
    const data = await request(`/assets/${id}/audio`)
    if (token !== generation.current) return
    setAudioUrl(data.url); setAudioError(false); audioExpiry.current = Date.now() + data.expires_in * 1000 - 30000
    return data.url
  }
  const playRange = async () => {
    const start = Number(form.start_seconds), end = Number(form.end_seconds)
    if (!(start >= 0 && end > start && end <= detail.duration_seconds && end - start <= 60)) throw new Error('원음 안에서 60초 이하의 구간을 지정해 주세요.')
    const element = player.current
    if (!audioUrl || audioError || Date.now() >= audioExpiry.current) {
      const url = await loadAudio()
      if (!url) return
      // Set src only here: a second React src assignment interrupts first playback.
      element.src = url
    }
    element.currentTime = start
    await element.play()
  }
  const save = async status => {
    let id = segmentId, version = form.review_version
    if (!id) {
      const row = await request(`/assets/${detail.asset.id}/segments`, { method: 'POST', body: JSON.stringify(form) })
      id = row.id; version = row.review_version; setSegmentId(id); setForm(current => ({ ...current, review_version: version }))
    }
    const row = await request(`/segments/${id}`, { method: 'PUT', body: JSON.stringify({ ...form, review_version: version, quality_status: status }) })
    setDetail(current => ({ ...current, segments: [...current.segments.filter(item => item.id !== id), row].sort((a, b) => a.start_seconds - b.start_seconds) }))
    setForm(current => ({ ...current, ...row, notes: row.metadata.notes, error_tags: row.metadata.error_tags })); setDirty(false)
    setNotice(status === 'approved' ? '검수 완료로 저장했습니다.' : '저장했습니다.')
  }
  const changeAsset = async patch => {
    await request(`/assets/${detail.asset.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setDetail(current => ({ ...current, asset: { ...current.asset, ...patch } }))
    if (patch.consent_status === 'revoked') { player.current?.pause(); setAudioUrl('') }
    await list(offset)
  }
  const importFiles = async () => {
    let latest
    for (const pair of pairs.filter(item => item.valid)) {
      setImporting(pair.audio.name)
      const body = new FormData()
      body.append('audio', pair.audio); body.append('reference', pair.reference); body.append('training_rights', 'true')
      const result = await request('/import', { method: 'POST', body })
      latest = result.id
      setPairs(current => current.filter(item => item.key !== pair.key))
    }
    await list(0)
    if (latest) await openAsset(latest)
    setNotice('가져오기가 완료되었습니다.')
  }
  const download = async () => {
    const response = await access.request(`${API}/api/admin/training/export`, { headers: auth.getAuthHeaders(), cache: 'no-store' })
    if (!response.ok) { const data = await access.readJson(response); throw new Error(data?.detail || '내보내기에 실패했습니다.') }
    const blob = await response.blob(); access.assertCurrent()
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = 'reviewed-dataset.jsonl'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const selected = detail?.segments.find(row => row.id === segmentId)
  const nextPending = detail?.segments.find(row => row.id !== segmentId && row.quality_status === 'needs_review')
  const visible = detail?.segments.filter(row => filter === 'all' || row.quality_status === filter) || []

  return <div className={styles.root}>
    <Head><title>학습 데이터 검수 · mallog24</title><meta name="robots" content="noindex,nofollow" /></Head>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><img src="/mallog24-app-icon.png" alt="" width="32" height="32" />mallog24</Link>
      <span>학습 데이터 검수</span><Link href="/" className={styles.back}><ArrowLeft size={16} />작업 공간</Link>
    </header>
    <main className={styles.main}>
      <div className={styles.heading}><div><span className={styles.eyebrow}>관리자</span><h1>원음 검수</h1></div>
        {allowed && <button disabled={busy} onClick={() => perform(download)}><Download size={17} />검수 데이터 내보내기</button>}</div>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      {notice && <div role="status" className={styles.notice}>{notice}</div>}
      {auth.authInitializing || (auth.authUser && allowed === null) ? <p role="status">접근 권한 확인 중…</p>
        : !auth.authUser ? <p><Link href="/">관리자 계정으로 로그인</Link></p>
        : allowed === false ? <p>관리자 전용 페이지입니다. <button onClick={() => window.location.reload()}>다시 확인</button></p>
        : <>
          <section className={styles.importBar}>
            <div className={styles.actions}>
              <input hidden type="file" ref={folder} webkitdirectory="" multiple onChange={e => { setPairs(pairTrainingFiles([...e.target.files])); setRights(false); e.target.value = '' }} />
              <input hidden type="file" ref={files} multiple accept="audio/*,.txt,.mp4" onChange={e => { setPairs(pairTrainingFiles([...e.target.files])); setRights(false); e.target.value = '' }} />
              <button disabled={busy} onClick={() => folder.current.click()}><FolderOpen size={17} />학습 폴더 선택</button>
              <button disabled={busy} onClick={() => files.current.click()}>파일 선택</button>
              <button disabled={busy} title="목록 새로고침" aria-label="목록 새로고침" onClick={() => perform(() => list(offset))}><RefreshCw size={17} /></button>
            </div>
            {pairs.length > 0 && <div className={styles.importDetails}>
              <ul>{pairs.map(pair => <li key={pair.key}>{pair.key}<span>{pair.valid ? '음원 + TXT' : pair.problem}</span></li>)}</ul>
              <label className={styles.check}><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} disabled={busy} />선택한 음원·텍스트를 비공개 서버에 보관하고 학습에 사용할 권한과 동의를 확보했습니다.</label>
              <button className={styles.primary} disabled={!rights || busy || !pairs.some(pair => pair.valid)} onClick={() => { if (discard()) perform(async () => { try { await importFiles() } finally { setImporting('') } }) }}>자료 가져오기 ({pairs.filter(pair => pair.valid).length})</button>
              {importing && <p role="status" className={styles.filename}>업로드 중: {importing}</p>}
            </div>}
          </section>
          <div className={styles.layout}>
            <aside className={styles.sources}>
              <h2>원음 목록</h2>
              {!assets.length && <p className={styles.muted}>등록된 원음이 없습니다.</p>}
              {assets.map(asset => <button key={asset.id} disabled={busy} className={detail?.asset.id === asset.id ? styles.selected : ''} onClick={() => { if (discard()) perform(() => openAsset(asset.id)) }}>
                <span className={styles.filename}>{asset.original_filename}</span><small>{stamp(asset.audio_seconds)} · {asset.consent_status === 'granted' ? '이용 동의 확인' : '이용 동의 철회'}</small>
              </button>)}
              <div className={styles.actions}><button disabled={!offset || busy} onClick={() => perform(() => list(offset - 50))}>이전</button><button disabled={!hasMore || busy} onClick={() => perform(() => list(offset + 50))}>다음</button></div>
            </aside>
            <div className={styles.workspace}>
              {!detail ? <div className={styles.empty}><Headphones size={32} /><p>선택된 원음이 없습니다.</p></div> : <>
                <div className={styles.sourceHeading}><h2>{detail.asset.original_filename}</h2><span>{stamp(detail.duration_seconds)}</span></div>
                <div className={styles.settings}>
                  <label>데이터 분류<select disabled={busy} value={detail.asset.dataset_split} onChange={e => perform(() => changeAsset({ dataset_split: e.target.value }))}>
                    <option value="unassigned">미지정 · 내보내기 제외</option><option value="train">학습</option><option value="validation">검증</option><option value="test">최종 평가</option>
                  </select></label>
                  <label>이용 동의<select disabled={busy} value={detail.asset.consent_status} onChange={e => { const value = e.target.value; if (value !== 'granted' || window.confirm('이 원음의 보관·학습 활용 동의를 다시 확인하셨나요?')) perform(() => changeAsset({ consent_status: value })) }}>
                    <option value="granted">확인됨</option><option value="revoked">철회</option>
                  </select></label>
                </div>
                <details className={styles.reference}><summary>변환 결과 참고문 · 미검수 · 시간 정렬 없음</summary><pre>{detail.reference_text}</pre>
                  {detail.hints.length > 0 && <div><h3>참고문 반복 후보 · 시간 미확정</h3>{detail.hints.map((hint, i) => <blockquote key={i}>{hint.text}</blockquote>)}</div>}
                </details>
                <div className={styles.editorLayout}>
                  <section className={styles.segments}><div className={styles.sectionHeading}><h3>검수 구간 ({detail.segments.length})</h3><button title="구간 추가" aria-label="구간 추가" disabled={busy} onClick={() => { if (discard()) selectSegment(null) }}><Plus size={17} /></button></div>
                    <select aria-label="검수 상태 필터" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체</option><option value="needs_review">검수 대기</option><option value="approved">검수 완료</option><option value="rejected">제외</option></select>
                    {visible.map(row => <button className={segmentId === row.id ? styles.selected : ''} disabled={busy} key={row.id} onClick={() => { if (discard()) selectSegment(row) }}><strong>{stamp(row.start_seconds)} – {stamp(row.end_seconds)}</strong><span>{STATUS[row.quality_status]}</span></button>)}
                    {!visible.length && <p className={styles.muted}>검수 구간이 없습니다.</p>}
                  </section>
                  <section className={styles.editor}><div className={styles.sectionHeading}><h3>{segmentId ? `구간 #${segmentId}` : '새 구간'}</h3><span>{dirty ? '저장 전' : STATUS[selected?.quality_status] || '검수 대기'}</span></div>
                    <fieldset disabled={busy}>
                      <div className={styles.range}><label>시작 (초)<input type="number" min="0" step="0.1" value={form.start_seconds} onChange={e => edit('start_seconds', e.target.value)} /></label><label>종료 (초)<input type="number" min="0" step="0.1" max={detail.duration_seconds} value={form.end_seconds} onChange={e => edit('end_seconds', e.target.value)} /></label>
                        <button type="button" onClick={() => perform(playRange)} disabled={detail.asset.consent_status !== 'granted'}><Headphones size={17} />구간 듣기</button></div>
                      <audio ref={player} controls preload="metadata" onError={() => { setAudioError(true); setError('음원 재생이 중단되었습니다. 구간 듣기를 다시 눌러 주세요.') }} onTimeUpdate={e => { setPosition(e.currentTarget.currentTime); if (e.currentTarget.currentTime >= Number(form.end_seconds)) e.currentTarget.pause() }} />
                      <div className={styles.transport}><span>{stamp(position)}</span><label>재생 속도<select aria-label="재생 속도" defaultValue="1" onChange={e => { if (player.current) player.current.playbackRate = Number(e.target.value) }}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label></div>
                      <label>인식 언어<select value={form.language} onChange={e => edit('language', e.target.value)}><option value="ko">한국어</option><option value="en">영어</option><option value="ja">일본어</option></select></label>
                      <label className={styles.answer}>원음 그대로의 정답<textarea value={form.final_result} maxLength={10000} rows={8} onChange={e => edit('final_result', e.target.value)} /></label>
                      <div className={styles.tags}>{Object.entries(TAGS).map(([key, label]) => <label key={key}><input type="checkbox" checked={form.error_tags.includes(key)} onChange={e => edit('error_tags', e.target.checked ? [...form.error_tags, key] : form.error_tags.filter(tag => tag !== key))} />{label}</label>)}</div>
                      <label>검수 메모<textarea rows={2} maxLength={2000} value={form.notes} onChange={e => edit('notes', e.target.value)} /></label>
                      <label className={styles.check}><input type="checkbox" checked={form.listened} onChange={e => edit('listened', e.target.checked)} />지정한 구간 전체를 직접 들었습니다.</label>
                      <label className={styles.check}><input type="checkbox" checked={form.verbatim_verified} onChange={e => edit('verbatim_verified', e.target.checked)} />실제 반복·구어체를 보존했으며 요약·추정·누락 없이 원음과 일치합니다.</label>
                      <div className={styles.actions}><button onClick={() => perform(() => save('needs_review'))}><Save size={17} />임시 저장</button><button onClick={() => perform(() => save('rejected'))}>학습 제외</button><button className={styles.primary} disabled={!form.listened || !form.verbatim_verified || !form.final_result.trim() || detail.asset.consent_status !== 'granted'} onClick={() => perform(() => save('approved'))}><Check size={17} />검수 완료</button></div>
                    </fieldset>
                    <button disabled={busy || !nextPending} onClick={() => { if (nextPending && discard()) selectSegment(nextPending) }}><SkipForward size={16} />다음 대기 구간</button>
                  </section>
                </div>
              </>}
            </div>
          </div>
        </>}
    </main>
  </div>
}
