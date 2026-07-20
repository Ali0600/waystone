import * as THREE from 'three'
import type { EnemyDef } from '../content/enemies'
import type { EventBus } from '../core/events'
import { makeToonMaterial } from '../engine/toon'
import { buildEnemyMesh } from './worldenemies'
import type { Encounter } from './encounter'

/**
 * The duel arena: its own tiny scene — a stone ring hanging in the dusk.
 * Purely presentational; every gameplay fact comes from the Encounter.
 */
export class Arena {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private playerMesh: THREE.Group
  private enemyMesh: THREE.Group
  private t = 0
  private playerLunge = 0
  private enemyLunge = 0
  private unsubs: (() => void)[] = []

  constructor(enemy: EnemyDef, bus: EventBus, aspect: number) {
    this.scene.background = new THREE.Color('#221c38')
    this.scene.fog = new THREE.Fog('#221c38', 18, 42)
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 100)
    // Narrow viewports need distance to keep both duelists in frame.
    const back = aspect < 1.25 ? 13.5 : 9.5
    this.camera.position.set(0, 3.6, back)
    this.camera.lookAt(0, 1.1, 0)

    this.scene.add(new THREE.HemisphereLight('#8a7fc0', '#3b2f2a', 1.6))
    const key = new THREE.DirectionalLight('#ffd9a0', 2.6)
    key.position.set(4, 8, 6)
    this.scene.add(key)

    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 8.5, 1.2, 12),
      makeToonMaterial('#5d5474'),
    )
    ring.position.y = -0.6
    this.scene.add(ring)
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.14, 6, 24),
      new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.5 }),
    )
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.02
    this.scene.add(rim)

    // The Surveyor (simplified duplicate of the avatar look).
    this.playerMesh = new THREE.Group()
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 8), makeToonMaterial('#3e3a5c'))
    cloak.position.y = 0.72
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), makeToonMaterial('#4a4570'))
    hood.position.y = 1.38
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 5),
      new THREE.MeshBasicMaterial({ color: '#ffcf7d' }),
    )
    lantern.position.set(0.42, 0.95, 0.18)
    const glow = new THREE.PointLight('#ffb347', 10, 12, 1.8)
    glow.position.copy(lantern.position)
    this.playerMesh.add(cloak, hood, lantern, glow)
    this.playerMesh.position.set(-3.2, 0, 0)
    this.playerMesh.rotation.y = Math.PI / 2
    this.scene.add(this.playerMesh)

    this.enemyMesh = buildEnemyMesh(enemy)
    this.enemyMesh.position.set(3.2, 0, 0)
    this.enemyMesh.rotation.y = -Math.PI / 2
    this.enemyMesh.scale.setScalar(1.35)
    this.scene.add(this.enemyMesh)

    this.unsubs.push(
      bus.on('combat:beat', ({ result }) => {
        if (result === 'hit') this.playerLunge = 1
      }),
      bus.on('combat:damage', ({ target }) => {
        if (target === 'enemy') this.enemyFlash()
      }),
      bus.on('combat:parry', ({ result }) => {
        if (result !== 'hit') this.playerLunge = 0.6
        else this.enemyLunge = 1
      }),
      bus.on('combat:telegraph', () => {
        this.enemyLunge = 0.5
      }),
    )
  }

  private enemyFlash(): void {
    this.enemyMesh.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && (mesh.material as THREE.MeshToonMaterial).emissive) {
        const m = mesh.material as THREE.MeshToonMaterial
        m.emissive.set('#ffffff')
        m.emissiveIntensity = 0.7
        setTimeout(() => {
          m.emissiveIntensity = 0
        }, 110)
      }
    })
  }

  update(dt: number, encounter: Encounter): void {
    this.t += dt
    this.playerLunge = Math.max(0, this.playerLunge - dt * 3.5)
    this.enemyLunge = Math.max(0, this.enemyLunge - dt * 3)
    this.playerMesh.position.x = -3.2 + this.playerLunge * 1.6
    this.playerMesh.position.y = Math.sin(this.t * 2.2) * 0.06
    this.enemyMesh.position.x = 3.2 - this.enemyLunge * 1.4
    this.enemyMesh.position.y = Math.sin(this.t * 1.7 + 1) * 0.08
    if (encounter.phase === 'victory') {
      this.enemyMesh.scale.multiplyScalar(Math.max(0.0, 1 - dt * 1.8))
      this.enemyMesh.rotation.y += dt * 4
    }
    if (encounter.phase === 'defeat') {
      this.playerMesh.rotation.z = Math.min(1.2, this.playerMesh.rotation.z + dt * 2)
    }
  }

  dispose(): void {
    for (const u of this.unsubs) u()
  }
}
