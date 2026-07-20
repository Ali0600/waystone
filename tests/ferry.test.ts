import { describe, expect, it } from 'vitest'
import { EventBus } from '../src/core/events'
import { createInitialState, parseGameState, type GameState } from '../src/core/state'
import { DiscoverySystem, type PlayerCapabilities } from '../src/discovery/system'
import type { DiscoverableDef } from '../src/discovery/types'
import { amberfall } from '../src/content/regions/amberfall'
import { waystation } from '../src/content/regions/waystation'
import { veilspire } from '../src/content/regions/veilspire'
import { thornmere } from '../src/content/regions/thornmere'
import { World } from '../src/world/world'

describe('World.moorings', () => {
  const defs = [amberfall, waystation, veilspire, thornmere]
  const makeWorld = (manifested: string[]) =>
    new World(defs, (id) => !defs.find((d) => d.id === id)?.latent || manifested.includes(id))

  it('offers moorings for manifested regions only', () => {
    const world = makeWorld([]) // veilspire latent, still a ghost
    const ids = world.moorings.map((m) => m.regionId)
    expect(ids).toContain('amberfall')
    expect(ids).toContain('waystation')
    expect(ids).toContain('thornmere') // non-latent → always offered
    expect(ids).not.toContain('veilspire') // latent, not yet planted

    world.manifest('veilspire')
    expect(world.moorings.map((m) => m.regionId)).toContain('veilspire')
  })

  it('every mooring carries a name and world coordinates', () => {
    const world = makeWorld(['veilspire'])
    for (const m of world.moorings) {
      expect(m.name.length).toBeGreaterThan(2)
      expect(Number.isFinite(m.x) && Number.isFinite(m.z)).toBe(true)
    }
  })
})

describe('the Ferry tool', () => {
  it('a tool-ferry payout grants the ferry capability', () => {
    const state: GameState = createInitialState()
    const caps: PlayerCapabilities = {
      lantern: true,
      grapple: false,
      sounding: false,
      chime: false,
      mistwalker: false,
      ferry: false,
    }
    const bus = new EventBus()
    const bell: DiscoverableDef = {
      id: 'ferry-prize',
      kind: 'guarded',
      x: 0,
      z: 0,
      label: 'The Ferryman’s Bell',
      cue: 'a guardian keeps a bell',
      prereq: 'combat',
      payouts: [
        { meter: 'tool-ferry', amount: 1 },
        { meter: 'completion', amount: 1 },
      ],
    }
    const sys = new DiscoverySystem([bell], state, bus, caps, () => 0)
    state.guardiansDefeated.push('ferry-prize')
    expect(sys.interact(0, 0)).toBe(true)
    expect(state.tools.ferry).toBe(true)
    expect(caps.ferry).toBe(true)
  })
})

describe('save v11 → v12 migration', () => {
  it('defaults the Ferry to un-owned', () => {
    const v11 = JSON.stringify({
      ...createInitialState(),
      version: 11,
      tools: { grapple: true, sounding: true, chime: true, mistwalker: true },
    })
    const parsed = parseGameState(v11)
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(createInitialState().version)
    expect(parsed!.tools).toEqual({
      grapple: true,
      sounding: true,
      chime: true,
      mistwalker: true,
      ferry: false,
    })
  })
})
