/**
 * Hero animation — PURE (no THREE imports; plain `{x,y,z}` euler records), so
 * the whole locomotion/attack system is unit-tested headlessly. `rig.ts` turns
 * these poses into a THREE skeleton; nothing here knows about meshes.
 *
 * Orientation conventions (load-bearing for every keyframe below):
 * - Character local forward = +Z (the face sphere sits at +Z), so the LEFT side
 *   is +X (the lantern hand) and the RIGHT is −X (the sword hand). In the arena
 *   the rig is turned yaw=+π/2, mapping the sword arm (−X) toward the camera, so
 *   every swing is visible.
 * - Joint rotations are radians. Limb joints hang their child mesh along −Y, so
 *   for arms/legs: negative `x` swings the limb FORWARD/up, positive `x` swings
 *   it BACK; knee/elbow fold is positive `x`. For the torso (child extends up)
 *   positive `x` = lean forward.
 *
 * THE FUTURE-GLB SEAM: the *names* here — LocoState, AttackId, ATTACK_FOR_KEY —
 * are renderer-agnostic. A future GLB/Mixamo character implements the same
 * `HeroDriver` surface (rig.ts) over an AnimationMixer, mapping these ids to
 * named clips, and Avatar/Arena stay untouched.
 */

import { COMBO_KEYS } from '../content/chains'

export const JOINTS = [
  'pelvis',
  'torso',
  'head',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
  'hipL',
  'kneeL',
  'hipR',
  'kneeR',
] as const
export type JointName = (typeof JOINTS)[number]

export interface JointRot {
  x: number
  y: number
  z: number
}
export type JointPose = Record<JointName, JointRot>

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function zeroPose(): JointPose {
  const p = {} as JointPose
  for (const j of JOINTS) p[j] = { x: 0, y: 0, z: 0 }
  return p
}

// --- Locomotion selection ---------------------------------------------------

export type LocoState = 'idle' | 'run' | 'sprint' | 'jump' | 'fall' | 'grapple'

export interface LocoInput {
  /** Horizontal speed (world units/s) — hypot(vx, vz). */
  speed: number
  onGround: boolean
  /** Vertical velocity (world units/s). */
  vy: number
  mode: 'normal' | 'grapple'
  /** Seconds since the last dash burst fired (Infinity if never). */
  sinceDash: number
}

/** Keyboard speed is ~0 or ~7, so a low floor cleanly separates idle from run. */
export const RUN_SPEED_MIN = 0.6
/** Only a dash burst (16, or 21.6 at tier 2) exceeds walk speed 7. */
export const SPRINT_SPEED_MIN = 9
/**
 * A dash burst decays back under SPRINT_SPEED_MIN within ~0.14s, far too brief
 * to read as a sprint — so a timed window after the burst (fed by
 * `stepEvents.dashed`) drives the sprint gait instead of raw speed.
 */
export const SPRINT_HOLD = 0.45
/** Jump leaves the ground at vy 9.5; below this the arc is cresting → 'fall'. */
export const JUMP_VY_MIN = 1.5

export function locomotionState(i: LocoInput): LocoState {
  if (i.mode === 'grapple') return 'grapple'
  if (!i.onGround) return i.vy > JUMP_VY_MIN ? 'jump' : 'fall'
  if (i.speed > SPRINT_SPEED_MIN || (i.sinceDash < SPRINT_HOLD && i.speed > 3)) return 'sprint'
  if (i.speed > RUN_SPEED_MIN) return 'run'
  return 'idle'
}

// --- Gait sampler -----------------------------------------------------------

function mk(over: Partial<Record<JointName, Partial<JointRot>>>): JointPose {
  const p = zeroPose()
  for (const j of JOINTS) {
    const o = over[j]
    if (o) p[j] = { x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0 }
  }
  return p
}

/**
 * A walk/run/etc. pose at time `t` and horizontal `speed`. Frequency scales with
 * speed; amplitude ramps in over the (2-frame) speed ramp so a standing start
 * doesn't snap to a full stride.
 */
