import * as THREE from 'three'
import type { EnemyDef } from '../content/enemies'
import type { EventBus } from '../core/events'
import { makeToonMaterial } from '../engine/toon'
import { buildEnemyMesh } from './worldenemies'
import { inWindow } from './timing'
import type { Encounter } from './encounter'
import { buildHeroRig, HeroDriver, attachSword, type HeroRig } from '../player/rig'
import { ATTACK_FOR_KEY, DRAW_SWAP_U, type AttackId } from '../player/heroanim'

/** The sword attack a completed combo beat plays (fallback: a generic slash). */
function attackForKey(key: string | undefined): AttackId {
  return (key && ATTACK_FOR_KEY[key as keyof typeof ATTACK_FOR_KEY]) || 'slashR'
}

/**
 * The duel arena: its own tiny scene — a stone ring hanging in the dusk.
 * Purely presentational; every gameplay fact comes from the Encounter. The
 * player figure is a full HeroRig (M37) that draws its sword and swings a
 * different attack per combo key.
 */
export class Arena {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private rig: HeroRig
  private driver: HeroDriver
  private enemyMesh: THREE.Group
  private t = 0
  private playerLunge = 0
  private enemyLunge = 0
  private flashT = 0 // seconds of white damage-flash remaining
  private swordInHand = false
  private outroPlayed = false
  private unsubs: (() => void)[] = []

  constructor(
    enemy: EnemyDef,
    bus: EventBus,
    aspect: number,
    private encounter: Encounter,
  ) {
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

    // The Surveyor — a full articulated rig, sword sheathed on the back and
    // drawn during the intro (the arena is built AFTER the Encounter emitted
    // 'combat:phase intro', so the draw is triggered here, not by that event).
    this.rig = buildHeroRig({ lanternIntensity: 10 })
    this.rig.group.position.set(-3.2, 0, 0)
    this.rig.group.rotation.y = Math.PI / 2 // face the enemy (+Z → world +X toward foe)
    this.driver = new HeroDriver(this.rig)
    this.driver.playAction('draw')
    this.scene.add(this.rig.group)

    this.enemyMesh = buildEnemyMesh(enemy)
    this.enemyMesh.position.set(3.2, 0, 0)
    this.enemyMesh.rotation.y = -Math.PI / 2
    this.enemyMesh.scale.setScalar(1.35)
    this.scene.add(this.enemyMesh)

    this.unsubs.push(
      bus.on('combat:beat', ({ result, beatIndex }) => {
        if (result === 'hit') {
          this.playerLunge = 1
          // The key just struck picks the swing (chainRun is still live in-emit —
          // pinned by tests/combat.test.ts).
          this.driver.playAction(attackForKey(this.encounter.chainRun?.keys[beatIndex]))
        } else if (result !== 'pending') {
          // A mistimed / wrong-key beat whiffs.
          this.driver.playAction('stumble')
        }
      }),
      bus.on('combat:damage', ({ target }) => {
        if (target === 'enemy') this.flashT = 0.11
      }),
      bus.on('combat:parry', ({ result }) => {
        if (result !== 'hit') {
          this.playerLunge = 0.6
          this.driver.playAction('block')
        } else {
          this.enemyLunge = 1
          this.driver.playAction('flinch')
        }
      }),
      bus.on('combat:telegraph', () => {
        this.enemyLunge = 0.5
      }),
      // The grapple crash-in: draw first (can't slam empty-handed), then the foe
      // recoils hard (the white hurt-flash comes free with combat:damage).
      bus.on('combat:entry', () => {
        this.enemyLunge = 1
        this.ensureSwordInHand()
        this.driver.playAction('slam')
      }),
    )
  }

  /** THE single caller of `attachSword(rig, 'hand')` — draws the blade once. */
  private ensureSwordInHand(): void {
    if (this.swordInHand) return
    attachSword(this.rig, 'hand')
    this.swordInHand = true
  }

  /** Set the enemy's emissive on every sub-mesh (the one owner of it, so the
   *  damage flash and the parry-window glow can't fight over it). */
  private setEnemyEmissive(color: string, intensity: number): void {
    this.enemyMesh.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && (mesh.material as THREE.MeshToonMaterial).emissive) {
        const m = mesh.material as THREE.MeshToonMaterial
        m.emissive.set(color)
        m.emissiveIntensity = intensity
      }
    })
  }

  update(dt: number, encounter: Encounter): void {
    this.t += dt
    this.playerLunge = Math.max(0, this.playerLunge - dt * 3.5)
    this.enemyLunge = Math.max(0, this.enemyLunge - dt * 3)

    // Enemy emissive, single owner: a brief white flash when it's hurt wins;
    // otherwise a breathing GOLD glow whenever a strike is parryable right now
    // (the at-a-glance "parry!" cue, where the player's eyes actually are).
    this.flashT = Math.max(0, this.flashT - dt)
    const run = encounter.strikeRun
    const parryNow =
      !!run &&
      run.hitTimes.some((h, i) => i >= run.hitIndex && inWindow(encounter.t, h, encounter.parryWindow))
    if (this.flashT > 0) this.setEnemyEmissive('#ffffff', 0.7)
    else if (parryNow) this.setEnemyEmissive('#ffb347', 0.35 + 0.3 * Math.sin(this.t * 26))
    else this.setEnemyEmissive('#000000', 0)

    // Player figure -----------------------------------------------------
    // Baseline idle (a live attack track overrides it inside the driver).
    this.driver.setLocomotion('idle', 0)
    // Outro, latched so it fires exactly once.
    if (!this.outroPlayed && (encounter.phase === 'victory' || encounter.phase === 'defeat')) {
      this.outroPlayed = true
      this.driver.playAction(encounter.phase === 'victory' ? 'victory' : 'defeat')
    }
    // Swap the sword into the hand partway through the draw.
    const act = this.driver.currentAction()
    if (act && act.id === 'draw' && act.u >= DRAW_SWAP_U) this.ensureSwordInHand()

    // Lunge slide (kept from the old arena); defeat sinks the rig into a kneel
    // (rotations alone can't lower the pelvis — this is that Y's only owner).
    this.rig.group.position.x = -3.2 + this.playerLunge * 1.6
    const targetY = encounter.phase === 'defeat' ? -0.3 : 0
    this.rig.group.position.y += (targetY - this.rig.group.position.y) * Math.min(1, dt * 3)
    this.driver.update(dt)

    // Enemy (unchanged) -------------------------------------------------
    this.enemyMesh.position.x = 3.2 - this.enemyLunge * 1.4
    this.enemyMesh.position.y = Math.sin(this.t * 1.7 + 1) * 0.08
    if (encounter.phase === 'victory') {
      this.enemyMesh.scale.multiplyScalar(Math.max(0.0, 1 - dt * 1.8))
      this.enemyMesh.rotation.y += dt * 4
    }
  }

  dispose(): void {
    for (const u of this.unsubs) u()
  }
}
