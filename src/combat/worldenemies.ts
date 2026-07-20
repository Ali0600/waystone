import * as THREE from 'three'
import { ENEMIES, type EnemyDef, type EnemySpawnDef } from '../content/enemies'
import type { GameState } from '../core/state'
import { makeToonMaterial } from '../engine/toon'
import { mulberry32 } from '../core/rng'

export interface EnemyContact {
  def: EnemyDef
  spawnIndex: number
  guards?: string
}

interface WorldEnemy {
  spawn: EnemySpawnDef
  def: EnemyDef
  group: THREE.Group
  angle: number
  speed: number
  defeated: boolean
}

/** Builds an archetype silhouette — readable at a glance. */
export function buildEnemyMesh(def: EnemyDef): THREE.Group {
  const g = new THREE.Group()
  const mat = makeToonMaterial(def.color)
  switch (def.archetype) {
    case 'husk': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.7), mat)
      body.position.y = 0.55
      body.rotation.x = 0.35 // hunched
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), mat)
      head.position.set(0, 1.05, 0.35)
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), mat)
      armL.position.set(-0.62, 0.5, 0.15)
      const armR = armL.clone()
      armR.position.x = 0.62
      g.add(body, head, armL, armR)
      break
    }
    case 'warden': {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.1, 6), mat)
      body.position.y = 1.05
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 5, 14), mat)
      halo.position.y = 2.35
      halo.rotation.x = Math.PI / 2
      halo.name = 'halo'
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 5),
        new THREE.MeshBasicMaterial({ color: '#e8f4ff' }),
      )
      eye.position.set(0, 1.7, 0.3)
      g.add(body, halo, eye)
      break
    }
    case 'chorister': {
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.85, 1.6, 8), mat)
      bell.position.y = 0.8
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 5), mat)
      hood.position.y = 1.75
      const mouth = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 5),
        new THREE.MeshBasicMaterial({ color: '#2c2638' }),
      )
      mouth.position.set(0, 1.7, 0.28)
      g.add(bell, hood, mouth)
      break
    }
  }
  return g
}

/**
 * Wandering world enemies. Contact with the player begins an encounter;
 * a defeated enemy despawns for the session (guardians stay recorded in
 * the save so their charge remains unlocked forever).
 */
export class WorldEnemies {
  readonly group = new THREE.Group()
  private enemies: WorldEnemy[] = []
  private t = 0

  private rng = mulberry32(31337)

  constructor(
    spawns: EnemySpawnDef[],
    private state: GameState,
    private heightAt: (x: number, z: number) => number,
  ) {
    this.addSpawns(spawns)
  }

  /** Newly manifested regions add their enemies at runtime. */
  addSpawns(spawns: EnemySpawnDef[]): void {
    for (const spawn of spawns) {
      const def = ENEMIES[spawn.enemyId]
      const group = buildEnemyMesh(def)
      group.position.set(spawn.x, this.heightAt(spawn.x, spawn.z), spawn.z)
      this.group.add(group)
      const defeated =
        spawn.guards !== undefined &&
        this.state.guardiansDefeated.includes(spawn.guards)
      group.visible = !defeated
      this.enemies.push({
        spawn,
        def,
        group,
        angle: this.rng() * Math.PI * 2,
        speed: 0.55 + this.rng() * 0.4,
        defeated,
      })
    }
  }

  /** Mark an enemy defeated (despawn) after a victorious encounter. */
  markDefeated(spawnIndex: number): void {
    const e = this.enemies[spawnIndex]
    if (!e) return
    e.defeated = true
    e.group.visible = false
  }

  /** Returns a contact if the player touches a live enemy. */
  update(dt: number, px: number, pz: number): EnemyContact | null {
    this.t += dt
    let contact: EnemyContact | null = null
    for (const [i, e] of this.enemies.entries()) {
      if (e.defeated) continue
      // Slow patrol loop around the spawn point.
      e.angle += dt * 0.25 * e.speed
      const cx = e.spawn.x + Math.cos(e.angle) * e.spawn.patrolR
      const cz = e.spawn.z + Math.sin(e.angle) * e.spawn.patrolR
      e.group.position.set(cx, this.heightAt(cx, cz), cz)
      e.group.rotation.y = -e.angle
      const halo = e.group.getObjectByName('halo')
      if (halo) halo.rotation.z = this.t * 1.2
      e.group.position.y += Math.sin(this.t * 1.8 + i) * 0.05

      if (contact === null && Math.hypot(px - cx, pz - cz) < 1.7) {
        contact = { def: e.def, spawnIndex: i, guards: e.spawn.guards }
      }
    }
    return contact
  }
}
