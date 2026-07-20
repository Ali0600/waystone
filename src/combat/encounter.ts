import {
  BEAT_WINDOW,
  CHAINS,
  PARRY_WINDOW,
  chainLevel,
  type ChainDef,
} from '../content/chains'
import type { EnemyAttack, EnemyDef } from '../content/enemies'
import { GLYPHS, type GlyphId } from '../content/glyphs'
import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import type { GlyphSystem } from '../progression/glyphs'
import type { MasterySystem } from '../progression/mastery'
import { beatExpired, judgePress } from './timing'
import { ArtRecognizer } from './arts'
import { mealShield } from '../minigames/angling'

export const PLAYER_MAX_HP = 30
const GLYPH_DAMAGE = 4
const REFLECT_DAMAGE = 4

export type EncounterPhase =
  | 'intro'
  | 'player'
  | 'playerChain'
  | 'enemyWindup'
  | 'enemyStrikes'
  | 'victory'
  | 'defeat'

interface ChainRun {
  def: ChainDef
  beats: number[]
  damagePerBeat: number
  startT: number
  beatIndex: number
  hits: number
}

interface StrikeRun {
  attack: EnemyAttack
  /** Absolute clock times of each hit. */
  hitTimes: number[]
  hitIndex: number
  parried: boolean[]
}

/**
 * A focused duel. Headless: consumes InputSnapshot-ish data, emits bus
 * events; the arena scene and DOM overlay merely render what this says.
 */
export class Encounter {
  phase: EncounterPhase = 'intro'
  t = 0
  playerHp = PLAYER_MAX_HP
  enemyHp: number
  /** Set when the outro is finished and the world may resume. */
  done = false
  chainRun: ChainRun | null = null
  strikeRun: StrikeRun | null = null
  /** Pending chorister chant: broken by matching glyph actions. */
  chantLocks: GlyphId[] | null = null
  private chantAttack: EnemyAttack | null = null
  private attackIndex = 0
  private phaseT = 0
  private outroT = 0
  private arts = new ArtRecognizer()
  private telegraphed = false

  constructor(
    private enemy: EnemyDef,
    private state: GameState,
    private bus: EventBus,
    private mastery: MasterySystem,
    private glyphs: GlyphSystem,
    /** Guarded discoverable id this enemy protects, if any. */
    private guards?: string,
  ) {
    this.enemyHp = enemy.hp
    // A cooked meal (from mist-angling) is a one-fight shield of over-max HP.
    if (state.pendingMeal) {
      const shield = mealShield(state.pendingMeal)
      if (shield > 0) {
        this.playerHp = PLAYER_MAX_HP + shield
        bus.emit('toast', { text: `The meal steadies you (+${shield} vigour)`, flavor: 'reward' })
      }
      state.pendingMeal = null
    }
    bus.emit('combat:start', { enemyName: enemy.name })
    this.setPhase('intro')
  }

  /** Chains available to the player right now (strike-tier gated). */
  availableChains(): ChainDef[] {
    return CHAINS.filter(
      (c) => this.mastery.tier('strike') >= c.requiresStrikeTier,
    )
  }

  /** Distinct glyphs inscribed on the grid = usable combat actions. */
  availableGlyphs(): GlyphId[] {
    const seen = new Set<GlyphId>()
    for (const g of this.state.glyphGrid) {
      if (g !== null) seen.add(g)
    }
    return [...seen]
  }

  private setPhase(phase: EncounterPhase): void {
    this.phase = phase
    this.phaseT = 0
    this.telegraphed = false
    this.bus.emit('combat:phase', { phase })
  }

  private damageEnemy(amount: number): void {
    this.enemyHp = Math.max(0, this.enemyHp - amount)
    this.bus.emit('combat:damage', {
      target: 'enemy',
      amount,
      hpLeft: this.enemyHp,
    })
    if (this.enemyHp <= 0) {
      this.win()
    }
  }

  private damagePlayer(amount: number): void {
    this.playerHp = Math.max(0, this.playerHp - amount)
    this.bus.emit('combat:damage', {
      target: 'player',
      amount,
      hpLeft: this.playerHp,
    })
    if (this.playerHp <= 0) {
      this.setPhase('defeat')
      this.bus.emit('combat:end', { victory: false })
    }
  }

