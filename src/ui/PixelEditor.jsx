import React, { useEffect, useRef, useState } from 'react'
import { plot, line, rect, ellipse, floodFill } from '../art/paint.js'

// The drawing surface. Strokes are drawn into a working copy and handed back
// on release, so each stroke is one undo step.
export default function PixelEditor({ grid, tool, color, brush, mirror, filled, showGrid, onBegin, onCommit, onPick }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const work = useRef(null)
  const bitmap = useRef(null)
  const drag = useRef(null)
  const [scale, setScale] = useState(8)
  const [hover, setHover] = useState(null)

  // fit to the stage with whole-number cells
  useEffect(() => {
    const fit = () => {
      const r = wrapRef.current.getBoundingClientRect()
      setScale(Math.max(2, Math.floor(Math.min((r.width - 48) / grid.w, (r.height - 48) / grid.h))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [grid.w, grid.h])

  const draw = (data, preview) => {
    const c = canvasRef.current
    if (!c) return
    const s = scale, { w, h, bg } = grid
    c.width = w * s
    c.height = h * s
    const g = c.getContext('2d')
    // One native-resolution pixel buffer, then one nearest-neighbour blit.
    // Avoid thousands of canvas API calls for each hover or brush movement.
    const scratch = (bitmap.current ??= document.createElement('canvas'))
    if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h }
    const sg = scratch.getContext('2d')
    const image = sg.createImageData(w, h)
    const pixels = image.data
    for (let i = 0; i < data.length; i++) {
      const v = data[i], k = i * 4
      pixels[k] = v < 0 ? bg[0] : (v >> 16) & 255
      pixels[k + 1] = v < 0 ? bg[1] : (v >> 8) & 255
      pixels[k + 2] = v < 0 ? bg[2] : v & 255
      pixels[k + 3] = 255
    }
    sg.putImageData(image, 0, 0)
    g.imageSmoothingEnabled = false
    g.drawImage(scratch, 0, 0, c.width, c.height)
    if (showGrid && s >= 6) {
      g.strokeStyle = 'rgba(255,255,255,0.055)'
      g.lineWidth = 1
      g.beginPath()
      for (let x = 1; x < w; x++) { g.moveTo(x * s + 0.5, 0); g.lineTo(x * s + 0.5, h * s) }
      for (let y = 1; y < h; y++) { g.moveTo(0, y * s + 0.5); g.lineTo(w * s, y * s + 0.5) }
      g.stroke()
    }
    if (mirror) {
      g.strokeStyle = 'rgba(233,162,59,0.35)'
      g.setLineDash([4, 4])
      g.beginPath(); g.moveTo((w * s) / 2, 0); g.lineTo((w * s) / 2, h * s); g.stroke()
      g.setLineDash([])
    }
    if (preview) {
      const [hx, hy] = preview
      const r0 = -Math.floor((brush - 1) / 2)
      const size = ['pencil', 'eraser'].includes(tool) ? brush : 1
      g.strokeStyle = 'rgba(255,255,255,0.7)'
      g.lineWidth = 1
      g.strokeRect((hx + (size > 1 ? r0 : 0)) * s + 0.5, (hy + (size > 1 ? r0 : 0)) * s + 0.5, size * s - 1, size * s - 1)
    }
  }

  useEffect(() => { draw(grid.data, hover) }, [grid, scale, showGrid, mirror, hover, tool, brush])

  const cellAt = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * grid.w)
    const y = Math.floor(((e.clientY - r.top) / r.height) * grid.h)
    return [Math.max(0, Math.min(grid.w - 1, x)), Math.max(0, Math.min(grid.h - 1, y))]
  }

  const paintCell = (data, x, y) => plot(data, grid.w, grid.h, x, y, tool === 'eraser' ? -1 : color, brush, mirror)
  const shapeInto = (data, [x0, y0], [x1, y1]) => {
    const fn = (x, y) => plot(data, grid.w, grid.h, x, y, color, 1, mirror)
    if (tool === 'line') line(x0, y0, x1, y1, fn)
    if (tool === 'rect') rect(x0, y0, x1, y1, filled, fn)
    if (tool === 'ellipse') ellipse(x0, y0, x1, y1, filled, fn)
  }

  const down = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    const [x, y] = cellAt(e)
    if (tool === 'picker') {
      const v = grid.data[y * grid.w + x]
      onPick(v >= 0 ? v : (grid.bg[0] << 16) | (grid.bg[1] << 8) | grid.bg[2])
      return
    }
    onBegin()
    work.current = grid.data.slice()
    if (tool === 'fill') {
      floodFill(work.current, grid.w, grid.h, x, y, color)
      if (mirror) floodFill(work.current, grid.w, grid.h, grid.w - 1 - x, y, color)
      onCommit(work.current)
      return
    }
    drag.current = { start: [x, y], last: [x, y] }
    if (tool === 'pencil' || tool === 'eraser') paintCell(work.current, x, y)
    draw(work.current, [x, y])
  }

  const move = (e) => {
    const [x, y] = cellAt(e)
    if (!drag.current) { if (!hover || hover[0] !== x || hover[1] !== y) setHover([x, y]); return }
    const d = drag.current
    if (tool === 'pencil' || tool === 'eraser') {
      line(d.last[0], d.last[1], x, y, (cx, cy) => paintCell(work.current, cx, cy))
      d.last = [x, y]
      draw(work.current, [x, y])
    } else {
      const temp = work.current.slice()
      shapeInto(temp, d.start, [x, y])
      d.preview = [x, y]
      draw(temp, null)
    }
  }

  const up = (e) => {
    const d = drag.current
    if (!d) return
    if (['line', 'rect', 'ellipse'].includes(tool)) shapeInto(work.current, d.start, d.preview ?? d.start)
    drag.current = null
    onCommit(work.current)
  }

  return (
    <div className="stage paint-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={`paint-canvas tool-${tool}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => !drag.current && setHover(null)}
        aria-label="Pixel canvas"
      />
    </div>
  )
}
