/**
 * Clip mapping for the downloadable GLB hero (M39, the D7 trial) — PURE, so it's
 * unit-tested against the model's real clip list. The GLB ships a fixed set of
 * named animation clips; this maps Waystone's renderer-agnostic semantic ids
 * (LocoState / AttackId from heroanim.ts) onto them. A different pack just needs
 * its own map + clip list here.
 *
 * Current asset: **KayKit "Adventurers" — Rogue (Hooded)**, CC0 by Kay Lousberg
 * (a hooded fantasy adventurer that matches the Surveyor). 76 clips including
 * bespoke 1H melee swings, so the combat map below points at real attack clips
 * (combat still renders the procedural rig this trial — see docs/DECISIONS.md D7).
 *
 * A wrong clip name = a silent no-animation bug, so `tests/glbanim.test.ts` pins
 * every mapped value to a clip that exists in `ADVENTURER_CLIPS`.
 */
import type { AttackId, LocoState } from './heroanim'

/** The path Vite serves the model from (base-aware: dev `/`, prod `/waystone/`). */
export const GLB_HERO_URL = `${import.meta.env.BASE_URL}models/Rogue_Hooded.glb`

/**
 * The combat blade for the GLB hero (M41): KayKit's 1-handed sword, from the SAME
 * CC0 pack/commit as the rogue (`Assets/gltf/sword_1handed.gltf`). Attached to the
 * right-hand bone in combat only (the world rogue roams unarmed — KayKit has no
 * back scabbard). A `.gltf`+`.bin`+texture triple; GLTFLoader resolves the sidecars
 * relative to this URL. See `public/models/CREDITS.md`.
 */
export const SWORD_URL = `${import.meta.env.BASE_URL}models/kaykit/sword_1handed.gltf`

/** Every clip the shipped Rogue_Hooded.glb contains (parsed from the file at add-time). */
export const ADVENTURER_CLIPS = [
  '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Slice_Diagonal',
  '1H_Melee_Attack_Slice_Horizontal',
  '1H_Melee_Attack_Stab',
  '1H_Ranged_Aiming',
  '1H_Ranged_Reload',
  '1H_Ranged_Shoot',
  '1H_Ranged_Shooting',
  '2H_Melee_Attack_Chop',
  '2H_Melee_Attack_Slice',
  '2H_Melee_Attack_Spin',
  '2H_Melee_Attack_Spinning',
  '2H_Melee_Attack_Stab',
  '2H_Melee_Idle',
  '2H_Ranged_Aiming',
  '2H_Ranged_Reload',
  '2H_Ranged_Shoot',
  '2H_Ranged_Shooting',
  'Block',
  'Block_Attack',
  'Block_Hit',
  'Blocking',
  'Cheer',
  'Death_A',
  'Death_A_Pose',
  'Death_B',
  'Death_B_Pose',
  'Dodge_Backward',
  'Dodge_Forward',
  'Dodge_Left',
  'Dodge_Right',
  'Dualwield_Melee_Attack_Chop',
  'Dualwield_Melee_Attack_Slice',
  'Dualwield_Melee_Attack_Stab',
  'Hit_A',
  'Hit_B',
  'Idle',
  'Interact',
  'Jump_Full_Long',
  'Jump_Full_Short',
  'Jump_Idle',
  'Jump_Land',
  'Jump_Start',
  'Lie_Down',
  'Lie_Idle',
  'Lie_Pose',
  'Lie_StandUp',
  'PickUp',
  'Running_A',
  'Running_B',
  'Running_Strafe_Left',
  'Running_Strafe_Right',
  'Sit_Chair_Down',
  'Sit_Chair_Idle',
  'Sit_Chair_Pose',
  'Sit_Chair_StandUp',
  'Sit_Floor_Down',
  'Sit_Floor_Idle',
  'Sit_Floor_Pose',
  'Sit_Floor_StandUp',
  'Spellcast_Long',
  'Spellcast_Raise',
  'Spellcast_Shoot',
  'Spellcasting',
  'T-Pose',
  'Throw',
  'Unarmed_Idle',
  'Unarmed_Melee_Attack_Kick',
  'Unarmed_Melee_Attack_Punch_A',
  'Unarmed_Melee_Attack_Punch_B',
  'Unarmed_Pose',
  'Use_Item',
  'Walking_A',
  'Walking_B',
  'Walking_Backwards',
  'Walking_C',
] as const

/** Locomotion state → looping clip. sprint reuses Running_A (played faster by the driver). */
export const CLIP_FOR_LOCO: Record<LocoState, string> = {
  idle: 'Idle',
  run: 'Running_A',
  sprint: 'Running_A',
  jump: 'Jump_Idle',
  fall: 'Jump_Idle',
  grapple: 'Idle',
}

/**
 * Attack id → one-shot clip. The KayKit pack HAS bespoke sword swings, so each
 * combo key gets a distinct melee clip (ready for a future combat-GLB; combat
 * still uses the procedural rig in the M39/M40 trial).
 */
export const CLIP_FOR_ATTACK: Record<AttackId, string> = {
  overhead: '1H_Melee_Attack_Chop',
  slashL: '1H_Melee_Attack_Slice_Horizontal',
  slashR: '1H_Melee_Attack_Slice_Diagonal',
  thrust: '1H_Melee_Attack_Stab',
  riser: '2H_Melee_Attack_Spin',
  stumble: 'Hit_A',
  block: 'Blocking',
  flinch: 'Hit_A',
  draw: 'Idle',
  slam: 'Jump_Full_Short',
  victory: 'Cheer',
  defeat: 'Death_A',
}
