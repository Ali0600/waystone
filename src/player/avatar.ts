import * as THREE from 'three'
import type { PlayerSim } from './controller'
import { buildHeroRig, HeroDriver, type HeroRig } from './rig'
import { locomotionState } from './heroanim'

/**
 * The Surveyor: a hooded, articulated wanderer with a lantern in the left hand
 * and a sword sheathed on the back (drawn only in the arena). The rig + pure
 * animation core (rig.ts / heroanim.ts) carry the motion; this class picks the
 * locomotion state from the sim and keeps the world-only concerns (facing,
 * hover-bob, blob shadow).
 *
 * Public surface is byte-compatible with the old procedural avatar — `group`,
 * `lanternLight`, `update(dt, sim, groundY)` — so main.ts is untouched.
 */
export class Avatar {
  readonly group: THREE.Group
  readonly lanternLight: THREE.PointLight
  private readonly rig: HeroRig
  private readonly body: THREE.Group
  private readonly driver: HeroDriver
  private readonly blob: THREE.Mesh
  private t = 0
  private sinceDash = Infinity

  constructor() {
    this.rig = buildHeroRig({ lanternIntensity: 14 }) // sword starts on the back
    this.group = this.rig.group
    this.body = this.rig.body
    this.lanternLight = this.rig.lanternLight // LanternVerb captures this by reference
    this.driver = new HeroDriver(this.rig)

    // Blob shadow — grounded readability without shadow maps (unchanged).
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28 }),
    )
    this.blob.rotation.x = -Math.PI / 2
    this.blob.name = 'blob'
    this.group.add(this.blob)
  }

  update(dt: number, sim: PlayerSim, groundY: number | null): void {
    this.t += dt
    this.group.position.copy(sim.position)

    const speed = Math.hypot(sim.velocity.x, sim.velocity.z)
    // A dash burst is momentary; remember how long ago it fired so the sprint
    // gait can outlast the speed spike (heroanim SPRINT_HOLD).
    this.sinceDash = sim.stepEvents.dashed ? 0 : this.sinceDash + dt

    this.driver.setLocomotion(
      locomotionState({
        speed,
        onGround: sim.onGround,
        vy: sim.velocity.y,
        mode: sim.mode,
        sinceDash: this.sinceDash,
      }),
      speed,
    )
    this.driver.update(dt)

    // Hover-bob (halved — the legs now carry the sense of motion) + face-movement
    // turn. Pitch/lean is owned by the pose's torso joint, not the body (one writer).
    const bobRate = sim.onGround ? 2.2 + speed * 0.9 : 1.2
    const bobAmp = sim.onGround ? 0.025 + Math.min(0.03, speed * 0.004) : 0.01
    this.body.position.y = 0.08 + Math.sin(this.t * bobRate) * bobAmp

    let dyaw = sim.facing - this.body.rotation.y
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
    this.body.rotation.y += dyaw * Math.min(1, 10 * dt)

    if (groundY !== null) {
      this.blob.visible = true
      this.blob.position.y = groundY - sim.position.y + 0.03
      const drop = Math.min(6, Math.max(0, sim.position.y - groundY))
      this.blob.scale.setScalar(Math.max(0.35, 1 - drop * 0.12))
    } else {
      this.blob.visible = false
    }
  }
}
