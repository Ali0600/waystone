import * as THREE from 'three'
import { makeToonMaterial } from '../engine/toon'
import type { PlayerSim } from './controller'

/**
 * The Surveyor: a hooded, hovering silhouette with a lantern. Procedural —
 * no rig, just bob/lean/turn, which reads as "cloaked wanderer" for free.
 */
export class Avatar {
  readonly group = new THREE.Group()
  readonly lanternLight: THREE.PointLight
  private readonly body: THREE.Group
  private t = 0

  constructor() {
    this.body = new THREE.Group()
    this.group.add(this.body)

    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.25, 8),
      makeToonMaterial('#3e3a5c'),
    )
    cloak.position.y = 0.72
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 6),
      makeToonMaterial('#4a4570'),
    )
    hood.position.y = 1.38
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 6, 5),
      makeToonMaterial('#1c1826'),
    )
    face.position.set(0, 1.36, 0.15)
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 5),
      new THREE.MeshBasicMaterial({ color: '#ffcf7d' }),
    )
    lantern.position.set(0.42, 0.95, 0.18)
    this.lanternLight = new THREE.PointLight('#ffb347', 14, 16, 1.8)
    this.lanternLight.position.copy(lantern.position)
    this.body.add(cloak, hood, face, lantern, this.lanternLight)

    // Blob shadow — grounded readability without shadow maps.
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28 }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.name = 'blob'
    this.group.add(blob)
  }

  update(dt: number, sim: PlayerSim, groundY: number | null): void {
    this.t += dt
    this.group.position.copy(sim.position)

    const speed = Math.hypot(sim.velocity.x, sim.velocity.z)
    const bobRate = sim.onGround ? 2.2 + speed * 0.9 : 1.2
    const bobAmp = sim.onGround ? 0.05 + Math.min(0.06, speed * 0.008) : 0.02
    this.body.position.y = 0.08 + Math.sin(this.t * bobRate) * bobAmp

    // Turn toward movement, lean into it slightly.
    let dyaw = sim.facing - this.body.rotation.y
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
    this.body.rotation.y += dyaw * Math.min(1, 10 * dt)
    this.body.rotation.x = Math.min(0.18, speed * 0.022)

    const blob = this.group.getObjectByName('blob')!
    if (groundY !== null) {
      blob.visible = true
      blob.position.y = groundY - sim.position.y + 0.03
      const drop = Math.min(6, Math.max(0, sim.position.y - groundY))
      blob.scale.setScalar(Math.max(0.35, 1 - drop * 0.12))
    } else {
      blob.visible = false
    }
  }
}
