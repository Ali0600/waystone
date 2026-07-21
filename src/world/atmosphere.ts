import * as THREE from 'three'
import type { RegionDef } from './region'
import type { MistSea } from './mist'

/** Easing time-constant (seconds): ~63% of the way each `tau`, ~95% by 3·tau. */
export const ATMOS_TAU = 0.8

/**
 * Frame-rate-independent easing fraction — how far to move toward the target
 * this frame. Composition-correct: easing by dt/2 twice equals easing by dt
 * once, so a variable frame rate can't change the blend speed (unlike a raw
 * `dt * rate`). Pure; unit-tested.
 */
export function smoothFactor(dt: number, tau = ATMOS_TAU): number {
  if (dt <= 0) return 0
  return 1 - Math.exp(-dt / tau)
}

/** The mutable atmosphere channels, one snapshot. */
interface AtmosState {
  sky: THREE.Color
  fog: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  sun: THREE.Color
  fogNear: number
  fogFar: number
  sunDir: THREE.Vector3
}

function stateFor(def: RegionDef): AtmosState {
  return {
    sky: new THREE.Color(def.palette.sky),
    fog: new THREE.Color(def.palette.fog),
    hemiSky: new THREE.Color(def.palette.hemiSky),
    hemiGround: new THREE.Color(def.palette.hemiGround),
    sun: new THREE.Color(def.palette.sun),
    fogNear: def.fog.near,
    fogFar: def.fog.far,
    sunDir: new THREE.Vector3(def.sunDir[0], def.sunDir[1], def.sunDir[2]),
  }
}

/** Distance the sun sits from origin along its direction (matches the boot code). */
const SUN_DISTANCE = 80

/**
 * Blends the scene's sky/fog/hemisphere/sun/mist toward the current region's
 * authored palette. Every isle ships its own mood (`RegionPalette` + per-region
 * `fog`/`sunDir`); this is what finally applies it as you cross between them.
 *
 * Ease-toward-target (not a from→to crossfade): a mid-blend region flip just
 * re-points the target and converges — no from/to bookkeeping, no visual jump.
 * Renderer-free (drives THREE.Color/Fog/Light objects), so it's testable headless.
 */
export class AtmosphereRig {
  private cur: AtmosState
  private target: AtmosState
  private readonly bg = new THREE.Color()

  constructor(
    private scene: THREE.Scene,
    private fog: THREE.Fog,
    private hemi: THREE.HemisphereLight,
    private sun: THREE.DirectionalLight,
    private mist: MistSea,
    initial: RegionDef,
  ) {
    this.scene.background = this.bg // the rig owns the background colour
    this.cur = stateFor(initial)
    this.target = stateFor(initial)
    this.apply()
  }

  /** Instant set — for boot and discrete jumps (the ferry). */
  snapTo(def: RegionDef): void {
    this.cur = stateFor(def)
    this.target = stateFor(def)
    this.apply()
  }

  /** Ease target — for walking across a region boundary. */
  setTarget(def: RegionDef): void {
    this.target = stateFor(def)
  }

  update(dt: number): void {
    const k = smoothFactor(dt)
    this.cur.sky.lerp(this.target.sky, k)
    this.cur.fog.lerp(this.target.fog, k)
    this.cur.hemiSky.lerp(this.target.hemiSky, k)
    this.cur.hemiGround.lerp(this.target.hemiGround, k)
    this.cur.sun.lerp(this.target.sun, k)
    this.cur.fogNear += (this.target.fogNear - this.cur.fogNear) * k
    this.cur.fogFar += (this.target.fogFar - this.cur.fogFar) * k
    this.cur.sunDir.lerp(this.target.sunDir, k)
    this.apply()
  }

  private apply(): void {
    this.bg.copy(this.cur.sky)
    this.fog.color.copy(this.cur.fog)
    this.fog.near = this.cur.fogNear
    this.fog.far = this.cur.fogFar
    this.hemi.color.copy(this.cur.hemiSky)
    this.hemi.groundColor.copy(this.cur.hemiGround)
    this.sun.color.copy(this.cur.sun)
    this.sun.position.copy(this.cur.sunDir).multiplyScalar(SUN_DISTANCE)
    this.mist.setColor(this.cur.fog)
  }
}
