import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react'
import SocialProviderButton from './SocialProviderButton'

export default function MallogAuthPanel(props) {
  const {
    locale, authInitializing, authMode, setAuthMode, authName, setAuthName,
    authEmail, setAuthEmail, authPassword, setAuthPassword, authPasswordConfirm,
    setAuthPasswordConfirm, authLoading, socialLoading, handleAuthSubmit,
    handleSocialLogin, socialProviders, error, notice, recoveryHref, homeHref,
    OURS_PRIVACY_URL, OURS_TERMS_URL, authUser, authPageMode,
  } = props
  const en = locale === 'en'
  const [showPassword, setShowPassword] = useState(false)
  const recovering = authMode === 'recover'
  const resetting = authMode === 'reset_password'
  const signup = authMode === 'signup'
  const busy = authLoading || Boolean(socialLoading) || authInitializing
  const recovered = authPageMode === 'recover' && authUser && authMode === 'login'
  const title = resetting ? (en ? 'Set a new password' : '새 비밀번호 설정')
    : recovering ? (en ? 'Account recovery' : '계정 찾기')
      : signup ? (en ? 'Create your account' : '회원가입')
        : recovered ? (en ? 'Your account is ready' : '계정 복구 완료')
          : (en ? 'Sign in to mallog24' : 'mallog24 로그인')

  return (
    <section id="auth-card" className="mallog-auth" aria-labelledby="auth-title" aria-busy={Boolean(authInitializing)}>
      <div className="mallog-auth-heading">
        <img src="/mallog24-app-icon.png" width="52" height="52" alt="" className="mallog-auth-logo" />
        <span className="mallog-free-label"><Check size={13} aria-hidden="true" />{en ? 'Free for every account' : '모든 계정 무료 이용'}</span>
        <h1 id="auth-title">{title}</h1>
      </div>
      {authInitializing ? (
        <div role="status" className="mallog-auth-loading"><LoaderCircle className="animate-spin" size={22} aria-hidden="true" />{en ? 'Checking your session...' : '로그인 상태 확인 중...'}</div>
      ) : recovered ? (
        <Link href={homeHref} className="mallog-primary-action">{en ? 'Open workspace' : '작업 공간으로 이동'}<ArrowRight size={17} aria-hidden="true" /></Link>
      ) : (
        <>
          {!recovering && !resetting && (
            <div className="mallog-auth-modes" aria-label={en ? 'Account options' : '계정 메뉴'}>
              <button type="button" disabled={busy} aria-pressed={!signup} onClick={() => setAuthMode('login')}>{en ? 'Sign in' : '로그인'}</button>
              <button type="button" disabled={busy} aria-pressed={signup} onClick={() => setAuthMode('signup')}>{en ? 'Create account' : '회원가입'}</button>
            </div>
          )}
          {recovering && <p className="mallog-auth-note">{en ? 'Your account ID is your email address. Enter it to receive a password reset link.' : '아이디는 가입한 이메일 주소입니다. 비밀번호 재설정 링크를 이메일로 보내드립니다.'}</p>}
          <form onSubmit={handleAuthSubmit} className="mallog-auth-form">
            {signup && <label htmlFor="account-name">{en ? 'Name' : '이름'}<input id="account-name" name="name" autoComplete="name" value={authName} onChange={event => setAuthName(event.target.value)} disabled={busy} /></label>}
            {!resetting && <label htmlFor="account-email">{en ? 'Email' : '이메일'}<input id="account-email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={authEmail} onChange={event => setAuthEmail(event.target.value)} required disabled={busy} /></label>}
            {!recovering && (
              <div className="mallog-auth-field">
                <label htmlFor="account-password">{resetting ? (en ? 'New password' : '새 비밀번호') : (en ? 'Password' : '비밀번호')}</label>
                <span className="mallog-password-field">
                  <input id="account-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={resetting || signup ? 'new-password' : 'current-password'} value={authPassword} onChange={event => setAuthPassword(event.target.value)} minLength={signup || resetting ? 8 : undefined} required disabled={busy} aria-describedby={signup || resetting ? 'password-requirement' : undefined} />
                  <button type="button" aria-label={en ? (showPassword ? 'Hide password' : 'Show password') : (showPassword ? '비밀번호 숨기기' : '비밀번호 보기')} title={en ? 'Password visibility' : '비밀번호 표시'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </span>
                {(signup || resetting) && <span id="password-requirement" className="mallog-field-note">{en ? 'At least 8 characters' : '8자 이상'}</span>}
              </div>
            )}
            {resetting && <label htmlFor="account-password-confirm">{en ? 'Confirm new password' : '새 비밀번호 확인'}<input id="account-password-confirm" name="password-confirm" type="password" autoComplete="new-password" value={authPasswordConfirm} onChange={event => setAuthPasswordConfirm(event.target.value)} minLength={8} required disabled={busy} /></label>}
            <button type="submit" className="mallog-primary-action" disabled={busy}>
              {authLoading ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
              {authLoading ? (en ? 'Processing...' : '처리 중...') : resetting ? (en ? 'Save new password' : '새 비밀번호 저장') : recovering ? (en ? 'Send reset link' : '재설정 메일 보내기') : signup ? (en ? 'Create free account' : '무료 회원가입') : (en ? 'Sign in' : '로그인')}
            </button>
          </form>
          <div className="mallog-auth-links">
            <Link href={recovering || resetting ? homeHref : recoveryHref}>{recovering || resetting ? (en ? 'Back to sign in' : '로그인으로 돌아가기') : (en ? 'Find account / reset password' : '아이디·비밀번호 찾기')}</Link>
          </div>
          {!recovering && !resetting && <>
            <div className="mallog-auth-divider"><span>{en ? 'or' : '또는'}</span></div>
            <div className="mallog-social-buttons">{socialProviders.map(provider => <SocialProviderButton key={provider.key} provider={provider.key} label={provider.label} disabled={busy} loadingLabel={socialLoading === provider.key ? (en ? 'Connecting...' : '연결 중...') : ''} onClick={() => handleSocialLogin(provider.key)} />)}</div>
          </>}
        </>
      )}
      {error && <p role="alert" className="mallog-feedback mallog-feedback-error">{error}</p>}
      {notice && <p role="status" className="mallog-feedback">{notice}</p>}
      <div className="mallog-auth-legal"><Link href={OURS_TERMS_URL}>{en ? 'Terms' : '이용약관'}</Link><Link href={OURS_PRIVACY_URL}>{en ? 'Privacy' : '개인정보처리방침'}</Link></div>
    </section>
  )
}
