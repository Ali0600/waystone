import * as THREE from 'three'
import type { InputSnapshot } from '../engine/input'
import { resolveCapsule, type Collider } from '../world/collision'

export interface PlayerParams {
  radius: number
  /** Total capsule height, foot tip to head tip. Must be >= 2 * radius. */
  height: number
  walkSpeed: number
  airControl: number
  gravity: number
  jumpSpeed: number
  /** Falling below this world Y respawns the player (the mist sea). */
  fallY: number
}

export const DEFAULT_PLAYER_PARAMS: PlayerParams = {
  radius: 0.45,
  height: 1.6,
  walkSpeed: 7,
  airControl: 0.35,
  gravity: 26,
  jumpSpeed: 9.5,
  fallY: -14,
}

const tmpSegment = new THREE.Line3()
const tmpDelta = new THREE.Vector3()
const tmpWish = new THREE.Vector3()

/**
 * Headless player simulation: position is the capsule's foot tip.
 * Rendering (avatar, camera) reads from this; tests drive it directly.
 */
export class PlayerSim {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  onGround = false
  /** Yaw the avatar should face (radians), driven by movement. Starts
   *  facing -Z (away from the boot camera). */
  facing = Math.PI
  private readonly spawn = new THREE.Vector3()

  constructor(
    public params: PlayerParams = { ...DEFAULT_PLAYER_PARAMS },
  ) {}

  setSpawn(p: THREE.Vector3): void {
    this.spawn.copy(p)
  }

  respawn(): void {
    this.position.copy(this.spawn)
    this.velocity.set(0, 0, 0)
    this.onGround = false
  }

  /**
   * One fixed step. `cameraYaw` maps input axes into world space
   * (W = away from camera).
   */
  step(dt: number, input: InputSnapshot, cameraYaw: number, collider: Collider): void {
    const p = this.params

    // Wish direction in world space.
    tmpWish.set(input.moveX, 0, input.moveZ)
    if (tmpWish.lengthSq() > 1) tmpWish.normalize()
    tmpWish.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw)

    const control = this.onGround ? 1 : p.airControl
    const targetVx = tmpWish.x * p.walkSpeed
    const targetVz = tmpWish.z * p.walkSpeed
    const blend = 1 - Math.exp(-12 * control * dt)
    this.velocity.x += (targetVx - this.velocity.x) * blend
    this.velocity.z += (targetVz - this.velocity.z) * blend

    if (tmpWish.lengthSq() > 0.001) {
      this.facing = Math.atan2(tmpWish.x, tmpWish.z)
    }

    if (input.jump && this.onGround) {
      this.velocity.y = p.jumpSpeed
      this.onGround = false
    }
    this.velocity.y -= p.gravity * dt

    this.position.addScaledVector(this.velocity, dt)

    // Collision: two resolve passes per step for stability on slopes.
    const preY = this.position.y
    for (let i = 0; i < 2; i++) {
      tmpSegment.start.set(this.position.x, this.position.y + p.radius, this.position.z)
      tmpSegment.end.set(this.position.x, this.position.y + p.height - p.radius, this.position.z)
      const pushed = resolveCapsule(collider, tmpSegment, p.radius)
      if (!pushed) break
      this.position.set(
        tmpSegment.start.x,
        tmpSegment.start.y - p.radius,
        tmpSegment.start.z,
      )
    }
    tmpDelta.set(0, this.position.y - preY, 0)

    // Grounded when collision pushed us up while we were moving down.
    this.onGround = this.velocity.y <= 0 && tmpDelta.y > Math.max(1e-4, -this.velocity.y * dt * 0.25)
    if (this.onGround) {
      this.velocity.y = 0
    }

    if (this.position.y < p.fallY) {
      this.respawn()
    }
  }
}
