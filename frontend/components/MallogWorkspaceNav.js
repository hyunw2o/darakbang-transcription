import { AudioLines, BookOpen, FileText, History, LogOut, Check } from 'lucide-react'
import { formatSecondsToHourMinute } from '../utils/format'

export default function MallogWorkspaceNav({ locale, activeTab, onChange, authUser, usage, handleLogout, busy }) {
  const en = locale === 'en'
  const tabs = [
    ['convert', en ? 'New transcription' : '새 변환', en ? 'New' : '새 변환', AudioLines],
    ['history', en ? 'Transcription history' : '변환 기록', en ? 'History' : '변환 기록', History],
    ['records', en ? 'Saved documents' : '저장 기록', en ? 'Saved' : '저장 기록', FileText],
    ['glossary', en ? 'My glossary' : '사용자 용어집', en ? 'Glossary' : '용어집', BookOpen],
  ]
  return (
    <aside className="mallog-workspace-nav">
      <div className="mallog-workspace-label">{en ? 'WORKSPACE' : '내 작업 공간'}</div>
      <nav aria-label={en ? 'Workspace' : '작업 메뉴'}>
        {tabs.map(([key, label, shortLabel, Icon]) => (
          <button key={key} type="button" aria-label={label} aria-current={activeTab === key ? 'page' : undefined} onClick={() => onChange(key)}>
            <Icon size={19} aria-hidden="true" />
            <span className="mallog-nav-full">{label}</span>
            <span className="mallog-nav-short" aria-hidden="true">{shortLabel}</span>
            {key === 'convert' && busy && <span className="mallog-status-dot" aria-label={en ? 'In progress' : '진행 중'} />}
          </button>
        ))}
      </nav>
      <div className="mallog-account">
        <span className="mallog-free-label"><Check size={13} aria-hidden="true" />{en ? 'Free access' : '무료 이용 중'}</span>
        <p className="mallog-account-name">{authUser?.user_metadata?.full_name || (en ? 'My account' : '내 계정')}</p>
        <p className="mallog-account-email">{authUser?.email}</p>
        {usage && <p className="mallog-account-usage">{en ? 'This month' : '이번 달 변환'}<strong>{formatSecondsToHourMinute(usage.used_audio_seconds, locale)}</strong></p>}
        <button type="button" className="mallog-signout" onClick={handleLogout}><LogOut size={16} aria-hidden="true" />{en ? 'Sign out' : '로그아웃'}</button>
      </div>
    </aside>
  )
}
