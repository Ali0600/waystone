import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  LANDMARK_GLB_URLS,
  hidePrimitiveRender,
  landmarkMaterial,
  retoonGlb,
} from '../src/world/landmarkglb'
import { buildCollider } from '../src/world/collision'
import { buildLandmark } from '../src/world/landmarks'
import { buildRegion } from '../src/world/region'
import { amberfall } from '../src/content/regions/amberfall'

/** Triangle count actually baked into the BVH for a subtree. */
function bvhTris(root: THREE.Object3D): number {
  return buildCollider(root).bvh.geometry.index!.count / 3
}

/**
 * THE invariant this feature stands on.
 *
 * three-mesh-bvh's StaticGeometryGenerator walks `object.traverseVisible`, so it
 * bakes only VISIBLE meshes. Hiding an upgraded landmark with `object.visible =
 * false` would therefore delete it from collision at the next rebuild — and
 * rebuilds happen at runtime (latent-path solidify, waystone planting), so the
 * monument would become walk-through-able only *after* planting. Nothing about
 * the render output reveals this, which is exactly why it's pinned here.
 */
describe('hidePrimitiveRender — hides the render, never the collision', () => {
  it('leaves the collider triangle count unchanged', () => {
    const socket = buildLandmark('socket', '#8d8398')
    const before = bvhTris(socket)
    expect(before).toBeGreaterThan(0)

    hidePrimitiveRender(socket)

    expect(bvhTris(socket)).toBe(before)
  })

  it('keeps every mesh object.visible (what traverseVisible reads)', () => {
    const socket = buildLandmark('socket', '#8d8398')
    hidePrimitiveRender(socket)

    let meshes = 0
    socket.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      meshes++
      expect(mesh.visible, 'object.visible must stay true or the BVH loses it').toBe(true)
    })
    expect(meshes).toBeGreaterThan(0)
  })

  it('does hide it from the renderer (material.visible is what three checks)', () => {
    const socket = buildLandmark('socket', '#8d8398')
    hidePrimitiveRender(socket)

    socket.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        expect(m.visible).toBe(false)
      }
    })
  })
})

describe('decor — render-only, never collidable', () => {
  it('is a sibling of collidable, not a descendant', () => {
    const region = buildRegion(amberfall)
    const collidable = region.group.getObjectByName('collidable')!
    expect(region.decor.parent).toBe(region.group)
    expect(collidable.getObjectByName('decor')).toBeUndefined()
  })

  it('a mesh added to decor does not enter the collider', () => {
    const region = buildRegion(amberfall)
    const collidable = region.group.getObjectByName('collidable')!
    const before = bvhTris(collidable)

    region.decor.add(
      new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial()),
    )
    region.rebuildCollider([])

    expect(bvhTris(collidable)).toBe(before)
  })
})

describe('landmarkMaterial — the Blender→game material contract', () => {
  it('maps rock to the region palette colour', () => {
    expect(landmarkMaterial('rock', '#8d8398').color.getHexString()).toBe('8d8398')
  })

  it('maps rock-dark to the well stone', () => {
    expect(landmarkMaterial('rock-dark', '#8d8398').color.getHexString()).toBe('2c2638')
  })

  it('makes the rune inlay emissive', () => {
    const m = landmarkMaterial('rune', '#8d8398')
    expect(m.emissive.getHex()).toBeGreaterThan(0)
    expect(m.emissiveIntensity).toBeGreaterThan(0)
  })

  it('falls back to rock for an unknown name instead of throwing', () => {
    expect(() => landmarkMaterial('who-named-this', '#8d8398')).not.toThrow()
    expect(landmarkMaterial('who-named-this', '#8d8398').color.getHexString()).toBe('8d8398')
  })

  it('every material is a toon material (the one choke point)', () => {
    for (const name of ['rock', 'rock-dark', 'rune', 'nonsense']) {
      expect(landmarkMaterial(name, '#8d8398').type).toBe('MeshToonMaterial')
    }
  })
})

describe('retoonGlb', () => {
  const named = (name: string) => {
    const m = new THREE.MeshStandardMaterial()
    m.name = name
    return m
  }

  it('replaces imported materials by name', () => {
    const root = new THREE.Group()
    // Typed as the base Mesh so `.material` widens — retoonGlb swaps the
    // concrete material type out from under it, which is the point.
    const rock: THREE.Mesh = new THREE.Mesh(new THREE.BoxGeometry(), named('rock'))
    const rune: THREE.Mesh = new THREE.Mesh(new THREE.BoxGeometry(), named('rune'))
    root.add(rock, rune)

    retoonGlb(root, '#8d8398')

    expect((rock.material as THREE.Material).type).toBe('MeshToonMaterial')
    expect((rock.material as THREE.MeshToonMaterial).color.getHexString()).toBe('8d8398')
    expect((rune.material as THREE.MeshToonMaterial).emissive.getHex()).toBeGreaterThan(0)
  })

  it('handles a multi-material mesh (the array case a GLB can produce)', () => {
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [named('rock'), named('rune')])
    root.add(mesh)

    retoonGlb(root, '#8d8398')

    const mats = mesh.material as THREE.Material[]
    expect(Array.isArray(mats)).toBe(true)
    expect(mats.map((m) => m.type)).toEqual(['MeshToonMaterial', 'MeshToonMaterial'])
  })
})

describe('LANDMARK_GLB_URLS', () => {
  it('is base-aware and points at the committed asset', () => {
    const url = LANDMARK_GLB_URLS.socket
    expect(url.endsWith('models/waystone/socket.glb')).toBe(true)
    expect(url.startsWith(import.meta.env.BASE_URL)).toBe(true)
  })
})
