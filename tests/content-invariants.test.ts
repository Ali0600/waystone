import { describe, expect, it } from 'vitest'
import { amberfall } from '../src/content/regions/amberfall'
import type { RegionDef } from '../src/world/region'

/**
 * The design pillars as executable tests. Authoring mistakes fail CI, not
 * playtests. Every region added to the game must join this list.
 */
const REGIONS: RegionDef[] = [amberfall]

describe.each(REGIONS.map((r) => [r.id, r] as const))('region %s', (_id, region) => {
  const defs = region.discoverables

  it('meets the density budget (~12 discoverables)', () => {
    expect(defs.length).toBeGreaterThanOrEqual(10)
  })

  it('has unique discoverable ids', () => {
    const ids = defs.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every discoverable pays at least 2 meters (layered rewards)', () => {
    for (const d of defs) {
      expect(d.payouts.length, `${d.id} payouts`).toBeGreaterThanOrEqual(2)
      const meters = new Set(d.payouts.map((p) => p.meter))
      expect(meters.size, `${d.id} distinct meters`).toBeGreaterThanOrEqual(2)
    }
  })

  it('every discoverable has a cue (no unhinted secrets)', () => {
    for (const d of defs) {
      expect(d.cue.trim().length, `${d.id} cue`).toBeGreaterThan(6)
    }
  })

  it('has at least 3 unreachable-on-first-visit discoverables (reasons to return)', () => {
    const locked = defs.filter((d) => d.prereq !== 'none')
    expect(locked.length).toBeGreaterThanOrEqual(3)
  })

  it('guarantees at least one Glyph Stone (guaranteed-payout rule)', () => {
    const stones = defs.filter((d) => d.payouts.some((p) => p.meter === 'glyphstone'))
    expect(stones.length).toBeGreaterThanOrEqual(1)
  })

  it('guarantees at least one buried Sounding cache (guaranteed-payout rule)', () => {
    expect(defs.filter((d) => d.kind === 'buried').length).toBeGreaterThanOrEqual(1)
  })

  it('positions all discoverables inside the island', () => {
    for (const d of defs) {
      expect(Math.hypot(d.x, d.z), `${d.id} radius`).toBeLessThan(region.island.radius * 0.97)
    }
  })

  it('positive payout amounts only', () => {
    for (const d of defs) {
      for (const p of d.payouts) {
        expect(p.amount, `${d.id} ${p.meter}`).toBeGreaterThan(0)
      }
    }
  })
})
