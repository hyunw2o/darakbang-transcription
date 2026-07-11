const STAGE_PERCENT = {
  uploading: 2,
  queued: 5,
  loading_glossary: 8,
  preparing_audio: 10,
  detecting_silence: 14,
  splitting_audio: 18,
  validating_coverage: 23,
  transcribing: 25,
  reviewing_confidence: 67,
  retranscribing: 70,
  merging_transcript: 80,
  correcting_text: 84,
  finalizing_text: 94,
  saving_result: 97,
  completed: 100,
  error: 100,
}

export const EMPTY_TRANSCRIPTION_PROGRESS = Object.freeze({
  stage: 'idle',
  percent: 0,
})

export const TRANSCRIPTION_PROCESS_STEPS = {
  ko: [
    { id: 'upload', label: '업로드', caption: '파일 전송 완료', stages: ['uploading'] },
    { id: 'queue', label: '작업 준비', caption: '대기열·용어집 확인', stages: ['queued', 'loading_glossary'] },
    { id: 'prepare', label: '오디오 준비', caption: '형식·길이 점검', stages: ['preparing_audio'] },
    { id: 'split', label: '무음 기준 분할', caption: '문장 경계 탐색', stages: ['detecting_silence', 'splitting_audio'] },
    { id: 'coverage', label: '시간축 검증', caption: '누락 구간 검사', stages: ['validating_coverage'] },
    { id: 'recognize', label: '음성 인식', caption: '청크 병렬 전사', stages: ['transcribing'] },
    { id: 'verify', label: '신뢰도 검토', caption: '선택 구간 재인식', stages: ['reviewing_confidence', 'retranscribing'] },
    { id: 'merge', label: '시간 기반 병합', caption: '중복·누락 정렬', stages: ['merging_transcript'] },
    { id: 'correct', label: '교정·구조화', caption: '원문 보존 검사', stages: ['correcting_text', 'finalizing_text'] },
    { id: 'save', label: '결과 저장', caption: '최종 텍스트 준비', stages: ['saving_result', 'completed'] },
  ],
  en: [
    { id: 'upload', label: 'Upload', caption: 'File transferred', stages: ['uploading'] },
    { id: 'queue', label: 'Prepare job', caption: 'Queue and glossary', stages: ['queued', 'loading_glossary'] },
    { id: 'prepare', label: 'Prepare audio', caption: 'Format and duration', stages: ['preparing_audio'] },
    { id: 'split', label: 'Silence split', caption: 'Find sentence gaps', stages: ['detecting_silence', 'splitting_audio'] },
    { id: 'coverage', label: 'Timeline check', caption: 'Verify full coverage', stages: ['validating_coverage'] },
    { id: 'recognize', label: 'Speech recognition', caption: 'Parallel transcription', stages: ['transcribing'] },
    { id: 'verify', label: 'Confidence review', caption: 'Selective retry', stages: ['reviewing_confidence', 'retranscribing'] },
    { id: 'merge', label: 'Timed merge', caption: 'Align overlaps', stages: ['merging_transcript'] },
    { id: 'correct', label: 'Refine and structure', caption: 'Preservation checks', stages: ['correcting_text', 'finalizing_text'] },
    { id: 'save', label: 'Save result', caption: 'Prepare final text', stages: ['saving_result', 'completed'] },
  ],
}

function normalizeLocale(locale) {
  return locale === 'en' ? 'en' : 'ko'
}

export function normalizeTranscriptionProgress(value, fallbackStage = 'queued') {
  const source = value && typeof value === 'object' ? value : {}
  const stage = String(source.stage || fallbackStage || 'queued')
  const rawPercent = Number(source.percent)
  const fallbackPercent = STAGE_PERCENT[stage] ?? STAGE_PERCENT[fallbackStage] ?? 5
  return {
    ...source,
    stage,
    percent: Number.isFinite(rawPercent)
      ? Math.max(0, Math.min(100, Math.round(rawPercent)))
      : fallbackPercent,
  }
}

