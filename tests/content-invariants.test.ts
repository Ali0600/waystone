import { describe, expect, it } from 'vitest'
import { amberfall } from '../src/content/regions/amberfall'
import { waystation } from '../src/content/regions/waystation'
import { RECRUITS } from '../src/content/recruits'
import type { RegionDef } from '../src/world/region'

/**
 * The design pillars as executable tests. Authoring mistakes fail CI, not
 * playtests. Every region added to the game must join this list.
 */
const REGIONS: RegionDef[] = [amberfall, waystation]

describe.each(REGIONS.map((r) => [r.id, r] as const))('region %s', (_id, region) => {
  const defs = region.discoverables

  it('meets its density budget', () => {
    expect(defs.length).toBeGreaterThanOrEqual(region.minDiscoverables ?? 10)
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
    const [ox, oz] = region.origin
    for (const d of defs) {
      expect(Math.hypot(d.x - ox, d.z - oz), `${d.id} radius`).toBeLessThan(
        region.island.radius * 0.97,
      )
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

describe('cross-region invariants', () => {
  const all = REGIONS.flatMap((r) => r.discoverables)

  it('discoverable ids are unique across the whole world', () => {
    const ids = all.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all six recruits exist as person discoverables', () => {
    const persons = all.filter((d) => d.kind === 'person')
    expect(persons).toHaveLength(6)
    for (const r of RECRUITS) {
      const person = persons.find((p) => p.id === r.personId)
      expect(person, r.personId).toBeDefined()
    }
  })

  it('recruit home spots sit on the Waystation isle', () => {
    const [ox, oz] = waystation.origin
    for (const r of RECRUITS) {
      expect(
        Math.hypot(r.home.x - ox, r.home.z - oz),
        `${r.personId} home`,
      ).toBeLessThan(waystation.island.radius * 0.9)
    }
  })

  it('recruit roles are unique (one structure each)', () => {
    const roles = RECRUITS.map((r) => r.role)
    expect(new Set(roles).size).toBe(roles.length)
  })
})
