import { LoaderCircle, RotateCw } from 'lucide-react'

export default function MallogWorkspaceLoading({ locale, error, timedOut }) {
  const en = locale === 'en'
  const needsReload = Boolean(error || timedOut)

  return (
    <div role={needsReload ? 'alert' : 'status'} className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center text-nm-text-secondary">
      {!needsReload && <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />}
      <p className="max-w-md break-keep">
        {needsReload
          ? (en ? 'The workspace could not be loaded. Check your connection and try again.' : '변환 화면을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.')
          : (en ? 'Preparing your workspace.' : '작업 공간을 준비하고 있습니다.')}
      </p>
      {needsReload && (
        <button type="button" onClick={() => window.location.reload()} className="action-btn inline-flex items-center gap-2">
          <RotateCw size={16} aria-hidden="true" />
          {en ? 'Reload' : '다시 불러오기'}
        </button>
      )}
    </div>
  )
}
