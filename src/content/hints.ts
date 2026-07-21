import type { GameEvents } from '../core/events'

/**
 * Contextual teaching hints — DATA for the M27 signposting pass. Each hint is a
 * short, just-in-time nudge shown once the player is in the situation it teaches
 * and retired the moment they perform the action (research: an over-firing hint
 * that states the obvious erodes trust in the whole channel).
 *
 * Spoiler rule (GAME_PROMPT.md v1: "Do not put [Hidden Arts] in a tooltip";
 * adjacency combos are discovered, never taught): a hint may teach a basic verb,
 * a tool key, or point at a system — but MUST NOT contain a Hidden-Art input
 * sequence or a glyph-combo recipe/name. Enforced by hints.test.ts.
 */

/** The live context a hint's trigger reads. Built each frame in main from the
 *  same handles the prompt chain uses — see HintSystem.update. */
export interface HintContext {
  /** state.mastery.lantern — 0 means the player has never pulsed the lantern. */
  lanternUses: number
  /** Sum of all mastery counters — "has the player used verbs at all". */
  totalVerbUses: number
  /** Any verb at tier ≥ 2 — the first mastery payoff has landed. */
  reachedAnyTier: boolean
  glyphStones: number
  /** No glyph inscribed on the grid yet. */
  gridEmpty: boolean
  /** Standing on the mist sea (Mistwalker floor holding the player). */
  onMist: boolean
  /** A panel owns the screen — suppress hints. */
  uiOpen: boolean
  /** A duel owns the screen — suppress world hints (combat teaches itself). */
  inCombat: boolean
}

export interface HintDef {
  id: string
  text: string
  /** Relevant right now? Going false while shown = the player did the thing. */
  when: (ctx: HintContext) => boolean
  /** Don't consider this hint until the system has run this many seconds
   *  (avoids teaching before the player has settled in). */
  minElapsedSec?: number
  /** Informational one-shot with no "doing" to detect — mark seen after it has
   *  been held long enough, so it teaches once and never nags. */
  showOnce?: boolean
  /** A bus event proving the player did the thing — retire the hint even if it
   *  was never shown (e.g. they inscribed before the scribe hint could fire). */
  retireOn?: keyof GameEvents
}

/** The minimal set (user-chosen) — only the gaps the research flagged as real,
 *  kept small because hint fatigue is the dominant failure mode. */
export const HINTS: HintDef[] = [
  {
    // The core verb has NO acquire toast (it's innate) — the one tool untaught
    // at game start. Retires on the first successful pulse (lanternUses > 0).
    id: 'lantern-pulse',
    text: 'F — pulse the lantern. What the song left latent answers to its light.',
    when: (c) => c.lanternUses === 0,
    minElapsedSec: 10,
  },
  {
    // First blank stone in hand, nothing inscribed — point at the Scribe/grid.
    id: 'stone-scribe',
    text: 'A blank Glyph Stone. Iole the Scribe teaches stones to speak — stand with her at the Waystation and open the grid (G).',
    when: (c) => c.glyphStones >= 1 && c.gridEmpty,
    retireOn: 'glyph:inscribed',
  },
  {
    // "No XP screen" is invisible: nothing tells you verbs level with use.
    id: 'mastery-exists',
    text: 'Your verbs remember. Repetition alone deepens them — there is no training menu.',
    when: (c) => c.totalVerbUses >= 5 && !c.reachedAnyTier,
    showOnce: true,
  },
  {
    // The Mistwalker charge model is untaught beyond the meter turning red.
    id: 'mist-charge',
    text: 'The mist bears your weight only while the charge lasts — reach solid ground to refill it.',
    when: (c) => c.onMist,
    showOnce: true,
  },
]
