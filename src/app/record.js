// Record a short video loop of any canvas. The source is copied into a larger
// canvas each frame (crisp for pixel art), captured with MediaRecorder, and
// downloaded as WebM. Nothing leaves the browser.

export const canRecord = () =>
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'

export function recordCanvas(src, { seconds = 6, name = 'morph', smooth = false, onDone } = {}) {
  if (!src || !canRecord()) return false
  const scale = Math.max(1, Math.min(8, Math.floor(1280 / src.width)))
  const out = document.createElement('canvas')
  out.width = Math.min(1920, src.width * scale)
  out.height = Math.round((out.width / src.width) * src.height)
  const g = out.getContext('2d')
  g.imageSmoothingEnabled = smooth
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => window.MediaRecorder.isTypeSupported(t))
  if (!type) return false
  const rec = new window.MediaRecorder(out.captureStream(30), { mimeType: type, videoBitsPerSecond: 8_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  let raf
  const copy = () => { g.drawImage(src, 0, 0, out.width, out.height); raf = requestAnimationFrame(copy) }
  rec.onstop = () => {
    cancelAnimationFrame(raf)
    const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}-${Date.now()}.webm`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    onDone?.()
  }
  copy()
  rec.start(250)
  setTimeout(() => rec.state !== 'inactive' && rec.stop(), seconds * 1000)
  return true
}
