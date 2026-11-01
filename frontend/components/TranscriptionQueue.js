import { ArrowUp, ArrowDown, Pause, RotateCcw, X, FileText, Check, LoaderCircle, Clock, CircleAlert } from 'lucide-react'

export default function TranscriptionQueue({ queue, state, locale, busy, onRetry, onResult }) {
  if (!state?.items.length) return null
  const en = locale === 'en'
  const labels = en
    ? { waiting: 'Waiting', uploading: 'Uploading', processing: 'Converting', completed: 'Completed', failed: 'Failed', uncertain: 'Status unknown' }
    : { waiting: '대기', uploading: '업로드 중', processing: '변환 중', completed: '완료', failed: '실패', uncertain: '상태 확인 필요' }
  const icons = { waiting: Clock, uploading: LoaderCircle, processing: LoaderCircle, completed: Check, failed: CircleAlert, uncertain: CircleAlert }
  const completed = state.items.filter(item => item.status === 'completed').length
  const iconButton = (Icon, label, action, disabled = false) => (
    <button type="button" title={label} aria-label={label} onClick={action} disabled={disabled} className="mallog-queue-icon">
      <Icon size={17} aria-hidden="true" />
    </button>
  )
  return (
    <section className="mallog-queue" aria-label={en ? 'Conversion queue' : '변환 대기 목록'}>
      <div className="mallog-queue-header">
        <h2>{en ? 'Conversion queue' : '변환 대기 목록'} <span>{completed} / {state.items.length}</span></h2>
        <div className="mallog-queue-actions">
          {state.running && iconButton(Pause, en ? 'Pause after current file' : '현재 파일 완료 후 일시정지', () => queue.pause())}
          {completed > 0 && <button type="button" className="text-xs text-nm-text-secondary" onClick={() => queue.clearCompleted()}>{en ? 'Clear completed' : '완료 항목 정리'}</button>}
        </div>
      </div>
      <p className="mallog-queue-summary" role="status">
        {completed === state.items.length ? (en ? 'All files completed' : '모든 파일 변환 완료') : state.running ? (en ? 'Converting in order' : '순차 변환 중') : state.activeId
          ? (en ? 'Pausing after current file' : '현재 파일 완료 후 일시정지')
          : (en ? 'Queue stopped' : '대기열 정지')}
      </p>
      <ol className="mallog-queue-list">
        {state.items.map((item, index) => {
          const Icon = icons[item.status]
          const waiting = item.status === 'waiting'
          return <li key={item.id} className={`mallog-queue-row mallog-queue-${item.status}`}>
            <Icon size={17} aria-hidden="true" className={['uploading', 'processing'].includes(item.status) ? 'animate-spin' : ''} />
            <div className="mallog-queue-file">
              <p title={item.name}>{item.name}</p>
              <small>{labels[item.status]} · {(item.size / 1024 / 1024).toFixed(1)} MB</small>
              {item.error && <p className="mallog-queue-error">{item.error}</p>}
            </div>
            <div className="mallog-queue-actions">
              {waiting && iconButton(ArrowUp, en ? 'Move up' : '위로 이동', () => queue.move(item.id, -1), state.items[index - 1]?.status !== 'waiting')}
              {waiting && iconButton(ArrowDown, en ? 'Move down' : '아래로 이동', () => queue.move(item.id, 1), state.items[index + 1]?.status !== 'waiting')}
              {['failed', 'uncertain'].includes(item.status) && iconButton(RotateCcw, en ? 'Retry / check status' : '재시도 / 상태 확인', () => onRetry(item.id), busy)}
              {item.status === 'completed' && iconButton(FileText, en ? 'View result' : '결과 보기', () => onResult(item.id), busy || state.running)}
              {['waiting', 'failed', 'completed'].includes(item.status) && iconButton(X, en ? 'Remove from queue' : '목록에서 제거', () => queue.remove(item.id))}
            </div>
          </li>
        })}
      </ol>
      <p className="mallog-queue-summary">{en ? 'Closing or reloading this page clears pending files. Completed results remain in History.' : '화면을 닫거나 새로고침하면 대기 파일은 사라집니다. 완료 결과는 변환 기록에 남습니다.'}</p>
    </section>
  )
}
