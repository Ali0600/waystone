import { describe, expect, it } from 'vitest'
import { ALL_CARDS, STARTER_CARDS } from '../src/content/cards.schema'
import { ENEMIES } from '../src/content/enemies'
import { RECRUITS } from '../src/content/recruits'
import { amberfall } from '../src/content/regions/amberfall'
import { cindervault } from '../src/content/regions/cindervault'
import { palegrove } from '../src/content/regions/palegrove'
import { thornmere } from '../src/content/regions/thornmere'
import { veilspire } from '../src/content/regions/veilspire'
import { waystation } from '../src/content/regions/waystation'

/**
 * A card must always depict something the player can actually encounter, and —
 * the pillar that makes the deck a record of exploration — EVERY encounterable
 * entity must have at least one card.
 */
describe('card library references', () => {
  const regionIds = new Set(
    [amberfall, waystation, veilspire, cindervault, palegrove, thornmere].map((r) => r.id),
  )

  it('cards have unique ids and positive stats', () => {
    const ids = ALL_CARDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of ALL_CARDS) {
      expect(c.power, c.id).toBeGreaterThan(0)
      expect(c.cost, c.id).toBeGreaterThan(0)
      expect(c.flavor.length, c.id).toBeGreaterThan(4)
    }
  })

  it('every card depicts a real encountered entity', () => {
    for (const c of ALL_CARDS) {
      const s = c.subject
      if (s.type === 'enemy') {
        expect(ENEMIES[s.enemyId], c.id).toBeDefined()
      } else if (s.type === 'recruit') {
        expect(RECRUITS.some((r) => r.personId === s.personId), c.id).toBe(true)
      } else if (s.type === 'region') {
        expect(regionIds.has(s.regionId), c.id).toBe(true)
      } else if (s.type === 'landmark') {
        expect(regionIds.has(s.regionId), c.id).toBe(true)
      }
    }
  })

  it('every enemy, recruit, and region has at least one card', () => {
    for (const id of Object.keys(ENEMIES)) {
      expect(
        ALL_CARDS.some((c) => c.subject.type === 'enemy' && c.subject.enemyId === id),
        `enemy ${id}`,
      ).toBe(true)
    }
    for (const r of RECRUITS) {
      expect(
        ALL_CARDS.some((c) => c.subject.type === 'recruit' && c.subject.personId === r.personId),
        `recruit ${r.personId}`,
      ).toBe(true)
    }
    for (const id of regionIds) {
      expect(
        ALL_CARDS.some((c) => c.subject.type === 'region' && c.subject.regionId === id),
        `region ${id}`,
      ).toBe(true)
    }
  })

  it('the starter deck is eight real cards', () => {
    expect(STARTER_CARDS).toHaveLength(8)
    for (const c of STARTER_CARDS) {
      expect(ALL_CARDS.includes(c), c?.id).toBe(true)
    }
  })
})
