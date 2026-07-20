import * as THREE from 'three'
import { RECRUITS, type RecruitDef } from '../content/recruits'
import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import { buildFigure, buildStructure } from './buildings'

/**
 * Recruit runtime: world figures stand where their `person` discoverable is;
 * when found, the figure leaves and their structure + hub figure appear at
 * the Waystation. All derived from discovery state — nothing extra saved.
 */
export class RecruitSystem {
  /** Added to the scene; contains world figures + hub structures. */
  readonly group = new THREE.Group()
  private worldFigures = new Map<string, THREE.Group>()
  private homes = new Map<string, THREE.Group>()
  private t = 0

  constructor(
    private state: GameState,
    bus: EventBus,
    private heightAt: (x: number, z: number) => number,
    personPositions: Map<string, { x: number; z: number }>,
  ) {
    for (const def of RECRUITS) {
      // World figure at the person discoverable's spot.
      const at = personPositions.get(def.personId)
      if (at) {
        const fig = buildFigure(def.color)
        fig.position.set(at.x, heightAt(at.x, at.z), at.z)
        this.worldFigures.set(def.personId, fig)
        this.group.add(fig)
      }
      // Hub structure + figure.
      const home = new THREE.Group()
      home.add(buildStructure(def.role, def.color))
      const homeFig = buildFigure(def.color)
      homeFig.position.set(1.4, 0, 1.6)
      homeFig.name = 'figure'
      home.add(homeFig)
      home.position.set(def.home.x, heightAt(def.home.x, def.home.z), def.home.z)
      home.rotation.y = def.home.yaw
      this.homes.set(def.personId, home)
      this.group.add(home)
    }
    this.sync()
    bus.on('discovery:found', ({ id }) => {
      const def = RECRUITS.find((r) => r.personId === id)
      if (def) {
        this.sync()
        bus.emit('toast', { text: def.foundLine, flavor: 'info' })
        bus.emit('toast', { text: 'The Waystation grows…', flavor: 'reward' })
      }
    })
  }

  /** A region just manifested: stand up world figures for any recruits who
   *  live on it (their hub structure already exists from construction). */
  addWorldFigures(persons: { id: string; x: number; z: number }[]): void {
    for (const p of persons) {
      const def = RECRUITS.find((r) => r.personId === p.id)
      if (!def || this.worldFigures.has(p.id)) continue
      const fig = buildFigure(def.color)
      fig.position.set(p.x, this.heightAt(p.x, p.z), p.z)
      this.worldFigures.set(p.id, fig)
      this.group.add(fig)
    }
    this.sync()
  }

  private isHome(id: string): boolean {
    return this.state.discoveries[id] === 'found'
  }

  /** Show/hide world figures + hub structures from discovery state. */
  sync(): void {
    for (const [id, fig] of this.worldFigures) fig.visible = !this.isHome(id)
    for (const [id, home] of this.homes) home.visible = this.isHome(id)
  }

  /** How many recruits are home (drives ambient hub life + tests). */
  homeCount(): number {
    return RECRUITS.filter((r) => this.isHome(r.personId)).length
  }

  /** The recruit def whose hub figure is near the player, for flavour lines. */
  nearbyHome(px: number, pz: number): RecruitDef | null {
    for (const def of RECRUITS) {
      if (!this.isHome(def.personId)) continue
      if (Math.hypot(px - def.home.x, pz - def.home.z) < 3.4) return def
    }
    return null
  }

  update(dt: number): void {
    this.t += dt
    for (const fig of this.worldFigures.values()) {
      if (!fig.visible) continue
      fig.position.y += Math.sin(this.t * 2.1 + fig.position.x) * 0.0015
      fig.rotation.y += dt * 0.15
    }
    for (const home of this.homes.values()) {
      if (!home.visible) continue
      const fig = home.getObjectByName('figure')
      if (fig) fig.rotation.y = Math.sin(this.t * 0.4 + home.position.x) * 0.8
      const steam = home.getObjectByName('steam')
      if (steam) {
        steam.position.y = 1.7 + Math.sin(this.t * 1.8) * 0.15
        steam.scale.setScalar(1 + Math.sin(this.t * 2.3) * 0.15)
      }
    }
  }
}
