import * as THREE from 'three'
import { makeToonMaterial } from '../engine/toon'
import { smoothFactor } from '../world/atmosphere'
import {
  JOINTS,
  type AttackId,
  type JointName,
  type JointPose,
  type LocoState,
  samplePose,
  startTrack,
  stepTrack,
  trackPose,
  trackU,
  type AnimTrack,
} from './heroanim'

/**
 * The articulated hero — a jointed humanoid built from primitives, posed by the
 * PURE core in `heroanim.ts`. The world Avatar and the combat Arena each own one
 * (different scenes, different lantern intensities); the old hand-built
 * duplicates are gone.
 *
 * SINGLE-WRITER DISCIPLINE (the M20 lesson):
 * - joint rotations → only `applyPose`
 * - sword parent/transform → only `attachSword`
 * - the lantern PointLight instance is created ONCE here and exposed as
 *   `rig.lanternLight` (LanternVerb captures it by reference and owns `.intensity`)
 */

/** Frame-rate-independent easing time-constants (seconds). */
export const POSE_TAU_LOCO = 0.09
export const POSE_TAU_ACTION = 0.045
/** The procedural rig hovers its body this high (the old cloak-hem gap). */
export const HERO_HOVER_Y = 0.08

export interface HeroRig {
  /** Root — set its position to the sim foot; the caller owns this transform. */
  group: THREE.Group
  /** Yaw/bob owner (Avatar semantics); hovers at y=0.08 like the old avatar. */
  body: THREE.Group
  joints: Record<JointName, THREE.Group>
  handSocket: THREE.Group
  backSocket: THREE.Group
  sword: THREE.Group
  lanternLight: THREE.PointLight
}

const box = (w: number, h: number, d: number, color: string, y = 0): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeToonMaterial(color))
  m.position.y = y
  return m
}

/** A named joint pivot (an empty Group rotated by `applyPose`). */
const joint = (x: number, y: number, z: number): THREE.Group => {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  return g
}

function buildSword(): THREE.Group {
  const sword = new THREE.Group()
  sword.name = 'sword'
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.7, 0.02), makeToonMaterial('#cfd6e6'))
  blade.position.y = 0.46
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.05), makeToonMaterial('#8a7150'))
  guard.position.y = 0.1
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.028, 0.16, 6),
    makeToonMaterial('#2e2a40'),
  )
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), makeToonMaterial('#8a7150'))
  pommel.position.y = -0.1
  sword.add(blade, guard, grip, pommel)
  return sword
}

/** Build one hero rig. Its `group` is added to a scene by the caller. */
export function buildHeroRig(opts: { lanternIntensity?: number } = {}): HeroRig {
  const CLOAK = '#3e3a5c'
  const HOOD = '#4a4570'
  const group = new THREE.Group()
  const body = new THREE.Group()
  body.position.y = 0.08 // hover baseline (matches the old avatar)
  group.add(body)

  const joints = {} as Record<JointName, THREE.Group>

  // Spine ---------------------------------------------------------------
  const pelvis = joint(0, 0.78, 0)
  pelvis.add(box(0.3, 0.14, 0.2, CLOAK, 0.02))
  const torso = joint(0, 0.14, 0)
  torso.add(box(0.34, 0.36, 0.24, CLOAK, 0.2))
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.62, 8), makeToonMaterial(CLOAK))
  cape.position.y = 0.18 // rim ≈ y0.90 so the legs read while running
  torso.add(cape)
  const head = joint(0, 0.42, 0)
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), makeToonMaterial(HOOD))
  hood.position.y = 0.06
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), makeToonMaterial('#1c1826'))
  face.position.set(0, 0.04, 0.15)
  head.add(hood, face)
  torso.add(head)
  pelvis.add(torso)

  // Arms ----------------------------------------------------------------
  const arm = (side: 1 | -1): { shoulder: THREE.Group; elbow: THREE.Group; hand: THREE.Group } => {
    const shoulder = joint(0.27 * side, 0.34, 0)
    shoulder.add(box(0.1, 0.3, 0.12, HOOD, -0.16))
    const elbow = joint(0, -0.3, 0)
    elbow.add(box(0.09, 0.26, 0.1, HOOD, -0.14))
    const hand = joint(0, -0.28, 0)
    shoulder.add(elbow)
    elbow.add(hand)
    torso.add(shoulder)
    return { shoulder, elbow, hand }
  }
  const left = arm(1) // +X — lantern hand
  const right = arm(-1) // −X — sword hand

  // Left hand: fist + carried lantern + the (single) lantern light.
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), makeToonMaterial(HOOD))
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 6, 5),
    new THREE.MeshBasicMaterial({ color: '#ffcf7d' }),
  )
  lantern.position.set(0, -0.1, 0.02)
  const lanternLight = new THREE.PointLight('#ffb347', opts.lanternIntensity ?? 14, 16, 1.8)
  lanternLight.position.set(0, -0.1, 0.02)
  left.hand.add(fist, lantern, lanternLight)

  // Right hand IS the hand socket (sword goes here when drawn).
  const handSocket = right.hand
  handSocket.rotation.set(Math.PI, 0, 0) // blade continues past the fist
  right.hand.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), makeToonMaterial(HOOD)))

  // Back socket: hilt riding over the right shoulder while sheathed.
  const backSocket = joint(0, 0.3, -0.17)
  backSocket.rotation.set(0.15, 0, -2.6)
  torso.add(backSocket)

  // Legs ----------------------------------------------------------------
  const leg = (side: 1 | -1): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = joint(0.1 * side, -0.02, 0)
    hip.add(box(0.13, 0.36, 0.15, CLOAK, -0.19))
    const knee = joint(0, -0.38, 0)
    knee.add(box(0.11, 0.34, 0.13, '#2e2a40', -0.17))
    const foot = box(0.12, 0.07, 0.2, '#2e2a40', -0.36)
    foot.position.z = 0.04
    knee.add(foot)
    hip.add(knee)
    pelvis.add(hip)
    return { hip, knee }
  }
  const legL = leg(1)
  const legR = leg(-1)

  body.add(pelvis)

  joints.pelvis = pelvis
  joints.torso = torso
  joints.head = head
  joints.shoulderL = left.shoulder
  joints.elbowL = left.elbow
  joints.shoulderR = right.shoulder
  joints.elbowR = right.elbow
  joints.hipL = legL.hip
  joints.kneeL = legL.knee
  joints.hipR = legR.hip
  joints.kneeR = legR.knee
  for (const name of JOINTS) joints[name].name = name // QA / debugging handles

  body.name = 'heroBody'

  const sword = buildSword()
  const rig: HeroRig = { group, body, joints, handSocket, backSocket, sword, lanternLight }
  attachSword(rig, 'back')
  return rig
}

