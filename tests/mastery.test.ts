import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '../src/core/events'
import { createInitialState, type GameState } from '../src/core/state'
import { MasterySystem, TIER_THRESHOLDS, tierOf } from '../src/progression/mastery'

describe('tierOf', () => {
  it('crosses tiers exactly at the thresholds', () => {
    const [t2, t3] = TIER_THRESHOLDS.lantern
    expect(tierOf('lantern', 0)).toBe(1)
    expect(tierOf('lantern', t2 - 1)).toBe(1)
    expect(tierOf('lantern', t2)).toBe(2)
    expect(tierOf('lantern', t3 - 1)).toBe(2)
    expect(tierOf('lantern', t3)).toBe(3)
    expect(tierOf('lantern', t3 + 500)).toBe(3)
  })
})

describe('MasterySystem', () => {
  let state: GameState
  let bus: EventBus
  let sys: MasterySystem
  let tierUps: string[]

  beforeEach(() => {
    state = createInitialState()
    bus = new EventBus()
    sys = new MasterySystem(state, bus)
    tierUps = []
    bus.on('mastery:tier', ({ verb, tier }) => tierUps.push(`${verb}:${tier}`))
  })

  it('records uses into serializable state', () => {
    sys.record('dash')
    sys.record('dash')
    expect(state.mastery.dash).toBe(2)
  })

  it('announces each tier-up exactly once', () => {
    const [t2, t3] = TIER_THRESHOLDS.grapple
    for (let i = 0; i < t3 + 5; i++) sys.record('grapple')
    expect(tierUps).toEqual(['grapple:2', 'grapple:3'])
    expect(sys.tier('grapple')).toBe(3)
    void t2
  })

  it('tracks verbs independently', () => {
    for (let i = 0; i < TIER_THRESHOLDS.parry[0]; i++) sys.record('parry')
    expect(sys.tier('parry')).toBe(2)
    expect(sys.tier('strike')).toBe(1)
  })
})
