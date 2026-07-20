import type { GameState } from '../core/state'
import type { RegionDef } from '../world/region'
import type { BountyDef, BountyReward } from '../content/bounties'
import { tierOf } from './mastery'

/**
 * Pure Reward-Board evaluator. Progress per check kind, and a claim that pays
 * exactly once. Region-complete needs the region defs (to count discoverables),
 * so they're passed in rather than imported — keeps this decoupled + testable.
 */

export interface BountyProgress {
  current: number
  target: number
  done: boolean
}

export function bountyProgress(
  state: GameState,
  def: BountyDef,
  regions: RegionDef[],
): BountyProgress {
  const c = def.check
  const clampDone = (current: number, target: number): BountyProgress => ({
    current: Math.min(current, target),
    target,
    done: current >= target,
  })
  switch (c.kind) {
    case 'region-complete': {
      const region = regions.find((r) => r.id === c.regionId)
      const defs = region?.discoverables ?? []
      const found = defs.filter((d) => state.discoveries[d.id] === 'found').length
      return { current: found, target: defs.length, done: defs.length > 0 && found >= defs.length }
    }
    case 'felled':
      return clampDone(state.enemiesFelled[c.enemyId] ?? 0, c.count)
    case 'angling-points':
      return clampDone(state.anglingPoints, c.points)
    case 'card-wins':
      return clampDone(
        Object.values(state.cardWins).reduce((s, n) => s + n, 0),
        c.count,
      )
    case 'mastery': {
      const tier = tierOf(c.verb, state.mastery[c.verb])
      return { current: tier, target: c.tier, done: tier >= c.tier }
    }
    case 'arts':
      return clampDone(state.artsUnlocked.length, c.count)
    case 'regions-manifested':
      return clampDone(state.regionsManifested.length, c.count)
  }
}

/**
 * Claim a bounty: pay its reward once. Returns the reward, or null if it was
 * already claimed or isn't complete.
 */
export function claimBounty(
  state: GameState,
  def: BountyDef,
  regions: RegionDef[],
): BountyReward | null {
  if (state.bountiesClaimed.includes(def.id)) return null
  if (!bountyProgress(state, def, regions).done) return null
  state.bountiesClaimed.push(def.id)
  state.lumen += def.reward.lumen
  if (def.reward.glyphStones) state.glyphStones += def.reward.glyphStones
  if (def.reward.cardId && !state.cardsOwned.includes(def.reward.cardId)) {
    state.cardsOwned.push(def.reward.cardId)
  }
  return def.reward
}
