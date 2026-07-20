import * as THREE from 'three'
import { buildCollider, type Collider } from './collision'
import { heightAt } from './terrain'
import { makeToonMaterial } from '../engine/toon'
import { buildRegion, type BuiltRegion, type RegionDef } from './region'

/** One shared ghost material for every unmanifested mesh. */
const GHOST_MATERIAL = makeToonMaterial('#bfe8ff', {
  transparent: true,
  opacity: 0.12,
})

/**
 * All islands live in ONE scene, separated by the mist sea — walking between
 * them is just walking. One combined collider covers everything that is
 * MANIFESTED; latent regions hang as ghosts contributing nothing until a
 * waystone completes them.
 */
export class World {
  readonly group = new THREE.Group()
  readonly regions: BuiltRegion[]
  collider: Collider
  private manifested = new Set<string>()
  private ghostOriginals = new Map<string, [THREE.Mesh, THREE.Material][]>()
  private extras: THREE.Object3D[] = []

  constructor(defs: RegionDef[], isManifested: (id: string) => boolean) {
    this.regions = defs.map(buildRegion)
    for (const r of this.regions) {
      this.group.add(r.group)
      if (isManifested(r.def.id)) {
        this.manifested.add(r.def.id)
      } else {
        this.applyGhost(r)
      }
    }
    this.collider = buildCollider(this.activeCollidables())
  }

  private activeCollidables(): THREE.Object3D[] {
    return this.regions
      .filter((r) => this.manifested.has(r.def.id))
      .map((r) => r.group.getObjectByName('collidable')!)
  }

  private applyGhost(region: BuiltRegion): void {
    const originals: [THREE.Mesh, THREE.Material][] = []
    region.group.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        originals.push([mesh, mesh.material as THREE.Material])
        mesh.material = GHOST_MATERIAL
      }
    })
    this.ghostOriginals.set(region.def.id, originals)
  }

  isManifested(id: string): boolean {
    return this.manifested.has(id)
  }

  /** Complete a latent region: solid materials, collision, real content. */
  manifest(id: string): BuiltRegion | null {
    const region = this.regions.find((r) => r.def.id === id)
    if (!region || this.manifested.has(id)) return null
    this.manifested.add(id)
    for (const [mesh, material] of this.ghostOriginals.get(id) ?? []) {
      mesh.material = material
    }
    this.ghostOriginals.delete(id)
    this.rebuildCollider(this.extras)
    return region
  }

  /** Rebuild collision including solidified latent-path groups. */
  rebuildCollider(extra: THREE.Object3D[]): void {
    this.extras = extra
    this.collider = buildCollider([...this.activeCollidables(), ...this.extras])
  }

  /** World-space terrain height over MANIFESTED islands only. */
  heightAt = (x: number, z: number): number => {
    for (const r of this.regions) {
      if (!this.manifested.has(r.def.id)) continue
      const lx = x - r.def.origin[0]
      const lz = z - r.def.origin[1]
      if (Math.hypot(lx, lz) < r.def.island.radius) {
        return heightAt(r.def.island, lx, lz)
      }
    }
    return 0
  }

  /** The manifested region whose island the point is over, if any. */
  regionAt(x: number, z: number): BuiltRegion | null {
    for (const r of this.regions) {
      if (!this.manifested.has(r.def.id)) continue
      if (
        Math.hypot(x - r.def.origin[0], z - r.def.origin[1]) <
        r.def.island.radius * 1.05
      ) {
        return r
      }
    }
    return null
  }

  private active(): BuiltRegion[] {
    return this.regions.filter((r) => this.manifested.has(r.def.id))
  }

  /** Content getters cover MANIFESTED regions only — latent content stays
   *  dormant until its region is completed (main adds it on manifest). */
  get discoverables() {
    return this.active().flatMap((r) => r.def.discoverables)
  }

  get grapplePoints() {
    return this.active().flatMap((r) => r.def.grapplePoints)
  }

  get latentPaths() {
    return this.active().flatMap((r) => r.def.latentPaths)
  }

  get enemies() {
    return this.active().flatMap((r) => r.def.enemies)
  }

  get anglingSpots() {
    return this.active().flatMap((r) => r.def.anglingSpots ?? [])
  }

  /** Ferry moorings on MANIFESTED regions — the fast-travel network. */
  get moorings() {
    return this.active().flatMap((r) =>
      r.def.mooring
        ? [{ regionId: r.def.id, name: r.def.name, x: r.def.mooring.x, z: r.def.mooring.z }]
        : [],
    )
  }
}
