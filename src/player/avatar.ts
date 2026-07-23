import * as THREE from 'three'
import type { PlayerSim } from './controller'
import { buildHeroRig, HeroDriver, type IHeroCharacter } from './rig'
import { GlbHeroDriver } from './glbdriver'
import { locomotionState } from './heroanim'

/** localStorage key persisting the trial character choice (no save-schema impact). */
export const CHARACTER_STYLE_KEY = 'waystone:character-style'

/** Which hero body to build: the procedural rig (default) or the downloadable GLB (M39/D7). */
export function characterStyle(): 'procedural' | 'glb' {
  try {
    const q = new URLSearchParams(location.search).get('char')
    if (q === 'glb' || q === 'procedural') return q
    return localStorage.getItem(CHARACTER_STYLE_KEY) === 'glb' ? 'glb' : 'procedural'
  } catch {
    return 'procedural'
  }
}

/**
 * The Surveyor in the world: picks a locomotion state from the sim and drives an
 * `IHeroCharacter` (the procedural hooded rig, or — the D7 trial — a downloadable
 * rigged GLB). Owns the world-only concerns (facing, hover-bob, blob shadow).
 *
 * Public surface is byte-compatible — `group`, `lanternLight`, `update(dt, sim,
 * groundY)` — so main.ts is untouched. Combat (arena.ts) stays procedural.
 */
export class Avatar {
  readonly group: THREE.Group
  readonly lanternLight: THREE.PointLight
  readonly style: 'procedural' | 'glb'
  private readonly character: IHeroCharacter
  private readonly body: THREE.Object3D
  private readonly blob: THREE.Mesh
  private t = 0
  private sinceDash = Infinity

  constructor() {
    this.style = characterStyle()
    this.character =
      this.style === 'glb' ? new GlbHeroDriver() : new HeroDriver(buildHeroRig({ lanternIntensity: 14 }))
    this.group = this.character.group
    this.body = this.character.body
    this.lanternLight = this.character.lanternLight // LanternVerb captures this by reference

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

    this.character.setLocomotion(
      locomotionState({
        speed,
        onGround: sim.onGround,
        vy: sim.velocity.y,
        mode: sim.mode,
        sinceDash: this.sinceDash,
      }),
      speed,
    )
    this.character.update(dt)

    // Hover-bob around the character's rest height + face-movement turn. Pitch is
    // owned by the pose/clip, not the body (one writer).
    const bobRate = sim.onGround ? 2.2 + speed * 0.9 : 1.2
    const bobAmp = sim.onGround ? 0.025 + Math.min(0.03, speed * 0.004) : 0.01
    this.body.position.y = this.character.baselineY + Math.sin(this.t * bobRate) * bobAmp

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
