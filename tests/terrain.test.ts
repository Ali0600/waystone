import { describe, expect, it } from 'vitest'
import { heightAt, type IslandParams } from '../src/world/terrain'
import { mulberry32 } from '../src/core/rng'

const params: IslandParams = {
  seed: 1187,
  radius: 80,
  maxHeight: 7,
  terraceStep: 0.45,
  noiseScale: 26,
  plateaus: [{ x: 0, z: 0, r: 14, h: 4.2 }],
}

describe('island heightfield', () => {
  it('is deterministic for the same params', () => {
    for (let i = 0; i < 50; i++) {
      const x = (i * 7919) % 160 - 80
      const z = (i * 104729) % 160 - 80
      expect(heightAt(params, x, z)).toBe(heightAt(params, x, z))
    }
  })

  it('is exactly flat in a plateau core', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 30; i++) {
      const a = rng() * Math.PI * 2
      const r = rng() * 14 * 0.5
      const h = heightAt(params, Math.cos(a) * r, Math.sin(a) * r)
      expect(h).toBeCloseTo(4.2, 6)
    }
  })

  it('returns 0 at and beyond the island radius', () => {
    expect(heightAt(params, 80, 0)).toBe(0)
    expect(heightAt(params, 0, 200)).toBe(0)
  })

  it('stays within sane bounds everywhere', () => {
    const rng = mulberry32(2)
    for (let i = 0; i < 200; i++) {
      const x = (rng() - 0.5) * 160
      const z = (rng() - 0.5) * 160
      const h = heightAt(params, x, z)
      expect(h).toBeGreaterThanOrEqual(-0.001)
      expect(h).toBeLessThanOrEqual(params.maxHeight + 4.2)
    }
  })
})

describe('mulberry32', () => {
  it('is deterministic per seed and in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const c = mulberry32(43)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    const seqC = Array.from({ length: 10 }, () => c())
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
