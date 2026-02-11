import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'

function ThemeToggle({ darkMode, setDarkMode }) {
  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      aria-label="다크 모드 전환"
    >
      {darkMode ? (
        <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  )
}

function StepIndicator({ currentStep }) {
  const steps = [
    { label: '업로드', icon: '1' },
    { label: '음성 인식', icon: '2' },
    { label: '교정', icon: '3' },
  ]

  return (
    <div className="flex items-center justify-center gap-2 my-8">
      {steps.map((step, i) => {
        const stepNum = i + 1
        const isCompleted = currentStep > stepNum
        const isActive = currentStep === stepNum

        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`step-dot ${isCompleted ? 'completed' : isActive ? 'active' : 'pending'}`}>
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.icon}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mb-5 rounded-full transition-colors duration-500 ${currentStep > stepNum ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Home({ darkMode, setDarkMode }) {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('ko')
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
      setError('파일 크기는 100MB 이하여야 합니다.')
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
          setError(data.error || '변환 중 오류가 발생했습니다.')
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
      setError('파일을 선택해주세요.')
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
        throw new Error(errorData.detail || '변환 실패')
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
      setError(err.message || '오류가 발생했습니다.')
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
        setError('해당 기록을 불러올 수 없습니다.')
      }
    } catch (e) {
      setError('불러오기 실패')
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
    a.download = `녹취록_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAsWord = () => {
    if (!result) return
    const text = result.corrected_text || result.raw_text
    const lines = text.split('\n')
    const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치']
    let html = ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (sectionHeaders.includes(trimmed)) {
        html += `<h2>${trimmed}</h2>`
      } else if (trimmed === '') {
        html += '<br/>'
      } else {
        const speakerMatch = trimmed.match(/^(화자\s*[A-Z]|참석자\s*\d+)\s*[:：]/)
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
        body { font-family: '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.8; }
        h2 { font-size: 14pt; color: #1a365d; border-bottom: 1px solid #3182ce; padding-bottom: 4px; margin-top: 20px; }
        p { margin: 6px 0; }
      </style></head>
      <body>${html}</body></html>`
    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `녹취록_${new Date().toISOString().slice(0, 10)}.doc`
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
      setError('요약 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-12">
      <Head>
        <title>STTudio - AI Speech to Text</title>
      </Head>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href={OURS_URL}
              className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              OURS
            </a>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              STTudio
            </h1>
          </div>
          <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8">

        {/* 업로드 카드 */}
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6 mb-6 animate-fade-in">
          <form onSubmit={handleSubmit}>

            {/* 드래그 앤 드롭 영역 */}
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
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
                  <div className="w-12 h-12 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="text-xs text-red-500 hover:text-red-600 underline"
                  >
                    파일 변경
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    파일을 끌어다 놓거나 <span className="text-blue-500 font-medium">클릭</span>하여 선택
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">MP3, WAV, M4A, OGG, FLAC (최대 100MB)</p>
                </div>
              )}
            </div>

            {/* 설정 */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500 dark:text-slate-400 shrink-0">언어</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all
                    text-slate-700 dark:text-slate-200"
                >
                  <option value="ko">한국어</option>
                  <option value="en">영어</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500 dark:text-slate-400 shrink-0">유형</label>
                <select
                  value={transcriptionType}
                  onChange={(e) => setTranscriptionType(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all
                    text-slate-700 dark:text-slate-200"
                >
                  <option value="sermon">설교 녹취</option>
                  <option value="phonecall">통화 기록</option>
                  <option value="conversation">대화/회의 기록</option>
                </select>
              </div>
            </div>

            {/* 변환 버튼 */}
            <button
              type="submit"
              disabled={loading || !file}
              className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700
                text-white disabled:text-slate-500 dark:disabled:text-slate-500
                py-3.5 rounded-xl font-semibold text-sm
                transition-all duration-200
                shadow-sm hover:shadow-md disabled:shadow-none
                disabled:cursor-not-allowed"
            >
              {loading ? '변환 중...' : '변환하기'}
            </button>
          </form>

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-slide-up">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* 진행률 표시 */}
        {loading && currentStep > 0 && (
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6 mb-6 animate-slide-up">
            <StepIndicator currentStep={currentStep} />
            <div className="progress-bar mt-4">
              <div
                className="progress-bar-fill animate-pulse-slow"
                style={{ width: currentStep === 1 ? '20%' : currentStep === 2 ? '55%' : '85%' }}
              />
            </div>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-3">
              {currentStep === 1 && '파일을 업로드하고 있습니다...'}
              {currentStep === 2 && 'AI가 음성을 인식하고 있습니다...'}
              {currentStep === 3 && '텍스트를 교정하고 구조화하고 있습니다...'}
            </p>
          </div>
        )}

        {/* 결과 영역 */}
        {result && (
          <div className="space-y-4 animate-slide-up">

            {/* 결과 헤더 + 텍스트 */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">변환 결과</h2>
                  {result.transcription_type && result.transcription_type !== 'sermon' && (
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium">
                      {result.transcription_type === 'phonecall' ? '통화 기록' : '대화/회의 기록'}
                    </span>
                  )}
                </div>
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                  {result.characters?.toLocaleString()} 자
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-100 dark:border-slate-800 max-h-[60vh] overflow-y-auto">
                <div className="text-sm leading-7 text-slate-700 dark:text-slate-300">
                  {(result.corrected_text || result.raw_text)
                    .split('\n')
                    .map((line, i) => {
                      const trimmed = line.trim()
                      // 섹션 헤더: 설교(본론/결론/기도) + 통화/대화(요약/주요 내용/논의 안건/결정 사항/후속 조치)
                      const sectionHeaders = ['본론', '결론', '기도', '요약', '주요 내용', '논의 안건', '결정 사항', '후속 조치']
                      if (sectionHeaders.includes(trimmed)) {
                        return (
                          <div key={i} className="text-base font-bold text-blue-700 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-1 mt-8 mb-3">
                            {trimmed}
                          </div>
                        )
                      }
                      // 화자 라벨 강조: "화자 A:", "화자 B:", "참석자 1:" 등
                      const speakerMatch = trimmed.match(/^(화자\s*[A-Z]|참석자\s*\d+)\s*[:：]/)
                      if (speakerMatch) {
                        return (
                          <p key={i} className="mb-1.5">
                            <span className="inline-block px-2 py-0.5 mr-1.5 text-xs font-semibold rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
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
              <div className="flex flex-wrap gap-2 mt-5">
                <button
                  onClick={() => copyToClipboard(result.corrected_text || result.raw_text, 'text')}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300
                    hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied === 'text' ? '복사됨' : '복사'}
                </button>
                <button
                  onClick={exportAsTxt}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300
                    hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  TXT
                </button>
                <button
                  onClick={exportAsWord}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300
                    hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50
                    p-4 text-sm font-medium text-blue-600 dark:text-blue-400
                    hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '요약 생성 중...' : '주보용 요약 생성'}
                </button>
              ) : (
                <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">주보용 요약</h3>
                    <button
                      onClick={() => copyToClipboard(result.summary, 'summary')}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                    >
                      {copied === 'summary' ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {result.summary}
                    </p>
                  </div>
                </div>
              )
            )}

            {/* 원본 텍스트 */}
            {result.corrected_text && (
              <details className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <summary className="p-4 cursor-pointer text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium select-none">
                  원본 텍스트 보기
                </summary>
                <div className="px-6 pb-6">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                    <p className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
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
              className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mb-3 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              최근 변환 기록 ({history.length})
            </button>

            {showHistory && (
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-slide-up">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map((item) => (
                    <li key={item.task_id}>
                      <button
                        onClick={() => handleLoadHistory(item.task_id)}
                        className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.status === 'completed' ? 'bg-green-500' :
                                item.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                                }`} />
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {new Date(item.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {item.transcription_type && item.transcription_type !== 'sermon' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                  {item.transcription_type === 'phonecall' ? '통화' : '회의'}
                                </span>
                              )}
                              {item.characters > 0 && (
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                  {item.characters?.toLocaleString()}자
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {item.summary_preview || "내용 없음"}
                            </p>
                          </div>
                          <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <p className="text-xs text-slate-400 dark:text-slate-600">
            STTudio &middot; Copyright 2026. OURS All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  )
}
