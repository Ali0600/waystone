import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '../src/core/events'
import { createInitialState, type GameState } from '../src/core/state'
import { DiscoverySystem, type PlayerCapabilities } from '../src/discovery/system'
import type { DiscoverableDef } from '../src/discovery/types'

const DEFS: DiscoverableDef[] = [
  {
    id: 'open-cache',
    kind: 'cache',
    x: 0,
    z: 0,
    label: 'Open Cache',
    cue: 'a glint in the open',
    prereq: 'none',
    payouts: [
      { meter: 'lumen', amount: 10 },
      { meter: 'completion', amount: 1 },
    ],
  },
  {
    id: 'ghost',
    kind: 'latent',
    x: 5,
    z: 0,
    label: 'Ghost Cache',
    cue: 'the air shimmers',
    prereq: 'lantern',
    payouts: [
      { meter: 'glyphstone', amount: 1 },
      { meter: 'lumen', amount: 5 },
    ],
  },
  {
    id: 'high-perch',
    kind: 'perch',
    x: 10,
    z: 0,
    label: 'High Perch',
    cue: 'a chest out of reach',
    prereq: 'grapple',
    payouts: [
      { meter: 'lumen', amount: 20 },
      { meter: 'completion', amount: 1 },
    ],
  },
]

describe('DiscoverySystem', () => {
  let state: GameState
  let bus: EventBus
  let caps: PlayerCapabilities
  let sys: DiscoverySystem
  let events: string[]

  beforeEach(() => {
    state = createInitialState()
    bus = new EventBus()
    caps = { lantern: true, grapple: false, sounding: false }
    sys = new DiscoverySystem(DEFS, state, bus, caps, () => 0)
    events = []
    bus.on('discovery:pinned', ({ id }) => events.push(`pin:${id}`))
    bus.on('discovery:revealed', ({ id }) => events.push(`reveal:${id}`))
    bus.on('discovery:found', ({ id }) => events.push(`found:${id}`))
  })

  it('collects an unlocked cache and pays every meter', () => {
    expect(sys.interact(0.5, 0.5)).toBe(true)
    expect(state.discoveries['open-cache']).toBe('found')
    expect(state.lumen).toBe(10)
    expect(events).toContain('found:open-cache')
    // No double collection.
    expect(sys.interact(0.5, 0.5)).toBe(false)
    expect(state.lumen).toBe(10)
  })

  it('pins a locked discoverable once, never twice', () => {
    sys.update(10, 3) // within PIN_RADIUS of high-perch
    sys.update(10, 3)
    sys.update(10, 3)
    expect(state.discoveries['high-perch']).toBe('pinned')
    expect(events.filter((e) => e === 'pin:high-perch')).toHaveLength(1)
  })

  it('does not pin collectable (prereq-met) discoverables', () => {
    sys.update(0, 1)
    expect(state.discoveries['open-cache']).toBeUndefined()
  })

  it('gates perch behind grapple, then allows it', () => {
    expect(sys.interactable(10, 0)).toBeNull()
    caps.grapple = true
    expect(sys.interactable(10, 0)?.id).toBe('high-perch')
    expect(sys.interact(10, 0)).toBe(true)
    expect(state.lumen).toBe(20)
  })

  it('latent flow: hidden → revealed by pulse → collectable', () => {
    expect(sys.interactable(5, 0)).toBeNull()
    // Pulse from too far does nothing.
    expect(sys.lanternPulse(20, 0)).toBe(0)
    // Pulse in range reveals exactly once.
    expect(sys.lanternPulse(5, 1)).toBe(1)
    expect(sys.lanternPulse(5, 1)).toBe(0)
    expect(state.discoveries['ghost']).toBe('revealed')
    expect(events.filter((e) => e === 'reveal:ghost')).toHaveLength(1)
    // Now collectable; pays both meters.
    expect(sys.interact(5, 0)).toBe(true)
    expect(state.glyphStones).toBe(1)
    expect(state.lumen).toBe(5)
  })

  it('a pinned discoverable still auto-resolves when capability arrives', () => {
    sys.update(10, 3) // pinned while locked
    caps.grapple = true
    expect(sys.interactable(10, 0)?.id).toBe('high-perch')
  })

  it('tracks completion', () => {
    expect(sys.completion()).toEqual({ found: 0, total: 3 })
    sys.interact(0, 0)
    expect(sys.completion()).toEqual({ found: 1, total: 3 })
  })
})
