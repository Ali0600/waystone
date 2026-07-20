import * as THREE from 'three'
import type { DiscoverySystem } from '../discovery/system'
import type { PlayerSim } from './controller'

const CHIME_COOLDOWN = 1.1
const RING_MAX_RADIUS = 7

/**
 * The Chime verb (Tool 3). Press C to ring — sealed stone within range
 * resonates open (its `chime`-prereq discoverable becomes collectable).
 * A single expanding violet ring, no tiers; the reveal + toast live in
 * DiscoverySystem.chimeResonate, mirroring the Lantern.
 */
export class ChimeVerb {
  readonly ring: THREE.Mesh
  private cooldown = 0
  private ringAge = Infinity

  constructor(
    private player: PlayerSim,
    private discovery: DiscoverySystem,
  ) {
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.05, 6, 40),
      new THREE.MeshBasicMaterial({
        color: '#c9a0ff',
        transparent: true,
        opacity: 0.85,
      }),
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.visible = false
  }

  /** Ring the chime. Returns false if still on cooldown (no sound/vfx). */
  tryResonate(): boolean {
    if (this.cooldown > 0) return false
    this.cooldown = CHIME_COOLDOWN
    this.ringAge = 0
    this.ring.visible = true
    this.ring.position.copy(this.player.position)
    this.ring.position.y += 0.15
    this.discovery.chimeResonate(this.player.position.x, this.player.position.z)
    return true
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.ring.visible) {
      this.ringAge += dt
      const t = this.ringAge / 0.7
      if (t >= 1) {
        this.ring.visible = false
      } else {
        this.ring.scale.setScalar(0.5 + t * RING_MAX_RADIUS)
        ;(this.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t)
      }
    }
  }
}
