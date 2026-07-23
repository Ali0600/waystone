/**
 * Clip mapping for the downloadable GLB hero (M39, the D7 trial) — PURE, so it's
 * unit-tested against the REAL shipped model. The GLB (RobotExpressive, CC0 by
 * Quaternius) ships a fixed set of named animation clips; this maps Waystone's
 * renderer-agnostic semantic ids (LocoState / AttackId from heroanim.ts) onto
 * them. A future GLB pack just needs its own map + clip list here.
 *
 * A wrong clip name = a silent no-animation bug, so `tests/glbanim.test.ts` pins
 * every value to a clip that actually exists in the shipped .glb.
 */
import type { AttackId, LocoState } from './heroanim'

/** The path Vite serves the model from (base-aware: dev `/`, prod `/waystone/`). */
export const GLB_HERO_URL = `${import.meta.env.BASE_URL}models/RobotExpressive.glb`

/** The 14 clips RobotExpressive.glb ships (verified by parsing the file; the test re-checks). */
export const ROBOT_CLIPS = [
  'Dance',
  'Death',
  'Idle',
  'Jump',
  'No',
  'Punch',
  'Running',
  'Sitting',
  'Standing',
  'ThumbsUp',
  'Walking',
  'WalkJump',
  'Wave',
  'Yes',
] as const

/** Locomotion state → looping clip. sprint reuses Running (played faster by the driver). */
export const CLIP_FOR_LOCO: Record<LocoState, string> = {
  idle: 'Idle',
  run: 'Running',
  sprint: 'Running',
  jump: 'Jump',
  fall: 'Jump',
  grapple: 'Idle',
}

/**
 * Attack id → one-shot clip. A generic pack has no bespoke sword swings, so the
 * five combo attacks all fall back to the single combat clip (Punch); outros use
 * gesture clips. (Combat keeps the procedural rig in the M39 trial — this map
 * exists for a future combat-GLB swap and is coverage-tested.)
 */
export const CLIP_FOR_ATTACK: Record<AttackId, string> = {
  overhead: 'Punch',
  slashL: 'Punch',
  slashR: 'Punch',
  thrust: 'Punch',
  riser: 'Punch',
  stumble: 'No',
  block: 'No',
  flinch: 'No',
  draw: 'Idle',
  slam: 'Jump',
  victory: 'Dance',
  defeat: 'Death',
}
