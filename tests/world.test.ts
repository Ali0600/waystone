import { describe, expect, it } from 'vitest'
import { EventBus } from '../src/core/events'
import { createInitialState } from '../src/core/state'
import { amberfall } from '../src/content/regions/amberfall'
import { waystation } from '../src/content/regions/waystation'
import { RECRUITS } from '../src/content/recruits'
import { veilspire } from '../src/content/regions/veilspire'
import { cindervault } from '../src/content/regions/cindervault'
import { palegrove } from '../src/content/regions/palegrove'
import { RecruitSystem } from '../src/hub/recruits'
import { World } from '../src/world/world'
import { PlayerSim } from '../src/player/controller'
import { idleInput } from './helpers'
import * as THREE from 'three'

describe('World', () => {
  const world = new World([amberfall, waystation], () => true)

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

describe('latent regions', () => {
  const defs = [amberfall, waystation, veilspire]
  const makeWorld = (manifested: string[]) =>
    new World(defs, (id) => !defs.find((d) => d.id === id)?.latent || manifested.includes(id))

  it('an unmanifested region contributes nothing', () => {
    const world = makeWorld([])
    // Court plateau centre would be 5.5 — but the island is not real yet.
    expect(world.heightAt(-175, -45)).toBe(0)
    expect(world.regionAt(-175, -45)).toBeNull()
    expect(world.discoverables.some((d) => d.id.startsWith('vs-'))).toBe(false)
    expect(world.enemies.some((e) => e.guards?.startsWith('vs-'))).toBe(false)
    expect(world.latentPaths.some((p) => p.id === 'vs-bridge-east')).toBe(false)
  })

  it('manifesting makes the region real: height, content, collision', () => {
    const world = makeWorld([])
    const region = world.manifest('veilspire')
    expect(region).not.toBeNull()
    expect(world.heightAt(-175, -45)).toBeCloseTo(5.5, 4)
    expect(world.regionAt(-175, -45)?.def.id).toBe('veilspire')
    expect(world.discoverables.some((d) => d.id.startsWith('vs-'))).toBe(true)

    // The island is walkable: a capsule dropped over the court lands on it.
    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(-175, 9, -45))
    sim.respawn()
    for (let i = 0; i < 240; i++) sim.step(1 / 60, idleInput(), 0, world.collider)
    expect(sim.onGround).toBe(true)
    expect(sim.position.y).toBeGreaterThan(5)
  })

  it('manifest is idempotent and restores from save state', () => {
    const world = makeWorld(['veilspire'])
    expect(world.isManifested('veilspire')).toBe(true)
    expect(world.manifest('veilspire')).toBeNull() // already real
    expect(world.heightAt(-175, -45)).toBeCloseTo(5.5, 4)
  })
})

describe('the second waystone chain (Cindervault)', () => {
  const defs = [amberfall, waystation, veilspire, cindervault]
  const makeWorld = (manifested: string[]) =>
    new World(defs, (id) => !defs.find((d) => d.id === id)?.latent || manifested.includes(id))

  it('cindervault stays a ghost until its own waystone is planted', () => {
    // Veilspire reached, but the second waystone not yet planted.
    const world = makeWorld(['veilspire'])
    expect(world.isManifested('cindervault')).toBe(false)
    expect(world.heightAt(-160, -190)).toBe(0) // vault centre — not real
    expect(world.discoverables.some((d) => d.id.startsWith('cv-'))).toBe(false)
    expect(world.discoverables.some((d) => d.id === 'vs-waystone-deep')).toBe(true)

    const region = world.manifest('cindervault')
    expect(region).not.toBeNull()
    expect(world.heightAt(-160, -190)).toBeCloseTo(6.5, 4) // vault plateau h
    expect(world.discoverables.some((d) => d.id === 'cv-person-cardplayer')).toBe(true)
  })

  it('both latent regions can be real at once, each on its own island', () => {
    const world = makeWorld(['veilspire', 'cindervault'])
    expect(world.regionAt(-175, -45)?.def.id).toBe('veilspire')
    expect(world.regionAt(-160, -190)?.def.id).toBe('cindervault')
  })
})

describe('the third waystone chain (Palegrove)', () => {
  const defs = [amberfall, waystation, veilspire, cindervault, palegrove]
  const makeWorld = (manifested: string[]) =>
    new World(defs, (id) => !defs.find((d) => d.id === id)?.latent || manifested.includes(id))

  it('palegrove stays a ghost until its own (third) waystone is planted', () => {
    const world = makeWorld(['veilspire', 'cindervault'])
    expect(world.isManifested('palegrove')).toBe(false)
    expect(world.heightAt(-300, -165)).toBe(0) // choir hall — not real
    expect(world.discoverables.some((d) => d.id.startsWith('pg-'))).toBe(false)
    // The third waystone lives in Cindervault.
    expect(world.discoverables.some((d) => d.id === 'cv-waystone-deep')).toBe(true)

    const region = world.manifest('palegrove')
    expect(region).not.toBeNull()
    expect(world.heightAt(-300, -165)).toBeCloseTo(5.5, 4) // choir hall plateau h
    expect(world.discoverables.some((d) => d.id.startsWith('pg-'))).toBe(true)
  })

  it('all four island regions can be real at once', () => {
    const world = makeWorld(['veilspire', 'cindervault', 'palegrove'])
    expect(world.regionAt(-300, -165)?.def.id).toBe('palegrove')
    expect(world.regionAt(-160, -190)?.def.id).toBe('cindervault')
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

  it('stands up a latecomer recruit (manifested region) exactly once', () => {
    // Boot with only an Amberfall recruit positioned; Cindervault is latent,
    // so Tam has no world figure yet.
    const state = createInitialState()
    const bus = new EventBus()
    const positions = new Map([['af-person-scribe', { x: 0, z: 0 }]])
    const sys = new RecruitSystem(state, bus, () => 0, positions)
    const before = sys.group.children.length
    sys.addWorldFigures([{ id: 'cv-person-cardplayer', x: -134, z: -172 }])
    expect(sys.group.children.length).toBe(before + 1)
    // A second manifest of the same region must not duplicate the figure.
    sys.addWorldFigures([{ id: 'cv-person-cardplayer', x: -134, z: -172 }])
    expect(sys.group.children.length).toBe(before + 1)
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
