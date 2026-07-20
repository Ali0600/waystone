import { MIST_Y } from '../world/mist'

/**
 * The Mistwalker (Tool 4): walk on the mist sea on a draining charge. Pure —
 * the charge is seconds of mist-walking left, draining while you stand on the
 * mist and refilling on solid ground. `active()` gates `PlayerSim.mistFloorY`;
 * when it hits zero the floor vanishes and the player sinks (and respawns at
 * the last solid shore). No DOM, no THREE — fully unit-testable.
 */

/** Seconds of mist-walking a full charge buys (~walkSpeed 7 → ~70 world units). */
export const MIST_CAPACITY = 10
/** Charge-seconds restored per real second while on solid ground. */
const REFILL_RATE = 2.5
/** At or below this Y the player is standing on the mist floor (draining). */
const ON_MIST_Y = MIST_Y + 0.2
/** Above this Y the player is on solid ground (refilling). */
const ON_SOLID_Y = MIST_Y + 1

export class MistCharge {
  charge = MIST_CAPACITY

  /** Advance one step given the player's current foot Y. */
  update(dt: number, playerY: number): void {
    if (playerY <= ON_MIST_Y) {
      this.charge = Math.max(0, this.charge - dt)
    } else if (playerY > ON_SOLID_Y) {
      this.charge = Math.min(MIST_CAPACITY, this.charge + dt * REFILL_RATE)
    }
    // The transitional band (jumping, mid-fall) neither drains nor refills.
  }

  /** True while there is any charge left — gates the mist floor. */
  active(): boolean {
    return this.charge > 0
  }

  /** 0..1 for the HUD meter. */
  fraction(): number {
    return this.charge / MIST_CAPACITY
  }
}
