import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

function ThemeIcon({ darkMode }) {
  if (darkMode) {
    return (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 0 1 11.21 3c0-.33.02-.66.05-.99A1 1 0 0 0 9.97.97 10 10 0 1 0 22.03 14c.22-.82-.61-1.55-1.42-1.21-.5.21-1.04.32-1.61.32Z" />
    </svg>
  )
}

function MobileMenuIcon({ open }) {
  return open ? (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  ) : (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

function NavItem({ item, className = '', onClick }) {
  const sharedClassName = `${className} whitespace-nowrap`
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={sharedClassName} onClick={onClick}>
        {item.label}
      </a>
    )
  }

  if (item.href.startsWith('/')) {
    return (
      <Link href={item.href} className={sharedClassName} onClick={onClick}>
        {item.label}
      </Link>
    )
  }

  return (
    <a href={item.href} className={sharedClassName} onClick={onClick}>
      {item.label}
    </a>
  )
}

const LABELS = {
  kr: {
    menu: '메뉴',
    theme: '테마 토글',
    switchLanguage: 'English',
    close: '메뉴 닫기',
  },
  en: {
    menu: 'Menu',
    theme: 'Toggle theme',
    switchLanguage: '한국어',
    close: 'Close menu',
  },
}

export default function HeaderMenuControls({
  darkMode,
  setDarkMode,
  uiTheme,
  setUiTheme,
  uiThemeMode,
  setUiThemeMode,
  locale = 'kr',
  navItems = [],
}) {
  const menuRef = useRef(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const labels = LABELS[locale] || LABELS.kr
  const languageHref = locale === 'kr' ? '/en' : '/'

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        setMobileOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [mobileOpen])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const toggleTheme = () => {
    const nextDarkMode = !darkMode
    setUiThemeMode?.('manual')
    setUiTheme?.(nextDarkMode ? 'noir' : 'aurora')
    setDarkMode(nextDarkMode)
  }

  return (
    <div ref={menuRef} className="flex items-center gap-2">
      <nav className="hidden items-center gap-2 lg:flex">
        {navItems.map((item) => (
          <NavItem
            key={`${item.label}-${item.href}`}
            item={item}
            className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-semibold text-[#64748B] transition hover:bg-[rgba(15,23,42,0.06)] hover:text-[#0F172A] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
          />
        ))}
        <Link
          href={languageHref}
          className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-semibold text-[#64748B] transition hover:bg-[rgba(15,23,42,0.06)] hover:text-[#0F172A] whitespace-nowrap dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {labels.switchLanguage}
        </Link>
      </nav>

      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] transition hover:bg-[rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#111827] dark:text-white dark:hover:bg-white/10"
        aria-label={labels.theme}
        onClick={toggleTheme}
      >
        <ThemeIcon darkMode={darkMode} />
      </button>

      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] transition hover:bg-[rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#111827] dark:text-white dark:hover:bg-white/10 lg:hidden"
        aria-label={mobileOpen ? labels.close : labels.menu}
        onClick={() => setMobileOpen((current) => !current)}
      >
        <MobileMenuIcon open={mobileOpen} />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm"
            aria-label={labels.close}
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-x-4 top-20 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#0F172A]">
            <div className="space-y-2">
              {navItems.map((item) => (
                <NavItem
                  key={`${item.label}-${item.href}-mobile`}
                  item={item}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center rounded-xl px-4 text-sm font-semibold text-[#0F172A] transition hover:bg-[#F8F9FF] dark:text-white dark:hover:bg-white/10"
                />
              ))}
              <Link
                href={languageHref}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-[48px] items-center rounded-xl px-4 text-sm font-semibold text-[#0F172A] transition hover:bg-[#F8F9FF] whitespace-nowrap dark:text-white dark:hover:bg-white/10"
              >
                {labels.switchLanguage}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
