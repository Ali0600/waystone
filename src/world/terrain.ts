import * as THREE from 'three'
import { fbm2 } from '../core/rng'

/** A flat circular zone — POIs and buildings sit on these. */
export interface Plateau {
  x: number
  z: number
  r: number
  h: number
}

export interface IslandParams {
  seed: number
  radius: number
  maxHeight: number
  /** Cosmetic ripple quantization — keep small enough to stay walkable. */
  terraceStep: number
  /** World units per noise cell. */
  noiseScale: number
  plateaus: Plateau[]
}

export interface TerrainColors {
  grass: string
  cliff: string
  rim: string
  underside: string
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Pure, deterministic island heightfield. 0 outside the island radius. */
export function heightAt(p: IslandParams, x: number, z: number): number {
  const d = Math.hypot(x, z)
  if (d >= p.radius) return 0
  const falloff = 1 - smoothstep(p.radius * 0.6, p.radius, d)
  let h = fbm2(x / p.noiseScale, z / p.noiseScale, p.seed) * p.maxHeight * falloff
  if (p.terraceStep > 0) {
    const terraced = Math.round(h / p.terraceStep) * p.terraceStep
    h = (h + terraced) / 2
  }
  for (const pl of p.plateaus) {
    const pd = Math.hypot(x - pl.x, z - pl.z)
    const w = 1 - smoothstep(pl.r * 0.55, pl.r, pd)
    h = h * (1 - w) + pl.h * w
  }
  return h
}

/**
 * Builds the island surface + a tapered rock underside as one flat-shaded,
 * vertex-colored geometry (indexed, ready for BVH + BatchedMesh alike).
 */
export function buildIslandGeometry(
  p: IslandParams,
  colors: TerrainColors,
): THREE.BufferGeometry {
  const rings = Math.max(24, Math.round(p.radius / 2))
  const segments = 72
  const positions: number[] = []

  // Surface: center vertex + rings of vertices.
  positions.push(0, heightAt(p, 0, 0), 0)
  for (let ri = 1; ri <= rings; ri++) {
    const r = (ri / rings) * p.radius
    for (let si = 0; si < segments; si++) {
      const a = (si / segments) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      positions.push(x, heightAt(p, x, z), z)
    }
  }
  const bottomIndex = positions.length / 3
  positions.push(0, -p.radius * 0.45, 0)

  const ringStart = (ri: number) => 1 + (ri - 1) * segments
  const indices: number[] = []
  // Winding: counter-clockwise seen from above (+Y normals) — see
  // terrain-winding.test.ts; backward winding renders as an invisible island.
  // Innermost fan.
  for (let si = 0; si < segments; si++) {
    indices.push(0, ringStart(1) + ((si + 1) % segments), ringStart(1) + si)
  }
  // Quads between rings.
  for (let ri = 1; ri < rings; ri++) {
    for (let si = 0; si < segments; si++) {
      const a = ringStart(ri) + si
      const b = ringStart(ri) + ((si + 1) % segments)
      const c = ringStart(ri + 1) + si
      const d = ringStart(ri + 1) + ((si + 1) % segments)
      indices.push(a, b, c, b, d, c)
    }
  }
  // Underside skirt to the bottom tip.
  for (let si = 0; si < segments; si++) {
    const a = ringStart(rings) + si
    const b = ringStart(rings) + ((si + 1) % segments)
    indices.push(a, b, bottomIndex)
  }

  let geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo = geo.toNonIndexed()

  // Per-face flat colors by slope + height.
  const pos = geo.getAttribute('position')
  const colorAttr = new Float32Array(pos.count * 3)
  const grass = new THREE.Color(colors.grass)
  const cliff = new THREE.Color(colors.cliff)
  const rim = new THREE.Color(colors.rim)
  const underside = new THREE.Color(colors.underside)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const n = new THREE.Vector3()
  const col = new THREE.Color()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize()
    const midY = (a.y + b.y + c.y) / 3
    const midR = Math.hypot((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3)
    if (midY < -0.05 || n.y < 0.05) {
      col.copy(underside)
    } else if (n.y < 0.62) {
      col.copy(cliff)
    } else {
      col.copy(grass)
      // Slightly sun-bleached highlands, darker rim band.
      col.lerp(new THREE.Color('#fff4d8'), Math.min(0.25, midY / (p.maxHeight * 2.5)))
      if (midR > p.radius * 0.85) col.lerp(rim, 0.5)
    }
    for (let v = 0; v < 3; v++) {
      colorAttr[(i + v) * 3] = col.r
      colorAttr[(i + v) * 3 + 1] = col.g
      colorAttr[(i + v) * 3 + 2] = col.b
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3))
  geo.computeVertexNormals()
  // Re-index sequentially so downstream consumers (BatchedMesh) can rely on
  // every geometry having an index buffer.
  geo.setIndex(
    Array.from({ length: pos.count }, (_, i) => i),
  )
  return geo
}
