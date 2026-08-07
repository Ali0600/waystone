import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { AttackId, LocoState } from './heroanim'
import type { IHeroCharacter } from './rig'
import { CLIP_FOR_ATTACK, CLIP_FOR_LOCO, GLB_HERO_URL } from './glbanim'

/** Options for the GLB hero. `weaponUrl` is combat-only (the world rogue roams unarmed). */
export interface GlbHeroOptions {
  url?: string
  weaponUrl?: string
  lanternIntensity?: number
}

/** Crossfade duration between clips (seconds). */
const FADE = 0.2
/** Target height (world units) to normalize the loaded model to. */
const TARGET_HEIGHT = 1.7
/**
 * Target blade length (world units) — a longsword reads at roughly half the
 * wielder's height. Weapons are authored to whatever hand a given pack has, so
 * the raw import can be wildly off: KayKit's sword arrives at 1.91u on our 1.7u
 * hero (112% of body height) because it was drawn for a chibi body with huge
 * hands. `weaponScaleFor` renormalizes it the same way the body is normalized,
 * so swapping either the hero or the weapon can't reintroduce the mismatch.
 */
const TARGET_WEAPON_LENGTH = 0.95

/**
 * Scale factor bringing an imported weapon's longest axis to
 * `TARGET_WEAPON_LENGTH`. Pure so the sizing rule is unit-testable without the
 * binary asset. A degenerate measurement (0/NaN) leaves the weapon untouched
 * rather than collapsing it to a point.
 */
export function weaponScaleFor(longestAxis: number): number {
  if (!Number.isFinite(longestAxis) || longestAxis <= 0) return 1
  return TARGET_WEAPON_LENGTH / longestAxis
}
/** Fixed yaw so the model's forward aligns with Waystone's +Z (tuned in QA —
 *  KayKit's Rogue faces +Z natively, so no rotation). */
const MODEL_YAW = 0

/**
 * The downloadable-GLB hero (M39, the D7 trial) — implements the SAME
 * `IHeroCharacter` surface the procedural `HeroDriver` does, over a THREE
 * `AnimationMixer`. Avatar/Arena don't know which one they're driving.
 *
 * Loads async: `group` is added to the scene immediately (empty), the model pops
 * in when the .glb arrives, and every method is a no-op until `ready`.
 */
export class GlbHeroDriver implements IHeroCharacter {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly lanternLight: THREE.PointLight
  /** The GLB stands on its feet (no cloak-hem hover). */
  readonly baselineY = 0
  private mixer: THREE.AnimationMixer | null = null
  private actions: Record<string, THREE.AnimationAction> = {}
  private locoAction: THREE.AnimationAction | null = null
  private oneShot: { id: AttackId; action: THREE.AnimationAction } | null = null
  private ready = false
  private pending: { state: LocoState; speed: number } = { state: 'idle', speed: 0 }
  /** Combat-only: a weapon GLB parented to the right-hand bone on load (world = none). */
  private readonly weaponUrl: string | null

  constructor(opts: GlbHeroOptions = {}) {
    this.weaponUrl = opts.weaponUrl ?? null
    this.group.add(this.body)
    // Created once, up front, so LanternVerb captures it by reference before the
    // async model arrives; re-parented onto the hand bone on load (same instance).
    this.lanternLight = new THREE.PointLight('#ffb347', opts.lanternIntensity ?? 14, 16, 1.8)
    this.lanternLight.position.set(0, 1.0, 0.25)
    this.body.add(this.lanternLight)

    const url = opts.url ?? GLB_HERO_URL
    new GLTFLoader()
      .loadAsync(url)
      .then((gltf) => this.onLoad(gltf))
      .catch((e) => console.warn('[GlbHeroDriver] failed to load', url, e))
  }

