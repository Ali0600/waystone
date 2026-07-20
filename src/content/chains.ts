/**
 * Attack Chains (M133 LoD Additions): sequences of timed inputs. Each chain
 * keeps its own use-counter and levels up — more beats, more damage. Your
 * basic attack is a growth track.
 */
export interface ChainLevel {
  /** Beat offsets (seconds from chain start). Press on each beat. */
  beats: number[]
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
      { beats: [0.5, 1.1, 1.7], damagePerBeat: 2 },
      { beats: [0.5, 1.1, 1.7, 2.2], damagePerBeat: 2 },
      { beats: [0.5, 1.0, 1.5, 1.9, 2.3], damagePerBeat: 2 },
    ],
  },
  {
    id: 'lantern-arc',
    name: 'Lantern Arc',
    levelAt: [5, 14],
    requiresStrikeTier: 2,
    levels: [
      { beats: [0.6, 1.0, 1.4], damagePerBeat: 3 },
      { beats: [0.6, 1.0, 1.4, 1.8], damagePerBeat: 3 },
      { beats: [0.5, 0.9, 1.3, 1.6, 2.0], damagePerBeat: 3 },
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
