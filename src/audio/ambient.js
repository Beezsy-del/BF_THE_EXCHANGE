// A soft generative soundtrack: a slow pad, a breath of wind, and the odd
// chime from a pentatonic scale. Off by default; the page must be clicked first.

const MOODS = {
  calm: { chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], chimes: [74, 76, 78, 81, 83, 86] },
  warm: { chords: [[45, 52, 60, 67], [41, 48, 57, 64], [50, 53, 57, 60], [40, 47, 55, 62]], chimes: [69, 72, 74, 76, 79, 81] },
  cold: { chords: [[52, 59, 68, 75], [49, 56, 64, 71], [45, 52, 59, 68], [47, 54, 63, 70]], chimes: [76, 78, 80, 83, 85, 88] },
}
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12)

export class Ambient {
  constructor() {
    this.on = false
    this.mood = 'calm'
    this.wind = 0.5
  }

  start() {
    if (this.on) return
    const ctx = (this.ctx ??= new (window.AudioContext || window.webkitAudioContext)())
    ctx.resume()
    this.on = true
    const master = (this.master = ctx.createGain())
    master.gain.value = 0
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.5)
    master.connect(ctx.destination)

    // a long, soft reverb from decaying noise
    const verb = ctx.createConvolver()
    const len = ctx.sampleRate * 4
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    }
    verb.buffer = ir
    const wet = ctx.createGain()
    wet.gain.value = 0.6
    verb.connect(wet).connect(master)
    this.verb = verb

    // pad: 4 voices, each two slightly detuned oscillators through a low-pass
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    lp.Q.value = 0.3
    const padGain = ctx.createGain()
    padGain.gain.value = 0.05
    lp.connect(padGain)
    padGain.connect(master)
    padGain.connect(verb)
    this.voices = [0, 1, 2, 3].map(() => {
      const g = ctx.createGain()
      g.gain.value = 0.25
      const a = ctx.createOscillator(), b = ctx.createOscillator()
      a.type = 'sine'; b.type = 'triangle'
      b.detune.value = 7
      a.connect(g); b.connect(g); g.connect(lp)
      a.start(); b.start()
      return { a, b }
    })
    this.chordIndex = 0
    this.setChord(true)
    this.chordTimer = setInterval(() => this.setChord(false), 11000)

    // wind: filtered noise whose level follows the wind slider
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const nd = noise.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 500
    bp.Q.value = 0.6
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.07
    lfoGain.gain.value = 250
    lfo.connect(lfoGain).connect(bp.frequency)
    lfo.start()
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    src.connect(bp).connect(this.windGain).connect(master)
    src.start()
    this.extras = [src, lfo]
    this.setWind(this.wind)

    this.scheduleChime()
  }

  setChord(immediate) {
    if (!this.on) return
    const chords = MOODS[this.mood].chords
    const chord = chords[this.chordIndex++ % chords.length]
    const now = this.ctx.currentTime
    this.voices.forEach((v, i) => {
      const f = freq(chord[i])
      for (const o of [v.a, v.b]) {
        if (immediate) o.frequency.setValueAtTime(f, now)
        else o.frequency.setTargetAtTime(f, now, 2.5) // a slow glide between chords
      }
    })
  }

  scheduleChime() {
    if (!this.on) return
    const wait = 2600 + Math.random() * 5200
    this.chimeTimer = setTimeout(() => { this.chime(); this.scheduleChime() }, wait)
  }

  chime() {
    const ctx = this.ctx, now = ctx.currentTime
    const notes = MOODS[this.mood].chimes
    const f = freq(notes[Math.floor(Math.random() * notes.length)])
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.045, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator()
    o1.frequency.value = f
    o2.frequency.value = f * 2.76 // a bell-like overtone
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    o1.connect(g); o2.connect(g2).connect(g)
    g.connect(this.verb)
    g.connect(this.master)
    o1.start(now); o2.start(now)
    o1.stop(now + 3.4); o2.stop(now + 3.4)
  }

  setWind(w) {
    this.wind = w
    if (this.on) this.windGain.gain.setTargetAtTime(0.012 + Math.min(2, w) * 0.03, this.ctx.currentTime, 1.2)
  }

  setMood(m) {
    if (!MOODS[m] || m === this.mood) return
    this.mood = m
    if (this.on) this.setChord(false)
  }

  stop() {
    if (!this.on) return
    this.on = false
    clearInterval(this.chordTimer)
    clearTimeout(this.chimeTimer)
    const ctx = this.ctx, master = this.master
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.6)
    const voices = this.voices, extras = this.extras
    setTimeout(() => {
      voices.forEach((v) => { v.a.stop(); v.b.stop() })
      extras.forEach((n) => n.stop())
      master.disconnect()
    }, 2500)
  }
}
