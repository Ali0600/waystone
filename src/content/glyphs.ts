/**
 * The six inscribable glyphs and the adjacency combos (v1 §4B). Blank Glyph
 * Stones are finite world finds; inscribing one into the 4×4 grid is
 * permanent (until the re-inscription hub upgrade). Neighbouring glyphs can
 * fuse — discovering a good adjacency IS a reward, so combos are not listed
 * in any tooltip.
 */
export type GlyphId = 'ember' | 'gale' | 'stone' | 'tide' | 'light' | 'shade'

export const GLYPH_IDS: readonly GlyphId[] = [
  'ember',
  'gale',
  'stone',
  'tide',
  'light',
  'shade',
]

export interface GlyphDef {
  id: GlyphId
  name: string
  color: string
  rune: string
  desc: string
}

export const GLYPHS: Record<GlyphId, GlyphDef> = {
  ember: {
    id: 'ember',
    name: 'Ember',
    color: '#e06a45',
    rune: '᛭',
    desc: 'A note of heat. Burns what stands before you.',
  },
  gale: {
    id: 'gale',
    name: 'Gale',
    color: '#8fd0d8',
    rune: 'ᚴ',
    desc: 'A note of motion. Strikes twice, lightly.',
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    color: '#c2a24e',
    rune: 'ᚼ',
    desc: 'A note of weight. Slow, and very heavy.',
  },
  tide: {
    id: 'tide',
    name: 'Tide',
    color: '#5f8ac6',
    rune: 'ᛟ',
    desc: 'A note of change. Washes enemy footing away.',
  },
  light: {
    id: 'light',
    name: 'Light',
    color: '#efd98a',
    rune: 'ᛝ',
    desc: 'A note of clarity. Reveals and sears.',
  },
  shade: {
    id: 'shade',
    name: 'Shade',
    color: '#8a6fae',
    rune: 'ᛉ',
    desc: 'A note of rest. Quiets what it touches.',
  },
}

export interface ComboDef {
  id: string
  name: string
  color: string
  rune: string
  /** Unordered ingredient pair. */
  pair: [GlyphId, GlyphId]
  desc: string
}

export const COMBOS: ComboDef[] = [
  {
    id: 'levin',
    name: 'Levin',
    color: '#c8e8ff',
    rune: 'ᚦ',
    pair: ['ember', 'gale'],
    desc: 'Heat and motion fuse into lightning.',
  },
  {
    id: 'bloom',
    name: 'Bloom',
    color: '#8fc87a',
    rune: 'ᛒ',
    pair: ['stone', 'tide'],
    desc: 'Weight and change fuse into rampant growth.',
  },
]
