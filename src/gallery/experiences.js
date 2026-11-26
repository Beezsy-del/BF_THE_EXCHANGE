// The gallery: finished experiences, one per kind of art MORPH can make.
// Each opens in the studio that made it, ready to be changed.

import { OCEAN, JELLYFISH, BLOOM, SPIRAL, BLOSSOM_CODE } from './programs.js'

export const EXPERIENCES = [
  {
    key: 'blossom-night', title: 'Blossom Night', category: 'Pixel scene',
    blurb: 'A cherry tree by a moonlit lake. Five formulas move the wind, petals, stars and water.',
    open: { view: 'scene' },
  },
  {
    key: 'ocean', title: 'Ocean Sunset', category: 'Animated landscape',
    blurb: 'Drifting clouds, rolling foam and the sun glittering on the water.',
    open: { view: 'animate', code: OCEAN, motion: 'original' },
  },
  {
    key: 'bloom', title: 'Golden Bloom', category: 'Particle transformation',
    blurb: 'A flower of 2,000 dots that unfurls into golden dust and gathers again.',
    open: { view: 'animate', code: BLOOM, motion: 'original', mode: 'particles' },
  },
  {
    key: 'jellyfish', title: 'Jellyfish', category: 'Living creatures',
    blurb: 'Bells pulse, tentacles trail, plankton glimmers in the deep.',
    open: { view: 'animate', code: JELLYFISH, motion: 'original' },
  },
  {
    key: 'type', title: 'Living Type', category: 'Animated typography',
    blurb: 'Any word becomes pixels, then particles you can scatter.',
    open: { view: 'animate', text: 'MORPH', gradient: 'neon', motion: 'dissolve', mode: 'particles' },
  },
  {
    key: 'silk', title: 'Silk Ribbons', category: 'Dynamic wallpaper',
    blurb: 'Thousands of particles follow a flowing field and leave silky trails.',
    open: { view: 'explore', preset: 'silk' },
  },
  {
    key: 'spiral', title: 'Spectrum Spiral', category: 'Abstract',
    blurb: 'A square spiral that turns one degree too far, breathing colour.',
    open: { view: 'animate', code: SPIRAL, motion: 'original' },
  },
  {
    key: 'marble', title: 'Liquid Marble', category: 'Formula art',
    blurb: 'Noise folded into noise, flowing like ink in water.',
    open: { view: 'explore', preset: 'marble' },
  },
  {
    key: 'tree', title: 'Code Blossom', category: 'Drawn with code',
    blurb: 'The cherry tree as a 60-line program. Open it in Draw and change anything.',
    open: { view: 'animate', code: BLOSSOM_CODE, motion: 'original' },
  },
]
