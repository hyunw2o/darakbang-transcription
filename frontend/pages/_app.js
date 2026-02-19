import { useState, useEffect } from 'react'
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
    const initialDarkMode =
      saved !== null ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches

    setDarkMode(initialDarkMode)

    if (savedThemeMode === 'manual' || savedThemeMode === 'auto') {
      setUiThemeMode(savedThemeMode)
    }

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
    document.documentElement.setAttribute('data-ui-theme', uiTheme)
    localStorage.setItem(THEME_KEY, uiTheme)
    localStorage.setItem(THEME_MODE_KEY, uiThemeMode)
  }, [uiTheme, uiThemeMode])

  return (
    <Component
      {...pageProps}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      uiThemeMode={uiThemeMode}
      setUiThemeMode={setUiThemeMode}
      uiTheme={uiTheme}
      setUiTheme={setUiTheme}
    />
  )
}
