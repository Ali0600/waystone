import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { MistCharge, MIST_CAPACITY } from '../src/player/mistwalker'
import { PlayerSim } from '../src/player/controller'
import { buildCollider } from '../src/world/collision'
import { MIST_Y } from '../src/world/mist'
import { createInitialState, parseGameState } from '../src/core/state'
import { idleInput } from './helpers'

/** A collider far below the action, so nothing the player does collides. */
function emptyCollider() {
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
  box.position.set(0, -500, 0)
  return buildCollider(box)
}

describe('MistCharge', () => {
  it('starts full and drains only while on the mist', () => {
    const c = new MistCharge()
    expect(c.charge).toBe(MIST_CAPACITY)
    c.update(1, MIST_Y) // standing on the mist floor
    expect(c.charge).toBe(MIST_CAPACITY - 1)
    c.update(1, MIST_Y + 5) // solid ground — no drain (refill)
    expect(c.charge).toBeGreaterThan(MIST_CAPACITY - 1)
  })

  it('refills on solid ground and clamps to capacity', () => {
    const c = new MistCharge()
    c.charge = 2
    c.update(10, MIST_Y + 5) // long time on solid → refills, capped
    expect(c.charge).toBe(MIST_CAPACITY)
  })

  it('empties to exactly zero and reports inactive', () => {
    const c = new MistCharge()
    c.charge = 0.5
    c.update(1, MIST_Y) // would go negative — clamps at 0
    expect(c.charge).toBe(0)
    expect(c.active()).toBe(false)
    c.charge = 0.01
    expect(c.active()).toBe(true)
  })
})

describe('PlayerSim.mistFloorY', () => {
  it('clamps a fall to the mist floor when set', () => {
    const collider = emptyCollider()
    const walker = new PlayerSim()
    walker.setSpawn(new THREE.Vector3(0, 5, 0))
    walker.respawn()
    walker.mistFloorY = MIST_Y + 0.05
    let minY = Infinity
    for (let i = 0; i < 240; i++) {
      walker.step(1 / 60, idleInput(), 0, collider)
      minY = Math.min(minY, walker.position.y)
    }
    // Never sank below the mist floor, and rests on it.
    expect(minY).toBeGreaterThan(MIST_Y - 0.5)
    expect(walker.position.y).toBeCloseTo(MIST_Y + 0.05, 2)
    expect(walker.onGround).toBe(true)
  })

  it('falls through the mist floor when null (ordinary fall → respawn)', () => {
    const collider = emptyCollider()
    const faller = new PlayerSim()
    faller.setSpawn(new THREE.Vector3(0, 5, 0))
    faller.respawn()
    faller.mistFloorY = null
    let minY = Infinity
    for (let i = 0; i < 240; i++) {
      faller.step(1 / 60, idleInput(), 0, collider)
      minY = Math.min(minY, faller.position.y)
    }
    // It sank past the mist floor (no clamp) but respawn kept it above fallY.
    expect(minY).toBeLessThan(MIST_Y)
    expect(faller.position.y).toBeGreaterThan(faller.params.fallY)
  })

  it('a charge-out (floor removed) sinks the player and respawns them', () => {
    const collider = emptyCollider()
    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(0, 5, 0))
    sim.respawn()
    // On the mist floor.
    sim.mistFloorY = MIST_Y + 0.05
    for (let i = 0; i < 120; i++) sim.step(1 / 60, idleInput(), 0, collider)
    expect(sim.position.y).toBeCloseTo(MIST_Y + 0.05, 2)
    // Charge runs out → floor removed → sinks past the floor, respawn catches it.
    sim.mistFloorY = null
    let sankBelowFloor = false
    for (let i = 0; i < 240; i++) {
      sim.step(1 / 60, idleInput(), 0, collider)
      if (sim.position.y < MIST_Y) sankBelowFloor = true
    }
    expect(sankBelowFloor).toBe(true)
    expect(sim.position.y).toBeGreaterThan(sim.params.fallY)
  })
})

describe('save v10 → v11 migration', () => {
  it('defaults the Mistwalker to un-owned', () => {
    const v10 = JSON.stringify({
      ...createInitialState(),
      version: 10,
      tools: { grapple: true, sounding: true, chime: true },
    })
    const parsed = parseGameState(v10)
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(createInitialState().version)
    expect(parsed!.tools).toEqual({
      grapple: true,
      sounding: true,
      chime: true,
      mistwalker: false,
    })
  })
})