export function samplePose(state: LocoState, t: number, speed: number): JointPose {
  const phase = t * (5.5 + 0.9 * Math.min(speed, 18))
  const s = Math.sin(phase)
  const amp = clamp(speed / 7, 0.4, 1.15)

  switch (state) {
    case 'idle': {
      // Subtle breath + a slow head sway; arms rest slightly bent (static).
      return mk({
        torso: { x: 0.02 * Math.sin(1.6 * t) },
        head: { y: 0.05 * Math.sin(0.35 * t) },
        shoulderL: { x: -0.32 + 0.03 * Math.sin(1.6 * t + 0.3) },
        elbowL: { x: -0.5 },
        shoulderR: { x: -0.3 },
        elbowR: { x: -0.35 },
        hipL: { x: 0.02 },
        kneeL: { x: 0.06 },
        hipR: { x: 0.02 },
        kneeR: { x: 0.06 },
      })
    }
    case 'run':
    case 'sprint': {
      const sprint = state === 'sprint'
      const aLeg = (sprint ? 1.05 : 0.75) * amp
      const aKnee = sprint ? 1.2 : 0.9
      const aArm = (sprint ? 0.85 : 0.55) * amp
      const lean = sprint ? 0.24 : 0.1
      return mk({
        // Antiphase legs; knees fold on the back-swing.
        hipL: { x: -aLeg * s },
        hipR: { x: aLeg * s },
        kneeL: { x: 0.12 + aKnee * Math.max(0, Math.sin(phase - 0.35)) },
        kneeR: { x: 0.12 + aKnee * Math.max(0, Math.sin(phase - 0.35 + Math.PI)) },
        // Arms counter-phase; the LEFT (lantern) arm is damped so the light
        // doesn't strobe.
        shoulderR: { x: -aArm * s },
        shoulderL: { x: aArm * 0.4 * s },
        elbowR: { x: -0.3 - 0.35 * Math.max(0, s) },
        elbowL: { x: -0.55 },
        torso: { x: lean + 0.02 * Math.sin(2 * phase), y: 0.06 * s },
        pelvis: { y: -0.06 * s },
        head: { x: -0.06 },
      })
    }
    case 'jump': {
      // Tuck: knees up, arms trailing.
      return mk({
        hipL: { x: -0.5 },
        hipR: { x: -0.5 },
        kneeL: { x: 0.9 },
        kneeR: { x: 0.9 },
        shoulderL: { x: 0.35 },
        shoulderR: { x: 0.35 },
        elbowL: { x: -0.4 },
        elbowR: { x: -0.4 },
        torso: { x: 0.06 },
      })
    }
    case 'fall': {
      // Spread: arms out, legs split.
      return mk({
        shoulderL: { x: -0.4, z: 0.45 },
        shoulderR: { x: -0.4, z: -0.45 },
        elbowL: { x: -0.3 },
        elbowR: { x: -0.3 },
        hipL: { x: -0.35 },
        hipR: { x: 0.25 },
        kneeL: { x: 0.3 },
        kneeR: { x: 0.3 },
        torso: { x: -0.05 },
      })
    }
    case 'grapple': {
      // Right arm reaches up the line; lantern tucked.
      return mk({
        shoulderR: { x: -2.6 },
        elbowR: { x: -0.15 },
        shoulderL: { x: 0.2 },
        elbowL: { x: -0.9 },
        hipL: { x: 0.5 },
        hipR: { x: 0.5 },
        kneeL: { x: 0.45 },
        kneeR: { x: 0.45 },
        torso: { x: 0.3 },
      })
    }
  }
}

// --- Keyframe engine (attacks) ---------------------------------------------

export interface Keyframe {
  /** Normalized time 0..1 within the attack. */
  u: number
  pose: Partial<Record<JointName, Partial<JointRot>>>
}

/**
 * Interpolate a keyframe list at normalized `u` (clamped). Smoothstep-eased so
 * strikes accelerate into the apex. An absent joint (or axis) eases toward
 * neutral 0 — deliberate; author the guard baseline into each frame that needs
 * to hold it.
 */
export function sampleKeyframes(frames: Keyframe[], u: number): JointPose {
  const c = clamp(u, 0, 1)
  let lo = frames[0]
  let hi = frames[frames.length - 1]
  for (let i = 0; i < frames.length - 1; i++) {
    if (c >= frames[i].u && c <= frames[i + 1].u) {
      lo = frames[i]
      hi = frames[i + 1]
      break
    }
  }
  const span = hi.u - lo.u
  const s = span > 1e-9 ? (c - lo.u) / span : 0
  const e = s * s * (3 - 2 * s) // smoothstep
  const out = zeroPose()
  for (const j of JOINTS) {
    const a = lo.pose[j] ?? {}
    const b = hi.pose[j] ?? {}
    out[j] = {
      x: lerp(a.x ?? 0, b.x ?? 0, e),
      y: lerp(a.y ?? 0, b.y ?? 0, e),
      z: lerp(a.z ?? 0, b.z ?? 0, e),
    }
  }
  return out
}

export type AttackId =
  | 'overhead'
  | 'slashL'
  | 'slashR'
  | 'thrust'
  | 'riser'
  | 'stumble'
  | 'block'
  | 'flinch'
  | 'draw'
  | 'slam'
  | 'victory'
  | 'defeat'