export function resolveProcessStepIndex(stage, currentStep = 1, locale = 'ko') {
  const steps = TRANSCRIPTION_PROCESS_STEPS[normalizeLocale(locale)]
  const matchedIndex = steps.findIndex((step) => step.stages.includes(stage))
  if (matchedIndex >= 0) return matchedIndex
  if (stage === 'idle') return -1
  if (Number(currentStep) <= 1) return 0
  if (Number(currentStep) === 2) return 1
  return 8
}

export function getTranscriptionProgressText(progress, locale = 'ko') {
  const normalizedLocale = normalizeLocale(locale)
  const data = normalizeTranscriptionProgress(progress, 'queued')
  const current = Number(data.current_chunk) || 0
  const total = Number(data.total_chunks) || 0
  const chunkSuffix = total > 0
    ? normalizedLocale === 'en'
      ? ` (${Math.min(current, total)}/${total} chunks)`
      : ` (${Math.min(current, total)}/${total}개 구간)`
    : ''

  const copy = normalizedLocale === 'en'
    ? {
        uploading: 'Uploading the audio file securely.',
        queued: 'Upload complete. Waiting for a transcription worker.',
        loading_glossary: 'Loading your glossary and recognition hints.',
        preparing_audio: 'Checking the audio format and full duration.',
        detecting_silence: 'Finding natural silence between sentences.',
        splitting_audio: 'Splitting the complete timeline at sentence boundaries.',
        validating_coverage: 'Verifying that every moment of the source audio is covered.',
        transcribing: `Recognizing speech in parallel${chunkSuffix}.`,
        reviewing_confidence: 'Checking low-confidence words and cut sentence boundaries.',
        retranscribing: `Re-recognizing uncertain audio with prior context and glossary terms${chunkSuffix}.`,
        merging_transcript: 'Aligning timestamps and similar sentences without gaps or duplicates.',
        correcting_text: 'Refining and structuring text while preserving the original ASR.',
        finalizing_text: 'Running preservation checks before finalizing the transcript.',
        saving_result: 'Saving the final transcript and preparing the result screen.',
        completed: 'Transcription is complete.',
        error: 'Transcription stopped because an error occurred.',
      }
    : {
        uploading: '음성 파일을 안전하게 업로드하고 있습니다.',
        queued: '업로드가 완료되어 변환 작업 순서를 기다리고 있습니다.',
        loading_glossary: '사용자 용어집과 음성 인식 힌트를 불러오고 있습니다.',
        preparing_audio: '오디오 형식과 전체 재생 시간을 확인하고 있습니다.',
        detecting_silence: '문장 사이의 자연스러운 무음 지점을 찾고 있습니다.',
        splitting_audio: '전체 시간축을 문장 경계에 맞춰 안전하게 나누고 있습니다.',
        validating_coverage: '원본 음원의 처음부터 끝까지 빠진 구간이 없는지 검사하고 있습니다.',
        transcribing: `여러 구간의 음성을 병렬로 인식하고 있습니다${chunkSuffix}.`,
        reviewing_confidence: '신뢰도가 낮은 단어와 끊긴 문장 경계를 검사하고 있습니다.',
        retranscribing: `불확실한 구간을 앞 문맥과 용어집으로 다시 인식하고 있습니다${chunkSuffix}.`,
        merging_transcript: '타임스탬프와 문장 유사도로 중복과 누락 없이 병합하고 있습니다.',
        correcting_text: '원본 인식 결과를 보존하며 문장을 교정하고 구조화하고 있습니다.',
        finalizing_text: '문장 삭제·축약 방지 검사를 거쳐 최종 텍스트를 확정하고 있습니다.',
        saving_result: '최종 변환문을 저장하고 결과 화면을 준비하고 있습니다.',
        completed: '모든 변환 과정이 완료되었습니다.',
        error: '오류가 발생해 변환이 중단되었습니다.',
      }

  return copy[data.stage] || (normalizedLocale === 'en' ? 'Processing the transcription.' : '변환 작업을 처리하고 있습니다.')
}
