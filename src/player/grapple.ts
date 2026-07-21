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

/** A moving grapple target supplied each frame (a prowling enemy). Scored in the
 *  same pass as the fixed crystal pylons; `id` lets the caller act on the choice. */
export interface DynamicTarget {
  id: number
  pos: THREE.Vector3
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
  /** The aimed enemy (mutually exclusive with a pylon target), or null. */
  private dynTarget: DynamicTarget | null = null
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

  /** Current highlighted target position — an aimed enemy wins over a pylon,
   *  but they're mutually exclusive (only one is set). Null if none aimable. */
  targetPoint(): THREE.Vector3 | null {
    if (this.dynTarget) return this.dynTarget.pos
    return this.target >= 0 ? this.pylons[this.target].pos : null
  }

  /** spawnIndex of the currently-aimed enemy, or null (a pylon, or nothing). */
  dynamicTargetId(): number | null {
    return this.dynTarget ? this.dynTarget.id : null
  }

  /** Aim-cone/range/line-of-sight score for a candidate world point, or null if
   *  it fails a gate. Shared by pylons and enemies so both target identically. */
  private scoreTarget(pos: THREE.Vector3, collider: Collider): number | null {
    // Aim chest → target, straight line.
    tmpToPylon.subVectors(pos, this.player.position)
    tmpToPylon.y -= 1.2
    const dist = tmpToPylon.length()
    if (dist > RANGE || dist < 2) return null
    tmpToPylon.normalize()
    const dot = tmpToPylon.dot(tmpForward)
    if (dot < AIM_CONE) return null
    // Line of sight from the player's chest. Anything within 3.2u of the target
    // counts as its own ledge/mount (or the ground at a foe's feet), not an
    // obstruction: a crystal above a perch disc (r 2.3) ALWAYS has its sightline
    // graze the rim — measured live at dist-2.9. Blockers sit mid-ray, not at the end.
    tmpRay.origin.copy(this.player.position)
    tmpRay.origin.y += 1.2
    tmpRay.direction.copy(tmpToPylon)
    const hit = collider.bvh.raycastFirst(tmpRay, THREE.DoubleSide)
    if (hit && hit.distance < dist - 3.2) return null
    return dot - dist / RANGE / 4
  }

  /** Pick the pylon OR enemy the player is looking toward (most-aimed-at wins). */
  updateTargeting(
    cameraYaw: number,
    cameraPitch: number,
    collider: Collider,
    dynamic: DynamicTarget[] = [],
  ): void {
    tmpForward.set(
      -Math.sin(cameraYaw) * Math.cos(cameraPitch),
      -Math.sin(cameraPitch) * 0.4,
      -Math.cos(cameraYaw) * Math.cos(cameraPitch),
    )
    tmpForward.normalize()
    let best = -1
    let bestDyn: DynamicTarget | null = null
    let bestScore = -Infinity
    for (let i = 0; i < this.pylons.length; i++) {
      const score = this.scoreTarget(this.pylons[i].pos, collider)
      if (score !== null && score > bestScore) {
        bestScore = score
        best = i
        bestDyn = null
      }
    }
    for (const d of dynamic) {
      const score = this.scoreTarget(d.pos, collider)
      if (score !== null && score > bestScore) {
        bestScore = score
        best = -1
        bestDyn = d
      }
    }
    this.target = best
    this.dynTarget = bestDyn
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
