import * as THREE from 'three'
import { makeToonMaterial } from '../engine/toon'
import type { Collider } from '../world/collision'
import type { PlayerSim } from './controller'

export interface GrapplePointDef {
  x: number
  z: number
  /** Height above terrain. */
  dy: number
}

const RANGE = 20
const AIM_CONE = Math.cos(0.7) // ~40°

const tmpToPylon = new THREE.Vector3()
const tmpForward = new THREE.Vector3()
const tmpRay = new THREE.Ray()

/**
 * Grapple pylons: crystal anchors the player can pull themselves to.
 * Targeting = nearest pylon in range, roughly ahead of the camera, with
 * line of sight.
 */
export class GrappleVerb {
  readonly group = new THREE.Group()
  private pylons: { pos: THREE.Vector3; crystal: THREE.Mesh }[] = []
  private target: number = -1
  private rope: THREE.Line
  private t = 0

  constructor(
    defs: GrapplePointDef[],
    private heightAt: (x: number, z: number) => number,
    private player: PlayerSim,
  ) {
    this.addPoints(defs)
    const ropeGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    this.rope = new THREE.Line(
      ropeGeo,
      new THREE.LineBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.9 }),
    )
    this.rope.visible = false
    this.rope.frustumCulled = false
    this.group.add(this.rope)
  }

  /** Newly manifested regions add their pylons at runtime. */
  addPoints(defs: GrapplePointDef[]): void {
    for (const def of defs) {
      const pos = new THREE.Vector3(def.x, this.heightAt(def.x, def.z) + def.dy, def.z)
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.14, Math.min(def.dy, 2.2), 5),
        makeToonMaterial('#5a5470'),
      )
      post.position.set(pos.x, pos.y - Math.min(def.dy, 2.2) / 2, pos.z)
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        makeToonMaterial('#8ad8c8', { emissive: '#2e8a76', emissiveIntensity: 0.9 }),
      )
      crystal.position.copy(pos)
      this.group.add(post, crystal)
      this.pylons.push({ pos, crystal })
    }
  }

  /** Current highlighted pylon position (null if none aimable). */
  targetPoint(): THREE.Vector3 | null {
    return this.target >= 0 ? this.pylons[this.target].pos : null
  }

  /** Pick the pylon the player is looking toward. */
  updateTargeting(cameraYaw: number, cameraPitch: number, collider: Collider): void {
    tmpForward.set(
      -Math.sin(cameraYaw) * Math.cos(cameraPitch),
      -Math.sin(cameraPitch) * 0.4,
      -Math.cos(cameraYaw) * Math.cos(cameraPitch),
    )
    tmpForward.normalize()
    let best = -1
    let bestScore = -Infinity
    for (let i = 0; i < this.pylons.length; i++) {
      // Aim chest → crystal, straight line.
      tmpToPylon.subVectors(this.pylons[i].pos, this.player.position)
      tmpToPylon.y -= 1.2
      const dist = tmpToPylon.length()
      if (dist > RANGE || dist < 2) continue
      tmpToPylon.normalize()
      const dot = tmpToPylon.dot(tmpForward)
      if (dot < AIM_CONE) continue
      // Line of sight from the player's chest. Anything within 3.2u of the
      // crystal counts as its own ledge/mount, not an obstruction: a crystal
      // above a perch disc (r 2.3) ALWAYS has its sightline graze the rim —
      // measured live at dist-2.9. True blockers sit mid-ray, not at the end.
      tmpRay.origin.copy(this.player.position)
      tmpRay.origin.y += 1.2
      tmpRay.direction.copy(tmpToPylon)
      const hit = collider.bvh.raycastFirst(tmpRay, THREE.DoubleSide)
      if (hit && hit.distance < dist - 3.2) continue
      const score = dot - dist / RANGE / 4
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    this.target = best
  }

  /** Fire toward the current target. Returns true if launched. */
  tryLaunch(): boolean {
    const point = this.targetPoint()
    if (!point) return false
    return this.player.startGrapple(point)
  }

  update(dt: number): void {
    this.t += dt
    for (const [i, pylon] of this.pylons.entries()) {
      pylon.crystal.rotation.y += dt * (i === this.target ? 4 : 0.8)
      const mat = pylon.crystal.material as THREE.MeshToonMaterial
      mat.emissiveIntensity = i === this.target ? 2.2 : 0.9 + Math.sin(this.t * 2 + i) * 0.15
      const s = i === this.target ? 1.35 : 1
      pylon.crystal.scale.setScalar(s + Math.sin(this.t * 3 + i) * 0.05)
    }
    if (this.player.mode === 'grapple') {
      this.rope.visible = true
      const positions = this.rope.geometry.getAttribute('position')
      positions.setXYZ(
        0,
        this.player.position.x,
        this.player.position.y + 1.1,
        this.player.position.z,
      )
      positions.setXYZ(
        1,
        this.player.grappleTarget.x,
        this.player.grappleTarget.y,
        this.player.grappleTarget.z,
      )
      positions.needsUpdate = true
    } else {
      this.rope.visible = false
    }
  }
}
