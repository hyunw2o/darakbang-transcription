const test = require('node:test')
const assert = require('node:assert/strict')
const { pairTrainingFiles } = require('../utils/trainingReview.cjs')

test('matches Korean NFC and NFD filenames', () => {
  const pairs = pairTrainingFiles([{ name: '학습.mp3' }, { name: '학습'.normalize('NFD') + '.txt' }])
  assert.equal(pairs.length, 1); assert.equal(pairs[0].valid, true)
})
test('duplicate audio stems are not silently paired', () => {
  assert.equal(pairTrainingFiles([{ name: 'a.mp3' }, { name: 'a.wav' }, { name: 'a.txt' }])[0].valid, false)
})
test('missing counterpart remains visible', () => {
  const pairs = pairTrainingFiles([{ name: 'a.mp3' }, { name: 'b.txt' }])
  assert.equal(pairs.length, 2); assert.ok(pairs.every(p => !p.valid))
})
test('directory names avoid ambiguous cross-folder pairing', () => {
  const pairs = pairTrainingFiles([{ name: 'a.mp3', webkitRelativePath: 'one/a.mp3' }, { name: 'a.txt', webkitRelativePath: 'two/a.txt' }])
  assert.ok(pairs.every(p => !p.valid))
})
test('unsupported files ignored and extensions case-insensitive', () => {
  const pairs = pairTrainingFiles([{ name: 'a.MP3' }, { name: 'a.TXT' }, { name: 'photo.png' }])
  assert.equal(pairs.length, 1); assert.equal(pairs[0].valid, true)
})
