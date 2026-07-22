import {
  BEAT_WINDOW,
  CHAINS,
  COMBO_KEYS,
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
import { FISH, mealShield } from '../minigames/angling'
import { BattleMenu, type MenuEntry, type MenuCommit } from './menu'

export const PLAYER_MAX_HP = 30
const GLYPH_DAMAGE = 4
const REFLECT_DAMAGE = 4
/** Bracing (Defend) widens the parry window this much on the next enemy turn. */
const BRACE_WINDOW_MULT = 1.6
/** Opening blow when you crash into a foe by grapple — indexed by grapple tier
 *  (1/2/3). Max 5 < the weakest enemy's 26 HP, so it can never one-shot. */
export const GRAPPLE_ENTRY_DAMAGE = [2, 3, 5]

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
  /** The key each beat demands (same length as `beats`) — the M35 combo. */
  keys: string[]
  damagePerBeat: number
  startT: number
  beatIndex: number
  hits: number
}

interface StrikeRun {
  attack: EnemyAttack
  /** Encounter-clock time the telegraph (windup) began — the parry bar's origin. */
  startT: number
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
  /** Max HP the bar divides by — PLAYER_MAX_HP, or higher with a meal shield. */
  readonly maxHp: number
  enemyHp: number
  /** Set when the outro is finished and the world may resume. */
  done = false
  chainRun: ChainRun | null = null
  strikeRun: StrikeRun | null = null
  /** Pending chorister chant: broken by matching glyph actions. */
  chantLocks: GlyphId[] | null = null
  /** Defend stance: halves the next enemy turn's damage + widens the parry window. */
  braced = false
  /** The classic command menu (Attack/Glyphs/Defend/Item). */
  readonly menu = new BattleMenu()
  private chantAttack: EnemyAttack | null = null
  private attackIndex = 0
  private phaseT = 0
  private outroT = 0
  private arts = new ArtRecognizer()
  private telegraphed = false
  /** The grapple-entry blow lands once, mid-intro. */
  private entryApplied = false

