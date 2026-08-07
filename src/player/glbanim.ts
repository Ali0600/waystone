/**
 * Clip mapping for the GLB hero — PURE, so it's unit-tested against the model's
 * real clip list. The GLB ships a fixed set of named animation clips; this maps
 * Waystone's renderer-agnostic semantic ids (LocoState / AttackId from
 * heroanim.ts) onto them. A different model just needs its own map + clip list.
 *
 * Current asset (M43): **the Surveyor** — Waystone's OWN hooded hero mesh, built
 * in Blender over the CC0 KayKit "Adventurers" skeleton so it inherits that pack's
 * animation clips without us having to author any. Slim/realistic proportions
 * matching the procedural hero (`rig.ts`), NOT KayKit's chibi rogue it replaced
 * — see `docs/DECISIONS.md` D12. Rebuild with `tools/blender/build_waystone_hero.py`.
 *
 * The export is TRIMMED to the clips mapped below (+ T-Pose): 76 -> 14, which is
 * why `HERO_CLIPS` is short. That makes the membership test below strict — any
 * mapping to an unshipped clip fails CI instead of silently not animating.
 */
import type { AttackId, LocoState } from './heroanim'

/** The path Vite serves the model from (base-aware: dev `/`, prod `/waystone/`). */
export const GLB_HERO_URL = `${import.meta.env.BASE_URL}models/waystone/hero.glb`

/**
 * The combat blade for the GLB hero (M41): KayKit's 1-handed sword, from the SAME
 * CC0 pack whose skeleton the hero borrows (`Assets/gltf/sword_1handed.gltf`).
 * Attached to the right-hand bone in combat only (the world hero roams unarmed —
 * there is no back scabbard). A `.gltf`+`.bin`+texture triple; GLTFLoader resolves
 * the sidecars relative to this URL. See `public/models/CREDITS.md`.
 */
export const SWORD_URL = `${import.meta.env.BASE_URL}models/kaykit/sword_1handed.gltf`

/** Every clip the shipped hero.glb contains (parsed from the file at build time).
 *  Trimmed from KayKit's 76 to just what the maps below use, plus T-Pose. */
export const HERO_CLIPS = [
  '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Slice_Diagonal',
  '1H_Melee_Attack_Slice_Horizontal',
  '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Spin',
  'Blocking',
  'Cheer',
  'Death_A',
  'Hit_A',
  'Idle',
  'Jump_Full_Short',
  'Jump_Idle',
  'Running_A',
  'T-Pose',
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
 * Attack id → one-shot clip. The inherited KayKit set HAS bespoke sword swings,
 * so each combo key gets a distinct melee clip (M41 realized this in combat).
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
