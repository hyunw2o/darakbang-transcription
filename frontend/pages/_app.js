import { useState, useEffect } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { getImageProps } from 'next/image'
import '../styles/globals.css'
import '../styles/workspace.css'

const THEME_KEY = 'mallog24-ui-theme'
const THEME_MODE_KEY = 'mallog24-ui-theme-mode'
const faviconSrc = getImageProps({ src: '/mallog24-app-icon.png', width: 32, height: 32, alt: '' }).props.src

function readStoredBoolean(value, fallback) {
  if (value === null) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export default function App({ Component, pageProps }) {
  const [darkMode, setDarkMode] = useState(false)
  const [uiThemeMode, setUiThemeMode] = useState('auto')
  const [uiTheme, setUiTheme] = useState('aurora')
  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    const savedTheme = localStorage.getItem(THEME_KEY)
    const savedThemeMode = localStorage.getItem(THEME_MODE_KEY)
    const initialThemeMode = 'manual'

    const initialDarkMode = savedThemeMode === 'manual' && saved !== null
      ? readStoredBoolean(saved, false)
      : false

    setDarkMode(initialDarkMode)

    setUiThemeMode(initialThemeMode)

    if (savedTheme) {
      setUiTheme(savedTheme)
    } else {
      setUiTheme(initialDarkMode ? 'noir' : 'aurora')
    }
    setThemeReady(true)
  }, [])

  useEffect(() => {
    if (!themeReady) return
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode, themeReady])

  useEffect(() => {
    if (!themeReady) return
    if (uiThemeMode === 'auto') {
      setUiTheme(darkMode ? 'noir' : 'aurora')
    }
  }, [darkMode, uiThemeMode, themeReady])

  useEffect(() => {
    if (!themeReady || uiThemeMode !== 'auto') return undefined

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
  }, [uiThemeMode, themeReady])

  useEffect(() => {
    if (!themeReady) return
    document.documentElement.setAttribute('data-ui-theme', uiTheme)
    localStorage.setItem(THEME_KEY, uiTheme)
    localStorage.setItem(THEME_MODE_KEY, uiThemeMode)
  }, [uiTheme, uiThemeMode, themeReady])

  return (
    <>
      <Head>
        <link rel="icon" href={faviconSrc} sizes="32x32" />
        <link rel="apple-touch-icon" href="/mallog24-app-icon.png?v=20260220" />
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
      <Script
        id="adsense"
        strategy="lazyOnload"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8592086805043488"
        crossOrigin="anonymous"
      />
    </>
  )
}
