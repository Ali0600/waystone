import { describe, expect, it } from 'vitest'
import { guideModel, guidePercent } from '../src/progression/guide'
import { createInitialState } from '../src/core/state'
import { amberfall } from '../src/content/regions/amberfall'
import { veilspire } from '../src/content/regions/veilspire'
import { ARTS } from '../src/content/chains'
import { COMBOS } from '../src/content/glyphs'

const REGIONS = [amberfall, veilspire]
// amberfall is non-latent (manifested from boot); veilspire is latent.
const manifested = (id: string) => id === 'amberfall'

describe('guideModel — the spoiler gate', () => {
  it('surfaces remaining discoverables by CUE, and never leaks a label', () => {
    const model = guideModel(createInitialState(), REGIONS, manifested)
    const amber = model.regions.find((r) => r.id === 'amberfall')!

    // Every unfound discoverable is present by its in-game cue…
    const cues = new Set(amber.remaining.map((r) => r.cue))
    for (const d of amberfall.discoverables) {
      expect(cues.has(d.cue), `cue for ${d.id}`).toBe(true)
    }
    // …and NO discoverable's name leaks anywhere in the serialized guide.
    const json = JSON.stringify(model)
    for (const d of amberfall.discoverables) {
      expect(json.includes(d.label), `label "${d.label}" leaked`).toBe(false)
    }
    // remaining entries carry only kind/cue/status — no id, no label field.
    for (const r of amber.remaining) {
      expect(Object.keys(r).sort()).toEqual(['cue', 'kind', 'status'])
    }
  })

  it('masks latent isles — no name, no counts, no remaining, no name leak', () => {
    const model = guideModel(createInitialState(), REGIONS, manifested)
    const veil = model.regions.find((r) => r.id === 'veilspire')!
    expect(veil.latent).toBe(true)
    expect(veil.name).toBeNull()
    expect(veil.total).toBe(0)
    expect(veil.remaining).toEqual([])
    expect(JSON.stringify(model).includes(veilspire.name), 'latent name leaked').toBe(false)
  })
})

describe('guideModel — counts & statuses', () => {
  it('counts found vs total per manifested region', () => {
    const s = createInitialState()
    s.discoveries[amberfall.discoverables[0].id] = 'found'
    s.discoveries[amberfall.discoverables[1].id] = 'found'
    const amber = guideModel(s, REGIONS, manifested).regions.find((r) => r.id === 'amberfall')!
    expect(amber.found).toBe(2)
    expect(amber.total).toBe(amberfall.discoverables.length)
    expect(amber.remaining).toHaveLength(amberfall.discoverables.length - 2)
  })

  it('maps revealed→ready, pinned→pinned, absent→unseen', () => {
    const s = createInitialState()
    s.discoveries[amberfall.discoverables[0].id] = 'revealed'
    s.discoveries[amberfall.discoverables[1].id] = 'pinned'
    const amber = guideModel(s, REGIONS, manifested).regions.find((r) => r.id === 'amberfall')!
    expect(amber.remaining.filter((r) => r.status === 'ready')).toHaveLength(1)
    expect(amber.remaining.filter((r) => r.status === 'pinned')).toHaveLength(1)
    expect(amber.remaining.filter((r) => r.status === 'unseen')).toHaveLength(
      amberfall.discoverables.length - 2,
    )
  })

  it('aggregates categories; latent isle counts toward isles total only', () => {
    const model = guideModel(createInitialState(), REGIONS, manifested)
    expect(model.arts).toEqual({ current: 0, total: ARTS.length })
    expect(model.fusions).toEqual({ current: 0, total: COMBOS.length })
    expect(model.isles).toEqual({ current: 1, total: 2 })
    expect(model.people.total).toBeGreaterThan(0)
    // overall never counts a latent region's (unknown) discoverables.
    expect(model.overall.total).toBeGreaterThan(0)
  })

  it('guidePercent rounds and guards a zero total', () => {
    expect(guidePercent({ current: 0, total: 0 })).toBe(0)
    expect(guidePercent({ current: 1, total: 4 })).toBe(25)
    expect(guidePercent({ current: 2, total: 3 })).toBe(67)
  })
})
