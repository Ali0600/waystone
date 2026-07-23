import { describe, expect, it } from 'vitest'
import { COMBO_KEYS } from '../src/content/chains'
import {
  ATTACKS,
  ATTACK_FOR_KEY,
  JOINTS,
  type JointName,
  type LocoState,
  locomotionState,
  sampleKeyframes,
  samplePose,
  startTrack,
  stepTrack,
  trackPose,
  trackU,
  zeroPose,
} from '../src/player/heroanim'

const loco = (o: Partial<Parameters<typeof locomotionState>[0]>): LocoState =>
  locomotionState({ speed: 0, onGround: true, vy: 0, mode: 'normal', sinceDash: Infinity, ...o })

describe('locomotionState', () => {
  it('maps real movement states', () => {
    expect(loco({ speed: 0 })).toBe('idle')
    expect(loco({ speed: 7 })).toBe('run')
    expect(loco({ speed: 16 })).toBe('sprint')
    // A recent dash burst reads as a sprint even once speed has decayed to walk.
    expect(loco({ speed: 7, sinceDash: 0.2 })).toBe('sprint')
    expect(loco({ speed: 7, sinceDash: 0.9 })).toBe('run')
    expect(loco({ onGround: false, vy: 9.5 })).toBe('jump')
    expect(loco({ onGround: false, vy: -3 })).toBe('fall')
    expect(loco({ mode: 'grapple', speed: 5 })).toBe('grapple')
  })
})

describe('gait sampler', () => {
  it('run legs are antiphase and arms counter the same-side leg', () => {
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const p = samplePose('run', t, 7)
      expect(p.hipL.x).toBeCloseTo(-p.hipR.x, 6) // antiphase legs
      if (Math.abs(p.hipR.x) > 0.05) {
        expect(Math.sign(p.shoulderR.x)).toBe(-Math.sign(p.hipR.x)) // arm counters leg
      }
    }
  })

  it('sprint swings the legs harder than run (same speed isolates the state)', () => {
    const peak = (state: LocoState, speed: number): number => {
      let m = 0
      for (let t = 0; t <= 2; t += 0.01) m = Math.max(m, Math.abs(samplePose(state, t, speed).hipL.x))
      return m
    }
    // Compare at the SAME speed so the speed→amplitude ramp can't mask a
    // sabotaged sprint multiplier — this isolates the per-state leg amplitude.
    expect(peak('sprint', 12)).toBeGreaterThan(peak('run', 12))
  })

  it('leg cadence rises with speed', () => {
    const flips = (speed: number): number => {
      let n = 0
      let prev = samplePose('run', 0, speed).hipL.x
      for (let t = 0.01; t <= 2; t += 0.01) {
        const v = samplePose('run', t, speed).hipL.x
        if (Math.sign(v) !== Math.sign(prev) && v !== 0) n++
        prev = v
      }
      return n
    }
    expect(flips(7)).toBeGreaterThan(flips(3))
  })

  it('idle is alive but subtle (small peak-to-peak on every joint)', () => {
    const lo = {} as Record<JointName, { x: number; y: number; z: number }>
    const hi = {} as Record<JointName, { x: number; y: number; z: number }>
    for (const j of JOINTS) {
      lo[j] = { x: Infinity, y: Infinity, z: Infinity }
      hi[j] = { x: -Infinity, y: -Infinity, z: -Infinity }
    }
    for (let t = 0; t <= 6; t += 0.05) {
      const p = samplePose('idle', t, 0)
      for (const j of JOINTS)
        for (const ax of ['x', 'y', 'z'] as const) {
          lo[j][ax] = Math.min(lo[j][ax], p[j][ax])
          hi[j][ax] = Math.max(hi[j][ax], p[j][ax])
        }
    }
    for (const j of JOINTS)
      for (const ax of ['x', 'y', 'z'] as const)
        expect(hi[j][ax] - lo[j][ax]).toBeLessThan(0.12)
    // Alive: the pose is not frozen.
    expect(samplePose('idle', 0, 0)).not.toEqual(samplePose('idle', 2, 0))
  })
})

