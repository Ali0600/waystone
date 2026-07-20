import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildCollider } from '../src/world/collision'
import { PlayerSim } from '../src/player/controller'
import type { InputSnapshot } from '../src/engine/input'

/**
 * Headless integration: real PlayerSim vs a real BVH world. This is the test
 * that catches three-mesh-bvh API breakage and controller regressions.
 */
function makeWorld(): ReturnType<typeof buildCollider> {
  const root = new THREE.Group()
  const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40))
  floor.position.y = -0.5 // top surface at y = 0
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 40))
  wall.position.set(5, 3, 0) // near face at x = 4.5
  root.add(floor, wall)
  return buildCollider(root)
}

const idle: InputSnapshot = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  dash: false,
  interact: false,
  lantern: false,
  grapple: false,
  map: false,
  lookDX: 0,
  lookDY: 0,
}

const DT = 1 / 60

describe('PlayerSim vs BVH world', () => {
  it('falls onto the floor, lands, and stays grounded', () => {
    const collider = makeWorld()
    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(0, 3, 0))
    sim.respawn()
    for (let i = 0; i < 180; i++) sim.step(DT, idle, 0, collider)
    expect(sim.onGround).toBe(true)
    // Foot tip rests within a couple of cm of the surface.
    expect(sim.position.y).toBeGreaterThan(-0.05)
    expect(sim.position.y).toBeLessThan(0.1)
    expect(Math.abs(sim.velocity.y)).toBeLessThan(0.01)
  })

  it('cannot walk through a wall', () => {
    const collider = makeWorld()
    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(0, 0.5, 0))
    sim.respawn()
    // Camera yaw 0 makes +moveX push toward +X (into the wall at x=4.5).
    const run: InputSnapshot = { ...idle, moveX: 1 }
    for (let i = 0; i < 300; i++) sim.step(DT, run, 0, collider)
    // Blocked at the wall face minus the capsule radius (some tolerance).
    expect(sim.position.x).toBeLessThan(4.5 - sim.params.radius + 0.1)
    expect(sim.position.x).toBeGreaterThan(3) // but it did travel to the wall
    expect(sim.onGround).toBe(true)
  })

  it('jump leaves the ground and lands again', () => {
    const collider = makeWorld()
    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(0, 0.5, 0))
    sim.respawn()
    for (let i = 0; i < 120; i++) sim.step(DT, idle, 0, collider)
    expect(sim.onGround).toBe(true)

    sim.step(DT, { ...idle, jump: true }, 0, collider)
    expect(sim.onGround).toBe(false)
    let peak = 0
    for (let i = 0; i < 180; i++) {
      sim.step(DT, idle, 0, collider)
      peak = Math.max(peak, sim.position.y)
    }
    expect(peak).toBeGreaterThan(1) // actually jumped
    expect(sim.onGround).toBe(true) // and came back down
  })

  it('respawns after falling past fallY', () => {
    const collider = makeWorld()
    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(0, 0.5, 0))
    sim.respawn()
    sim.position.set(30, -2, 0) // off the floor slab, over the void
    for (let i = 0; i < 600; i++) sim.step(DT, idle, 0, collider)
    // Back on the floor at spawn, not falling forever.
    expect(sim.position.y).toBeGreaterThan(-1)
    expect(Math.hypot(sim.position.x, sim.position.z)).toBeLessThan(1)
  })
})
