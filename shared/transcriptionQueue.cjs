// Synchronous claims prevent double uploads between React renders on both clients.
function createTranscriptionQueue(createId) {
  let state = { items: [], running: false, activeId: null, options: null }
  const listeners = new Set()
  const publish = (next) => {
    state = { ...state, ...next }
    listeners.forEach(listener => listener())
  }
  const patch = (id, changes) => state.items.map(item => item.id === id ? { ...item, ...changes } : item)
  const blocked = () => state.items.some(item => item.status === 'uncertain' || item.status === 'failed')
  const queue = {
    getSnapshot: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    enqueue(files) {
      const added = []
      for (const file of files) {
        const fingerprint = JSON.stringify([file.name, file.size, file.uri || file.lastModified || 0])
        if ([...state.items, ...added].some(item => item.fingerprint === fingerprint && item.status !== 'completed')) continue
        added.push({ id: createId(), uploadId: createId(), file, name: file.name, size: file.size,
          fingerprint, status: 'waiting', taskId: null, result: null, error: '',
          options: state.running ? state.options : null })
      }
      if (added.length) publish({ items: [...state.items, ...added] })
      return added
    },
    start(options) {
      if (blocked()) return false
      publish({ running: true, options,
        items: state.items.map(item => item.status === 'waiting' && !item.options ? { ...item, options } : item) })
      return true
    },
    pause() { if (state.running) publish({ running: false }) },
    claim() {
      if (!state.running || state.activeId || blocked()) return null
      const item = state.items.find(entry => entry.status === 'waiting')
      if (!item) { publish({ running: false }); return null }
      const claimed = { ...item, status: item.taskId ? 'processing' : 'uploading', options: item.options || state.options }
      publish({ activeId: item.id, items: patch(item.id, claimed) })
      return claimed
    },
    processing(id, taskId) {
      if (state.activeId === id) publish({ items: patch(id, { taskId, status: 'processing' }) })
    },
    complete(id, result) {
      if (state.activeId !== id) return
      publish({ activeId: null, items: patch(id, { status: 'completed', result, taskId: result.task_id || null, file: null, error: '' }) })
    },
    fail(id, error, uncertain = true) {
      if (state.activeId !== id) return
      publish({ activeId: null, running: false, items: patch(id, { status: uncertain ? 'uncertain' : 'failed', error }) })
    },
    retry(id) {
      if (state.activeId) return
      const item = state.items.find(entry => entry.id === id)
      if (!item || !['failed', 'uncertain'].includes(item.status)) return
      // Unknown outcomes keep their upload ID/task ID; only confirmed failures get a new request.
      publish({ running: true, items: patch(id, { status: 'waiting', error: '',
        ...(item.status === 'failed' ? { taskId: null, uploadId: createId() } : {}) }) })
    },
    remove(id) {
      const item = state.items.find(entry => entry.id === id)
      if (item && ['waiting', 'failed', 'completed'].includes(item.status)) publish({ items: state.items.filter(entry => entry.id !== id) })
    },
    move(id, direction) {
      const items = [...state.items]
      const index = items.findIndex(item => item.id === id)
      const target = index + direction
      if (![-1, 1].includes(direction) || items[index]?.status !== 'waiting' || items[target]?.status !== 'waiting') return
      ;[items[index], items[target]] = [items[target], items[index]]
      publish({ items })
    },
    clearCompleted() { publish({ items: state.items.filter(item => item.status !== 'completed') }) },
    reset() { publish({ items: [], running: false, activeId: null, options: null }) },
  }
  return queue
}

module.exports = { createTranscriptionQueue }
