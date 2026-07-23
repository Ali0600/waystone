import { describe, expect, it } from 'vitest'
import { CLIP_FOR_ATTACK, CLIP_FOR_LOCO, ADVENTURER_CLIPS, SWORD_URL } from '../src/player/glbanim'

/**
 * `ADVENTURER_CLIPS` is the clip list parsed from the shipped Rogue_Hooded.glb at
 * add-time. These guard that every semantic id maps to a clip that's actually in
 * that list — a wrong clip name is otherwise a silent no-animation bug. (The
 * asset-reality check — that the .glb still ships these clips — is the browser QA,
 * since reading a binary GLB needs node fs, which the project's tsconfig
 * deliberately excludes.)
 */
describe('GLB hero clip mapping', () => {
  const clips = new Set<string>(ADVENTURER_CLIPS)

  it('every locomotion state maps to a real clip', () => {
    for (const [state, clip] of Object.entries(CLIP_FOR_LOCO)) {
      expect(clips.has(clip), `loco '${state}' → '${clip}' not in ROBOT_CLIPS`).toBe(true)
    }
  })

  it('every attack id maps to a real clip', () => {
    for (const [id, clip] of Object.entries(CLIP_FOR_ATTACK)) {
      expect(clips.has(clip), `attack '${id}' → '${clip}' not in ROBOT_CLIPS`).toBe(true)
    }
  })

  it('covers idle/run/sprint/jump — the states the world trial exercises', () => {
    for (const s of ['idle', 'run', 'sprint', 'jump'] as const) {
      expect(CLIP_FOR_LOCO[s]).toBeTruthy()
    }
  })

  // M41: combat blade path. The actual bone-attach needs the binary asset → browser-QA;
  // here we just pin the committed path so a typo can't silently 404 the sword.
  it('SWORD_URL points at the committed KayKit blade under models/kaykit', () => {
    expect(SWORD_URL.endsWith('models/kaykit/sword_1handed.gltf')).toBe(true)
  })
})
