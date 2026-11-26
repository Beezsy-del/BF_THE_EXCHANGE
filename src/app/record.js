// Capture a short local canvas video. All owned tracks and timers are released
// on success, recorder failure, or a source that becomes unavailable.
export const canRecord = () =>
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'

export function recordCanvas(src, { seconds = 6, name = 'morph', smooth = false, onDone } = {}) {
  if (!src || !canRecord() || !(src.width > 0 && src.height > 0)) return false
  let stream, rec, raf, timer, watchdog, finished = false
  const cleanup = () => {
    cancelAnimationFrame(raf)
    clearTimeout(timer)
    clearTimeout(watchdog)
    stream?.getTracks().forEach((track) => track.stop())
  }
  const finish = (ok, error) => {
    if (finished) return
    finished = true
    cleanup()
    if (!ok && rec?.state !== 'inactive') { try { rec.stop() } catch { /* already stopped */ } }
    onDone?.({ ok, error })
  }
  try {
    const scale = Math.max(1, Math.min(8, Math.floor(1280 / src.width)))
    const out = document.createElement('canvas')
    out.width = Math.min(1920, src.width * scale)
    out.height = Math.max(1, Math.round((out.width / src.width) * src.height))
    const g = out.getContext('2d')
    if (!g) return false
    g.imageSmoothingEnabled = smooth
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => window.MediaRecorder.isTypeSupported(t))
    if (!type) return false
    stream = out.captureStream(30)
    rec = new window.MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (!finished && e.data.size) chunks.push(e.data) }
    rec.onerror = () => finish(false, 'The browser could not finish recording.')
    rec.onstop = () => {
      if (finished) return
      try {
        if (!chunks.length) { finish(false, 'The recording was empty.'); return }
        const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
        const a = document.createElement('a')
        a.href = url; a.download = `${name}-${Date.now()}.webm`; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
        finish(true)
      } catch { finish(false, 'The video could not be saved.') }
    }
    const copy = () => {
      if (finished) return
      try {
        if (!(src.width > 0 && src.height > 0)) { finish(false, 'The recording canvas is no longer available.'); return }
        g.drawImage(src, 0, 0, out.width, out.height)
      } catch { finish(false, 'The recording canvas could not be read.'); return }
      raf = requestAnimationFrame(copy)
    }
    // Initial failures return false without notifying a caller that has not started yet.
    g.drawImage(src, 0, 0, out.width, out.height)
    rec.start(250)
    raf = requestAnimationFrame(copy)
    const duration = Number.isFinite(seconds) ? Math.max(0.1, Math.min(60, seconds)) : 6
    timer = setTimeout(() => { try { if (rec.state !== 'inactive') rec.stop() } catch { finish(false, 'Recording could not stop.') } }, duration * 1000)
    watchdog = setTimeout(() => finish(false, 'Recording timed out.'), duration * 1000 + 3000)
    return true
  } catch {
    finished = true
    cleanup()
    if (rec?.state === 'recording') { try { rec.stop() } catch { /* cleanup */ } }
    return false
  }
}
