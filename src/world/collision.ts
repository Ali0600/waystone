import * as THREE from 'three'
import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'

/**
 * Static world collision. Constraint: the collidable subtree is baked in
 * WORLD space and never moves afterwards — so capsule queries can work in
 * world coordinates directly, with no local-space transforms.
 */
export interface Collider {
  bvh: MeshBVH
}

export function buildCollider(root: THREE.Object3D): Collider {
  root.updateMatrixWorld(true)
  const generator = new StaticGeometryGenerator(root)
  generator.attributes = ['position']
  const merged = generator.generate()
  return { bvh: new MeshBVH(merged) }
}

const tmpBox = new THREE.Box3()
const tmpTriPoint = new THREE.Vector3()
const tmpCapsulePoint = new THREE.Vector3()
const tmpDir = new THREE.Vector3()

/**
 * Canonical three-mesh-bvh capsule resolve (characterMovement example):
 * push the capsule segment out of every intersecting triangle. Mutates
 * `segment`; returns true if anything pushed.
 */
export function resolveCapsule(
  collider: Collider,
  segment: THREE.Line3,
  radius: number,
): boolean {
  tmpBox.makeEmpty()
  tmpBox.expandByPoint(segment.start)
  tmpBox.expandByPoint(segment.end)
  tmpBox.min.addScalar(-radius)
  tmpBox.max.addScalar(radius)

  let pushed = false
  collider.bvh.shapecast({
    intersectsBounds: (box) => box.intersectsBox(tmpBox),
    intersectsTriangle: (tri) => {
      const distance = tri.closestPointToSegment(segment, tmpTriPoint, tmpCapsulePoint)
      if (distance < radius) {
        const depth = radius - distance
        tmpDir.subVectors(tmpCapsulePoint, tmpTriPoint).normalize()
        segment.start.addScaledVector(tmpDir, depth)
        segment.end.addScaledVector(tmpDir, depth)
        pushed = true
      }
    },
  })
  return pushed
}

const tmpRay = new THREE.Ray()
const down = new THREE.Vector3(0, -1, 0)

/** World-space downward raycast (blob shadow, ground probes). */
export function groundHeightBelow(
  collider: Collider,
  x: number,
  y: number,
  z: number,
): number | null {
  tmpRay.origin.set(x, y, z)
  tmpRay.direction.copy(down)
  const hit = collider.bvh.raycastFirst(tmpRay, THREE.DoubleSide)
  return hit ? y - hit.distance : null
}
