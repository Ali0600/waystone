import { describe, expect, it } from 'vitest'
import {
  CLIP_FOR_ATTACK,
  CLIP_FOR_LOCO,
  GLB_HERO_URL,
  HERO_CLIPS,
  SWORD_URL,
} from '../src/player/glbanim'
import { weaponScaleFor } from '../src/player/glbdriver'

/**
 * `HERO_CLIPS` is the clip list of the shipped hero.glb. These guard that every
 * semantic id maps to a clip that's actually in that list — a wrong clip name is
 * otherwise a silent no-animation bug.
 *
 * Since M43 the export is TRIMMED to exactly what's mapped (14 clips, down from
 * KayKit's 76), so this is now a tight two-way constraint rather than a loose
 * membership check: dropping a clip from the Blender export, or pointing a map at
 * a clip that isn't shipped, both fail here. (Reading the binary GLB itself needs
 * node fs, which the project's tsconfig excludes — that stays browser-QA.)
 */
describe('GLB hero clip mapping', () => {
  const clips = new Set<string>(HERO_CLIPS)

  it('every locomotion state maps to a real clip', () => {
    for (const [state, clip] of Object.entries(CLIP_FOR_LOCO)) {
      expect(clips.has(clip), `loco '${state}' → '${clip}' not in HERO_CLIPS`).toBe(true)
    }
  })

  it('every attack id maps to a real clip', () => {
    for (const [id, clip] of Object.entries(CLIP_FOR_ATTACK)) {
      expect(clips.has(clip), `attack '${id}' → '${clip}' not in HERO_CLIPS`).toBe(true)
    }
  })

  it('ships no clip it does not use (the trim stays honest)', () => {
    const used = new Set([
      ...Object.values(CLIP_FOR_LOCO),
      ...Object.values(CLIP_FOR_ATTACK),
      'T-Pose', // kept as a rest reference
    ])
    const unused = HERO_CLIPS.filter((c) => !used.has(c))
    expect(unused, `hero.glb ships clips nothing maps to: ${unused.join(', ')}`).toEqual([])
  })

  it('GLB_HERO_URL points at the committed hero asset', () => {
    expect(GLB_HERO_URL.endsWith('models/waystone/hero.glb')).toBe(true)
    expect(GLB_HERO_URL.startsWith(import.meta.env.BASE_URL)).toBe(true)
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

/**
 * Weapons are authored for the hand of whatever body their pack drew. KayKit's
 * sword imports at 1.91u on our 1.7u hero — 112% of body height — which read as
 * stylistically fine on the chibi rogue and absurd on the slim Surveyor (M43).
 * `weaponScaleFor` renormalizes it, so swapping either side can't reintroduce
 * the mismatch. The attach itself needs the binary asset → browser-QA.
 */
describe('weaponScaleFor', () => {
  it('brings the KayKit blade to roughly half the hero height', () => {
    const scaled = 1.91 * weaponScaleFor(1.91)
    expect(scaled).toBeCloseTo(0.95, 5)
    expect(scaled / 1.7).toBeLessThan(0.65) // a sword, not a flagpole
    expect(scaled / 1.7).toBeGreaterThan(0.4)
  })

  it('is a no-op on a degenerate measurement instead of collapsing the weapon', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(weaponScaleFor(bad)).toBe(1)
    }
  })
})