describe('keyframe engine', () => {
  it('interpolates with smoothstep easing (not linear)', () => {
    const frames = [
      { u: 0, pose: { torso: { x: 0 } } },
      { u: 1, pose: { torso: { x: 1 } } },
    ]
    // smoothstep(0.25) = 0.25^2 * (3 - 0.5) = 0.15625 — a linear lerp would give 0.25.
    expect(sampleKeyframes(frames, 0.25).torso.x).toBeCloseTo(0.15625, 6)
  })

  it('hits authored keyframes exactly and clamps out-of-range u', () => {
    const frames = [
      { u: 0, pose: { torso: { x: 0 } } },
      { u: 0.5, pose: { torso: { x: 2 } } },
      { u: 1, pose: { torso: { x: 0 } } },
    ]
    expect(sampleKeyframes(frames, 0.5).torso.x).toBeCloseTo(2, 6)
    expect(sampleKeyframes(frames, -0.5).torso.x).toBeCloseTo(0, 6) // clamp low
    expect(sampleKeyframes(frames, 1.5).torso.x).toBeCloseTo(0, 6) // clamp high
  })

  it('eases absent joints/axes to neutral and always returns every joint', () => {
    const frames = [
      { u: 0, pose: { shoulderR: { x: -1 } } },
      { u: 1, pose: { shoulderR: { x: -1 } } },
    ]
    const p = sampleKeyframes(frames, 0.5)
    expect(Object.keys(p).sort()).toEqual([...JOINTS].sort())
    expect(p.kneeR).toEqual({ x: 0, y: 0, z: 0 }) // never mentioned → neutral
  })
})

describe('attack library', () => {
  it('maps every combo key to a real attack', () => {
    expect(Object.keys(ATTACK_FOR_KEY).sort()).toEqual([...COMBO_KEYS].sort())
    for (const id of Object.values(ATTACK_FOR_KEY)) expect(ATTACKS[id]).toBeDefined()
  })

  it('every attack is well-formed (u ascending 0→1, known joints, hold only on outros)', () => {
    for (const def of Object.values(ATTACKS)) {
      expect(def.dur).toBeGreaterThan(0)
      expect(def.frames.length).toBeGreaterThanOrEqual(2)
      expect(def.frames[0].u).toBe(0)
      expect(def.frames[def.frames.length - 1].u).toBe(1)
      for (let i = 1; i < def.frames.length; i++)
        expect(def.frames[i].u).toBeGreaterThan(def.frames[i - 1].u) // strictly ascending
      for (const f of def.frames)
        for (const j of Object.keys(f.pose)) expect(JOINTS).toContain(j as JointName)
      if (def.hold) expect(['victory', 'defeat']).toContain(def.id)
    }
  })
})

describe('attack track', () => {
  it('accumulates, ends a normal attack, and clamps a holding one', () => {
    const tr = startTrack('thrust')
    expect(tr.t).toBe(0)
    expect(stepTrack(tr, 0.1)!.t).toBeCloseTo(0.1, 6)
    // thrust dur 0.42 → stepping past it ends the track.
    expect(stepTrack({ id: 'thrust', t: 0.4 }, 0.1)).toBeNull()
    // victory holds: stepping way past dur clamps to the final frame, never null.
    const held = stepTrack({ id: 'victory', t: 0 }, 99)!
    expect(held).not.toBeNull()
    expect(trackU(held)).toBeCloseTo(1, 6)
  })

  it('trackPose samples the attack at the current normalized time', () => {
    const half = { id: 'thrust' as const, t: ATTACKS.thrust.dur / 2 }
    expect(trackPose(half)).toEqual(sampleKeyframes(ATTACKS.thrust.frames, 0.5))
  })
})

describe('zeroPose', () => {
  it('has every joint at rest', () => {
    const z = zeroPose()
    expect(Object.keys(z).sort()).toEqual([...JOINTS].sort())
    for (const j of JOINTS) expect(z[j]).toEqual({ x: 0, y: 0, z: 0 })
  })
})
