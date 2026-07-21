import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GrappleVerb, type GrapplePointDef } from '../src/player/grapple'
import { PlayerSim } from '../src/player/controller'
import type { Collider } from '../src/world/collision'

// A collider stub whose ray never hits anything (clear line of sight). Individual
// tests override raycastFirst to model an obstruction.
function stubCollider(raycastFirst: () => unknown = () => null): Collider {
  return { bvh: { raycastFirst } } as unknown as Collider
}

const flat = () => 0

/** A grounded player at the origin (grapple targeting reads player.position). */
function playerAt(x = 0, y = 0.5, z = 0): PlayerSim {
  // airGrapple gate open so tryLaunch works without a real floor to stand on.
  const p = new PlayerSim(undefined, {
    airDash: () => false,
    airGrapple: () => true,
    dashPower: () => 1,
  })
  p.position.set(x, y, z)
  return p
}

/** Build a verb over the given pylons, player looking down -Z (yaw 0, pitch 0). */
function verb(pylons: GrapplePointDef[], player = playerAt()): GrappleVerb {
  return new GrappleVerb(pylons, flat, player)
}

describe('GrappleVerb — targeting the crystal pylons', () => {
  it('targets a pylon roughly ahead and in range', () => {
    const g = verb([{ x: 0, z: -10, dy: 4 }])
    g.updateTargeting(0, 0, stubCollider())
    expect(g.targetPoint()).not.toBeNull()
    expect(g.dynamicTargetId()).toBeNull() // it's a pylon, not a foe
  })

  it('rejects a pylon behind the aim cone, too close, or out of range', () => {
    // Behind the player (looking -Z, pylon at +Z).
    const behind = verb([{ x: 0, z: 10, dy: 4 }])
    behind.updateTargeting(0, 0, stubCollider())
    expect(behind.targetPoint()).toBeNull()

    // Closer than the 2u minimum.
    const near = verb([{ x: 0, z: -1, dy: 0.5 }])
    near.updateTargeting(0, 0, stubCollider())
    expect(near.targetPoint()).toBeNull()

    // Beyond the 20u range.
    const far = verb([{ x: 0, z: -40, dy: 4 }])
    far.updateTargeting(0, 0, stubCollider())
    expect(far.targetPoint()).toBeNull()
  })
})

describe('GrappleVerb — grappable enemies (dynamic targets)', () => {
  const foe = (id: number, x: number, z: number) => ({
    id,
    pos: new THREE.Vector3(x, 1.1, z),
  })

  it('targets a foe in the aim cone and reports its id', () => {
    const g = verb([])
    g.updateTargeting(0, 0, stubCollider(), [foe(5, 0, -8)])
    expect(g.dynamicTargetId()).toBe(5)
    // targetPoint is the foe's position — tryLaunch pulls toward it.
    expect(g.targetPoint()!.z).toBeCloseTo(-8)
  })

  it('ignores a foe behind, too close, or out of range', () => {
    const g = verb([])
    g.updateTargeting(0, 0, stubCollider(), [foe(1, 0, 8)]) // behind
    expect(g.dynamicTargetId()).toBeNull()
    g.updateTargeting(0, 0, stubCollider(), [foe(2, 0, -1)]) // too close
    expect(g.dynamicTargetId()).toBeNull()
    g.updateTargeting(0, 0, stubCollider(), [foe(3, 0, -40)]) // too far
    expect(g.dynamicTargetId()).toBeNull()
  })

  it('picks the most-aimed-at: a dead-ahead foe beats an off-axis pylon', () => {
    // The pylon is a legitimate candidate on its own...
    const g = verb([{ x: 4, z: -9, dy: 3 }])
    g.updateTargeting(0, 0, stubCollider(), [])
    expect(g.targetPoint()).not.toBeNull()
    expect(g.dynamicTargetId()).toBeNull()
    // ...but a foe straight down the crosshair wins on score.
    g.updateTargeting(0, 0, stubCollider(), [foe(9, 0, -9)])
    expect(g.dynamicTargetId()).toBe(9)
  })

  it('a mid-ray obstruction rejects the foe; a graze near it does not', () => {
    const g = verb([])
    // Foe ~8u out. A hit at 3u (well short of dist-3.2) is a true blocker.
    g.updateTargeting(0, 0, stubCollider(() => ({ distance: 3 })), [foe(4, 0, -8)])
    expect(g.dynamicTargetId()).toBeNull()
    // A hit at 7u (inside the 3.2u end-exemption) is the foe's own ground, not a wall.
    g.updateTargeting(0, 0, stubCollider(() => ({ distance: 7 })), [foe(4, 0, -8)])
    expect(g.dynamicTargetId()).toBe(4)
  })

  it('tryLaunch at a foe pulls the player toward it', () => {
    const player = playerAt()
    const g = verb([], player)
    g.updateTargeting(0, 0, stubCollider(), [foe(2, 0, -8)])
    expect(g.tryLaunch()).toBe(true)
    expect(player.mode).toBe('grapple')
    expect(player.grappleTarget.z).toBeCloseTo(-8)
  })
})
