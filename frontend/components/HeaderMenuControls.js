import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const UI_THEME_OPTIONS = [
  { key: 'auto', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]

const LABELS = {
  kr: {
    language: '언어 선택',
    theme: '테마 선택',
  },
  en: {
    language: 'Language',
    theme: 'Theme',
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
}) {
  const menuRef = useRef(null)
  const [openMenu, setOpenMenu] = useState('')
  const labels = LABELS[locale] || LABELS.kr

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleThemeSelect = (themeKey) => {
    if (themeKey === 'auto') {
      setUiThemeMode('auto')
    } else if (themeKey === 'light') {
      setUiThemeMode('manual')
      setUiTheme('aurora')
      setDarkMode(false)
    } else {
      setUiThemeMode('manual')
      setUiTheme('noir')
      setDarkMode(true)
    }
    setOpenMenu('')
  }

  return (
    <div ref={menuRef} className="relative flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          className="nm-icon-btn"
          aria-label={labels.language}
          onClick={() => setOpenMenu(openMenu === 'lang' ? '' : 'lang')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" />
          </svg>
        </button>
        {openMenu === 'lang' && (
          <div className="nm-menu left-0 w-24">
            <Link
              href="/"
              onClick={() => setOpenMenu('')}
              className={`nm-menu-item ${locale === 'kr' ? 'active' : ''}`}
            >
              KR
            </Link>
            <Link
              href="/en"
              onClick={() => setOpenMenu('')}
              className={`nm-menu-item ${locale === 'en' ? 'active' : ''}`}
            >
              EN
            </Link>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          className="nm-icon-btn"
          aria-label={labels.theme}
          onClick={() => setOpenMenu(openMenu === 'theme' ? '' : 'theme')}
        >
          {darkMode ? (
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-nm-text-secondary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8 8 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
        {openMenu === 'theme' && (
          <div className="nm-menu right-0 w-40">
            {UI_THEME_OPTIONS.map((theme) => (
              <button
                key={theme.key}
                type="button"
                onClick={() => handleThemeSelect(theme.key)}
                className={`nm-menu-item ${
                  theme.key === 'auto'
                    ? uiThemeMode === 'auto'
                      ? 'active'
                      : ''
                    : theme.key === 'light'
                      ? uiThemeMode === 'manual' && uiTheme === 'aurora'
                        ? 'active'
                        : ''
                      : uiThemeMode === 'manual' && uiTheme === 'noir'
                        ? 'active'
                        : ''
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
