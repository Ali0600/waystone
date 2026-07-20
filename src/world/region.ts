import * as THREE from 'three'
import { mulberry32 } from '../core/rng'
import { makeToonMaterial } from '../engine/toon'
import { buildCollider, type Collider } from './collision'
import { buildLandmark, type LandmarkKind } from './landmarks'
import {
  buildScatterMesh,
  makeRockGeometry,
  makeTreeGeometry,
  type ScatterPlacement,
} from './props'
import { buildIslandGeometry, heightAt, type IslandParams } from './terrain'
import type { DiscoverableDef } from '../discovery/types'
import type { GrapplePointDef } from '../player/grapple'
import type { EnemySpawnDef } from '../content/enemies'
import type { LatentPathDef } from './latentpath'

export interface RegionPalette {
  sky: string
  fog: string
  hemiSky: string
  hemiGround: string
  sun: string
  grass: string
  cliff: string
  rim: string
  underside: string
  trunk: string
  canopy: string[]
  rock: string
}

export interface LandmarkDef {
  kind: LandmarkKind
  x: number
  z: number
  yaw?: number
  scale?: number
}

export interface RegionDef {
  id: string
  name: string
  /** World-space centre of this island. All other coordinates in the def
   *  (landmarks, discoverables, pylons, paths, spawn) are WORLD coords. */
  origin: [number, number]
  island: IslandParams
  palette: RegionPalette
  fog: { near: number; far: number }
  sunDir: [number, number, number]
  landmarks: LandmarkDef[]
  scatter: { trees: number; rocks: number; seed: number }
  /** x/z only; y resolved from the terrain at build time. */
  spawn: [number, number]
  discoverables: DiscoverableDef[]
  grapplePoints: GrapplePointDef[]
  latentPaths: LatentPathDef[]
  enemies: EnemySpawnDef[]
  /** Density budget floor for the content-invariant tests (hub isles are
   *  smaller than full regions). Defaults to 10. */
  minDiscoverables?: number
}

export interface BuiltRegion {
  def: RegionDef
  group: THREE.Group
  collider: Collider
  spawn: THREE.Vector3
  heightAt(x: number, z: number): number
  /** Rebuild collision including extra solidified groups (latent paths). */
  rebuildCollider(extra: THREE.Object3D[]): void
}

export function buildRegion(def: RegionDef): BuiltRegion {
  const group = new THREE.Group()
  group.name = `region:${def.id}`
  const collidable = new THREE.Group()
  collidable.name = 'collidable'
  group.add(collidable)
  const [ox, oz] = def.origin

  // Terrain (island-local geometry placed at the region origin).
  const terrainGeo = buildIslandGeometry(def.island, {
    grass: def.palette.grass,
    cliff: def.palette.cliff,
    rim: def.palette.rim,
    underside: def.palette.underside,
  })
  const terrain = new THREE.Mesh(
    terrainGeo,
    makeToonMaterial('#ffffff', { vertexColors: true }),
  )
  terrain.name = 'terrain'
  terrain.position.set(ox, 0, oz)
  collidable.add(terrain)

  /** World-coord height query for this island. */
  const h = (x: number, z: number) => heightAt(def.island, x - ox, z - oz)

  // Landmarks (collidable).
  for (const lm of def.landmarks) {
    const built = buildLandmark(lm.kind, def.palette.rock)
    built.position.set(lm.x, h(lm.x, lm.z), lm.z)
    built.rotation.y = lm.yaw ?? 0
    built.scale.setScalar(lm.scale ?? 1)
    collidable.add(built)
  }

  // Elevated perch discoverables stand on real floating ledges — grapple
  // destinations with actual footing (interaction requires being up there).
  for (const d of def.discoverables) {
    if (d.kind === 'perch' && (d.dy ?? 0) > 1.5) {
      const ledge = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 1.5, 0.6, 8),
        makeToonMaterial(def.palette.rock),
      )
      ledge.position.set(d.x, h(d.x, d.z) + (d.dy ?? 0) - 0.3, d.z)
      collidable.add(ledge)
    }
  }

  // Scattered decor (visual only): one BatchedMesh, one draw call.
  const rng = mulberry32(def.scatter.seed)
  const geometries = [
    makeRockGeometry(rng, 0.7, def.palette.rock),
    makeRockGeometry(rng, 1.2, def.palette.cliff),
    makeTreeGeometry(def.palette.trunk, def.palette.canopy[0]),
    makeTreeGeometry(def.palette.trunk, def.palette.canopy[1 % def.palette.canopy.length]),
  ]
  const placements: ScatterPlacement[] = []
  const avoid: { x: number; z: number; r: number }[] = [
    { x: def.spawn[0], z: def.spawn[1], r: 4 },
    ...def.landmarks.map((lm) => ({ x: lm.x, z: lm.z, r: 5 })),
  ]
  const tryPlace = (geometryIndex: number, isTree: boolean) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * def.island.radius * 0.9
      const x = ox + Math.cos(a) * r
      const z = oz + Math.sin(a) * r
      if (avoid.some((av) => Math.hypot(x - av.x, z - av.z) < av.r)) continue
      if (
        isTree &&
        def.island.plateaus.some(
          (pl) => Math.hypot(x - ox - pl.x, z - oz - pl.z) < pl.r * 0.8,
        )
      ) {
        continue
      }
      placements.push({
        geometryIndex,
        x,
        y: h(x, z) - 0.05,
        z,
        yaw: rng() * Math.PI * 2,
        scale: 0.75 + rng() * 0.6,
      })
      return
    }
  }
  for (let i = 0; i < def.scatter.rocks; i++) tryPlace(i % 2, false)
  for (let i = 0; i < def.scatter.trees; i++) tryPlace(2 + (i % 2), true)
  group.add(buildScatterMesh(geometries, placements))

  const spawn = new THREE.Vector3(
    def.spawn[0],
    h(def.spawn[0], def.spawn[1]) + 0.2,
    def.spawn[1],
  )
  const built: BuiltRegion = {
    def,
    group,
    collider: buildCollider(collidable),
    spawn,
    heightAt: h,
    rebuildCollider(extra: THREE.Object3D[]) {
      built.collider = buildCollider([collidable, ...extra])
    },
  }
  return built
}
