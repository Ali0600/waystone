import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { makeToonMaterial, toonGradient } from '../src/engine/toon'

// The brief's gotcha: gradientMap without NearestFilter/NoColorSpace silently
// smears toon bands into a smooth gradient. These tests pin the choke point.
describe('toonGradient', () => {
  it('uses NearestFilter for both filters', () => {
    const tex = toonGradient(3)
    expect(tex.minFilter).toBe(THREE.NearestFilter)
    expect(tex.magFilter).toBe(THREE.NearestFilter)
  })

  it('keeps non-color data colorSpace', () => {
    expect(toonGradient(3).colorSpace).toBe(THREE.NoColorSpace)
  })

  it('produces N evenly spread bands from 0 to 255', () => {
    const tex = toonGradient(4)
    const data = tex.image.data as Uint8Array
    expect(Array.from(data)).toEqual([0, 85, 170, 255])
    expect(tex.image.width).toBe(4)
    expect(tex.image.height).toBe(1)
  })

  it('caches per band count', () => {
    expect(toonGradient(3)).toBe(toonGradient(3))
    expect(toonGradient(3)).not.toBe(toonGradient(5))
  })
})

describe('makeToonMaterial', () => {
  it('wires the gradient map into a MeshToonMaterial', () => {
    const mat = makeToonMaterial('#ff0000')
    expect(mat).toBeInstanceOf(THREE.MeshToonMaterial)
    expect(mat.gradientMap).toBe(toonGradient(3))
    expect(mat.color.getHexString()).toBe('ff0000')
  })

  it('passes through material params', () => {
    const mat = makeToonMaterial('#00ff00', { transparent: true, opacity: 0.5, bands: 5 })
    expect(mat.transparent).toBe(true)
    expect(mat.opacity).toBe(0.5)
    expect(mat.gradientMap).toBe(toonGradient(5))
  })
})
