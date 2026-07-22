/**
 * Attack Chains (M133 LoD Additions): sequences of timed inputs. Each chain
 * keeps its own use-counter and levels up — more beats, more damage. Your
 * basic attack is a growth track.
 *
 * M35: each beat demands a SPECIFIC key (shown on its marker in the beat bar) —
 * a combo of WASD + Space, not just timing. Pressing any other combo key
 * fumbles the chain. Patterns are AUTHORED per level (memorizable, LoD-style;
 * leveling a chain changes its pattern). Safe key space: movement is frozen in
 * a duel, Hidden Arts use the ARROW keys, and parry stays Space-only.
 */

/** The keys a chain beat may demand (KeyboardEvent.code). */
export const COMBO_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'] as const

export interface ChainLevel {
  /** Beat offsets (seconds from chain start). Press on each beat. */
  beats: number[]
  /** The key each beat demands — same length as `beats` (invariant-tested). */
  keys: string[]
  damagePerBeat: number
}

export interface ChainDef {
  id: string
  name: string
  /** Uses needed for level 2 / level 3. */
  levelAt: [number, number]
  levels: [ChainLevel, ChainLevel, ChainLevel]
  /** Strike mastery tier required to use this chain at all. */
  requiresStrikeTier: 1 | 2 | 3
}

/** Timing window (± seconds) for chain beats and parries. */
export const BEAT_WINDOW = 0.16
export const PARRY_WINDOW = 0.18

export const CHAINS: ChainDef[] = [
  {
    id: 'traveler',
    name: "Traveler's Cadence",
    levelAt: [6, 18],
    requiresStrikeTier: 1,
    levels: [
      // Gentle intro: the first fight teaches the mechanic with one direction.
      { beats: [0.5, 1.1, 1.7], keys: ['Space', 'KeyW', 'Space'], damagePerBeat: 2 },
      { beats: [0.5, 1.1, 1.7, 2.2], keys: ['Space', 'KeyW', 'KeyA', 'Space'], damagePerBeat: 2 },
      {
        beats: [0.5, 1.0, 1.5, 1.9, 2.3],
        keys: ['Space', 'KeyW', 'KeyA', 'KeyD', 'Space'],
        damagePerBeat: 2,
      },
    ],
  },
  {
    id: 'lantern-arc',
    name: 'Lantern Arc',
    levelAt: [5, 14],
    requiresStrikeTier: 2,
    levels: [
      { beats: [0.6, 1.0, 1.4], keys: ['KeyW', 'KeyS', 'Space'], damagePerBeat: 3 },
      { beats: [0.6, 1.0, 1.4, 1.8], keys: ['KeyW', 'KeyS', 'KeyA', 'Space'], damagePerBeat: 3 },
      {
        beats: [0.5, 0.9, 1.3, 1.6, 2.0],
        keys: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'],
        damagePerBeat: 3,
      },
    ],
  },
]

export function chainLevel(def: ChainDef, uses: number): ChainLevel {
  if (uses >= def.levelAt[1]) return def.levels[2]
  if (uses >= def.levelAt[0]) return def.levels[1]
  return def.levels[0]
}

/**
 * Hidden Arts (M145 Legaia): input sequences the game never documents.
 * Unlock permanently on first successful performance. Not in any tooltip —
 * players teach each other these.
 */
export interface ArtDef {
  id: string
  name: string
  sequence: string[] // KeyboardEvent.code order
  damage: number
  /** If set, the enemy's next turn is skipped after this Art lands. */
  stagger?: boolean
}

export const ARTS: ArtDef[] = [
  {
    id: 'emberwake',
    name: 'Emberwake',
    sequence: ['ArrowDown', 'ArrowUp', 'Space'],
    damage: 12,
  },
  {
    id: 'stillpoint',
    name: 'Stillpoint',
    sequence: ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'Space'],
    damage: 16,
  },
  {
    // Taught by Nerei the Angler once you've landed enough from the mist.
    // Not found by input alone — knowledge is the reward, per the others.
    // NB: the tail must not equal a shorter Art's sequence, or the recognizer
    // fires that one first (…ArrowUp,Space would collide with Emberwake).
    id: 'undertow',
    name: 'Undertow',
    sequence: ['ArrowRight', 'ArrowDown', 'ArrowRight', 'Space'],
    damage: 18,
    stagger: true,
  },
]
