import { GameAudio, pitchForDistance } from '../engine/audio'
import type { DiscoverySystem } from '../discovery/system'
import type { PlayerSim } from '../player/controller'

export const SOUNDING_RANGE = 30
const PING_COOLDOWN = 0.45

/** A ping's outcome — `miss` (fired, nothing in range) is distinct from
 *  `cooldown` (no ping happened) so a one-shot "nothing here" hint fires only on
 *  a real empty ping, never on rapid re-presses. */
export type PingResult = { kind: 'cooldown' } | { kind: 'miss' } | { kind: 'hit'; dist: number }

/**
 * Sounding (Chocobo Hot & Cold): press T to ping. The nearest buried cache
 * answers — pitch rises and the screen warms as you close in; on top of it,
 * the ping RINGS and the dig prompt appears (digging is a normal interact —
 * the buried prereq passes once you carry the Sounding Rod).
 */
export class SoundingVerb {
  private cooldown = 0
  private warmth: HTMLElement
  private warmthLevel = 0

  constructor(
    private player: PlayerSim,
    private discovery: DiscoverySystem,
    private audio: GameAudio,
  ) {
    this.warmth = document.createElement('div')
    this.warmth.className = 'sounding-warmth'
    document.body.appendChild(this.warmth)
  }

  /** Ping the buried world. See PingResult — `miss` vs `cooldown` are distinct. */
  tryPing(): PingResult {
    if (this.cooldown > 0) return { kind: 'cooldown' }
    this.cooldown = PING_COOLDOWN
    const near = this.discovery.nearestBuried(
      this.player.position.x,
      this.player.position.z,
      SOUNDING_RANGE,
    )
    if (!near) {
      this.audio.tone(140, 0.12, 'triangle', 0.5) // dull thock: nothing here
      this.warmthLevel = 0
      return { kind: 'miss' }
    }
    const pitch = pitchForDistance(near.dist, SOUNDING_RANGE)
    if (near.dist < 3) {
      this.audio.chord([pitch, pitch * 1.25, pitch * 1.5], 0.5) // it RINGS
    } else {
      this.audio.tone(pitch, 0.16, 'sine', 0.8)
    }
    this.warmthLevel = 1 - near.dist / SOUNDING_RANGE
    return { kind: 'hit', dist: near.dist }
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt)
    // Warmth vignette decays between pings.
    this.warmthLevel = Math.max(0, this.warmthLevel - dt * 0.35)
    this.warmth.style.opacity = String(this.warmthLevel * 0.55)
  }
}
