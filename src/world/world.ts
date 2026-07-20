import * as THREE from 'three'
import { buildCollider, type Collider } from './collision'
import { heightAt } from './terrain'
import { buildRegion, type BuiltRegion, type RegionDef } from './region'

/**
 * All islands live in ONE scene, separated by the mist sea — walking between
 * them is just walking. One combined collider covers everything.
 */
export class World {
  readonly group = new THREE.Group()
  readonly regions: BuiltRegion[]
  collider: Collider
  private readonly collidables: THREE.Object3D[]
  private extras: THREE.Object3D[] = []

  constructor(defs: RegionDef[]) {
    this.regions = defs.map(buildRegion)
    for (const r of this.regions) this.group.add(r.group)
    this.collidables = this.regions.map(
      (r) => r.group.getObjectByName('collidable')!,
    )
    this.collider = buildCollider(this.collidables)
  }

  /** Rebuild collision including solidified latent-path groups. */
  rebuildCollider(extra: THREE.Object3D[]): void {
    this.extras = extra
    this.collider = buildCollider([...this.collidables, ...this.extras])
  }

  /** World-space terrain height: whichever island contains the point. */
  heightAt = (x: number, z: number): number => {
    for (const r of this.regions) {
      const lx = x - r.def.origin[0]
      const lz = z - r.def.origin[1]
      if (Math.hypot(lx, lz) < r.def.island.radius) {
        return heightAt(r.def.island, lx, lz)
      }
    }
    return 0
  }

  /** The region whose island the point is over, if any. */
  regionAt(x: number, z: number): BuiltRegion | null {
    for (const r of this.regions) {
      if (
        Math.hypot(x - r.def.origin[0], z - r.def.origin[1]) <
        r.def.island.radius * 1.05
      ) {
        return r
      }
    }
    return null
  }

  /** All discoverables across regions (content is world-coordinate). */
  get discoverables() {
    return this.regions.flatMap((r) => r.def.discoverables)
  }

  get grapplePoints() {
    return this.regions.flatMap((r) => r.def.grapplePoints)
  }

  get latentPaths() {
    return this.regions.flatMap((r) => r.def.latentPaths)
  }

  get enemies() {
    return this.regions.flatMap((r) => r.def.enemies)
  }
}
