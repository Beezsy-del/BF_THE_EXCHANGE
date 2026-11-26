// Curated palettes. Each one regenerates the whole scene, so the composition
// stays the same while the mood changes.

export const PALETTES = {
  sakura: {
    name: 'Sakura Night',
    sky: ['#0a0b20', '#121431', '#1b1d44', '#272957', '#35366a'],
    star: '#eef0ff',
    moon: ['#f5f0dc', '#d9d2b4'],
    halo: '#3a3c78',
    farHills: ['#232551', '#2f3165'],
    mountain: ['#22234a', '#33356a', '#8d8cbd', '#c8c5e6'],
    bush: ['#16172f', '#20234a', '#2c3060'],
    fence: '#101126',
    ground: ['#141529', '#1f2140', '#2b3b63'],
    water: ['#121431', '#0b0c22'],
    waterGlint: '#5b5f9c',
    trunk: ['#24121d', '#4a2231', '#743749', '#94505e'],
    blossom: ['#6e2752', '#a8406f', '#df6e98', '#ffa8c3', '#ffdde9'],
    glow: '#ff5c9a',
    lantern: ['#ffd38f', '#ff9a4d'],
  },
  ember: {
    name: 'Ember Dusk',
    sky: ['#140b1f', '#24112c', '#3c1838', '#622846', '#93434d'],
    star: '#ffe9d6',
    moon: ['#ffe2b8', '#e6b98a'],
    halo: '#7a3348',
    farHills: ['#3a1733', '#4d1f3d'],
    mountain: ['#2b1230', '#3e1b3d', '#a0596a', '#d48c86'],
    bush: ['#1c0c1f', '#2a1229', '#3b1a34'],
    fence: '#150815',
    ground: ['#1a0b18', '#2a1225', '#4a2131'],
    water: ['#1e0e24', '#120818'],
    waterGlint: '#a24f5c',
    trunk: ['#1a0a10', '#3a1518', '#5e2622', '#7e3a2c'],
    blossom: ['#5a151c', '#97291f', '#d3512a', '#f58c45', '#ffd18b'],
    glow: '#ff6a2c',
    lantern: ['#ffe0a0', '#ff8a3a'],
  },
  frost: {
    name: 'Frost Moon',
    sky: ['#050a15', '#0a1426', '#111f38', '#1a2d4d', '#263f63'],
    star: '#f0f7ff',
    moon: ['#f4fbff', '#c9dcec'],
    halo: '#2a4a74',
    farHills: ['#13233f', '#1c3152'],
    mountain: ['#122039', '#1d3253', '#9fb7d6', '#e3eefb'],
    bush: ['#0b1426', '#122039', '#1b2f50'],
    fence: '#080f1d',
    ground: ['#0c1527', '#16243e', '#2a4466'],
    water: ['#0c172b', '#06101f'],
    waterGlint: '#5d85b3',
    trunk: ['#120f1a', '#2a2433', '#433a4d', '#5d5368'],
    blossom: ['#2f4b7a', '#5f84bb', '#9dbfe6', '#d9eaff', '#ffffff'],
    glow: '#7fc4ff',
    lantern: ['#e8f6ff', '#9ad2ff'],
  },
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
