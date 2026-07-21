import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { WorldEnemies } from '../src/combat/worldenemies'
import { createInitialState } from '../src/core/state'
import type { EnemySpawnDef } from '../src/content/enemies'

// Flat world so patrol positions are predictable.
const flat = () => 0

function spawn(over: Partial<EnemySpawnDef> = {}): EnemySpawnDef {
  return { enemyId: 'husk', x: 0, z: 0, patrolR: 0, guards: undefined, ...over }
}

/** The emissive hex of an enemy group's first glowing sub-mesh (0 = no glow). */
function emissiveHex(group: THREE.Object3D): number {
  let hex = 0
  group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined
    if (m && m.emissive && hex === 0) hex = m.emissive.getHex() * (m.emissiveIntensity > 0 ? 1 : 0)
  })
  return hex
}

describe('WorldEnemies — touch begins a duel', () => {
  it('returns a contact when the player is within touch range of a live enemy', () => {
    const we = new WorldEnemies([spawn({ x: 10, z: 0, patrolR: 0 })], createInitialState(), flat)
    // Far away → no contact.
    expect(we.update(1 / 60, 0, 0)).toBeNull()
    // On top of it (patrolR 0 keeps it at its spawn) → contact carrying its identity.
    const c = we.update(1 / 60, 10, 0)
    expect(c).not.toBeNull()
    expect(c!.def.id).toBe('husk')
    expect(c!.spawnIndex).toBe(0)
  })

  it('carries the guards id so a victory can unlock the guarded discoverable', () => {
    const we = new WorldEnemies(
      [spawn({ x: 0, z: 0, guards: 'af-tool-grapple' })],
      createInitialState(),
      flat,
    )
    expect(we.update(1 / 60, 0, 0)!.guards).toBe('af-tool-grapple')
  })

  it('a defeated enemy despawns — no more contact', () => {
    const we = new WorldEnemies([spawn()], createInitialState(), flat)
    expect(we.update(1 / 60, 0, 0)).not.toBeNull()
    we.markDefeated(0)
    expect(we.update(1 / 60, 0, 0)).toBeNull()
  })

  it('a guardian already recorded in the save starts defeated (stays cleared forever)', () => {
    const state = createInitialState()
    state.guardiansDefeated.push('af-tool-grapple')
    const we = new WorldEnemies(
      [spawn({ guards: 'af-tool-grapple' })],
      state,
      flat,
    )
    expect(we.update(1 / 60, 0, 0)).toBeNull() // no re-fight
  })

  it('picks the NEAREST live enemy in range, not the first by array order', () => {
    // You walked into the closer one — the duel must open against IT, not
    // whichever happens to be earlier in the spawn list. The nearer enemy is
    // deliberately placed LATER so a first-wins bug fails this.
    const we = new WorldEnemies(
      [spawn({ x: 1.5, z: 0 }), spawn({ x: 0.3, z: 0 })], // idx0 far, idx1 near
      createInitialState(),
      flat,
    )
    const c = we.update(1 / 60, 0, 0)
    expect(c).not.toBeNull()
    expect(c!.spawnIndex).toBe(1)
  })

  it('a post-fight grace suppresses contact, then re-engages after it lapses', () => {
    const we = new WorldEnemies([spawn({ x: 0, z: 0 })], createInitialState(), flat)
    expect(we.update(1 / 60, 0, 0)).not.toBeNull() // in range, no grace
    we.suppress(2)
    expect(we.update(1 / 60, 0, 0)).toBeNull() // grace: standing on it, no duel
    for (let t = 0; t < 2; t += 1 / 60) we.update(1 / 60, 0, 0) // step past the grace
    expect(we.update(1 / 60, 0, 0)).not.toBeNull() // re-engages deliberately
  })

  it('the chained-duel bug: winning enemy A does not instantly start enemy B', () => {
    // Two enemies both inside touch range (as when patrols overlap on an isle).
    const we = new WorldEnemies(
      [spawn({ x: 0.4, z: 0 }), spawn({ x: 0.8, z: 0 })],
      createInitialState(),
      flat,
    )
    const first = we.update(1 / 60, 0, 0)
    expect(first!.spawnIndex).toBe(0) // nearest
    // Model endEncounter(): defeat A + apply the post-fight grace.
    we.markDefeated(first!.spawnIndex)
    we.suppress(2)
    // The very next world frame must NOT chain into a duel with B.
    expect(we.update(1 / 60, 0, 0)).toBeNull()
  })
})

describe('WorldEnemies — grapple targets', () => {
  it('liveTargets reports live enemies at chest height, and drops the defeated', () => {
    const we = new WorldEnemies([spawn({ x: 5, z: 0, patrolR: 0 })], createInitialState(), flat)
    we.update(1 / 60, 0, 0) // position the patrol
    const [t] = we.liveTargets()
    expect(t.spawnIndex).toBe(0)
    expect(t.pos.x).toBeCloseTo(5, 1)
    expect(t.pos.z).toBeCloseTo(0, 1)
    expect(t.pos.y).toBeGreaterThan(1) // chest offset above the ground (bob-inclusive)
    expect(t.pos.y).toBeLessThan(1.25)
    we.markDefeated(0)
    expect(we.liveTargets()).toHaveLength(0)
  })

  it('liveTargets follows the patrol (positions are current, not the spawn point)', () => {
    const we = new WorldEnemies([spawn({ x: 5, z: 0, patrolR: 3 })], createInitialState(), flat)
    for (let i = 0; i < 120; i++) we.update(1 / 60, 0, 0)
    const { pos } = we.liveTargets()[0]
    // On the patrol circle: radius 3 about (5, 0).
    expect(Math.hypot(pos.x - 5, pos.z - 0)).toBeCloseTo(3, 1)
  })

  it('highlights exactly one enemy and un-glows the previous when the target moves', () => {
    const we = new WorldEnemies(
      [spawn({ x: 5, z: 0 }), spawn({ x: -5, z: 0 })],
      createInitialState(),
      flat,
    )
    const [g0, g1] = we.group.children
    we.setGrappleHighlight(0)
    we.update(1 / 60, 100, 100) // far from both — no contact, applies the glow
    expect(emissiveHex(g0)).not.toBe(0) // enemy 0 glows gold
    expect(emissiveHex(g1)).toBe(0) // enemy 1 dark

    we.setGrappleHighlight(1) // aim swings to the other foe
    we.update(1 / 60, 100, 100)
    expect(emissiveHex(g0)).toBe(0) // previous target restored to no-glow
    expect(emissiveHex(g1)).not.toBe(0)

    we.setGrappleHighlight(null) // aim leaves both
    we.update(1 / 60, 100, 100)
    expect(emissiveHex(g1)).toBe(0)
  })
})
