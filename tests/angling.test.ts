import { describe, expect, it } from 'vitest'
import {
  AnglingSim,
  FISH,
  TEACHER_THRESHOLD,
  cookBestFish,
  mealShield,
  pickSpecies,
} from '../src/minigames/angling'
import { createInitialState, parseGameState } from '../src/core/state'

/** Drive the sim to its first bite (cast with a fixed 2s bite delay). */
function toBite(sim: AnglingSim): void {
  sim.cast(0) // biteAt = BITE_MIN = 2s
  let guard = 0
  while (sim.state === 'waiting' && guard++ < 500) sim.update(0.05, false, 0)
}

describe('pickSpecies (weighted, deterministic)', () => {
  it('maps roll bands to species by weight (60/30/10)', () => {
    expect(pickSpecies(0).id).toBe('mistminnow')
    expect(pickSpecies(0.59).id).toBe('mistminnow')
    expect(pickSpecies(0.6).id).toBe('veilcarp')
    expect(pickSpecies(0.89).id).toBe('veilcarp')
    expect(pickSpecies(0.9).id).toBe('ember-eel')
    expect(pickSpecies(0.999).id).toBe('ember-eel')
  })
})

describe('AnglingSim', () => {
  it('waits the injected delay, then a bite picks a species', () => {
    const sim = new AnglingSim()
    sim.cast(0) // 2s
    sim.update(1.9, false, 0)
    expect(sim.state).toBe('waiting')
    sim.update(0.2, false, 0.95) // crosses 2s → bite, roll 0.95 → ember-eel
    expect(sim.state).toBe('bite')
    expect(sim.hooked?.id).toBe('ember-eel')
  })

  it('striking within the window hooks the fish', () => {
    const sim = new AnglingSim()
    toBite(sim)
    expect(sim.state).toBe('bite')
    sim.update(0.1, true, 0) // hold within the 0.35s strike window
    expect(sim.state).toBe('reeling')
  })

  it('missing the strike window loses the fish', () => {
    const sim = new AnglingSim()
    toBite(sim)
    for (let i = 0; i < 10; i++) sim.update(0.05, false, 0) // 0.5s > 0.35 window
    expect(sim.state).toBe('escaped')
  })

  it('reeling steadily snaps the line before it lands', () => {
    const sim = new AnglingSim()
    toBite(sim)
    sim.update(0.05, true, 0) // strike → reeling
    let guard = 0
    while (sim.state === 'reeling' && guard++ < 400) sim.update(0.05, true, 0)
    expect(sim.state).toBe('escaped') // tension held over the limit
    expect(sim.progress).toBeLessThan(1)
  })

  it('managing tension — hold, release, hold — lands the fish', () => {
    const sim = new AnglingSim()
    toBite(sim)
    sim.update(0.02, true, 0) // strike → reeling
    // Hold ~1s (progress ~0.5, tension ~0.9, under the snap point).
    for (let i = 0; i < 20; i++) sim.update(0.05, true, 0)
    expect(sim.state).toBe('reeling')
    // Release to shed the tension.
    for (let i = 0; i < 20; i++) sim.update(0.05, false, 0)
    expect(sim.tension).toBe(0)
    // Hold again to finish reeling in.
    for (let i = 0; i < 30 && sim.state === 'reeling'; i++) sim.update(0.05, true, 0)
    expect(sim.state).toBe('landed')
    expect(sim.progress).toBe(1)
    expect(sim.hooked).not.toBeNull()
  })
})

describe('cookBestFish', () => {
  it('cooks the highest-points fish and consumes one', () => {
    const state = { fishHeld: { mistminnow: 2, veilcarp: 1 }, pendingMeal: null as string | null }
    const cooked = cookBestFish(state)
    expect(cooked?.id).toBe('veilcarp') // 3pts > mistminnow's 1
    expect(state.fishHeld.veilcarp).toBe(0)
    expect(state.fishHeld.mistminnow).toBe(2) // untouched
    expect(state.pendingMeal).toBe('veilcarp')
  })

  it('returns null and changes nothing with an empty pack', () => {
    const state = { fishHeld: {}, pendingMeal: null as string | null }
    expect(cookBestFish(state)).toBeNull()
    expect(state.pendingMeal).toBeNull()
  })
})

describe('mealShield', () => {
  it('scales with the species and is zero for the unknown', () => {
    expect(mealShield('mistminnow')).toBe(6)
    expect(mealShield('veilcarp')).toBe(12)
    expect(mealShield('ember-eel')).toBe(20)
    expect(mealShield('nope')).toBe(0)
  })
})

describe('save v8 → v9 migration', () => {
  it('defaults the angling fields on an older save', () => {
    const v8 = JSON.stringify({
      ...createInitialState(),
      version: 8,
      fishHeld: undefined,
      anglingPoints: undefined,
      pendingMeal: undefined,
    })
    const parsed = parseGameState(v8)
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(createInitialState().version)
    expect(parsed!.fishHeld).toEqual({})
    expect(parsed!.anglingPoints).toBe(0)
    expect(parsed!.pendingMeal).toBeNull()
  })
})

describe('the teacher threshold', () => {
  it('is a positive point total reachable from a couple of good fish', () => {
    const bestPerCatch = Math.max(...FISH.map((f) => f.points))
    expect(TEACHER_THRESHOLD).toBeGreaterThan(0)
    // Not trivially reachable in one catch, but not a grind either.
    expect(TEACHER_THRESHOLD).toBeGreaterThan(bestPerCatch)
  })
})
