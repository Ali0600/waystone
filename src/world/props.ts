import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Rng } from '../core/rng'
import { makeToonMaterial } from '../engine/toon'

/** Bakes a uniform vertex color onto a geometry (drops UVs for merge parity). */
function colorize(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  geo.deleteAttribute('uv')
  const count = geo.getAttribute('position').count
  const c = new THREE.Color(hex)
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

/** All prop geometry ends up non-indexed + flat-shaded, then sequentially
 *  indexed — BatchedMesh wants every geometry shaped the same way. */
function finalize(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = geo.index === null ? geo : geo.toNonIndexed()
  flat.computeVertexNormals()
  const count = flat.getAttribute('position').count
  flat.setIndex(Array.from({ length: count }, (_, i) => i))
  return flat
}

function mergedProp(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = parts.map((g) => (g.index === null ? g : g.toNonIndexed()))
  const merged = mergeGeometries(nonIndexed)
  for (const g of nonIndexed) g.dispose()
  return finalize(merged)
}

export function makeRockGeometry(rng: Rng, size: number, color: string): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(size, 0)
  const pos = geo.getAttribute('position')
  // Jitter matched vertices consistently: hash by rounded position.
  const seen = new Map<string, [number, number, number]>()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    let jitter = seen.get(key)
    if (!jitter) {
      jitter = [(rng() - 0.5) * size * 0.5, (rng() - 0.5) * size * 0.35, (rng() - 0.5) * size * 0.5]
      seen.set(key, jitter)
    }
    pos.setXYZ(i, pos.getX(i) + jitter[0], Math.max(-size * 0.2, pos.getY(i) + jitter[1]), pos.getZ(i) + jitter[2])
  }
  return finalize(colorize(geo, color))
}

export function makeTreeGeometry(trunkColor: string, canopyColor: string): THREE.BufferGeometry {
  const trunk = colorize(new THREE.CylinderGeometry(0.14, 0.2, 1.2, 6), trunkColor)
  trunk.translate(0, 0.6, 0)
  const lower = colorize(new THREE.ConeGeometry(1.0, 1.5, 7), canopyColor)
  lower.translate(0, 1.85, 0)
  const upperCol = new THREE.Color(canopyColor).lerp(new THREE.Color('#fff2c0'), 0.22)
  const upper = colorize(new THREE.ConeGeometry(0.66, 1.2, 7), `#${upperCol.getHexString()}`)
  upper.translate(0, 2.75, 0)
  return mergedProp([trunk, lower, upper])
}

export interface ScatterPlacement {
  geometryIndex: number
  x: number
  y: number
  z: number
  yaw: number
  scale: number
}

/**
 * One BatchedMesh for all scattered decor: mixed geometries, one toon
 * material, one draw call. Geometries must come pre-indexed (see finalize).
 */
export function buildScatterMesh(
  geometries: THREE.BufferGeometry[],
  placements: ScatterPlacement[],
): THREE.BatchedMesh {
  let maxVerts = 0
  let maxIndices = 0
  for (const g of geometries) {
    maxVerts += g.getAttribute('position').count
    maxIndices += g.index?.count ?? 0
  }
  const material = makeToonMaterial('#ffffff', { vertexColors: true })
  const batched = new THREE.BatchedMesh(placements.length, maxVerts, maxIndices, material)
  const ids = geometries.map((g) => batched.addGeometry(g))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const s = new THREE.Vector3()
  const t = new THREE.Vector3()
  for (const p of placements) {
    const instance = batched.addInstance(ids[p.geometryIndex])
    q.setFromAxisAngle(up, p.yaw)
    s.setScalar(p.scale)
    t.set(p.x, p.y, p.z)
    m.compose(t, q, s)
    batched.setMatrixAt(instance, m)
  }
  return batched
}
