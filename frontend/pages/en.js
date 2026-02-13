import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'

function ThemeToggle({ darkMode, setDarkMode }) {
  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      aria-label="Toggle dark mode"
    >
      {darkMode ? (
        <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  )
}

function StepIndicator({ currentStep }) {
  const steps = [
    { label: 'Upload', num: 1 },
    { label: 'STT', num: 2 },
    { label: 'Refine', num: 3 },
  ]

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, i) => {
        const isCompleted = currentStep > step.num
        const isActive = currentStep === step.num

        return (
          <div key={i} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
                ${isCompleted ? 'bg-green-500 text-white shadow-sm shadow-green-500/30' :
                  isActive ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30 animate-pulse' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.num}
              </div>
              <span className={`text-[11px] font-medium ${
                isActive ? 'text-blue-600 dark:text-blue-400' :
                isCompleted ? 'text-green-600 dark:text-green-400' :
                'text-slate-400 dark:text-slate-500'
              }`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-14 h-0.5 mb-5 rounded-full transition-all duration-700
                ${currentStep > step.num ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Home({ darkMode, setDarkMode }) {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('en')
  const [transcriptionType, setTranscriptionType] = useState('sermon')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(null)

  const pollInterval = useRef(null)
  const fileInputRef = useRef(null)
  const pollStartTime = useRef(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://darakbang-transcription-production.up.railway.app'
  const OURS_URL = process.env.NEXT_PUBLIC_OURS_URL || 'https://ours-homepage.vercel.app'

  useEffect(() => {
    fetchHistory()
    return () => stopPolling()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/history`)
      if (res.ok) setHistory(await res.json())
    } catch (e) {
      console.error("Failed to fetch history", e)
    }
  }

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current)
      pollInterval.current = null
    }
  }

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('File size must be 100MB or less.')
      return
    }
    setFile(selectedFile)
    setError(null)
    setResult(null)
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) validateAndSetFile(selectedFile)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) validateAndSetFile(droppedFile)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const startPolling = (taskId) => {
    stopPolling()
    pollStartTime.current = Date.now()
    setCurrentStep(1)

    pollInterval.current = setInterval(async () => {
      try {
        const elapsed = Date.now() - pollStartTime.current
        if (elapsed > 3000) setCurrentStep(prev => Math.max(prev, 2))

        const res = await fetch(`${API_URL}/api/status/${taskId}`)
        if (!res.ok) return

        const data = await res.json()

        if (data.status === 'completed') {
          stopPolling()
          setCurrentStep(3)
          setTimeout(() => {
            setResult(data)
            setLoading(false)
            setCurrentStep(0)
            fetchHistory()
          }, 800)
        } else if (data.status === 'error') {
          stopPolling()
          setError(data.error || 'An error occurred during transcription.')
          setLoading(false)
          setCurrentStep(0)
        } else if (data.status === 'processing') {
          setCurrentStep(3)
        }
      } catch (e) {
        console.error("Polling error", e)
      }
    }, 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select an audio file.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setCurrentStep(1)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', language)
      formData.append('correct', 'true')
      formData.append('transcription_type', transcriptionType)

      const response = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Transcription failed.')
      }

      const data = await response.json()

      if (data.status === 'queued') {
        setCurrentStep(2)
        startPolling(data.task_id)
      } else {
        setResult(data)
        setLoading(false)
        setCurrentStep(0)
      }
    } catch (err) {
      setError(err.message || 'An error occurred.')
      setLoading(false)
      setCurrentStep(0)
    }
  }

  const handleLoadHistory = async (taskId) => {
    setLoading(true)
    setError(null)
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      const res = await fetch(`${API_URL}/api/status/${taskId}`)
      const data = await res.json()
      if (data.status === 'completed') {
        setResult(data)
      } else {
        setError('Unable to load this record.')
      }
    } catch (e) {
      setError('Failed to load record.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const exportAsTxt = () => {
    if (!result) return
    const text = result.corrected_text || result.raw_text
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAsWord = () => {
    if (!result) return
    const text = result.corrected_text || result.raw_text
    const lines = text.split('\n')
    const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치',
      'Main Body', 'Conclusion', 'Prayer', 'Summary', 'Key Points', 'Agenda Items', 'Decisions', 'Action Items']
    let html = ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (sectionHeaders.includes(trimmed)) {
        html += `<h2>${trimmed}</h2>`
      } else if (trimmed === '') {
        html += '<br/>'
      } else {
        const speakerMatch = trimmed.match(/^(화자\s*[A-Z]|참석자\s*\d+|Speaker\s*[A-Z]|Participant\s*\d+)\s*[:：]/)
        if (speakerMatch) {
          html += `<p><b>${speakerMatch[1]}:</b> ${trimmed.slice(speakerMatch[0].length).trim()}</p>`
        } else {
          html += `<p>${trimmed}</p>`
        }
      }
    }
    const docContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>
        body { font-family: 'Segoe UI', sans-serif; font-size: 11pt; line-height: 1.8; }
        h2 { font-size: 14pt; color: #1a365d; border-bottom: 1px solid #3182ce; padding-bottom: 4px; margin-top: 20px; }
        p { margin: 6px 0; }
      </style></head>
      <body>${html}</body></html>`
    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript_${new Date().toISOString().slice(0, 10)}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSummarize = async () => {
    if (!result?.corrected_text && !result?.raw_text) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('text', result.corrected_text || result.raw_text)
      formData.append('summary_type', 'short')

      const response = await fetch(`${API_URL}/api/summarize`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      setResult({ ...result, summary: data.summary })
    } catch (err) {
      setError('Summary generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const typeLabels = { sermon: 'Sermon Transcript', phonecall: 'Call Record', conversation: 'Meeting/Conversation Record' }
  const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치',
    'Main Body', 'Conclusion', 'Prayer', 'Summary', 'Key Points', 'Agenda Items', 'Decisions', 'Action Items']

  return (
    <div className="min-h-screen pb-12">
      <Head>
        <title>malloc24 - AI Speech to Text</title>
      </Head>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <a
              href={OURS_URL}
              className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              OURS
            </a>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              malloc24
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <Link
                href="/"
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                KR
              </Link>
              <Link
                href="/en"
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              >
                EN
              </Link>
            </nav>
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6">

        {/* 업로드 카드 */}
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50 p-5 sm:p-6 mb-5 animate-fade-in">
          <form onSubmit={handleSubmit}>

            {/* 드래그 앤 드롭 영역 */}
            <div
              className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all duration-300
                ${dragOver ? 'border-blue-400 bg-blue-50/80 dark:bg-blue-900/20 scale-[1.01]' :
                  file ? 'border-green-400/60 dark:border-green-500/40 bg-green-50/50 dark:bg-green-900/10' :
                  'border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="space-y-2">
                  <div className="w-11 h-11 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="text-xs text-red-500 hover:text-red-600 font-medium mt-1"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-11 h-11 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Drag & drop your file, or <span className="text-blue-500 font-medium">click</span> to browse
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">MP3, WAV, M4A, OGG, FLAC (up to 100MB)</p>
                </div>
              )}
            </div>

            {/* 설정 */}
            <div className="mt-4 flex gap-3">
              <div className="flex-1 relative">
                <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[10px] font-medium text-slate-400 dark:text-slate-500">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl
                    focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none transition-all
                    text-slate-700 dark:text-slate-200"
                >
                  <option value="ko">Korean</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="flex-1 relative">
                <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[10px] font-medium text-slate-400 dark:text-slate-500">Type</label>
                <select
                  value={transcriptionType}
                  onChange={(e) => setTranscriptionType(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl
                    focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none transition-all
                    text-slate-700 dark:text-slate-200"
                >
                  <option value="sermon">Sermon Transcript</option>
                  <option value="phonecall">Call Record</option>
                  <option value="conversation">Meeting/Conversation Record</option>
                </select>
              </div>
            </div>

            {/* 변환 버튼 */}
            <button
              type="submit"
              disabled={loading || !file}
              className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-700
                text-white disabled:text-slate-400 dark:disabled:text-slate-500
                py-3.5 rounded-xl font-semibold text-sm
                transition-all duration-200
                shadow-sm hover:shadow-md shadow-blue-600/10 hover:shadow-blue-600/20
                disabled:shadow-none disabled:cursor-not-allowed
                active:scale-[0.98]"
            >
              {loading ? 'Transcribing...' : 'Start Transcription'}
            </button>
          </form>

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-4 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800/50 rounded-xl animate-slide-up">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* 진행률 표시 */}
        {loading && currentStep > 0 && (
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50 p-6 mb-5 animate-slide-up">
            <StepIndicator currentStep={currentStep} />
            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-5">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: currentStep === 1 ? '20%' : currentStep === 2 ? '55%' : '85%' }}
              />
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">
              {currentStep === 1 && 'Uploading file...'}
              {currentStep === 2 && 'AI is recognizing speech...'}
              {currentStep === 3 && 'Refining and structuring text...'}
            </p>
          </div>
        )}

        {/* 결과 영역 */}
        {result && (
          <div className="space-y-4 animate-slide-up">

            {/* 결과 헤더 + 텍스트 */}
            <div className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Transcription Result</h2>
                  {result.transcription_type && result.transcription_type !== 'sermon' && (
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[11px] font-medium">
                      {typeLabels[result.transcription_type] || result.transcription_type}
                    </span>
                  )}
                </div>
                <span className="px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-[11px] font-medium">
                  {result.characters?.toLocaleString()} chars
                </span>
              </div>

              <div className="bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-slate-800/50 max-h-[60vh] overflow-y-auto">
                <div className="text-[13px] leading-7 text-slate-700 dark:text-slate-300">
                  {(result.corrected_text || result.raw_text)
                    .split('\n')
                    .map((line, i) => {
                      const trimmed = line.trim()
                      if (sectionHeaders.includes(trimmed)) {
                        return (
                          <div key={i} className="text-sm font-bold text-blue-700 dark:text-blue-400 border-b border-blue-100 dark:border-blue-900/50 pb-1 mt-7 mb-3">
                            {trimmed}
                          </div>
                        )
                      }
                      const speakerMatch = trimmed.match(/^(화자\s*[A-Z](?:\([^)]*\))?|참석자\s*\d+(?:\([^)]*\))?|Speaker\s*[A-Z](?:\s*\([^)]*\))?|Participant\s*\d+(?:\s*\([^)]*\))?)\s*[:：]/)
                      if (speakerMatch) {
                        return (
                          <p key={i} className="mb-1.5">
                            <span className="inline-block px-2 py-0.5 mr-1.5 text-[11px] font-semibold rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/40">
                              {speakerMatch[1]}
                            </span>
                            {trimmed.slice(speakerMatch[0].length).trim()}
                          </p>
                        )
                      }
                      if (trimmed === '') return <br key={i} />
                      return <p key={i} className="mb-1.5">{line}</p>
                    })
                  }
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => copyToClipboard(result.corrected_text || result.raw_text, 'text')}
                  className="action-btn"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied === 'text' ? 'Copied' : 'Copy'}
                </button>
                <button onClick={exportAsTxt} className="action-btn">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  TXT
                </button>
                <button onClick={exportAsWord} className="action-btn">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Word
                </button>
              </div>
            </div>

            {/* 요약 섹션 (설교 녹취만) */}
            {(result.transcription_type || 'sermon') === 'sermon' && (
              !result.summary ? (
                <button
                  onClick={handleSummarize}
                  disabled={loading}
                  className="w-full bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50
                    p-4 text-sm font-medium text-blue-600 dark:text-blue-400
                    hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Generating summary...' : 'Generate Bulletin Summary'}
                </button>
              ) : (
                <div className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50 p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bulletin Summary</h3>
                    <button
                      onClick={() => copyToClipboard(result.summary, 'summary')}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                    >
                      {copied === 'summary' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-blue-50/80 dark:bg-blue-900/15 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <p className="whitespace-pre-wrap text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      {result.summary}
                    </p>
                  </div>
                </div>
              )
            )}

            {/* 원본 텍스트 */}
            {result.corrected_text && (
              <details className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
                <summary className="p-4 cursor-pointer text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium select-none transition-colors">
                  View Raw Text
                </summary>
                <div className="px-5 pb-5">
                  <div className="bg-slate-50/80 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <p className="whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {result.raw_text}
                    </p>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}

        {/* 히스토리 */}
        {history.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 mb-3 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistory ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Recent Transcriptions ({history.length})
            </button>

            {showHistory && (
              <div className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50 overflow-hidden animate-slide-up">
                <ul className="divide-y divide-slate-100/80 dark:divide-slate-800/50">
                  {history.map((item) => (
                    <li key={item.task_id}>
                      <button
                        onClick={() => handleLoadHistory(item.task_id)}
                        className="w-full text-left p-4 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                item.status === 'completed' ? 'bg-green-500' :
                                item.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                              }`} />
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {item.transcription_type && item.transcription_type !== 'sermon' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                                  {item.transcription_type === 'phonecall' ? 'Call' : 'Meeting'}
                                </span>
                              )}
                              {item.characters > 0 && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                  {item.characters?.toLocaleString()} chars
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {item.summary_preview || "No content"}
                            </p>
                          </div>
                          <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 푸터 */}
        <footer className="mt-12 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-600">
            malloc24 &middot; Copyright 2026. OURS All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  )
}
