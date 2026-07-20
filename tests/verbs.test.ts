import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildCollider } from '../src/world/collision'
import { PlayerSim, type VerbGates } from '../src/player/controller'
import { LatentPaths } from '../src/world/latentpath'
import { EventBus } from '../src/core/events'
import { createInitialState } from '../src/core/state'
import { idleInput } from './helpers'

const idle = idleInput()

const DT = 1 / 60

function flatWorld() {
  const root = new THREE.Group()
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 60))
  floor.position.y = -0.5
  root.add(floor)
  return buildCollider(root)
}

function gates(overrides: Partial<VerbGates> = {}): VerbGates {
  return {
    airDash: () => false,
    airGrapple: () => false,
    dashPower: () => 1,
    ...overrides,
  }
}

describe('dash', () => {
  it('bursts farther than plain walking and respects cooldown', () => {
    const collider = flatWorld()
    const walk = new PlayerSim(undefined, gates())
    walk.setSpawn(new THREE.Vector3(0, 0.5, 0))
    walk.respawn()
    const dash = new PlayerSim(undefined, gates())
    dash.setSpawn(new THREE.Vector3(0, 0.5, 0))
    dash.respawn()
    for (let i = 0; i < 60; i++) {
      walk.step(DT, { ...idle, moveX: 1 }, 0, collider)
      dash.step(DT, { ...idle, moveX: 1, dash: i === 30 }, 0, collider)
    }
    expect(dash.position.x).toBeGreaterThan(walk.position.x + 0.5)

    // Second dash within the cooldown must not fire.
    dash.step(DT, { ...idle, moveX: 1, dash: true }, 0, collider)
    expect(dash.stepEvents.dashed).toBe(false)
  })

  it('air dash is tier-gated', () => {
    const collider = flatWorld()
    const grounded = new PlayerSim(undefined, gates())
    grounded.setSpawn(new THREE.Vector3(0, 6, 0))
    grounded.respawn()
    grounded.step(DT, { ...idle, moveX: 1, dash: true }, 0, collider) // airborne
    expect(grounded.stepEvents.dashed).toBe(false)

    const tiered = new PlayerSim(undefined, gates({ airDash: () => true }))
    tiered.setSpawn(new THREE.Vector3(0, 6, 0))
    tiered.respawn()
    tiered.step(DT, { ...idle, moveX: 1, dash: true }, 0, collider)
    expect(tiered.stepEvents.dashed).toBe(true)
  })
})

describe('grapple flight', () => {
  it('carries the player to an elevated target', () => {
    const root = new THREE.Group()
    const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 60))
    floor.position.y = -0.5
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 6))
    ledge.position.set(12, 6, 0)
    root.add(floor, ledge)
    const collider = buildCollider(root)

    const sim = new PlayerSim(undefined, gates())
    sim.setSpawn(new THREE.Vector3(0, 0.5, 0))
    sim.respawn()
    for (let i = 0; i < 60; i++) sim.step(DT, idle, 0, collider) // settle
    expect(sim.startGrapple(new THREE.Vector3(12, 7.4, 0))).toBe(true)
    let landedEvent = false
    for (let i = 0; i < 300; i++) {
      sim.step(DT, idle, 0, collider)
      landedEvent ||= sim.stepEvents.grappleLanded
    }
    expect(landedEvent).toBe(true)
    // Ended up on the ledge (top at y=6.5), not back on the floor.
    expect(sim.position.y).toBeGreaterThan(5.5)
    expect(Math.abs(sim.position.x - 12)).toBeLessThan(4)
    expect(sim.onGround).toBe(true)
  })

  it('cannot start from the air without tier 3', () => {
    const collider = flatWorld()
    const sim = new PlayerSim(undefined, gates())
    sim.setSpawn(new THREE.Vector3(0, 8, 0))
    sim.respawn()
    sim.step(DT, idle, 0, collider) // airborne
    expect(sim.startGrapple(new THREE.Vector3(10, 10, 0))).toBe(false)

    const tiered = new PlayerSim(undefined, gates({ airGrapple: () => true }))
    tiered.setSpawn(new THREE.Vector3(0, 8, 0))
    tiered.respawn()
    tiered.step(DT, idle, 0, collider)
    expect(tiered.startGrapple(new THREE.Vector3(10, 10, 0))).toBe(true)
  })
})

describe('latent paths', () => {
  const DEF = {
    id: 'test-path',
    from: [0, 2, 0] as [number, number, number],
    to: [10, 2, 0] as [number, number, number],
    islet: { x: 12, z: 0, y: 2, r: 4 },
    reveals: ['linked-cache'],
  }

  it('solidifies on pulse near an endpoint and marks linked discoverables', () => {
    const state = createInitialState()
    const bus = new EventBus()
    const paths = new LatentPaths([DEF], state, bus)
    expect(paths.solidGroups()).toHaveLength(0)

    expect(paths.pulse(50, 50, 8)).toEqual([]) // too far
    expect(paths.pulse(1, 1, 8)).toEqual(['test-path'])
    expect(state.pathsRevealed).toContain('test-path')
    expect(state.discoveries['linked-cache']).toBe('revealed')
    expect(paths.solidGroups()).toHaveLength(1)
    // Idempotent.
    expect(paths.pulse(1, 1, 8)).toEqual([])
  })

  it('restores solidified paths from a save', () => {
    const state = createInitialState()
    state.pathsRevealed = ['test-path']
    const paths = new LatentPaths([DEF], state, new EventBus())
    expect(paths.solidGroups()).toHaveLength(1)
  })

  it('a solidified path is walkable (collider includes it)', () => {
    const state = createInitialState()
    const bus = new EventBus()
    const paths = new LatentPaths([DEF], state, bus)
    paths.pulse(1, 1, 8)
    const collider = buildCollider(paths.solidGroups())
    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(5, 4, 0)) // above the plank line
    sim.respawn()
    for (let i = 0; i < 180; i++) sim.step(DT, idle, 0, collider)
    expect(sim.onGround).toBe(true) // landed ON the planks, not fallen through
    expect(sim.position.y).toBeGreaterThan(1.5)
  })

  it('walks ONTO a path from the ground — first plank is a ramp, not a wall', () => {
    // Ground at y=0; path starts slightly above it, like the region rim.
    const state = createInitialState()
    const bus = new EventBus()
    const groundLevelDef = {
      id: 'ramp-path',
      from: [3, 0.25, 0] as [number, number, number],
      to: [16, 2.5, 0] as [number, number, number],
      reveals: [],
    }
    const paths = new LatentPaths([groundLevelDef], state, bus)
    paths.pulse(3, 0, 8)
    const root = new THREE.Group()
    const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 20))
    floor.position.y = -0.5
    root.add(floor)
    const collider = buildCollider([root, ...paths.solidGroups()])

    const sim = new PlayerSim()
    sim.setSpawn(new THREE.Vector3(0, 0.5, 0))
    sim.respawn()
    for (let i = 0; i < 60; i++) sim.step(DT, idle, 0, collider)
    // Track peak progress: the walkway ends mid-air in this minimal world,
    // so the sim eventually walks off the far end and respawns.
    let maxX = 0
    let maxY = 0
    for (let i = 0; i < 300; i++) {
      sim.step(DT, { ...idle, moveX: 1 }, 0, collider)
      if (sim.onGround) {
        maxX = Math.max(maxX, sim.position.x)
        maxY = Math.max(maxY, sim.position.y)
      }
    }
    // Climbed the whole walkway, not stuck at the first plank edge.
    expect(maxX).toBeGreaterThan(14)
    expect(maxY).toBeGreaterThan(2.2)
  })
})
