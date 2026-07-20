import * as THREE from 'three'
import type { DiscoverySystem } from '../discovery/system'
import { REVEAL_RADIUS } from '../discovery/types'
import type { MasterySystem } from '../progression/mastery'
import type { LatentPaths } from '../world/latentpath'
import type { PlayerSim } from './controller'

const PULSE_COOLDOWN = 1.1
const PULSE_MAX_RADIUS = 7

/**
 * The Lantern verb. Tiers change what a pulse can touch:
 *  T1 — reveal latent objects · T2 — solidify latent paths · T3 — buried
 *  caches call out (auto-pinned in a wide sweep).
 */
export class LanternVerb {
  readonly ring: THREE.Mesh
  private cooldown = 0
  private ringAge = Infinity

  constructor(
    private player: PlayerSim,
    private discovery: DiscoverySystem,
    private lanternLight: THREE.PointLight,
    private mastery: MasterySystem,
    private paths: LatentPaths,
    /** Called when a path solidifies (collider rebuild). */
    private onPathRevealed: () => void,
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

  tryPulse(): boolean {
    if (this.cooldown > 0) return false
    this.cooldown = PULSE_COOLDOWN
    this.ringAge = 0
    this.ring.visible = true
    this.ring.position.copy(this.player.position)
    this.ring.position.y += 0.15
    const px = this.player.position.x
    const pz = this.player.position.z

    this.discovery.lanternPulse(px, pz)
    const tier = this.mastery.tier('lantern')
    if (tier >= 2) {
      const revealed = this.paths.pulse(px, pz, REVEAL_RADIUS + 4)
      if (revealed.length > 0) this.onPathRevealed()
    }
    if (tier >= 3) {
      this.discovery.buriedSweep(px, pz, PULSE_MAX_RADIUS * 3)
    }
    this.mastery.record('lantern')
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
