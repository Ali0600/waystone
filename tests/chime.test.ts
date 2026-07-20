import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '../src/core/events'
import { createInitialState, parseGameState, type GameState } from '../src/core/state'
import { DiscoverySystem, type PlayerCapabilities } from '../src/discovery/system'
import type { DiscoverableDef } from '../src/discovery/types'

function sealed(id: string, x: number, z: number): DiscoverableDef {
  return {
    id,
    kind: 'sealed',
    x,
    z,
    label: `Seal ${id}`,
    cue: 'a sealed stone hums',
    prereq: 'chime',
    payouts: [
      { meter: 'lumen', amount: 20 },
      { meter: 'completion', amount: 1 },
    ],
  }
}

const CHIME_TOOL: DiscoverableDef = {
  id: 'chime-tool',
  kind: 'guarded',
  x: 40,
  z: 0,
  label: 'The Resonant Chime',
  cue: 'a guardian keeps a bell',
  prereq: 'combat',
  payouts: [
    { meter: 'tool-chime', amount: 1 },
    { meter: 'completion', amount: 1 },
  ],
}

describe('the Chime (Tool 3)', () => {
  let state: GameState
  let bus: EventBus
  let caps: PlayerCapabilities
  let sys: DiscoverySystem

  beforeEach(() => {
    state = createInitialState()
    bus = new EventBus()
    caps = { lantern: true, grapple: false, sounding: false, chime: false }
    sys = new DiscoverySystem([sealed('near', 0, 0), sealed('far', 30, 0)], state, bus, caps, () => 0)
  })

  it('a sealed cache is not collectable until the chime resonates it open', () => {
    // Standing on it, it still cannot be taken — it is sealed.
    expect(sys.interact(0, 0)).toBe(false)
    expect(state.discoveries['near']).toBeUndefined()
    // Ring the chime nearby: the seal opens.
    expect(sys.chimeResonate(0, 0)).toBe(1)
    expect(state.discoveries['near']).toBe('revealed')
    // Now it is a normal interact.
    expect(sys.interact(0, 0)).toBe(true)
    expect(state.discoveries['near']).toBe('found')
  })

  it('an unopened seal auto-pins as a "?" when the player is near without the chime', () => {
    const pinned: string[] = []
    bus.on('discovery:pinned', ({ id }) => pinned.push(id))
    sys.update(0, 0)
    expect(pinned).toContain('near')
    expect(state.discoveries['near']).toBe('pinned')
  })

  it('only resonates seals within range, and is idempotent', () => {
    // The far seal (30u) is out of the ~7u resonance radius.
    expect(sys.chimeResonate(0, 0)).toBe(1)
    expect(state.discoveries['far']).toBeUndefined()
    // Ringing again opens nothing new.
    expect(sys.chimeResonate(0, 0)).toBe(0)
  })

  it('collecting a tool-chime payout grants the chime capability', () => {
    const toolSys = new DiscoverySystem([CHIME_TOOL], state, bus, caps, () => 0)
    state.guardiansDefeated.push('chime-tool') // the guardian has fallen
    expect(toolSys.interact(40, 0)).toBe(true)
    expect(state.tools.chime).toBe(true)
    expect(caps.chime).toBe(true)
  })

  it('migrates a v7 save forward, defaulting the chime to un-owned', () => {
    const v7 = JSON.stringify({ ...createInitialState(), version: 7, tools: { grapple: true, sounding: false } })
    const parsed = parseGameState(v7)
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(createInitialState().version)
    expect(parsed!.tools).toEqual({ grapple: true, sounding: false, chime: false })
  })
})
