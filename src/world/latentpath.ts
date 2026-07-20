import * as THREE from 'three'
import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import { makeToonMaterial } from '../engine/toon'

export interface LatentPathDef {
  id: string
  /** Plank walkway between two points (y above mist, absolute). */
  from: [number, number, number]
  to: [number, number, number]
  /** Optional islet disc at the far end. */
  islet?: { x: number; z: number; y: number; r: number }
  /** Discoverable ids that become 'revealed' when this path solidifies. */
  reveals: string[]
  /** Permanent walkways (hub bridge): solid from construction, no lantern. */
  startSolid?: boolean
}

interface BuiltPath {
  def: LatentPathDef
  group: THREE.Group
  solidified: boolean
}

/**
 * Latent paths — Lantern T2's payoff. Ghost walkways that solidify when
 * pulsed, gaining collision (the region collider is rebuilt by the caller).
 */
export class LatentPaths {
  readonly group = new THREE.Group()
  private paths: BuiltPath[] = []

  constructor(
    defs: LatentPathDef[],
    private state: GameState,
    private bus: EventBus,
    /** Ground query: island height at the point, or null when over open
     *  mist. Endpoints over an island snap to their terrain so the first
     *  plank is always a step, never a wall (0 is a VALID island height —
     *  a threshold cannot distinguish rim from mist; null can). */
    private groundAt: (x: number, z: number) => number | null = () => null,
  ) {
    this.group.name = 'latent-paths'
    this.addDefs(defs)
  }

  /** Newly manifested regions add their walkways at runtime. */
  addDefs(defs: LatentPathDef[]): void {
    for (const def of defs) {
      const g = this.build(def)
      const solidified =
        def.startSolid === true || this.state.pathsRevealed.includes(def.id)
      this.paths.push({ def, group: g, solidified })
      if (solidified) this.applySolid(g)
      this.group.add(g)
    }
  }

  private build(def: LatentPathDef): THREE.Group {
    const g = new THREE.Group()
    g.name = `path:${def.id}`
    const from = new THREE.Vector3(...def.from)
    const to = new THREE.Vector3(...def.to)
    for (const end of [from, to]) {
      const ground = this.groundAt(end.x, end.z)
      if (ground !== null) end.y = ground + 0.18
    }
    const span = to.clone().sub(from)
    const length = span.length()
    const planks = Math.max(3, Math.round(length / 2.2))
    const yaw = Math.atan2(span.x, span.z)
    // Arc height along the walkway; planks tilt to follow its local slope so
    // the ends meet their terrain as ramps, never step-walls.
    const arcAt = (t: number) =>
      new THREE.Vector3().lerpVectors(from, to, t).setY(
        from.y + (to.y - from.y) * t + Math.sin(t * Math.PI) * 0.6,
      )
    const horizontal = Math.hypot(span.x, span.z)
    for (let i = 0; i < planks; i++) {
      const t = (i + 0.5) / planks
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.22, length / planks - 0.15),
        makeToonMaterial('#bfe8ff', { transparent: true, opacity: 0.15 }),
      )
      const ahead = arcAt(Math.min(1, t + 0.5 / planks))
      const behind = arcAt(Math.max(0, t - 0.5 / planks))
      plank.position.copy(arcAt(t))
      plank.rotation.order = 'YXZ'
      plank.rotation.y = yaw
      plank.rotation.x = -Math.atan2(ahead.y - behind.y, horizontal / planks)
      g.add(plank)
    }
    if (def.islet) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(def.islet.r, def.islet.r * 0.55, 2.2, 9),
        makeToonMaterial('#bfe8ff', { transparent: true, opacity: 0.15 }),
      )
      disc.position.set(def.islet.x, def.islet.y - 1.1, def.islet.z)
      g.add(disc)
    }
    return g
  }

  private applySolid(g: THREE.Group): void {
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh
        ;(mesh.material as THREE.Material).dispose()
        mesh.material = makeToonMaterial('#9a8f78')
      }
    })
  }

  /** Whether a given path is currently solid (walkable). */
  isSolid(id: string): boolean {
    return this.paths.some((p) => p.def.id === id && p.solidified)
  }

  /** Solid path groups — included in collider rebuilds. */
  solidGroups(): THREE.Group[] {
    return this.paths.filter((p) => p.solidified).map((p) => p.group)
  }

  /**
   * A lantern pulse at tier >= 2 solidifies nearby paths. Returns the ids
   * revealed (caller rebuilds the collider + marks linked discoverables).
   */
  pulse(px: number, pz: number, radius: number): string[] {
    const revealed: string[] = []
    for (const path of this.paths) {
      if (path.solidified) continue
      const nearFrom = Math.hypot(px - path.def.from[0], pz - path.def.from[2]) < radius
      const nearTo = Math.hypot(px - path.def.to[0], pz - path.def.to[2]) < radius
      if (!nearFrom && !nearTo) continue
      path.solidified = true
      this.applySolid(path.group)
      this.state.pathsRevealed.push(path.def.id)
      for (const id of path.def.reveals) {
        if (this.state.discoveries[id] !== 'found') {
          this.state.discoveries[id] = 'revealed'
        }
      }
      this.bus.emit('path:revealed', { id: path.def.id })
      this.bus.emit('toast', {
        text: 'The song remembers — a path takes shape',
        flavor: 'reward',
      })
      revealed.push(path.def.id)
    }
    return revealed
  }
}
