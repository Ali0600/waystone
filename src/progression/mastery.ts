import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'

/**
 * Use-Based Mastery — the spine (v1 §4A). Every verb has a hidden counter;
 * tiers grant new PROPERTIES, not numbers. No XP screen: the world is the
 * trainer.
 */
export type VerbId = 'strike' | 'parry' | 'dash' | 'grapple' | 'lantern'

export const VERB_IDS: readonly VerbId[] = ['strike', 'parry', 'dash', 'grapple', 'lantern']

/** Uses required to reach tier 2 / tier 3. */
export const TIER_THRESHOLDS: Record<VerbId, [number, number]> = {
  strike: [12, 36],
  parry: [8, 24],
  dash: [15, 40],
  grapple: [10, 28],
  lantern: [8, 22],
}

/** What each tier unlocks — shown on tier-up, used for gating. */
export const TIER_PROPERTIES: Record<VerbId, [string, string]> = {
  strike: ['longer chains', 'chain finishers'],
  parry: ['reflect projectiles', 'break enemy Locks'],
  dash: ['longer dash', 'air dash'],
  grapple: ['pull objects', 'mid-air re-grapple'],
  lantern: ['latent paths shimmer', 'buried caches call out'],
}

export function tierOf(verb: VerbId, uses: number): 1 | 2 | 3 {
  const [t2, t3] = TIER_THRESHOLDS[verb]
  if (uses >= t3) return 3
  if (uses >= t2) return 2
  return 1
}

export class MasterySystem {
  constructor(
    private state: GameState,
    private bus: EventBus,
  ) {}

  tier(verb: VerbId): 1 | 2 | 3 {
    return tierOf(verb, this.state.mastery[verb])
  }

  uses(verb: VerbId): number {
    return this.state.mastery[verb]
  }

  /** Count one use; announces a tier-up when a threshold is crossed. */
  record(verb: VerbId): void {
    const before = this.tier(verb)
    this.state.mastery[verb] += 1
    const after = this.tier(verb)
    if (after > before) {
      this.bus.emit('mastery:tier', { verb, tier: after })
      const property = TIER_PROPERTIES[verb][after - 2]
      this.bus.emit('toast', {
        text: `${verb[0].toUpperCase()}${verb.slice(1)} attuned — Tier ${after}: ${property}`,
        flavor: 'reward',
      })
    }
  }
}
