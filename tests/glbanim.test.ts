import { describe, expect, it } from 'vitest'
import { CLIP_FOR_ATTACK, CLIP_FOR_LOCO, ROBOT_CLIPS } from '../src/player/glbanim'

/**
 * `ROBOT_CLIPS` is the clip list parsed from the shipped RobotExpressive.glb at
 * add-time. These guard that every semantic id maps to a clip that's actually in
 * that list — a wrong clip name is otherwise a silent no-animation bug. (The
 * asset-reality check — that the .glb still ships these clips — is the M39 browser
 * QA, since reading a binary GLB needs node fs, which the project's tsconfig
 * deliberately excludes.)
 */
describe('GLB hero clip mapping', () => {
  const clips = new Set<string>(ROBOT_CLIPS)

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
})
