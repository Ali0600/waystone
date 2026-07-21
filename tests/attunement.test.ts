import { describe, expect, it } from 'vitest'
import { attunementModel } from '../src/progression/attunement'
import { createInitialState, type GameState } from '../src/core/state'
import { TIER_THRESHOLDS, TIER_PROPERTIES } from '../src/progression/mastery'

const verb = (m: ReturnType<typeof attunementModel>, id: string) =>
  m.verbs.find((v) => v.id === id)!
const chain = (m: ReturnType<typeof attunementModel>, i: number) => m.chains[i]

function state(mut?: (s: GameState) => void): GameState {
  const s = createInitialState()
  mut?.(s)
  return s
}

describe('attunementModel — verb tiers', () => {
  it('reports tier, uses, and the next-tier counter at the boundaries', () => {
    const [t2, t3] = TIER_THRESHOLDS.strike // [12, 36]
    // Just below tier 2.
    let v = verb(attunementModel(state((s) => (s.mastery.strike = t2 - 1))), 'strike')
    expect(v.tier).toBe(1)
    expect(v.next).toEqual({ atUses: t2, toGo: 1 })

    // Exactly tier 2 → next points at tier 3.
    v = verb(attunementModel(state((s) => (s.mastery.strike = t2))), 'strike')
    expect(v.tier).toBe(2)
    expect(v.next).toEqual({ atUses: t3, toGo: t3 - t2 })

    // Maxed → no next.
    v = verb(attunementModel(state((s) => (s.mastery.strike = t3))), 'strike')
    expect(v.tier).toBe(3)
    expect(v.next).toBeNull()
  })

  it('reveals a tier property only once it is earned (spoiler gate)', () => {
    const [t2] = TIER_THRESHOLDS.parry
    const [p2, p3] = TIER_PROPERTIES.parry
    // Tier 1: both properties masked.
    let v = verb(attunementModel(state()), 'parry')
    expect(v.properties).toEqual([
      { tier: 2, label: null },
      { tier: 3, label: null },
    ])
    // Tier 2: the tier-2 property is named, tier-3 still masked.
    v = verb(attunementModel(state((s) => (s.mastery.parry = t2))), 'parry')
    expect(v.properties[0].label).toBe(p2)
    expect(v.properties[1].label).toBeNull()
    void p3
  })
})

describe('attunementModel — chains level with use', () => {
  it('reports level, hits (3→4→5), and the next-level counter', () => {
    // traveler: levelAt [6, 18], beats 3/4/5.
    let c = chain(attunementModel(state((s) => (s.chainUses.traveler = 5))), 0)
    expect(c.name).toBe("Traveler's Cadence")
    expect(c.level).toBe(1)
    expect(c.hits).toBe(3)
    expect(c.next).toEqual({ atUses: 6, toGo: 1 })

    c = chain(attunementModel(state((s) => (s.chainUses.traveler = 6))), 0)
    expect(c.level).toBe(2)
    expect(c.hits).toBe(4)
    expect(c.next).toEqual({ atUses: 18, toGo: 12 })

    c = chain(attunementModel(state((s) => (s.chainUses.traveler = 18))), 0)
    expect(c.level).toBe(3)
    expect(c.hits).toBe(5)
    expect(c.next).toBeNull()
  })

  it('masks a chain locked behind a higher strike tier', () => {
    // lantern-arc requires strike tier 2.
    let c = chain(attunementModel(state()), 1) // fresh → strike tier 1
    expect(c.known).toBe(false)
    expect(c.name).toBeNull()
    c = chain(attunementModel(state((s) => (s.mastery.strike = TIER_THRESHOLDS.strike[0]))), 1)
    expect(c.known).toBe(true)
    expect(c.name).toBe('Lantern Arc')
  })
})

describe('attunementModel — tools, glyphs, arts, fusions', () => {
  it('names owned tools (lantern innate), masks unowned', () => {
    const m = attunementModel(state((s) => (s.tools.grapple = true)))
    const owned = m.tools.filter((t) => t.owned).map((t) => t.name)
    expect(owned).toContain('The Lantern') // innate
    expect(owned).toContain('The Surveyor’s Grapple')
    // The four still-unfound tools are masked.
    expect(m.tools.filter((t) => !t.owned).every((t) => t.name === null)).toBe(true)
    expect(m.tools.filter((t) => t.owned).length).toBe(2)
  })

  it('passes through per-glyph use counts and every glyph name (public)', () => {
    const m = attunementModel(state((s) => (s.glyphUses.ember = 7)))
    expect(m.glyphs).toHaveLength(6)
    expect(m.glyphs.find((g) => g.id === 'ember')!.uses).toBe(7)
  })

  it('lists learned Art NAMES only, and discovered Resonances', () => {
    const m = attunementModel(
      state((s) => {
        s.artsUnlocked.push('emberwake')
        s.combosDiscovered.push('levin')
      }),
    )
    expect(m.arts.total).toBe(3)
    expect(m.arts.learned).toEqual([{ name: 'Emberwake' }])
    expect(m.fusions.discovered.map((f) => f.name)).toEqual(['Levin'])
  })
})

describe('attunementModel — the serialized model never spoils', () => {
  it('a fresh save leaks no unearned property, locked chain, unowned tool, or Art sequence', () => {
    const json = JSON.stringify(attunementModel(createInitialState()))
    // No unearned tier property (all verbs start tier 1).
    for (const id of ['strike', 'parry', 'dash', 'grapple', 'lantern'] as const) {
      for (const p of TIER_PROPERTIES[id]) {
        expect(json.includes(p), `leaks unearned property "${p}"`).toBe(false)
      }
    }
    // No locked-chain name, no unfound-tool name. (The word "Grapple" is the
    // always-public VERB name, so it can't be a tool-leak probe — the grapple
    // tool is masked by its desc, checked below and by the tool-masking test.)
    expect(json.includes('Lantern Arc')).toBe(false)
    for (const name of ['Sounding Rod', 'Resonant Chime', 'Mistwalker', 'Ferryman']) {
      expect(json.includes(name), `leaks unowned tool "${name}"`).toBe(false)
    }
    // No unowned-tool descriptions (the richest spoiler — only present if owned).
    for (const frag of ['pull yourself across', 'buried world answers', 'ring sealed stone', 'sail between']) {
      expect(json.includes(frag), `leaks unowned tool desc "${frag}"`).toBe(false)
    }
    // No Hidden-Art input sequence anywhere (arts show names only, when learned).
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) {
      expect(json.includes(key), `leaks an Art sequence key "${key}"`).toBe(false)
    }
    // The innate Lantern IS named (it's owned from the start).
    expect(json.includes('The Lantern')).toBe(true)
  })
})
