import { describe, expect, it } from 'vitest'
import { pitchForDistance } from '../src/engine/audio'
import { EventBus } from '../src/core/events'
import { createInitialState } from '../src/core/state'
import { DiscoverySystem } from '../src/discovery/system'
import type { DiscoverableDef } from '../src/discovery/types'

describe('pitchForDistance', () => {
  it('rises monotonically as you close in', () => {
    let prev = -Infinity
    for (let d = 30; d >= 0; d -= 3) {
      const pitch = pitchForDistance(d, 30)
      expect(pitch).toBeGreaterThanOrEqual(prev)
      prev = pitch
    }
  })

  it('spans the audible sweep and clamps out of range', () => {
    expect(pitchForDistance(30)).toBeCloseTo(220, 3)
    expect(pitchForDistance(0)).toBeCloseTo(920, 3)
    expect(pitchForDistance(999)).toBeCloseTo(220, 3)
    expect(pitchForDistance(-5)).toBeCloseTo(920, 3)
  })
})

describe('nearestBuried', () => {
  const buried = (id: string, x: number, z: number): DiscoverableDef => ({
    id,
    kind: 'buried',
    x,
    z,
    label: id,
    cue: 'hollow ground here',
    prereq: 'sounding',
    payouts: [
      { meter: 'lumen', amount: 5 },
      { meter: 'completion', amount: 1 },
    ],
  })

  it('answers with the nearest unfound cache in range only', () => {
    const state = createInitialState()
    const sys = new DiscoverySystem(
      [buried('near', 5, 0), buried('far', 20, 0), buried('outside', 100, 0)],
      state,
      new EventBus(),
      { lantern: true, grapple: false, sounding: true },
      () => 0,
    )
    expect(sys.nearestBuried(0, 0, 30)?.def.id).toBe('near')
    state.discoveries['near'] = 'found'
    expect(sys.nearestBuried(0, 0, 30)?.def.id).toBe('far')
    state.discoveries['far'] = 'found'
    expect(sys.nearestBuried(0, 0, 30)).toBeNull() // 'outside' is out of range
  })

  it('digging a buried cache is a normal interact once the rod is carried', () => {
    const state = createInitialState()
    const caps = { lantern: true, grapple: false, sounding: false }
    const sys = new DiscoverySystem([buried('dig', 0, 0)], state, new EventBus(), caps, () => 0)
    expect(sys.interact(0, 0)).toBe(false) // no rod, no dig
    caps.sounding = true
    expect(sys.interact(0, 0)).toBe(true)
    expect(state.discoveries['dig']).toBe('found')
  })
})
