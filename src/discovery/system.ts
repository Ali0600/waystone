import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import {
  INTERACT_RADIUS,
  PIN_RADIUS,
  REVEAL_RADIUS,
  type DiscoverableDef,
  type DiscoveryPrereq,
} from './types'

/** Capabilities the player currently has — grows across milestones. */
export interface PlayerCapabilities {
  lantern: boolean
  grapple: boolean
  sounding: boolean
}

function prereqMet(
  prereq: DiscoveryPrereq,
  caps: PlayerCapabilities,
  status: string | undefined,
): boolean {
  switch (prereq) {
    case 'none':
      return true
    case 'lantern':
      return status === 'revealed' // pulse must have made it solid
    case 'grapple':
      return caps.grapple
    case 'sounding':
      return caps.sounding
    case 'combat':
      return false // until M6 wires encounters, guardians are unbeaten
  }
}

/**
 * Headless discovery logic: proximity pins, lantern reveals, interaction.
 * The view layer renders from events + state; tests drive this directly.
 */
export class DiscoverySystem {
  constructor(
    private defs: DiscoverableDef[],
    private state: GameState,
    private bus: EventBus,
    private caps: PlayerCapabilities,
    /** Region terrain lookup for world-space positions. */
    private heightAt: (x: number, z: number) => number,
  ) {}

  worldY(def: DiscoverableDef): number {
    return this.heightAt(def.x, def.z) + (def.dy ?? 0)
  }

  status(id: string): string | undefined {
    return this.state.discoveries[id]
  }

  /** Nearest not-yet-found discoverable the player could interact with now. */
  interactable(px: number, pz: number): DiscoverableDef | null {
    let best: DiscoverableDef | null = null
    let bestD = INTERACT_RADIUS
    for (const def of this.defs) {
      const status = this.state.discoveries[def.id]
      if (status === 'found') continue
      if (!prereqMet(def.prereq, this.caps, status)) continue
      const d = Math.hypot(px - def.x, pz - def.z)
      if (d < bestD) {
        best = def
        bestD = d
      }
    }
    return best
  }

  /** Proximity pass: auto-pin anything seen-but-locked. Call per sim step. */
  update(px: number, pz: number): void {
    for (const def of this.defs) {
      const status = this.state.discoveries[def.id]
      if (status !== undefined) continue // already pinned/revealed/found
      if (prereqMet(def.prereq, this.caps, status)) continue // collectable, no pin needed
      const d = Math.hypot(px - def.x, pz - def.z)
      if (d < PIN_RADIUS) {
        this.state.discoveries[def.id] = 'pinned'
        this.bus.emit('discovery:pinned', { id: def.id })
        this.bus.emit('toast', { text: `? marked on your map — ${def.cue}`, flavor: 'info' })
      }
    }
  }

  /** Lantern pulse: reveal latent discoverables near the player. */
  lanternPulse(px: number, pz: number): number {
    let revealed = 0
    for (const def of this.defs) {
      if (def.prereq !== 'lantern') continue
      const status = this.state.discoveries[def.id]
      if (status === 'revealed' || status === 'found') continue
      const d = Math.hypot(px - def.x, pz - def.z)
      if (d < REVEAL_RADIUS) {
        this.state.discoveries[def.id] = 'revealed'
        this.bus.emit('discovery:revealed', { id: def.id })
        this.bus.emit('toast', { text: `The lantern reveals: ${def.label}`, flavor: 'reward' })
        revealed++
      }
    }
    return revealed
  }

  /** Attempt to collect the nearest eligible discoverable. */
  interact(px: number, pz: number): boolean {
    const def = this.interactable(px, pz)
    if (!def) return false
    this.state.discoveries[def.id] = 'found'
    for (const p of def.payouts) {
      if (p.meter === 'lumen') {
        this.state.lumen += p.amount
        this.bus.emit('lumen:changed', { total: this.state.lumen, delta: p.amount })
      } else if (p.meter === 'glyphstone') {
        this.state.glyphStones += p.amount
        this.bus.emit('glyphstone:changed', {
          total: this.state.glyphStones,
          delta: p.amount,
        })
      }
    }
    this.bus.emit('discovery:found', { id: def.id })
    this.bus.emit('toast', { text: def.label, flavor: 'reward' })
    return true
  }

  /** Completion: found / total, for the map + (later) the Archivist. */
  completion(): { found: number; total: number } {
    let found = 0
    for (const def of this.defs) {
      if (this.state.discoveries[def.id] === 'found') found++
    }
    return { found, total: this.defs.length }
  }
}
