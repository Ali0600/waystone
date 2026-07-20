import * as THREE from 'three'
import type { DiscoverySystem } from '../discovery/system'
import type { PlayerSim } from './controller'

const PULSE_COOLDOWN = 1.1
const PULSE_MAX_RADIUS = 7

/**
 * The Lantern verb (T1: reveal latent objects). A pulse is a visible
 * expanding ring + a discovery-system reveal query.
 */
export class LanternVerb {
  readonly ring: THREE.Mesh
  private cooldown = 0
  private ringAge = Infinity

  constructor(
    private player: PlayerSim,
    private discovery: DiscoverySystem,
    private lanternLight: THREE.PointLight,
  ) {
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 6, 40),
      new THREE.MeshBasicMaterial({
        color: '#ffd98a',
        transparent: true,
        opacity: 0.8,
      }),
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.visible = false
  }

  /** Returns true if a pulse fired (mastery counting hooks in at M3). */
  tryPulse(): boolean {
    if (this.cooldown > 0) return false
    this.cooldown = PULSE_COOLDOWN
    this.ringAge = 0
    this.ring.visible = true
    this.ring.position.copy(this.player.position)
    this.ring.position.y += 0.15
    this.discovery.lanternPulse(this.player.position.x, this.player.position.z)
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
        const r = 0.5 + t * PULSE_MAX_RADIUS
        this.ring.scale.setScalar(r)
        ;(this.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t)
      }
    }
    // Lantern light swells with the pulse.
    const swell = this.ring.visible ? 1.6 - this.ringAge : 1
    this.lanternLight.intensity = 14 * Math.max(1, swell * 1.6)
  }
}
