// Pixel editor operations on a flat Int32Array (0xRRGGBB, or -1 for empty).

export function plot(data, w, h, x, y, color, size = 1, mirror = false) {
  const r0 = -Math.floor((size - 1) / 2), r1 = r0 + size - 1
  const put = (px, py) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return
    data[py * w + px] = color
  }
  for (let dy = r0; dy <= r1; dy++) {
    for (let dx = r0; dx <= r1; dx++) {
      put(x + dx, y + dy)
      if (mirror) put(w - 1 - (x + dx), y + dy)
    }
  }
}

// Bresenham line, calling fn(x, y) for every cell.
export function line(x0, y0, x1, y1, fn) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    fn(x0, y0)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

export function rect(x0, y0, x1, y1, filled, fn) {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)]
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)]
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      if (filled || x === ax || x === bx || y === ay || y === by) fn(x, y)
    }
  }
}

export function ellipse(x0, y0, x1, y1, filled, fn) {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)]
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)]
  const cx = (ax + bx) / 2, cy = (ay + by) / 2
  const rx = (bx - ax) / 2 + 0.5, ry = (by - ay) / 2 + 0.5
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      if (!inside(x, y)) continue
      if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) fn(x, y)
    }
  }
}

export function floodFill(data, w, h, x, y, color) {
  const target = data[y * w + x]
  if (target === color) return
  const stack = [x, y]
  while (stack.length) {
    const py = stack.pop(), px = stack.pop()
    if (px < 0 || py < 0 || px >= w || py >= h) continue
    const i = py * w + px
    if (data[i] !== target) continue
    data[i] = color
    stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1)
  }
}

// Resize keeping the drawing centred.
export function resize(grid, w, h) {
  const data = new Int32Array(w * h).fill(-1)
  const ox = Math.floor((w - grid.w) / 2), oy = Math.floor((h - grid.h) / 2)
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const nx = x + ox, ny = y + oy
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) data[ny * w + nx] = grid.data[y * grid.w + x]
    }
  }
  return { ...grid, w, h, data }
}

export const toHex = (c) => '#' + (c >>> 0 & 0xffffff).toString(16).padStart(6, '0')
export const fromHex = (h) => parseInt(h.replace('#', ''), 16)
