import type { GameState } from '../core/state'
import {
  VERB_IDS,
  TIER_THRESHOLDS,
  TIER_PROPERTIES,
  tierOf,
  type VerbId,
} from './mastery'
import { CHAINS, ARTS } from '../content/chains'
import { GLYPH_IDS, GLYPHS, COMBOS } from '../content/glyphs'
import { TOOL_IDS, TOOL_INFO } from '../content/tools'

/**
 * The Attunement model (M30) — a pure, unit-testable view of ALL progression:
 * verb tiers, combat chains, tools, glyph use, Hidden Arts and Resonances. The
 * `ui/attunement.ts` panel renders this LoD-Additions-chart style; it owns no
 * data logic.
 *
 * Knowledge-as-reward is preserved by masking (the guide.ts precedent): an
 * unearned tier property, a locked chain, an unowned tool, an unlearned Art or
 * undiscovered Resonance carry NO name/label/sequence — the UI shows `???`. The
 * spoiler gate is pinned by attunement.test.ts (a serialized model must not
 * contain any unearned name/property/sequence).
 */

/** A step toward the next level/tier — a LoD "Next LV" counter. */
export interface NextStep {
  /** The use count at which the next level/tier lands. */
  atUses: number
  /** How many more uses to get there. */
  toGo: number
}

export interface VerbAttune {
  id: VerbId
  /** Capitalised verb ("Strike"). Always shown — the verbs themselves are known. */
  name: string
  tier: 1 | 2 | 3
  uses: number
  /** Uses toward the next tier, or null when maxed (tier 3). */
  next: NextStep | null
  /** Tier-2 then tier-3 property; `label` is null until that tier is EARNED. */
  properties: { tier: 2 | 3; label: string | null }[]
}

export interface ChainAttune {
  /** Whether the player's strike tier has unlocked this chain at all. */
  known: boolean
  /** The chain's name, or null while it's still locked (rendered `???`). */
  name: string | null
  requiresStrikeTier: 1 | 2 | 3
  level: 1 | 2 | 3
  uses: number
  next: NextStep | null
  /** Beats at the current level (LoD "hits"). */
  hits: number
  dmgPerBeat: number
}

export interface ToolAttune {
  owned: boolean
  /** Name/key/desc only when owned — unowned tools stay `???`. */
  name: string | null
  key: string | null
  desc: string | null
}

export interface GlyphAttune {
  id: string
  name: string
  rune: string
  color: string
  uses: number
}

export interface AttunementModel {
  verbs: VerbAttune[]
  chains: ChainAttune[]
  tools: ToolAttune[]
  glyphs: GlyphAttune[]
  /** Learned Art NAMES only — never their input sequences. */
  arts: { total: number; learned: { name: string }[] }
  fusions: { total: number; discovered: { rune: string; name: string; color: string }[] }
}

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`

/** The next unreached threshold in an ascending pair, or null if past both. */
function nextThreshold(uses: number, thresholds: [number, number]): NextStep | null {
  for (const at of thresholds) {
    if (uses < at) return { atUses: at, toGo: at - uses }
  }
  return null
}

function verbAttune(state: GameState, id: VerbId): VerbAttune {
  const uses = state.mastery[id]
  const [t2, t3] = TIER_THRESHOLDS[id]
  const [p2, p3] = TIER_PROPERTIES[id]
  return {
    id,
    name: cap(id),
    tier: tierOf(id, uses),
    uses,
    next: nextThreshold(uses, [t2, t3]),
    properties: [
      { tier: 2, label: uses >= t2 ? p2 : null },
      { tier: 3, label: uses >= t3 ? p3 : null },
    ],
  }
}

function chainAttune(state: GameState, def: (typeof CHAINS)[number]): ChainAttune {
  const strikeTier = tierOf('strike', state.mastery.strike)
  const known = strikeTier >= def.requiresStrikeTier
  const uses = state.chainUses[def.id] ?? 0
  const [l2, l3] = def.levelAt
  const level: 1 | 2 | 3 = uses >= l3 ? 3 : uses >= l2 ? 2 : 1
  const cur = def.levels[level - 1]
  return {
    known,
    name: known ? def.name : null,
    requiresStrikeTier: def.requiresStrikeTier,
    level,
    uses,
    next: nextThreshold(uses, [l2, l3]),
    hits: cur.beats.length,
    dmgPerBeat: cur.damagePerBeat,
  }
}

export function attunementModel(state: GameState): AttunementModel {
  return {
    verbs: VERB_IDS.map((id) => verbAttune(state, id)),
    chains: CHAINS.map((def) => chainAttune(state, def)),
    tools: TOOL_IDS.map((id) => {
      // The Lantern is innate; the other five flip a `state.tools` flag.
      const owned = id === 'lantern' ? true : state.tools[id]
      const info = TOOL_INFO[id]
      return {
        owned,
        name: owned ? info.name : null,
        key: owned ? info.key : null,
        desc: owned ? info.desc : null,
      }
    }),
    glyphs: GLYPH_IDS.map((id) => {
      const g = GLYPHS[id]
      return { id, name: g.name, rune: g.rune, color: g.color, uses: state.glyphUses[id] ?? 0 }
    }),
    arts: {
      total: ARTS.length,
      learned: ARTS.filter((a) => state.artsUnlocked.includes(a.id)).map((a) => ({ name: a.name })),
    },
    fusions: {
      total: COMBOS.length,
      discovered: COMBOS.filter((c) => state.combosDiscovered.includes(c.id)).map((c) => ({
        rune: c.rune,
        name: c.name,
        color: c.color,
      })),
    },
  }
}
