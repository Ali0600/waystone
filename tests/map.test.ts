import { describe, expect, it } from 'vitest'
import { frameRegions } from '../src/discovery/map'
import { amberfall } from '../src/content/regions/amberfall'
import { veilspire } from '../src/content/regions/veilspire'
import { waystation } from '../src/content/regions/waystation'
import { cindervault } from '../src/content/regions/cindervault'
import { palegrove } from '../src/content/regions/palegrove'
import { thornmere } from '../src/content/regions/thornmere'

const ALL = [amberfall, veilspire, waystation, cindervault, palegrove, thornmere]
const frameInput = (d: (typeof ALL)[number]) => ({ origin: d.origin, radius: d.island.radius })

describe('frameRegions — world→canvas framing', () => {
  it('frames a single island centered, filling the canvas minus the margin', () => {
    // origin (0,0) r10 → bounds ±10, span 20; scale = (560 - 2*28) / 20.
    const f = frameRegions([{ origin: [0, 0], radius: 10 }], 560)
    expect(f.cx).toBe(0)
    expect(f.cz).toBe(0)
    expect(f.scale).toBeCloseTo(504 / 20, 9) // 25.2
  })

  it('centers on the bounds midpoint and scales by the LARGER axis', () => {
    // Two isles offset in X: X-bounds [-10, 50] (span 60), Z-bounds [-10, 10] (span 20).
    const f = frameRegions(
      [
        { origin: [0, 0], radius: 10 },
        { origin: [40, 0], radius: 10 },
      ],
      560,
    )
    expect(f.cx).toBe(20) // (−10 + 50) / 2
    expect(f.cz).toBe(0)
    expect(f.scale).toBeCloseTo(504 / 60, 9) // larger axis (60) sets the scale, not 20
  })

  it('honors a custom margin', () => {
    const f = frameRegions([{ origin: [0, 0], radius: 10 }], 560, 0)
    expect(f.scale).toBeCloseTo(560 / 20, 9)
  })
})

describe('frameRegions over the real regions', () => {
  it('the local frame of an isle zooms in at least 2x vs the whole-world frame', () => {
    const local = frameRegions([frameInput(amberfall)], 560)
    const world = frameRegions(ALL.map(frameInput), 560)
    // The whole point of the split: the isle view is meaningfully closer.
    expect(local.scale).toBeGreaterThanOrEqual(world.scale * 2)
  })

  it('the world frame centers on the midpoint of every islands bounds', () => {
    const world = frameRegions(ALL.map(frameInput), 560)
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const d of ALL) {
      const [ox, oz] = d.origin
      const r = d.island.radius
      minX = Math.min(minX, ox - r); maxX = Math.max(maxX, ox + r)
      minZ = Math.min(minZ, oz - r); maxZ = Math.max(maxZ, oz + r)
    }
    expect(world.cx).toBeCloseTo((minX + maxX) / 2, 9)
    expect(world.cz).toBeCloseTo((minZ + maxZ) / 2, 9)
  })
})