  private win(): void {
    this.setPhase('victory')
    this.state.enemiesFelled[this.enemy.id] =
      (this.state.enemiesFelled[this.enemy.id] ?? 0) + 1
    this.state.lumen += this.enemy.lumenReward
    this.bus.emit('lumen:changed', {
      total: this.state.lumen,
      delta: this.enemy.lumenReward,
    })
    if (this.guards && !this.state.guardiansDefeated.includes(this.guards)) {
      this.state.guardiansDefeated.push(this.guards)
      this.bus.emit('toast', { text: 'The guardian falls — its charge lies open', flavor: 'reward' })
    }
    this.bus.emit('combat:end', { victory: true })
  }

  private beginEnemyTurn(): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return
    this.setPhase('enemyWindup')
  }

  private chooseAttack(): EnemyAttack {
    // Resolve a pending chant before anything else.
    if (this.chantLocks !== null && this.chantAttack !== null) {
      return this.chantAttack
    }
    const attack = this.enemy.attacks[this.attackIndex % this.enemy.attacks.length]
    this.attackIndex++
    // Never start a second chant while one is pending.
    if (attack.pattern === 'chant' && this.chantLocks !== null) {
      return this.enemy.attacks[this.attackIndex++ % this.enemy.attacks.length]
    }
    return attack
  }

  /** A glyph action: damage + break every matching lock. */
  private useGlyph(glyph: GlyphId): void {
    this.glyphs.recordUse(glyph)
    let damage = GLYPH_DAMAGE
    if (this.chantLocks !== null) {
      const before = this.chantLocks.length
      this.chantLocks = this.chantLocks.filter((l) => l !== glyph)
      if (this.chantLocks.length < before) {
        this.bus.emit('combat:lock', { remaining: [...this.chantLocks] })
        this.bus.emit('toast', {
          text: `${GLYPHS[glyph].name} shatters a lock!`,
          flavor: 'reward',
        })
      }
    }
    this.damageEnemy(damage)
    if (this.phase !== 'victory') this.beginEnemyTurn()
  }

  update(dt: number, pressedCodes: string[], spacePressed: boolean): void {
    this.t += dt
    this.phaseT += dt

    switch (this.phase) {
      case 'intro': {
        if (this.phaseT >= 1.2) this.setPhase('player')
        break
      }
      case 'player': {
        // Hidden arts first — they override menu keys.
        const art = this.arts.push(pressedCodes, this.t)
        if (art) {
          const first = !this.state.artsUnlocked.includes(art.id)
          if (first) this.state.artsUnlocked.push(art.id)
          this.bus.emit('combat:art', { name: art.name, unlocked: first })
          if (first) {
            this.bus.emit('toast', {
              text: `Hidden Art unlocked — ${art.name}!`,
              flavor: 'reward',
            })
          }
          this.damageEnemy(art.damage)
          // A staggering Art (Undertow) skips the enemy's next turn.
          if (this.phase === 'player' && !art.stagger) this.beginEnemyTurn()
          break
        }
        // Chain selection.
        const chains = this.availableChains()
        if (pressedCodes.includes('Digit1') && chains[0]) {
          this.startChain(chains[0])
          break
        }
        if (pressedCodes.includes('Digit2') && chains[1]) {
          this.startChain(chains[1])
          break
        }
        // Glyph actions on 3..8.
        const glyphsAvail = this.availableGlyphs()
        for (let i = 0; i < glyphsAvail.length && i < 6; i++) {
          if (pressedCodes.includes(`Digit${i + 3}`)) {
            this.useGlyph(glyphsAvail[i])
            break
          }
        }
        break
      }
      case 'playerChain': {
        const run = this.chainRun!
        const rel = this.t - run.startT
        if (run.beatIndex >= run.beats.length) {
          // Chain complete.
          this.finishChain(true)
          break
        }
        const beatT = run.beats[run.beatIndex]
        if (spacePressed) {
          const judged = judgePress(rel, beatT, BEAT_WINDOW)
          if (judged === 'hit') {
            run.hits++
            run.beatIndex++
            this.bus.emit('combat:beat', { result: 'hit', beatIndex: run.beatIndex - 1 })
          } else if (judged === 'early' || judged === 'late') {
            this.bus.emit('combat:beat', { result: judged, beatIndex: run.beatIndex })
            this.finishChain(false)
            break
          }
          // 'pending' presses are ignored.
        } else if (beatExpired(rel, beatT, BEAT_WINDOW)) {
          this.bus.emit('combat:beat', { result: 'missed', beatIndex: run.beatIndex })
          this.finishChain(false)
          break
        }
        break
      }
      case 'enemyWindup': {
        if (!this.telegraphed) {
          this.telegraphed = true
          const attack = this.chooseAttack()
          const resolvingChant =
            attack.pattern === 'chant' && this.chantLocks !== null && this.chantAttack === attack
          if (attack.pattern === 'chant' && !resolvingChant) {
            // Begin the chant: show locks, then hand the turn back.
            this.chantAttack = attack
            this.chantLocks = [...(attack.locks ?? [])]
            this.bus.emit('combat:telegraph', {
              name: attack.name,
              pattern: 'chant',
              locks: [...this.chantLocks],
            })
          } else {
            this.strikeRun = {
              attack,
              hitTimes: (attack.beats ?? [0]).map(
                (b) => this.t + attack.windup + b,
              ),
              hitIndex: 0,
              parried: [],
            }
            this.bus.emit('combat:telegraph', {
              name: attack.name,
              pattern: attack.pattern,
              locks: [],
            })
          }
        }
        const attack = this.chantAttack
        if (this.chantLocks !== null && attack && this.strikeRun === null) {
          // Chant telegraph window: Parry T3 can shatter a lock outright.
          if (
            spacePressed &&
            this.mastery.tier('parry') >= 3 &&
            this.chantLocks.length > 0 &&
            this.phaseT > 0.4
          ) {
            this.chantLocks.shift()
            this.mastery.record('parry')
            this.bus.emit('combat:parry', { result: 'lockbroken' })
            this.bus.emit('combat:lock', { remaining: [...this.chantLocks] })
          }
          if (this.phaseT >= attack.windup) {
            // Chant begun; player gets a turn to break locks.
            this.setPhase('player')
          }
          break
        }
        if (this.phaseT >= (this.strikeRun?.attack.windup ?? 0)) {
          this.setPhase('enemyStrikes')
        }
        break
      }
      case 'enemyStrikes': {
        const run = this.strikeRun
        if (!run) {
          // Resolving a chant.
          this.resolveChant()
          break
        }
        if (run.attack.pattern === 'chant') {
          this.resolveChant()
          break
        }
        if (run.hitIndex >= run.hitTimes.length) {
          this.strikeRun = null
          if (this.phase === 'enemyStrikes') this.setPhase('player')
          break
        }
        const hitT = run.hitTimes[run.hitIndex]
        if (spacePressed) {
          const judged = judgePress(this.t, hitT, PARRY_WINDOW)
          if (judged === 'hit') {
            run.parried[run.hitIndex] = true
            run.hitIndex++
            this.mastery.record('parry')
            const reflected =
              run.attack.pattern === 'projectile' && this.mastery.tier('parry') >= 2
            this.bus.emit('combat:parry', {
              result: reflected ? 'reflected' : 'parried',
            })
            if (reflected) this.damageEnemy(REFLECT_DAMAGE)
            break
          }
        }
        if (beatExpired(this.t, hitT, PARRY_WINDOW)) {
          run.hitIndex++
          this.bus.emit('combat:parry', { result: 'hit' })
          this.damagePlayer(run.attack.damage)
        }
        break
      }
      case 'victory':
      case 'defeat': {
        this.outroT += dt
        if (this.outroT >= 1.6) this.done = true
        break
      }
    }
  }

  private startChain(def: ChainDef): void {
    const uses = this.state.chainUses[def.id] ?? 0
    const level = chainLevel(def, uses)
    this.chainRun = {
      def,
      beats: level.beats,
      damagePerBeat: level.damagePerBeat,
      startT: this.t,
      beatIndex: 0,
      hits: 0,
    }
    this.setPhase('playerChain')
  }

  private finishChain(completed: boolean): void {
    const run = this.chainRun!
    this.chainRun = null
    const damage = run.hits * run.damagePerBeat + (completed ? 2 : 0)
    if (completed) {
      this.state.chainUses[run.def.id] = (this.state.chainUses[run.def.id] ?? 0) + 1
      this.mastery.record('strike')
    }
    if (damage > 0) this.damageEnemy(damage)
    if (this.phase !== 'victory') this.beginEnemyTurn()
  }

  private resolveChant(): void {
    const attack = this.chantAttack!
    this.chantAttack = null
    this.strikeRun = null
    const locks = this.chantLocks ?? []
    this.chantLocks = null
    if (locks.length === 0) {
      this.bus.emit('toast', { text: 'The verse collapses — the chant is broken!', flavor: 'reward' })
      this.setPhase('player') // stagger: enemy loses its turn
    } else {
      this.damagePlayer(attack.damage)
      if (this.phase === 'enemyStrikes') this.setPhase('player')
    }
  }
}
