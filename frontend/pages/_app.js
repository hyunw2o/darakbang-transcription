import { useState, useEffect } from 'react'
import Head from 'next/head'
import '../styles/globals.css'

const THEME_KEY = 'mallog24-ui-theme'
const THEME_MODE_KEY = 'mallog24-ui-theme-mode'

export default function App({ Component, pageProps }) {
  const [darkMode, setDarkMode] = useState(false)
  const [uiThemeMode, setUiThemeMode] = useState('auto')
  const [uiTheme, setUiTheme] = useState('aurora')

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    const savedTheme = localStorage.getItem(THEME_KEY)
    const savedThemeMode = localStorage.getItem(THEME_MODE_KEY)
    const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialThemeMode = savedThemeMode === 'manual' || savedThemeMode === 'auto'
      ? savedThemeMode
      : 'auto'

    const initialDarkMode = initialThemeMode === 'auto'
      ? systemDarkMode
      : saved !== null
        ? JSON.parse(saved)
        : systemDarkMode

    setDarkMode(initialDarkMode)

    setUiThemeMode(initialThemeMode)

    if (savedTheme) {
      setUiTheme(savedTheme)
    } else {
      setUiTheme(initialDarkMode ? 'noir' : 'aurora')
    }
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (uiThemeMode === 'auto') {
      setUiTheme(darkMode ? 'noir' : 'aurora')
    }
  }, [darkMode, uiThemeMode])

  useEffect(() => {
    if (uiThemeMode !== 'auto') return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncWithSystem = (isDark) => setDarkMode(isDark)
    syncWithSystem(media.matches)

    const handleChange = (event) => {
      syncWithSystem(event.matches)
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [uiThemeMode])

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', uiTheme)
    localStorage.setItem(THEME_KEY, uiTheme)
    localStorage.setItem(THEME_MODE_KEY, uiThemeMode)
  }, [uiTheme, uiThemeMode])

  return (
    <>
      <Head>
        <link rel="icon" type="image/png" href="/mallog24-app-icon.png" />
        <link rel="apple-touch-icon" href="/mallog24-app-icon.png" />
      </Head>
      <Component
        {...pageProps}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        uiThemeMode={uiThemeMode}
        setUiThemeMode={setUiThemeMode}
        uiTheme={uiTheme}
        setUiTheme={setUiTheme}
      />
    </>
  )
}
