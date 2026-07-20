import * as THREE from 'three'
import type { EventBus } from '../core/events'
import { makeToonMaterial } from '../engine/toon'
import type { DiscoverableDef } from './types'
import type { DiscoverySystem } from './system'

interface Entry {
  def: DiscoverableDef
  root: THREE.Group
  glint: THREE.Mesh | null
  solid: THREE.Group
  phase: number
}

/** Renders discoverables + their cues; reacts to system events. */
export class DiscoveryView {
  readonly group = new THREE.Group()
  private entries = new Map<string, Entry>()
  private t = 0

  constructor(
    defs: DiscoverableDef[],
    private system: DiscoverySystem,
    bus: EventBus,
  ) {
    this.group.name = 'discoverables'
    for (const def of defs) {
      const entry = this.build(def)
      this.entries.set(def.id, entry)
      this.group.add(entry.root)
      this.sync(def.id)
    }
    bus.on('discovery:found', ({ id }) => this.sync(id))
    bus.on('discovery:revealed', ({ id }) => this.sync(id))
  }

  /** Newly manifested regions add their discoverables at runtime. */
  addDefs(defs: DiscoverableDef[]): void {
    for (const def of defs) {
      const entry = this.build(def)
      this.entries.set(def.id, entry)
      this.group.add(entry.root)
      this.sync(def.id)
    }
  }

  private build(def: DiscoverableDef): Entry {
    const root = new THREE.Group()
    root.position.set(def.x, this.system.worldY(def), def.z)
    const solid = new THREE.Group()
    root.add(solid)
    let glint: THREE.Mesh | null = null

    switch (def.kind) {
      case 'cache':
      case 'guarded':
      case 'perch': {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.6, 0.65),
          makeToonMaterial(def.kind === 'guarded' ? '#7d4b3f' : '#8a6a3f'),
        )
        box.position.y = 0.3
        const lid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.33, 0.33, 0.9, 8, 1, false, 0, Math.PI),
          makeToonMaterial('#a5824e'),
        )
        lid.rotation.z = Math.PI / 2
        lid.position.y = 0.6
        solid.add(box, lid)
        break
      }
      case 'glyphstone': {
        const rune = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.45, 0),
          makeToonMaterial('#9fd8d0', { emissive: '#2e6b64', emissiveIntensity: 0.8 }),
        )
        rune.position.y = 1.0
        rune.name = 'rune'
        solid.add(rune)
        break
      }
      case 'latent': {
        // Same chest, but ghostly until revealed.
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.6, 0.65),
          makeToonMaterial('#bfe8ff', { transparent: true, opacity: 0.16 }),
        )
        box.position.y = 0.3
        solid.add(box)
        break
      }
      case 'buried': {
        // Cracked-earth patch: the visible cue for the Sounding dig (M8).
        const patch = new THREE.Mesh(
          new THREE.CircleGeometry(0.9, 7),
          makeToonMaterial('#4d4034'),
        )
        patch.rotation.x = -Math.PI / 2
        patch.position.y = 0.04
        solid.add(patch)
        break
      }
      case 'person':
        // The figure itself is rendered by RecruitSystem; only the glint here.
        break
      case 'waystone': {
        const monolith = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.5, 2.2, 6),
          makeToonMaterial('#8ad8c8', { emissive: '#1e5a50', emissiveIntensity: 0.9 }),
        )
        monolith.position.y = 1.1
        monolith.name = 'rune'
        solid.add(monolith)
        break
      }
    }

    // The glint: a small bobbing spark — the universal "something is here"
    // cue (no unhinted secrets). Latent/buried keep a fainter shimmer.
    const faint = def.kind === 'latent' || def.kind === 'buried'
    glint = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshBasicMaterial({
        color: faint ? '#9fd8ff' : '#ffd98a',
        transparent: true,
        opacity: faint ? 0.5 : 0.9,
      }),
    )
    glint.position.y = def.kind === 'perch' ? 1.6 : 1.3
    root.add(glint)

    return { def, root, glint, solid, phase: Math.random() * Math.PI * 2 }
  }

  private sync(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    const status = this.system.status(id)
    if (status === 'found') {
      entry.root.visible = false
      return
    }
    if (entry.def.kind === 'latent' && status === 'revealed') {
      // Solidify: swap ghost material for the real chest look.
      entry.solid.children.forEach((c) => {
        const mesh = c as THREE.Mesh
        ;(mesh.material as THREE.Material).dispose()
        mesh.material = makeToonMaterial('#8a6a3f')
      })
      if (entry.glint) {
        ;(entry.glint.material as THREE.MeshBasicMaterial).color.set('#ffd98a')
        ;(entry.glint.material as THREE.MeshBasicMaterial).opacity = 0.9
      }
    }
  }

  update(dt: number): void {
    this.t += dt
    for (const entry of this.entries.values()) {
      if (!entry.root.visible) continue
      if (entry.glint) {
        entry.glint.position.y += Math.sin(this.t * 2.4 + entry.phase) * 0.0035
        entry.glint.rotation.y += dt * 1.8
        const m = entry.glint.material as THREE.MeshBasicMaterial
        m.opacity = Math.max(0.25, m.opacity + Math.sin(this.t * 3.1 + entry.phase) * 0.008)
      }
      const rune = entry.solid.getObjectByName('rune')
      if (rune) {
        rune.rotation.y += dt * 0.9
        rune.position.y = 1.0 + Math.sin(this.t * 1.6 + entry.phase) * 0.08
      }
    }
  }
}
