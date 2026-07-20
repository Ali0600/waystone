import { describe, expect, it } from 'vitest'
import { EventBus } from '../src/core/events'
import { createInitialState } from '../src/core/state'
import { amberfall } from '../src/content/regions/amberfall'
import { waystation } from '../src/content/regions/waystation'
import { RECRUITS } from '../src/content/recruits'
import { RecruitSystem } from '../src/hub/recruits'
import { World } from '../src/world/world'

describe('World', () => {
  const world = new World([amberfall, waystation])

  it('dispatches heightAt to the island containing the point', () => {
    // Amberfall centre plateau.
    expect(world.heightAt(0, 0)).toBeCloseTo(4.2, 4)
    // Waystation plaza (origin 0,-135; plateau h 2.0 at its centre).
    expect(world.heightAt(0, -135)).toBeCloseTo(2.0, 4)
    // Open mist between the islands.
    expect(world.heightAt(0, -95)).toBe(0)
  })

  it('identifies the region at a point', () => {
    expect(world.regionAt(0, 10)?.def.id).toBe('amberfall')
    expect(world.regionAt(2, -130)?.def.id).toBe('waystation')
    expect(world.regionAt(0, -96)).toBeNull()
  })

  it('aggregates content across regions', () => {
    expect(world.discoverables.length).toBe(
      amberfall.discoverables.length + waystation.discoverables.length,
    )
    expect(world.latentPaths.some((p) => p.startSolid)).toBe(true)
  })
})

describe('RecruitSystem', () => {
  function build(found: string[]) {
    const state = createInitialState()
    for (const id of found) state.discoveries[id] = 'found'
    const bus = new EventBus()
    const positions = new Map(RECRUITS.map((r) => [r.personId, { x: 0, z: 0 }]))
    return { sys: new RecruitSystem(state, bus, () => 0, positions), state, bus }
  }

  it('starts with everyone out in the world and no structures', () => {
    const { sys } = build([])
    expect(sys.homeCount()).toBe(0)
  })

  it('derives homes purely from discovery state', () => {
    const { sys } = build(['af-person-scribe', 'af-person-cook'])
    expect(sys.homeCount()).toBe(2)
  })

  it('reacts to a person being found at runtime', () => {
    const { sys, state, bus } = build([])
    state.discoveries['af-person-smith'] = 'found'
    bus.emit('discovery:found', { id: 'af-person-smith' })
    expect(sys.homeCount()).toBe(1)
  })

  it('offers a nearby home recruit for flavour lines', () => {
    const { sys } = build(['af-person-scribe'])
    const scribe = RECRUITS.find((r) => r.role === 'scribe')!
    expect(sys.nearbyHome(scribe.home.x + 1, scribe.home.z + 1)?.role).toBe('scribe')
    expect(sys.nearbyHome(0, 0)).toBeNull()
    // An un-found recruit's home spot offers nothing.
    const smith = RECRUITS.find((r) => r.role === 'smith')!
    expect(sys.nearbyHome(smith.home.x, smith.home.z)).toBeNull()
  })
})
