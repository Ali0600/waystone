/** Deterministic seeded RNG (mulberry32) — world generation must be repeatable. */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer hash for coordinate-based noise lookups. */
export function hash2(x: number, y: number, seed: number): number {
  let h = seed >>> 0
  h = Math.imul(h ^ (x | 0), 0x85ebca6b)
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Smoothly interpolated 2D value noise in [0, 1]. */
export function valueNoise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const sx = xf * xf * (3 - 2 * xf)
  const sy = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

/** Two-octave fractal value noise in [0, 1]. */
export function fbm2(x: number, y: number, seed: number): number {
  const n1 = valueNoise2(x, y, seed)
  const n2 = valueNoise2(x * 2.7, y * 2.7, seed ^ 0x9e3779b9)
  return (n1 * 2 + n2) / 3
}
