/**
 * Blender-authored GLB landmark models (M42) — the first static asset in the
 * world layer. A landmark opts in with `LandmarkDef.model`; the GLB is an
 * OVERLAY that replaces the primitive's *rendering* only.
 *
 * ## Why the primitive stays
 *
 * The primitive landmark IS the collider and must remain one. Two traps make
 * that less obvious than it looks — both verified in source, not assumed:
 *
 * 1. **three-mesh-bvh's `StaticGeometryGenerator` walks `object.traverseVisible`**,
 *    so it only bakes VISIBLE meshes. Hiding the primitive the obvious way
 *    (`mesh.visible = false`) would silently drop the landmark out of the BVH at
 *    the next `world.rebuildCollider(...)` — which really fires at runtime, on
 *    latent-path solidify and waystone planting (`main.ts`). You would walk
 *    straight through the monument, and only *after* planting. So we hide it from
 *    the RENDERER instead: `material.visible = false` (three's `projectObject`
 *    gates the render-list push on it) while `object.visible` stays `true`.
 *    `hidePrimitiveRender` below is the single owner of that distinction, and
 *    `tests/landmarkglb.test.ts` pins the collider triangle count across it.
 *
 * 2. **The GLB must never enter the collidable subtree.** It is attached to the
 *    region's `decor` Group — a sibling of `collidable`, never a descendant — so
 *    no rebuild can pull its 1,840 triangles into collision.
 *
 * Net effect: the BVH is byte-identical to before this feature existed.
 *
 * The models ship no textures; `retoonGlb` maps their named materials onto
 * `makeToonMaterial` so a monument wears the region's own palette.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { makeToonMaterial } from '../engine/toon'

/** Base-aware model URLs (dev `/`, GitHub Pages `/waystone/`) — the `GLB_HERO_URL` pattern. */
export const LANDMARK_GLB_URLS: Record<string, string> = {
  socket: `${import.meta.env.BASE_URL}models/waystone/socket.glb`,
}

/** The dark stone of the socket's inner well — the value `buildSocket()` already used. */
const WELL_DARK = '#2c2638'
/** Arcane inlay: the waystone-monolith / grapple-crystal palette. */
const RUNE = { color: '#8ad8c8', emissive: '#2e8a76', emissiveIntensity: 0.9 }

/**
 * PURE name → toon material map. The exported GLB names its materials
 * `rock` / `rock-dark` / `rune`; those names are the whole contract between
 * Blender and the game, so an unknown one must degrade rather than throw.
 */
export function landmarkMaterial(name: string, rockColor: string): THREE.MeshToonMaterial {
  switch (name) {
    case 'rock-dark':
      return makeToonMaterial(WELL_DARK)
    case 'rune':
      return makeToonMaterial(RUNE.color, {
        emissive: RUNE.emissive,
        emissiveIntensity: RUNE.emissiveIntensity,
      })
    case 'rock':
    default:
      return makeToonMaterial(rockColor)
  }
}

/**
 * Swap every imported material for a toon one, keyed by the imported name.
 * Handles the multi-material (array) case, which the sibling swaps in
 * `latentpath.ts` / `world.ts` don't — a GLB is the one place it can occur.
 */
export function retoonGlb(root: THREE.Object3D, rockColor: string): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const swap = (m: THREE.Material) => {
      const next = landmarkMaterial(m.name, rockColor)
      m.dispose()
      return next
    }
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(swap)
      : swap(mesh.material)
  })
}

/**
 * Hide a primitive landmark from the RENDERER while keeping it in the collider.
 *
 * `material.visible = false` — NOT `object.visible = false`, which would remove
 * it from `traverseVisible` and therefore from the BVH (trap 1 above).
 */
export function hidePrimitiveRender(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      m.visible = false
    }
  })
}

/**
 * Load a landmark model. Resolves to null on any failure (missing file, bad
 * parse) after warning — the caller then leaves the primitive visible, so a
 * broken asset degrades to the old look instead of an empty patch of ground.
 * A silent fallback would hide exactly the outage it protects against.
 */
export async function loadLandmarkGlb(model: string): Promise<THREE.Group | null> {
  const url = LANDMARK_GLB_URLS[model]
  if (!url) {
    console.warn(`[landmarkglb] no model registered for "${model}"`)
    return null
  }
  try {
    const gltf = await new GLTFLoader().loadAsync(url)
    return gltf.scene
  } catch (e) {
    console.warn(`[landmarkglb] failed to load ${url} — keeping the primitive`, e)
    return null
  }
}
