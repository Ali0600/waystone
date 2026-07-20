import * as THREE from 'three'
import type { Input, InputSnapshot } from '../engine/input'
import type { Collider } from '../world/collision'

const SENSITIVITY = 0.0024
const KEY_TURN_SPEED = 2.2
const DISTANCE = 7.5
const HEAD_OFFSET = 1.7

const tmpTarget = new THREE.Vector3()
const tmpDesired = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
const tmpRay = new THREE.Ray()

/**
 * Third-person orbit camera. Pointer lock drives it normally; in QA mode
 * (?qa=1) or before lock, arrow keys turn it so automation can steer.
 */
export class OrbitFollowCamera {
  // Camera sits +Z of the target at yaw 0, i.e. the view faces -Z (the
  // island interior from the south-rim spawn).
  yaw = 0
  pitch = 0.35

  constructor(
    public camera: THREE.PerspectiveCamera,
    private input: Input,
  ) {}

  update(dt: number, snap: InputSnapshot, playerPos: THREE.Vector3, collider: Collider): void {
    this.yaw -= snap.lookDX * SENSITIVITY
    this.pitch += snap.lookDY * SENSITIVITY
    if (this.input.isHeld('ArrowLeft')) this.yaw += KEY_TURN_SPEED * dt
    if (this.input.isHeld('ArrowRight')) this.yaw -= KEY_TURN_SPEED * dt
    if (this.input.isHeld('ArrowUp')) this.pitch -= KEY_TURN_SPEED * 0.5 * dt
    if (this.input.isHeld('ArrowDown')) this.pitch += KEY_TURN_SPEED * 0.5 * dt
    this.pitch = Math.min(1.25, Math.max(-0.9, this.pitch))

    tmpTarget.copy(playerPos)
    tmpTarget.y += HEAD_OFFSET

    tmpDir.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    )
    tmpDesired.copy(tmpTarget).addScaledVector(tmpDir, DISTANCE)

    // Pull in when world geometry blocks the view line.
    tmpRay.origin.copy(tmpTarget)
    tmpRay.direction.copy(tmpDir)
    const hit = collider.bvh.raycastFirst(tmpRay, THREE.DoubleSide)
    if (hit && hit.distance < DISTANCE) {
      tmpDesired.copy(tmpTarget).addScaledVector(tmpDir, Math.max(0.8, hit.distance - 0.4))
    }

    const blend = 1 - Math.exp(-14 * dt)
    this.camera.position.lerp(tmpDesired, blend)
    this.camera.lookAt(tmpTarget)
  }
}