export interface AttackDef {
  id: AttackId
  /** Seconds. */
  dur: number
  /** If set, the final frame is held instead of ending the track (outros). */
  hold?: boolean
  frames: Keyframe[]
}

/** Sword-guard base pose — blade up across the body, ready. */
const G: Partial<Record<JointName, Partial<JointRot>>> = {
  shoulderR: { x: -0.9 },
  elbowR: { x: -1.0 },
  shoulderL: { x: -0.3 },
  elbowL: { x: -0.7 },
  torso: { y: -0.15 },
}

/** Merge per-joint overrides onto a base partial (used to keep the guard). */
function guarded(
  over: Partial<Record<JointName, Partial<JointRot>>>,
): Partial<Record<JointName, Partial<JointRot>>> {
  const out: Partial<Record<JointName, Partial<JointRot>>> = {}
  for (const j of JOINTS) {
    const a = G[j]
    const b = over[j]
    if (a || b) out[j] = { ...a, ...b }
  }
  return out
}

/**
 * The attack library. Strike apex is authored at u=0.5 (the browser-QA capture
 * contract — screenshots taken at mid-track land on the strike).
 */
export const ATTACKS: Record<AttackId, AttackDef> = {
  overhead: {
    id: 'overhead',
    dur: 0.45,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.3,
        pose: guarded({
          shoulderR: { x: -2.9 },
          elbowR: { x: -0.5 },
          torso: { x: -0.1, y: -0.2 },
          head: { x: -0.15 },
        }),
      },
      {
        u: 0.5,
        pose: guarded({
          shoulderR: { x: -0.7 },
          elbowR: { x: -0.1 },
          torso: { x: 0.3, y: 0.1 },
          hipL: { x: -0.2 },
        }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  slashL: {
    id: 'slashL',
    dur: 0.45,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.28,
        pose: guarded({ shoulderR: { x: -1.5, y: 0.5 }, elbowR: { x: -0.8 }, torso: { y: -0.55 } }),
      },
      {
        u: 0.5,
        pose: guarded({ shoulderR: { x: -1.0, y: -0.9 }, elbowR: { x: -0.15 }, torso: { y: 0.5 } }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  slashR: {
    id: 'slashR',
    dur: 0.45,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.28,
        pose: guarded({ shoulderR: { x: -1.5, y: -0.9 }, elbowR: { x: -0.8 }, torso: { y: 0.45 } }),
      },
      {
        u: 0.5,
        pose: guarded({ shoulderR: { x: -1.0, y: 0.6 }, elbowR: { x: -0.15 }, torso: { y: -0.55 } }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  thrust: {
    id: 'thrust',
    dur: 0.42,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.32,
        pose: guarded({ elbowR: { x: -1.6 }, shoulderR: { x: -0.5 }, torso: { y: -0.35 } }),
      },
      {
        u: 0.5,
        pose: guarded({
          shoulderR: { x: -1.55 },
          elbowR: { x: -0.05 },
          torso: { x: 0.28, y: 0.3 },
          hipR: { x: -0.25 },
          kneeL: { x: 0.5 },
        }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  riser: {
    id: 'riser',
    dur: 0.6,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.3,
        pose: guarded({
          torso: { x: 0.35 },
          kneeL: { x: 0.9 },
          kneeR: { x: 0.9 },
          hipL: { x: -0.45 },
          hipR: { x: -0.45 },
          shoulderR: { x: 0.4 },
        }),
      },
      {
        u: 0.5,
        pose: guarded({
          shoulderR: { x: -2.7 },
          elbowR: { x: -0.2 },
          torso: { x: -0.18 },
          head: { x: -0.25 },
        }),
      },
      { u: 0.75, pose: guarded({ shoulderR: { x: -2.4 }, elbowR: { x: -0.2 } }) },
      { u: 1, pose: guarded({}) },
    ],
  },
  stumble: {
    id: 'stumble',
    dur: 0.5,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.2,
        pose: guarded({ torso: { x: 0.2, y: 0.5 }, shoulderR: { x: -0.4, y: -0.6 } }),
      },
      {
        u: 0.6,
        pose: guarded({
          torso: { x: 0.3 },
          head: { x: 0.25 },
          shoulderR: { x: 0.1 },
          shoulderL: { x: 0.05 },
          kneeL: { x: 0.35 },
          kneeR: { x: 0.35 },
        }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  block: {
    id: 'block',
    dur: 0.5,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.18,
        pose: guarded({
          shoulderR: { x: -1.2 },
          elbowR: { x: -1.7 },
          shoulderL: { x: -0.5 },
          kneeL: { x: 0.3 },
          kneeR: { x: 0.3 },
        }),
      },
      {
        u: 0.62,
        pose: guarded({
          shoulderR: { x: -1.2 },
          elbowR: { x: -1.7 },
          shoulderL: { x: -0.5 },
          kneeL: { x: 0.3 },
          kneeR: { x: 0.3 },
        }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  flinch: {
    id: 'flinch',
    dur: 0.55,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.18,
        pose: guarded({
          torso: { x: -0.3 },
          head: { x: -0.35 },
          shoulderL: { z: 0.6 },
          shoulderR: { z: -0.6 },
          hipL: { x: -0.15 },
        }),
      },
      {
        u: 0.5,
        pose: guarded({ torso: { x: -0.3 }, head: { x: -0.35 } }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  draw: {
    id: 'draw',
    dur: 0.9,
    frames: [
      { u: 0, pose: {} },
      {
        u: 0.35,
        pose: { shoulderR: { x: -3.0, y: -0.35 }, elbowR: { x: -1.5 }, torso: { y: -0.2 } },
      },
      { u: 0.7, pose: guarded({ shoulderR: { x: -1.1 }, elbowR: { x: -0.9 } }) },
      { u: 1, pose: guarded({}) },
    ],
  },
  slam: {
    id: 'slam',
    dur: 0.6,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.3,
        pose: guarded({ shoulderR: { x: -2.8 }, shoulderL: { x: -2.8 }, torso: { x: -0.15 } }),
      },
      {
        u: 0.5,
        pose: guarded({
          shoulderR: { x: -0.6 },
          shoulderL: { x: -0.6 },
          torso: { x: 0.35 },
          kneeL: { x: 0.5 },
          kneeR: { x: 0.5 },
        }),
      },
      { u: 1, pose: guarded({}) },
    ],
  },
  victory: {
    id: 'victory',
    dur: 1.2,
    hold: true,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.5,
        pose: guarded({ shoulderR: { x: -2.8 }, elbowR: { x: -0.15 }, head: { x: -0.3 } }),
      },
      {
        u: 1,
        pose: guarded({ shoulderR: { x: -2.8 }, elbowR: { x: -0.15 }, head: { x: -0.3 } }),
      },
    ],
  },
  defeat: {
    id: 'defeat',
    dur: 1.1,
    hold: true,
    frames: [
      { u: 0, pose: guarded({}) },
      {
        u: 0.55,
        pose: {
          kneeL: { x: 2.2 },
          kneeR: { x: 2.2 },
          hipL: { x: -0.4 },
          hipR: { x: -0.4 },
          torso: { x: 0.45 },
          head: { x: 0.5 },
          elbowR: { x: -0.15 },
          elbowL: { x: -0.15 },
        },
      },
      {
        u: 1,
        pose: {
          kneeL: { x: 2.2 },
          kneeR: { x: 2.2 },
          hipL: { x: -0.4 },
          hipR: { x: -0.4 },
          torso: { x: 0.45 },
          head: { x: 0.5 },
          elbowR: { x: -0.15 },
          elbowL: { x: -0.15 },
        },
      },
    ],
  },
}

/** Which sword attack each combo beat-key triggers (invariant-tested vs COMBO_KEYS). */
export const ATTACK_FOR_KEY: Record<(typeof COMBO_KEYS)[number], AttackId> = {
  KeyW: 'overhead',
  KeyA: 'slashL',
  KeyS: 'thrust',
  KeyD: 'slashR',
  Space: 'riser',
}

/** Draw-track point at which the sword swaps from the back socket to the hand. */
export const DRAW_SWAP_U = 0.45

// --- Attack track (a tiny pure stepper) ------------------------------------

export interface AnimTrack {
  id: AttackId
  /** Elapsed seconds within the attack. */
  t: number
}

export function startTrack(id: AttackId): AnimTrack {
  return { id, t: 0 }
}

/** Advance a track; returns null once a non-holding attack finishes. */
export function stepTrack(tr: AnimTrack | null, dt: number): AnimTrack | null {
  if (!tr) return null
  const def = ATTACKS[tr.id]
  const t = tr.t + dt
  if (t >= def.dur) return def.hold ? { id: tr.id, t: def.dur } : null
  return { id: tr.id, t }
}

export function trackU(tr: AnimTrack): number {
  return clamp(tr.t / ATTACKS[tr.id].dur, 0, 1)
}

export function trackPose(tr: AnimTrack): JointPose {
  return sampleKeyframes(ATTACKS[tr.id].frames, trackU(tr))
}