  constructor(
    private enemy: EnemyDef,
    private state: GameState,
    private bus: EventBus,
    private mastery: MasterySystem,
    private glyphs: GlyphSystem,
    /** Guarded discoverable id this enemy protects, if any. */
    private guards?: string,
    /** True when the duel was opened by grappling into the foe — deals a
     *  tier-scaled opening blow during the intro. */
    private grappleEntry = false,
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
    // The bar (and in-battle Item heals) cap at whatever the player started with.
    this.maxHp = Math.max(PLAYER_MAX_HP, this.playerHp)
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

  /** Live parry window — wider while braced, so Defend makes timing easier. */
  get parryWindow(): number {
    return PARRY_WINDOW * (this.braced ? BRACE_WINDOW_MULT : 1)
  }

  private setPhase(phase: EncounterPhase): void {
    this.phase = phase
    this.phaseT = 0
    this.telegraphed = false
    // A brace protects exactly one enemy turn; regaining the initiative ends it.
    if (phase === 'player') this.braced = false
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
    // Bracing (Defend) softens the blow this enemy turn.
    const actual = this.braced ? Math.ceil(amount / 2) : amount
    this.playerHp = Math.max(0, this.playerHp - actual)
    this.bus.emit('combat:damage', {
      target: 'player',
      amount: actual,
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

  /** Build the current command-menu tree (DATA — the DOM overlay renders it). */
  menuRoot(): MenuEntry[] {
    const root: MenuEntry[] = [
      {
        key: 'attack',
        label: 'Attack',
        submenu: this.availableChains().map((c) => ({
          key: c.id,
          label: c.name,
          commit: { kind: 'chain', id: c.id },
        })),
      },
    ]
    const glyphs = this.availableGlyphs()
    if (glyphs.length > 0) {
      root.push({
        key: 'glyphs',
        label: 'Glyphs',
        submenu: glyphs.map((g) => ({
          key: g,
          label: `${GLYPHS[g].rune} ${GLYPHS[g].name}`,
          color: GLYPHS[g].color,
          commit: { kind: 'glyph', id: g },
        })),
      })
    }
    root.push({ key: 'defend', label: 'Defend', commit: { kind: 'defend' } })
    const fish = FISH.filter((f) => (this.state.fishHeld[f.id] ?? 0) > 0)
    root.push({
      key: 'item',
      label: 'Item',
      disabled: fish.length === 0,
      submenu: fish.map((f) => ({
        key: f.id,
        label: f.name,
        detail: `×${this.state.fishHeld[f.id]}`,
        commit: { kind: 'item', fishId: f.id },
      })),
    })
    return root
  }

  private runCommit(commit: MenuCommit): void {
    switch (commit.kind) {
      case 'chain': {
        const def = this.availableChains().find((c) => c.id === commit.id)
        if (def) this.startChain(def)
        break
      }
      case 'glyph':
        this.useGlyph(commit.id)
        break
      case 'defend':
        this.brace()
        break
      case 'item':
        this.useItem(commit.fishId)
        break
    }
  }

  /** Defend: take a braced stance — the next enemy turn hits for half and its
   *  parry window is wider. Costs the turn. */
  private brace(): void {
    this.braced = true
    this.bus.emit('toast', {
      text: 'You brace — the next blow lands softer, and easier to turn.',
      flavor: 'info',
    })
    this.beginEnemyTurn()
  }

  /** Item: eat a held fish to heal (bigger species heal more). Costs the turn. */
  private useItem(fishId: string): void {
    if ((this.state.fishHeld[fishId] ?? 0) <= 0) return
    const heal = Math.max(3, Math.ceil(mealShield(fishId) * 0.6))
    const before = this.playerHp
    this.playerHp = Math.min(this.maxHp, this.playerHp + heal)
    this.state.fishHeld[fishId] -= 1
    if (this.state.fishHeld[fishId] <= 0) delete this.state.fishHeld[fishId]
    const name = FISH.find((f) => f.id === fishId)?.name ?? 'fish'
    this.bus.emit('toast', {
      text: `You eat the ${name} (+${this.playerHp - before} HP)`,
      flavor: 'reward',
    })
    this.beginEnemyTurn()
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
        // Crash-in damage lands a beat into the intro (after the UI has mounted
        // and can show the banner), reading as the impact of the tackle.
        if (this.grappleEntry && !this.entryApplied && this.phaseT >= 0.4) {
          this.entryApplied = true
          const tier = this.mastery.tier('grapple')
          const dmg = GRAPPLE_ENTRY_DAMAGE[Math.min(tier, GRAPPLE_ENTRY_DAMAGE.length) - 1]
          this.bus.emit('combat:entry', { dmg })
          this.damageEnemy(dmg)
        }
        // Guard the transition on the phase so a (theoretical) intro win isn't
        // clobbered back to 'player'.
        if (this.phase === 'intro' && this.phaseT >= 1.2) this.setPhase('player')
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
        // Glyph actions on 3..8 (retained shortcuts; the menu is the main path).
        const glyphsAvail = this.availableGlyphs()
        for (let i = 0; i < glyphsAvail.length && i < 6; i++) {
          if (pressedCodes.includes(`Digit${i + 3}`)) {
            this.useGlyph(glyphsAvail[i])
            break
          }
        }
        // The command menu (arrows + Enter). Only if a shortcut didn't just act.
        if (this.phase === 'player') {
          const commit = this.menu.step(pressedCodes, this.menuRoot())
          if (commit) this.runCommit(commit)
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
        const expected = run.keys[run.beatIndex]
        // A wrong combo key (a WASD/Space that isn't the one this beat wants)
        // fumbles the chain — precision matters, not just timing. Checked FIRST,
        // so pressing the right key AND a wrong one the same frame still fumbles.
        const wrongKey = pressedCodes.some(
          (c) => (COMBO_KEYS as readonly string[]).includes(c) && c !== expected,
        )
        if (wrongKey) {
          this.bus.emit('combat:beat', { result: 'wrong', beatIndex: run.beatIndex })
          this.finishChain(false)
          break
        }
        if (pressedCodes.includes(expected)) {
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
          // 'pending' presses (the right key, way early) are ignored.
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
              startT: this.t,
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
          // A flawless defense: every hit of the string was parried. `parried` is
          // sparse (set only on a parry), so check each index densely, not `.every`.
          if (run.hitTimes.length > 0 && run.hitTimes.every((_, i) => run.parried[i] === true)) {
            this.bus.emit('combat:perfect', { kind: 'guard' })
          }
          this.strikeRun = null
          if (this.phase === 'enemyStrikes') this.setPhase('player')
          break
        }
        const hitT = run.hitTimes[run.hitIndex]
        if (spacePressed) {
          const judged = judgePress(this.t, hitT, this.parryWindow)
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
        if (beatExpired(this.t, hitT, this.parryWindow)) {
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
      keys: level.keys,
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
      // A flawless chain (every beat landed — the only way to complete one).
      this.bus.emit('combat:perfect', { kind: 'chain' })
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
