import { describe, expect, it } from 'vitest'
import { createInitialState, parseGameState, type GameState } from '../src/core/state'
import { BOUNTIES, type BountyDef } from '../src/content/bounties'
import { bountyProgress, claimBounty } from '../src/progression/bounties'
import { ALL_CARDS } from '../src/content/cards.schema'
import { ENEMIES } from '../src/content/enemies'
import { amberfall } from '../src/content/regions/amberfall'
import { waystation } from '../src/content/regions/waystation'
import { veilspire } from '../src/content/regions/veilspire'
import { cindervault } from '../src/content/regions/cindervault'
import { palegrove } from '../src/content/regions/palegrove'
import { thornmere } from '../src/content/regions/thornmere'
import { TIER_THRESHOLDS } from '../src/progression/mastery'
import type { RegionDef } from '../src/world/region'

const REGIONS: RegionDef[] = [amberfall, waystation, veilspire, cindervault, palegrove, thornmere]

function bountyById(id: string): BountyDef {
  const b = BOUNTIES.find((x) => x.id === id)
  if (!b) throw new Error(`no bounty ${id}`)
  return b
}

describe('bountyProgress', () => {
  it('felled counts up to the target and marks done', () => {
    const s = createInitialState()
    const def = bountyById('bnt-fell-thorn') // felled thorn-husk × 2
    expect(bountyProgress(s, def, REGIONS)).toEqual({ current: 0, target: 2, done: false })
    s.enemiesFelled['thorn-husk'] = 1
    expect(bountyProgress(s, def, REGIONS).done).toBe(false)
    s.enemiesFelled['thorn-husk'] = 3 // over-count clamps in display, still done
    expect(bountyProgress(s, def, REGIONS)).toEqual({ current: 2, target: 2, done: true })
  })

  it('region-complete tracks found vs total discoverables', () => {
    const s = createInitialState()
    const def = bountyById('bnt-amberfall-whole')
    const total = amberfall.discoverables.length
    expect(bountyProgress(s, def, REGIONS)).toEqual({ current: 0, target: total, done: false })
    for (const d of amberfall.discoverables) s.discoveries[d.id] = 'found'
    expect(bountyProgress(s, def, REGIONS)).toEqual({ current: total, target: total, done: true })
  })

  it('mastery reads the verb tier', () => {
    const s = createInitialState()
    const def = bountyById('bnt-strike-master') // strike tier 3
    expect(bountyProgress(s, def, REGIONS).done).toBe(false)
    s.mastery.strike = TIER_THRESHOLDS.strike[1] // tier 3 threshold
    expect(bountyProgress(s, def, REGIONS).done).toBe(true)
  })

  it('card-wins sums across opponents; regions-manifested counts the set', () => {
    const s = createInitialState()
    s.cardWins = { a: 2, b: 3 }
    expect(bountyProgress(s, bountyById('bnt-card-champ'), REGIONS).done).toBe(true) // ≥5
    s.regionsManifested = ['veilspire', 'cindervault', 'palegrove']
    expect(bountyProgress(s, bountyById('bnt-three-isles'), REGIONS).done).toBe(true) // ≥3
  })
})

describe('claimBounty', () => {
  it('pays lumen + stones + card once, and refuses a second claim', () => {
    const s = createInitialState()
    const def = bountyById('bnt-angler-30') // angling 30 → lumen 35 + card-nerei
    s.anglingPoints = 30
    const r1 = claimBounty(s, def, REGIONS)
    expect(r1).not.toBeNull()
    expect(s.lumen).toBe(35)
    expect(s.cardsOwned).toContain('card-nerei')
    expect(s.bountiesClaimed).toContain(def.id)
    // Second claim: nothing.
    expect(claimBounty(s, def, REGIONS)).toBeNull()
    expect(s.lumen).toBe(35)
  })

  it('refuses to pay an incomplete bounty', () => {
    const s = createInitialState()
    const def = bountyById('bnt-strike-master')
    expect(claimBounty(s, def, REGIONS)).toBeNull()
    expect(s.lumen).toBe(0)
    expect(s.bountiesClaimed).toEqual([])
  })
})

describe('bounty content invariants', () => {
  it('has unique ids and positive rewards', () => {
    const ids = BOUNTIES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of BOUNTIES) {
      expect(b.reward.lumen, b.id).toBeGreaterThan(0)
      expect(b.flavor.length, b.id).toBeGreaterThan(4)
    }
  })

  it('every referenced region, enemy, and card resolves', () => {
    const regionIds = new Set(REGIONS.map((r) => r.id))
    const cardIds = new Set(ALL_CARDS.map((c) => c.id))
    for (const b of BOUNTIES) {
      if (b.check.kind === 'region-complete') {
        expect(regionIds.has(b.check.regionId), b.id).toBe(true)
      }
      if (b.check.kind === 'felled') {
        expect(ENEMIES[b.check.enemyId], b.id).toBeDefined()
      }
      if (b.reward.cardId) {
        expect(cardIds.has(b.reward.cardId), b.id).toBe(true)
      }
    }
  })
})

describe('save v12 → v13 migration', () => {
  it('defaults bountiesClaimed to empty', () => {
    const v12 = JSON.stringify({ ...createInitialState(), version: 12, bountiesClaimed: undefined })
    const parsed = parseGameState(v12) as GameState | null
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(createInitialState().version)
    expect(parsed!.bountiesClaimed).toEqual([])
  })
})