/**
 * THE SINGLE OWNER of sword parenting + local transform. `THREE.add` reparents
 * (removing from the old socket), so the sword mesh is never duplicated; the
 * socket Group carries the orientation.
 */
export function attachSword(rig: HeroRig, where: 'back' | 'hand'): void {
  const socket = where === 'hand' ? rig.handSocket : rig.backSocket
  socket.add(rig.sword)
  rig.sword.position.set(0, 0, 0)
  rig.sword.rotation.set(0, 0, 0)
}

/**
 * The ONLY writer of joint rotations — eases each joint toward the target pose
 * (frame-rate-independent via `smoothFactor`).
 */
export function applyPose(rig: HeroRig, pose: JointPose, dt: number, tau: number): void {
  const k = smoothFactor(dt, tau)
  for (const j of JOINTS) {
    const o = rig.joints[j]
    const t = pose[j]
    o.rotation.x += (t.x - o.rotation.x) * k
    o.rotation.y += (t.y - o.rotation.y) * k
    o.rotation.z += (t.z - o.rotation.z) * k
  }
}

/**
 * THE FUTURE-GLB SEAM (realized at M39): the renderer-agnostic surface Avatar and
 * Arena drive. `HeroDriver` (procedural rig) and `GlbHeroDriver` (a downloadable
 * rigged model over an `AnimationMixer`) both implement it, so swapping the body
 * is a construction choice — no change to the game wiring. `group` roots the
 * character in the scene, `body` is the yaw/bob owner, `lanternLight` is the
 * single PointLight the LanternVerb captures by reference.
 */
export interface IHeroCharacter {
  readonly group: THREE.Group
  readonly body: THREE.Object3D
  readonly lanternLight: THREE.PointLight
  /** Rest height of `body` above the foot (the avatar bobs around this). */
  readonly baselineY: number
  setLocomotion(state: LocoState, speed: number): void
  playAction(id: AttackId): void
  currentAction(): { id: AttackId; u: number } | null
  update(dt: number): void
}

/**
 * Drives the procedural rig from the semantic layer. `setLocomotion` → gait,
 * `playAction` → one-shot keyframe track with the same ids a GLB pack would name.
 */
export class HeroDriver implements IHeroCharacter {
  private t = 0
  private state: LocoState = 'idle'
  private speed = 0
  private track: AnimTrack | null = null

  constructor(private rig: HeroRig) {}

  get group(): THREE.Group {
    return this.rig.group
  }
  get body(): THREE.Object3D {
    return this.rig.body
  }
  get lanternLight(): THREE.PointLight {
    return this.rig.lanternLight
  }
  get baselineY(): number {
    return HERO_HOVER_Y
  }

  setLocomotion(state: LocoState, speed: number): void {
    this.state = state
    this.speed = speed
  }

  /** Start (or restart) a one-shot attack — always replaces a live track. */
  playAction(id: AttackId): void {
    this.track = startTrack(id)
  }

  currentAction(): { id: AttackId; u: number } | null {
    return this.track ? { id: this.track.id, u: trackU(this.track) } : null
  }

  update(dt: number): void {
    this.t += dt
    this.track = stepTrack(this.track, dt)
    // An active attack overrides locomotion; otherwise the gait plays.
    const target = this.track ? trackPose(this.track) : samplePose(this.state, this.t, this.speed)
    applyPose(this.rig, target, dt, this.track ? POSE_TAU_ACTION : POSE_TAU_LOCO)
  }
}
