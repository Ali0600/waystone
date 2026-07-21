import { describe, expect, it } from 'vitest'
import { treasureModel } from '../src/progression/inventory'
import { createInitialState } from '../src/core/state'
import { amberfall } from '../src/content/regions/amberfall'
import { veilspire } from '../src/content/regions/veilspire'

const REGIONS = [amberfall, veilspire]

/** Look up a discoverable def by id across the test regions. */
function def(id: string) {
  const d = REGIONS.flatMap((r) => r.discoverables).find((x) => x.id === id)
  if (!d) throw new Error(`no such discoverable ${id}`)
  return d
}

describe('treasureModel — the collection record', () => {
  it('records a found cache with its name, isle, and exact yield', () => {
    const s = createInitialState()
    s.discoveries['af-cache-treeline'] = 'found' // "Fallen Courier's Pack", pays ◆10
    const entry = treasureModel(s, REGIONS).find((t) => t.id === 'af-cache-treeline')!
    expect(entry).toBeDefined()
    expect(entry.label).toBe(def('af-cache-treeline').label)
    expect(entry.regionName).toBe('Amberfall Reach')
    expect(entry.yields).toEqual({ lumen: 10, glyphStones: 0, waystones: 0 })
  })

  it('sums a multi-meter guarded find (Lumen + Glyph Stone)', () => {
    const s = createInitialState()
    s.discoveries['vs-guarded-spire-heart'] = 'found' // "Heart of the Spire", ⬡1 + ◆30
    const entry = treasureModel(s, REGIONS).find((t) => t.id === 'vs-guarded-spire-heart')!
    expect(entry.yields).toEqual({ lumen: 30, glyphStones: 1, waystones: 0 })
  })

  it('includes a waystone find and counts the waystone it yielded', () => {
    const s = createInitialState()
    s.discoveries['af-waystone-vault'] = 'found' // "The Waystone", ◎1 + ◆25
    const entry = treasureModel(s, REGIONS).find((t) => t.id === 'af-waystone-vault')!
    expect(entry.yields).toEqual({ lumen: 25, glyphStones: 0, waystones: 1 })
  })

  it('excludes recruits (person) and tool finds — those live elsewhere', () => {
    const s = createInitialState()
    s.discoveries['af-person-scribe'] = 'found' // a recruit
    s.discoveries['af-tool-grapple'] = 'found' // grants a tool
    const ids = treasureModel(s, REGIONS).map((t) => t.id)
    expect(ids).not.toContain('af-person-scribe')
    expect(ids).not.toContain('af-tool-grapple')
  })

  it('lists ONLY found items — never leaks an uncollected label (spoiler gate)', () => {
    const s = createInitialState()
    // Collect exactly one item; everything else is unfound.
    s.discoveries['af-cache-arch'] = 'found'
    const json = JSON.stringify(treasureModel(s, REGIONS))
    for (const d of REGIONS.flatMap((r) => r.discoverables)) {
      if (d.id === 'af-cache-arch') continue
      expect(json.includes(d.label), `unfound label "${d.label}" leaked`).toBe(false)
    }
  })

  it('orders entries by region then authoring order', () => {
    const s = createInitialState()
    s.discoveries['vs-cache-landing'] = 'found' // veilspire (2nd region)
    s.discoveries['af-cache-arch'] = 'found' // amberfall (1st region)
    const ids = treasureModel(s, REGIONS).map((t) => t.id)
    expect(ids).toEqual(['af-cache-arch', 'vs-cache-landing'])
  })

  it('is empty on a fresh save', () => {
    expect(treasureModel(createInitialState(), REGIONS)).toEqual([])
  })
})
