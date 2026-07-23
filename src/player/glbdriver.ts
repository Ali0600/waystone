import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { AttackId, LocoState } from './heroanim'
import type { IHeroCharacter } from './rig'
import { CLIP_FOR_ATTACK, CLIP_FOR_LOCO, GLB_HERO_URL } from './glbanim'

/** Crossfade duration between clips (seconds). */
const FADE = 0.2
/** Target height (world units) to normalize the loaded model to. */
const TARGET_HEIGHT = 1.7
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

  constructor(url = GLB_HERO_URL) {
    this.group.add(this.body)
    // Created once, up front, so LanternVerb captures it by reference before the
    // async model arrives; re-parented onto the hand bone on load (same instance).
    this.lanternLight = new THREE.PointLight('#ffb347', 14, 16, 1.8)
    this.lanternLight.position.set(0, 1.0, 0.25)
    this.body.add(this.lanternLight)

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

    this.ready = true
    this.apply(this.pending.state, this.pending.speed)
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