  private onLoad(gltf: GLTF): void {
    const model = gltf.scene
    // Normalize to ~TARGET_HEIGHT tall and stand the feet at the body origin.
    const box = new THREE.Box3().setFromObject(model)
    const h = box.max.y - box.min.y || 1
    model.scale.setScalar(TARGET_HEIGHT / h)
    const grounded = new THREE.Box3().setFromObject(model)
    model.position.y = -grounded.min.y
    model.rotation.y = MODEL_YAW
    this.body.add(model)

    this.mixer = new THREE.AnimationMixer(model)
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip)

    // Lantern rides the left hand (falls back to the body). NB GLTFLoader strips
    // dots from node names, so KayKit's `handslot.l`/`hand.l` load as
    // `handslotl`/`handl` — try the sanitized forms first.
    const hand = ['handslotl', 'handl', 'Hand.L', 'Palm2.L']
      .map((n) => model.getObjectByName(n))
      .find(Boolean)
    if (hand) {
      hand.add(this.lanternLight)
      this.lanternLight.position.set(0, 0, 0) // sit at the hand (re-parent keeps local pos)
    }

    // Combat blade rides the RIGHT hand (world hero carries none). Same dot-stripped
    // bone convention as the lantern, mirrored to the right: `handslot.r` → `handslotr`.
    if (this.weaponUrl) this.attachWeapon(this.weaponUrl, model)

    this.ready = true
    this.apply(this.pending.state, this.pending.speed)
  }

  /**
   * Load a weapon GLB, renormalize its length, and parent it to the right-hand
   * bone. Async — the blade pops in just after the body and keeps its native
   * material. Scaling matters: a weapon is authored for the hand of whatever body
   * its pack drew, so on a different hero it imports at the wrong size.
   */
  private attachWeapon(url: string, model: THREE.Object3D): void {
    const hand = ['handslotr', 'handr', 'Hand.R', 'Palm2.R']
      .map((n) => model.getObjectByName(n))
      .find(Boolean)
    if (!hand) {
      console.warn('[GlbHeroDriver] right-hand bone not found; weapon skipped')
      return
    }
    new GLTFLoader()
      .loadAsync(url)
      .then((g) => {
        const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3())
        g.scene.scale.setScalar(weaponScaleFor(Math.max(size.x, size.y, size.z)))
        hand.add(g.scene)
      })
      .catch((e) => console.warn('[GlbHeroDriver] failed to load weapon', url, e))
  }

  private crossfadeTo(action: THREE.AnimationAction | null, timeScale: number): void {
    if (!action) return
    action.setEffectiveTimeScale(timeScale)
    if (action === this.locoAction) return
    action.reset().setEffectiveWeight(1).fadeIn(FADE).play()
    this.locoAction?.fadeOut(FADE)
    this.locoAction = action
  }

  private apply(state: LocoState, speed: number): void {
    // sprint reuses the run clip, faster; run scales gently with speed.
    const ts = state === 'sprint' ? 1.5 : state === 'run' ? Math.max(0.85, speed / 7) : 1
    this.crossfadeTo(this.actions[CLIP_FOR_LOCO[state]] ?? null, ts)
  }

  setLocomotion(state: LocoState, speed: number): void {
    this.pending = { state, speed }
    if (this.ready && !this.oneShot) this.apply(state, speed)
  }

  playAction(id: AttackId): void {
    if (!this.ready) return
    const a = this.actions[CLIP_FOR_ATTACK[id]]
    if (!a) return
    a.reset()
    a.setLoop(THREE.LoopOnce, 1)
    a.clampWhenFinished = true
    a.setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.1).play()
    this.locoAction?.fadeOut(0.1)
    this.locoAction = null
    this.oneShot = { id, action: a }
  }

  currentAction(): { id: AttackId; u: number } | null {
    if (!this.oneShot) return null
    const dur = this.oneShot.action.getClip().duration || 1
    return { id: this.oneShot.id, u: Math.min(1, this.oneShot.action.time / dur) }
  }

  update(dt: number): void {
    this.mixer?.update(dt)
    if (this.oneShot) {
      const a = this.oneShot.action
      if (a.time >= a.getClip().duration - 1e-3) {
        this.oneShot = null
        this.apply(this.pending.state, this.pending.speed) // back to locomotion
      }
    }
  }
}
