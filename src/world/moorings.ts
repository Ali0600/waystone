import * as THREE from 'three'
import { makeToonMaterial } from '../engine/toon'

/** A small dock post with a hanging bell — the ferry mooring marker. */
function buildMooringPost(): THREE.Group {
  const g = new THREE.Group()
  const wood = makeToonMaterial('#6b5540')
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 6), wood)
  post.position.y = 1.1
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), wood)
  arm.position.set(0.25, 2.1, 0)
  const bell = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.32, 7),
    makeToonMaterial('#8aa87a', { emissive: '#3a5a3a', emissiveIntensity: 0.5 }),
  )
  bell.position.set(0.5, 1.85, 0)
  bell.name = 'bell'
  g.add(post, arm, bell)
  return g
}

/**
 * Renders the ferry moorings — one post per manifested region. `add` is
 * idempotent per region so a manifest event can re-offer the full list.
 */
export class MooringPosts {
  readonly group = new THREE.Group()
  private have = new Set<string>()
  private t = 0

  constructor(private heightAt: (x: number, z: number) => number) {}

  add(moorings: { regionId: string; x: number; z: number }[]): void {
    for (const m of moorings) {
      if (this.have.has(m.regionId)) continue
      this.have.add(m.regionId)
      const post = buildMooringPost()
      post.position.set(m.x, this.heightAt(m.x, m.z), m.z)
      this.group.add(post)
    }
  }

  update(dt: number): void {
    this.t += dt
    for (const post of this.group.children) {
      const bell = post.getObjectByName('bell')
      if (bell) bell.rotation.z = Math.sin(this.t * 1.6 + post.position.x) * 0.12
    }
  }
}
