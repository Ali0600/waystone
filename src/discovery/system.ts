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
  guardianDown: boolean,
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
      return guardianDown
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

  /** Newly manifested regions add their content at runtime. */
  addDefs(defs: DiscoverableDef[]): void {
    this.defs.push(...defs)
  }

  worldY(def: DiscoverableDef): number {
    return this.heightAt(def.x, def.z) + (def.dy ?? 0)
  }

  status(id: string): string | undefined {
    return this.state.discoveries[id]
  }

  /** Nearest not-yet-found discoverable the player could interact with now.
   *  py guards elevation: a chest on a ledge overhead is NOT in reach. */
  interactable(px: number, pz: number, py?: number): DiscoverableDef | null {
    let best: DiscoverableDef | null = null
    let bestD = INTERACT_RADIUS
    for (const def of this.defs) {
      const status = this.state.discoveries[def.id]
      if (status === 'found') continue
      if (!prereqMet(def.prereq, this.caps, status, this.state.guardiansDefeated.includes(def.id))) continue
      if (py !== undefined && Math.abs(py - this.worldY(def)) > 3) continue
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
      if (prereqMet(def.prereq, this.caps, status, this.state.guardiansDefeated.includes(def.id))) continue // collectable, no pin needed
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

  /** Nearest unfound buried cache within range (the Sounding target). */
  nearestBuried(
    px: number,
    pz: number,
    range: number,
  ): { def: DiscoverableDef; dist: number } | null {
    let best: { def: DiscoverableDef; dist: number } | null = null
    for (const def of this.defs) {
      if (def.kind !== 'buried') continue
      if (this.state.discoveries[def.id] === 'found') continue
      const dist = Math.hypot(px - def.x, pz - def.z)
      if (dist <= range && (best === null || dist < best.dist)) {
        best = { def, dist }
      }
    }
    return best
  }

  /** Lantern T3: buried caches call out — pin every one in a wide sweep. */
  buriedSweep(px: number, pz: number, radius: number): number {
    let pinned = 0
    for (const def of this.defs) {
      if (def.kind !== 'buried') continue
      if (this.state.discoveries[def.id] !== undefined) continue
      if (Math.hypot(px - def.x, pz - def.z) < radius) {
        this.state.discoveries[def.id] = 'pinned'
        this.bus.emit('discovery:pinned', { id: def.id })
        pinned++
      }
    }
    if (pinned > 0) {
      this.bus.emit('toast', {
        text: `Something buried answers the light (${pinned} marked)`,
        flavor: 'reward',
      })
    }
    return pinned
  }

  /** Attempt to collect the nearest eligible discoverable. */
  interact(px: number, pz: number, py?: number): boolean {
    const def = this.interactable(px, pz, py)
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
      } else if (p.meter === 'waystone') {
        this.state.waystones += p.amount
        this.bus.emit('toast', {
          text: 'A Waystone — heavy with an unfinished note. The socket waits.',
          flavor: 'reward',
        })
      } else if (p.meter === 'tool-sounding') {
        this.state.tools.sounding = true
        this.caps.sounding = true
        this.bus.emit('tool:acquired', { tool: 'sounding' })
        this.bus.emit('toast', {
          text: 'The Sounding Rod — press T; the buried world answers in pitch',
          flavor: 'reward',
        })
      } else if (p.meter === 'tool-grapple') {
        this.state.tools.grapple = true
        this.caps.grapple = true
        this.bus.emit('tool:acquired', { tool: 'grapple' })
        this.bus.emit('toast', {
          text: 'The Surveyor’s Grapple — aim at a crystal pylon and press Q',
          flavor: 'reward',
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
