import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildIslandGeometry, type IslandParams } from '../src/world/terrain'

const params: IslandParams = {
  seed: 1187,
  radius: 80,
  maxHeight: 7,
  terraceStep: 0.45,
  noiseScale: 26,
  plateaus: [{ x: 0, z: 0, r: 14, h: 4.2 }],
}

/**
 * Regression: terrain faces must wind so their normals point OUT of the
 * island. Backward winding still collides fine (capsule resolve ignores
 * winding) but FrontSide rendering culls the whole walkable surface — the
 * player appears to stand on the mist sea. Caught live in M1 QA.
 */
describe('island geometry winding', () => {
  it('walkable surface faces point up', () => {
    const geo = buildIslandGeometry(params, {
      grass: '#75955c',
      cliff: '#7a6a5c',
      rim: '#57493e',
      underside: '#3a3243',
    })
    const pos = geo.getAttribute('position')
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const n = new THREE.Vector3()
    let surface = 0
    let upFacing = 0
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i)
      b.fromBufferAttribute(pos, i + 1)
      c.fromBufferAttribute(pos, i + 2)
      const midY = (a.y + b.y + c.y) / 3
      const midR = Math.hypot((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3)
      // Interior walkable faces only (skip cliffs/skirt/rim edge).
      if (midY < 0.2 || midR > params.radius * 0.75) continue
      n.crossVectors(b.clone().sub(a), c.clone().sub(a))
      if (n.y > 1e-9) upFacing++
      surface++
    }
    expect(surface).toBeGreaterThan(500) // sanity: we actually sampled faces
    expect(upFacing / surface).toBeGreaterThan(0.98)
  })

  it('underside skirt faces point down and out, not into the island', () => {
    const geo = buildIslandGeometry(params, {
      grass: '#75955c',
      cliff: '#7a6a5c',
      rim: '#57493e',
      underside: '#3a3243',
    })
    const pos = geo.getAttribute('position')
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const n = new THREE.Vector3()
    const mid = new THREE.Vector3()
    let skirt = 0
    let outward = 0
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i)
      b.fromBufferAttribute(pos, i + 1)
      c.fromBufferAttribute(pos, i + 2)
      mid.copy(a).add(b).add(c).divideScalar(3)
      if (mid.y > -1) continue // skirt faces only
      n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize()
      // Outward = away from the island's central axis or downward.
      const radial = Math.hypot(mid.x, mid.z)
      const dot = radial > 1e-6 ? (n.x * mid.x + n.z * mid.z) / radial : 0
      if (dot > 0 || n.y < 0) outward++
      skirt++
    }
    expect(skirt).toBeGreaterThan(50)
    expect(outward / skirt).toBeGreaterThan(0.98)
  })
})
