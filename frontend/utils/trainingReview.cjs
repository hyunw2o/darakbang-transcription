const AUDIO = /\.(mp3|wav|m4a|ogg|flac|webm|mp4)$/i

function pairTrainingFiles(files) {
  const groups = new Map()
  for (const file of files) {
    const path = (file.webkitRelativePath || file.name).normalize('NFC')
    if (!AUDIO.test(path) && !/\.txt$/i.test(path)) continue
    const key = path.replace(/\.[^.]+$/, '')
    if (!groups.has(key)) groups.set(key, { key, audio: [], reference: [] })
    groups.get(key)[AUDIO.test(path) ? 'audio' : 'reference'].push(file)
  }
  return [...groups.values()].map(group => ({
    key: group.key, audio: group.audio[0], reference: group.reference[0],
    valid: group.audio.length === 1 && group.reference.length === 1,
    problem: group.audio.length > 1 || group.reference.length > 1 ? '파일 이름 중복' : '음원 또는 TXT 누락',
  }))
}

module.exports = { pairTrainingFiles }
