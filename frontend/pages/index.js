import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

export default function Home() {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('ko')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [statusMessage, setStatusMessage] = useState('')

  const pollInterval = useRef(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    fetchHistory()
    return () => stopPolling()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/history`)
      if (res.ok) {
        setHistory(await res.json())
      }
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('파일 크기는 100MB 이하여야 합니다.')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const startPolling = (taskId) => {
    stopPolling()
    setStatusMessage('서버에서 처리 중입니다... (잠시만 기다려주세요)')

    pollInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/status/${taskId}`)
        if (!res.ok) return

        const data = await res.json()

        if (data.status === 'completed') {
          stopPolling()
          setResult(data)
          setLoading(false)
          setStatusMessage('')
          fetchHistory() // Refresh list
        } else if (data.status === 'error') {
          stopPolling()
          setError(data.error || '변환 중 오류가 발생했습니다.')
          setLoading(false)
          setStatusMessage('')
        } else if (data.status === 'processing') {
          setStatusMessage('AI가 열심히 설교를 분석하고 있습니다... 🤖')
        } else {
          setStatusMessage('대기열에 등록되었습니다...')
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
    setStatusMessage('파일 업로드 중...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', language)
      formData.append('correct', 'true')

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
        startPolling(data.task_id)
      } else {
        // Fallback for immediate response (if backend changes back)
        setResult(data)
        setLoading(false)
      }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
      setLoading(false)
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <Head>
        <title>다락방 설교 녹취 변환</title>
      </Head>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            다락방 설교 녹취 변환
          </h1>
          <p className="text-gray-600">
            렘넌트, 237, 5000종족 용어 특화 AI
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설교 음성 파일
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  ✅ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                언어
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ko">한국어</option>
                <option value="en">영어</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-medium text-lg
                hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                transition-all transform hover:scale-105 active:scale-95
                shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{statusMessage || '처리 중...'}</span>
                </>
              ) : '🎤 변환하기'}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <p className="text-red-700 font-medium">⚠️ {error}</p>
            </div>
          )}
        </div>

        {result && (
          <div className="bg-white rounded-xl shadow-lg p-8 space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-900">변환 완료 ✨</h2>
              <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {result.characters} 자
              </span>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                📝 교정된 텍스트
              </h3>
              <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
                <p className="whitespace-pre-wrap text-gray-800 leading-relaxed font-sans text-lg">
                  {result.corrected_text || result.raw_text}
                </p>
              </div>
            </div>

            {!result.summary && (
              <button
                onClick={handleSummarize}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium
                  hover:bg-green-700 disabled:bg-gray-400 transition-all
                  shadow-md hover:shadow-lg"
              >
                {loading ? '요약 중...' : '📄 주보용 요약 생성'}
              </button>
            )}

            {result.summary && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  📋 주보용 요약
                </h3>
                <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                  <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              </div>
            )}

            {result.corrected_text && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-medium">
                  🔍 Whisper 원본 텍스트 보기
                </summary>
                <div className="mt-3 bg-gray-100 p-4 rounded-lg">
                  <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                    {result.raw_text}
                  </p>
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.corrected_text || result.raw_text)
                  alert('✅ 복사되었습니다!')
                }}
                className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-medium
                  hover:bg-gray-700 transition-all shadow-md hover:shadow-lg"
              >
                📋 텍스트 복사
              </button>
              {result.summary && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.summary)
                    alert('✅ 요약이 복사되었습니다!')
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium
                    hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                >
                  📋 요약 복사
                </button>
              )}
            </div>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 px-2">📂 최근 변환 기록</h3>
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {history.map((item) => (
                  <li key={item.task_id} className="hover:bg-blue-50 transition-colors">
                    <button
                      onClick={() => handleLoadHistory(item.task_id)}
                      className="w-full text-left p-4 sm:flex items-center justify-between group"
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium 
                            ${item.status === 'completed' ? 'bg-green-100 text-green-700' :
                              item.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {item.status === 'completed' ? '완료' : item.status}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1 group-hover:text-blue-700">
                          {item.summary_preview || "내용 없음"}
                        </p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <span className="text-xs text-gray-400 block">{item.characters}자</span>
                        <span className="text-blue-600 text-sm opacity-0 group-hover:opacity-100 font-medium">
                          불러오기 →
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>류광수/이주현 목사 계열 다락방 교회 전용</p>
          <p className="mt-1">렘넌트, 237, 5000종족, 7망대 용어 특화</p>
        </div>
      </div>
    </div>
  )
}
