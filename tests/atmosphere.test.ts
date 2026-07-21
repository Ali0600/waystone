import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { AtmosphereRig, ATMOS_TAU, smoothFactor } from '../src/world/atmosphere'
import { MistSea } from '../src/world/mist'
import { amberfall } from '../src/content/regions/amberfall'
import { cindervault } from '../src/content/regions/cindervault'
import { palegrove } from '../src/content/regions/palegrove'

/** Ease a scalar toward a target by factor k (the rig's per-channel step). */
const ease = (cur: number, target: number, k: number) => cur + (target - cur) * k

function makeRig(initial = amberfall) {
  const scene = new THREE.Scene()
  const fog = new THREE.Fog('#000000', 10, 100)
  scene.fog = fog
  const hemi = new THREE.HemisphereLight('#000000', '#000000', 1.9)
  const sun = new THREE.DirectionalLight('#000000', 2.4)
  const mist = new MistSea('#000000')
  const rig = new AtmosphereRig(scene, fog, hemi, sun, mist, initial)
  return { scene, fog, hemi, sun, mist, rig }
}

const hex = (c: string) => new THREE.Color(c).getHexString()
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps

describe('smoothFactor', () => {
  it('is frame-rate independent: two half-steps == one full step', () => {
    // For a fixed target, easing by dt/2 twice must land exactly where dt once
    // lands — otherwise a variable frame rate changes the blend speed.
    const dt = 0.1
    const one = ease(0, 1, smoothFactor(dt))
    let two = ease(0, 1, smoothFactor(dt / 2))
    two = ease(two, 1, smoothFactor(dt / 2))
    expect(two).toBeCloseTo(one, 12)
  })

  it('returns 0 for dt<=0 and rises monotonically toward 1', () => {
    expect(smoothFactor(0)).toBe(0)
    expect(smoothFactor(-1)).toBe(0)
    expect(smoothFactor(0.05)).toBeLessThan(smoothFactor(0.2))
    expect(smoothFactor(1000)).toBeGreaterThan(0.99)
    expect(smoothFactor(ATMOS_TAU)).toBeCloseTo(1 - Math.exp(-1), 12)
  })
})

describe('AtmosphereRig', () => {
  it('snapTo sets every channel to the region exactly', () => {
    const { scene, fog, sun, mist, rig } = makeRig()
    rig.snapTo(cindervault)
    expect((scene.background as THREE.Color).getHexString()).toBe(hex(cindervault.palette.sky))
    expect(fog.color.getHexString()).toBe(hex(cindervault.palette.fog))
    expect(fog.near).toBe(cindervault.fog.near)
    expect(fog.far).toBe(cindervault.fog.far)
    // sun sits along its direction * 80
    const d = new THREE.Vector3(...cindervault.sunDir).multiplyScalar(80)
    expect(near(sun.position.x, d.x, 1e-6)).toBe(true)
    expect(near(sun.position.z, d.z, 1e-6)).toBe(true)
    // mist upper disc = the fog colour
    const upper = (mist as unknown as { upper: THREE.Mesh }).upper.material as THREE.MeshBasicMaterial
    expect(upper.color.getHexString()).toBe(hex(cindervault.palette.fog))
  })

  it('setTarget eases every channel to the new region within a few seconds', () => {
    const { scene, fog, sun, rig } = makeRig(amberfall)
    rig.setTarget(cindervault)
    for (let i = 0; i < 60; i++) rig.update(0.1) // 6s >> 3·tau
    const sky = new THREE.Color(cindervault.palette.sky)
    const bg = scene.background as THREE.Color
    expect(near(bg.r, sky.r)).toBe(true)
    expect(near(bg.g, sky.g)).toBe(true)
    expect(near(bg.b, sky.b)).toBe(true)
    expect(near(fog.near, cindervault.fog.near, 0.5)).toBe(true)
    expect(near(fog.far, cindervault.fog.far, 0.5)).toBe(true)
    const d = new THREE.Vector3(...cindervault.sunDir).multiplyScalar(80)
    expect(near(sun.position.x, d.x, 0.5)).toBe(true)
  })

  it('a mid-blend retarget converges to the LATEST region (no stuck from/to)', () => {
    const { scene, rig } = makeRig(amberfall)
    rig.setTarget(cindervault)
    for (let i = 0; i < 3; i++) rig.update(0.1) // partway to cindervault
    rig.setTarget(palegrove) // flip mid-blend
    for (let i = 0; i < 80; i++) rig.update(0.1)
    const sky = new THREE.Color(palegrove.palette.sky)
    const bg = scene.background as THREE.Color
    expect(near(bg.r, sky.r)).toBe(true)
    expect(near(bg.g, sky.g)).toBe(true)
    expect(near(bg.b, sky.b)).toBe(true)
  })
})
