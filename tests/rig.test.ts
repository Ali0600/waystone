import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { HeroDriver, applyPose, attachSword, buildHeroRig } from '../src/player/rig'
import { DRAW_SWAP_U, JOINTS, zeroPose } from '../src/player/heroanim'

describe('buildHeroRig', () => {
  it('exposes every joint and a lantern light in the left hand', () => {
    const rig = buildHeroRig()
    for (const j of JOINTS) expect(rig.joints[j]).toBeInstanceOf(THREE.Group)
    expect(rig.lanternLight).toBeInstanceOf(THREE.PointLight)
    // The light lives under the LEFT (lantern) arm chain.
    let p: THREE.Object3D | null = rig.lanternLight
    const chain: THREE.Object3D[] = []
    while (p) {
      chain.push(p)
      p = p.parent
    }
    expect(chain).toContain(rig.joints.shoulderL)
    expect(chain).not.toContain(rig.joints.shoulderR)
  })

  it('respects a custom lantern intensity', () => {
    expect(buildHeroRig({ lanternIntensity: 10 }).lanternLight.intensity).toBe(10)
  })
})

describe('attachSword', () => {
  it('reparents the ONE sword instance between sockets (never clones)', () => {
    const rig = buildHeroRig()
    for (const where of ['hand', 'back', 'hand', 'back', 'hand'] as const) {
      attachSword(rig, where)
      const socket = where === 'hand' ? rig.handSocket : rig.backSocket
      expect(rig.sword.parent).toBe(socket)
      // Exactly one 'sword' node anywhere under the rig.
      let count = 0
      rig.group.traverse((o) => {
        if (o.name === 'sword') count++
      })
      expect(count).toBe(1)
      // Local transform reset to the socket.
      expect(rig.sword.position.lengthSq()).toBe(0)
    }
  })
})

describe('applyPose', () => {
  it('eases each joint toward the target (converges over a second)', () => {
    const rig = buildHeroRig()
    const target = zeroPose()
    target.shoulderR = { x: 1, y: 0, z: 0 }
    for (let i = 0; i < 60; i++) applyPose(rig, target, 1 / 60, 0.09)
    expect(rig.joints.shoulderR.rotation.x).toBeCloseTo(1, 3)
  })
})

describe('HeroDriver', () => {
  it('an active attack overrides locomotion; the gait resumes when it ends', () => {
    const rig = buildHeroRig()
    const d = new HeroDriver(rig)
    d.setLocomotion('run', 7)
    // victory HOLDS at its apex (shoulderR ≈ −2.8), so easing converges there —
    // if locomotion wrongly won, shoulderR would oscillate near 0.
    d.playAction('victory')
    for (let i = 0; i < 120; i++) d.update(1 / 60)
    expect(rig.joints.shoulderR.rotation.x).toBeLessThan(-2.0)
    expect(d.currentAction()!.id).toBe('victory')

    // A non-holding attack clears itself, and locomotion takes over again.
    d.playAction('thrust') // dur 0.42
    for (let i = 0; i < 60; i++) d.update(1 / 60) // 1s > dur
    expect(d.currentAction()).toBeNull()
  })

  it('reports the current attack progress', () => {
    const d = new HeroDriver(buildHeroRig())
    d.playAction('overhead') // dur 0.45
    d.update(0.45 / 2)
    expect(d.currentAction()!.id).toBe('overhead')
    expect(d.currentAction()!.u).toBeCloseTo(0.5, 2)
  })

  // M41: the sword draw-swap moved OUT of the Arena INTO the driver, so combat and
  // the (future) GLB path both get it for free through the IHeroCharacter surface.
  it('draws the sword from the back into the hand as the draw action plays', () => {
    const rig = buildHeroRig()
    const d = new HeroDriver(rig)
    expect(rig.sword.parent).toBe(rig.backSocket) // sheathed at rest

    d.playAction('draw')
    d.update(1 / 60) // early in the draw, before the swap point
    expect(d.currentAction()!.id).toBe('draw')
    expect(d.currentAction()!.u).toBeLessThan(DRAW_SWAP_U)
    expect(rig.sword.parent).toBe(rig.backSocket)

    // Advance past DRAW_SWAP_U (bounded — never loop unbounded on a UI/anim condition).
    for (let i = 0; i < 120 && (d.currentAction()?.u ?? 1) < DRAW_SWAP_U; i++) d.update(1 / 60)
    expect(rig.sword.parent).toBe(rig.handSocket)
  })

  it('leaves the sword sheathed while only locomotion plays — the world avatar', () => {
    const rig = buildHeroRig()
    const d = new HeroDriver(rig)
    d.setLocomotion('run', 7)
    for (let i = 0; i < 60; i++) d.update(1 / 60)
    expect(rig.sword.parent).toBe(rig.backSocket)
  })

  it('a non-draw attack (a grapple slam that skips the draw) takes the sword in hand at once', () => {
    const rig = buildHeroRig()
    const d = new HeroDriver(rig)
    d.playAction('slam')
    d.update(1 / 60)
    expect(rig.sword.parent).toBe(rig.handSocket)
  })
})
