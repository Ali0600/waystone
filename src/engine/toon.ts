import * as THREE from 'three'

const gradientCache = new Map<number, THREE.DataTexture>()

/**
 * Discrete-band gradient map for MeshToonMaterial.
 * NearestFilter on BOTH filters and NoColorSpace are load-bearing:
 * without them the toon bands silently smear into a smooth gradient.
 */
export function toonGradient(bands = 3): THREE.DataTexture {
  const cached = gradientCache.get(bands)
  if (cached) return cached
  const data = new Uint8Array(bands)
  for (let i = 0; i < bands; i++) {
    data[i] = Math.round((i / (bands - 1)) * 255)
  }
  const tex = new THREE.DataTexture(data, bands, 1, THREE.RedFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  gradientCache.set(bands, tex)
  return tex
}

/**
 * The one choke point for creating toon materials — everything visible in the
 * world should come through here so the gradient-map setup can't be missed.
 */
export function makeToonMaterial(
  color: THREE.ColorRepresentation,
  opts: { bands?: number } & Pick<
    THREE.MeshToonMaterialParameters,
    | 'transparent'
    | 'opacity'
    | 'side'
    | 'emissive'
    | 'emissiveIntensity'
    | 'fog'
    | 'vertexColors'
  > = {},
): THREE.MeshToonMaterial {
  const { bands, ...params } = opts
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(bands ?? 3),
    ...params,
  })
}
