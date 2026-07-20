import { describe, expect, it } from 'vitest'
import { STARTER_CARDS } from '../src/content/cards.schema'
import { ENEMIES } from '../src/content/enemies'
import { RECRUITS } from '../src/content/recruits'
import { amberfall } from '../src/content/regions/amberfall'
import { veilspire } from '../src/content/regions/veilspire'
import { waystation } from '../src/content/regions/waystation'

/**
 * The deck game is Phase 2, but its data model ships now (v1 §8) — and a
 * card must always depict something the player can actually encounter.
 */
describe('card schema references', () => {
  const regionIds = new Set([amberfall, waystation, veilspire].map((r) => r.id))

  it('cards have unique ids and positive stats', () => {
    const ids = STARTER_CARDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of STARTER_CARDS) {
      expect(c.power, c.id).toBeGreaterThan(0)
      expect(c.cost, c.id).toBeGreaterThan(0)
      expect(c.flavor.length, c.id).toBeGreaterThan(4)
    }
  })

  it('every card depicts a real encountered entity', () => {
    for (const c of STARTER_CARDS) {
      const s = c.subject
      if (s.type === 'enemy') {
        expect(ENEMIES[s.enemyId], c.id).toBeDefined()
      } else if (s.type === 'recruit') {
        expect(
          RECRUITS.some((r) => r.personId === s.personId),
          c.id,
        ).toBe(true)
      } else if (s.type === 'region') {
        expect(regionIds.has(s.regionId), c.id).toBe(true)
      }
    }
  })
})
