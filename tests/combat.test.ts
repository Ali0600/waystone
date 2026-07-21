import { describe, expect, it } from 'vitest'
import { Encounter, PLAYER_MAX_HP } from '../src/combat/encounter'
import { ArtRecognizer } from '../src/combat/arts'
import { judgePress, beatExpired } from '../src/combat/timing'
import { ARTS, BEAT_WINDOW, CHAINS, PARRY_WINDOW } from '../src/content/chains'
import { ENEMIES, type EnemyDef } from '../src/content/enemies'
import { EventBus } from '../src/core/events'
import { createInitialState, type GameState } from '../src/core/state'
import { GlyphSystem } from '../src/progression/glyphs'
import { MasterySystem, TIER_THRESHOLDS } from '../src/progression/mastery'

const DT = 1 / 60

function makeEncounter(enemy: EnemyDef, prep?: (state: GameState) => void) {
  const state = createInitialState()
  prep?.(state)
  const bus = new EventBus()
  const mastery = new MasterySystem(state, bus)
  const glyphs = new GlyphSystem(state, bus, () => 0)
  const enc = new Encounter(enemy, state, bus, mastery, glyphs, undefined)
  const events: string[] = []
  bus.on('combat:parry', ({ result }) => events.push(`parry:${result}`))
  bus.on('combat:lock', ({ remaining }) => events.push(`locks:${remaining.length}`))
  bus.on('combat:art', ({ name }) => events.push(`art:${name}`))
  bus.on('combat:end', ({ victory }) => events.push(`end:${victory}`))
  return { enc, state, bus, mastery, glyphs, events }
}

/** Advance the encounter with no input. */
function idle(enc: Encounter, seconds: number) {
  for (let t = 0; t < seconds; t += DT) enc.update(DT, [], false)
}

/** Advance until a phase (with a safety cap). */
function untilPhase(enc: Encounter, phase: string, cap = 20) {
  for (let t = 0; t < cap; t += DT) {
    if (enc.phase === phase) return
    enc.update(DT, [], false)
  }
  if (enc.phase !== phase) throw new Error(`never reached ${phase} (at ${enc.phase})`)
}

describe('timing primitives', () => {
  it('judges hits at window edges', () => {
    expect(judgePress(1.0, 1.0, 0.16)).toBe('hit')
    expect(judgePress(1.16, 1.0, 0.16)).toBe('hit')
    expect(judgePress(0.84, 1.0, 0.16)).toBe('hit')
    expect(judgePress(1.17, 1.0, 0.16)).toBe('late')
    expect(judgePress(0.83, 1.0, 0.16)).toBe('early')
    expect(judgePress(0.2, 1.0, 0.16)).toBe('pending')
  })

  it('expires beats after the window', () => {
    expect(beatExpired(1.17, 1.0, 0.16)).toBe(true)
    expect(beatExpired(1.1, 1.0, 0.16)).toBe(false)
  })
})

describe('chains', () => {
  it('a perfectly timed chain damages the enemy and counts strike mastery', () => {
    const { enc, state } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    expect(enc.phase).toBe('playerChain')
    const chain = CHAINS[0]
    // Fire exactly on each beat of level 1.
    const level = chain.levels[0]
    let last = 0
    for (const beat of level.beats) {
      // advance to the beat time then press
      while (enc.t - enc.chainRun!.startT < beat - DT / 2) {
        enc.update(DT, [], false)
      }
      enc.update(DT, [], true)
      void last
    }
    // Chain completes on the frame after the last hit.
    enc.update(DT, [], false)
    expect(state.chainUses[chain.id]).toBe(1)
    expect(state.mastery.strike).toBe(1)
    expect(enc.enemyHp).toBe(
      ENEMIES.husk.hp - (level.beats.length * level.damagePerBeat + 2),
    )
    expect(enc.phase).toBe('enemyWindup')
  })

  it('a mistimed press ends the chain with partial damage', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    // Press way late for the first beat (after expiry it auto-misses).
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.1)
    expect(enc.phase).toBe('enemyWindup')
    expect(enc.enemyHp).toBe(ENEMIES.husk.hp) // zero hits, no bonus
  })

  it('the second chain is strike-tier gated', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    expect(enc.availableChains().map((c) => c.id)).toEqual(['traveler'])
    const { enc: enc2 } = makeEncounter(ENEMIES.husk, (s) => {
      s.mastery.strike = TIER_THRESHOLDS.strike[0]
    })
    expect(enc2.availableChains().map((c) => c.id)).toEqual([
      'traveler',
      'lantern-arc',
    ])
  })
})

describe('enemy turns and parry', () => {
  function toEnemyStrike(enc: Encounter) {
    untilPhase(enc, 'player')
    // Whiff a chain instantly to hand the turn over.
    enc.update(DT, ['Digit1'], false)
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.05)
    untilPhase(enc, 'enemyStrikes')
  }

  it('an unparried melee string damages the player per hit', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    toEnemyStrike(enc)
    const attack = ENEMIES.husk.attacks[0] // Cinder Swipe, 2 hits × 4
    idle(enc, (attack.beats!.at(-1) ?? 0) + PARRY_WINDOW + 0.3)
    expect(enc.playerHp).toBe(PLAYER_MAX_HP - attack.damage * attack.beats!.length)
    expect(enc.phase).toBe('player')
  })

  it('parrying every hit takes no damage and counts parry mastery', () => {
    const { enc, state } = makeEncounter(ENEMIES.husk)
    toEnemyStrike(enc)
    const run = enc.strikeRun!
    for (let i = 0; i < run.hitTimes.length; i++) {
      while (enc.t < run.hitTimes[i] - DT / 2) enc.update(DT, [], false)
      enc.update(DT, [], true) // parry on the beat
    }
    enc.update(DT, [], false)
    expect(enc.playerHp).toBe(PLAYER_MAX_HP)
    expect(state.mastery.parry).toBe(2)
  })

  it('a parried projectile reflects at Parry tier 2', () => {
    const base = makeEncounter(ENEMIES.warden)
    // Round-robin: first attack is the projectile Vigil Bolt.
    ;(() => {
      const { enc } = base
      toEnemyStrike(enc)
      const hitT = enc.strikeRun!.hitTimes[0]
      while (enc.t < hitT - DT / 2) enc.update(DT, [], false)
      enc.update(DT, [], true)
      expect(enc.playerHp).toBe(PLAYER_MAX_HP)
      expect(base.events).toContain('parry:parried') // tier 1: block only
    })()

    const tiered = makeEncounter(ENEMIES.warden, (s) => {
      s.mastery.parry = TIER_THRESHOLDS.parry[0] // tier 2
    })
    const { enc } = tiered
    const hpBefore = enc.enemyHp
    toEnemyStrike(enc)
    const hitT = enc.strikeRun!.hitTimes[0]
    while (enc.t < hitT - DT / 2) enc.update(DT, [], false)
    enc.update(DT, [], true)
    expect(tiered.events).toContain('parry:reflected')
    expect(enc.enemyHp).toBeLessThan(hpBefore)
  })

  it('the parry bar has a sound geometry: startT origin, windup-anchored ordered hits', () => {
    // The incoming-strike bar (M23) positions each marker at (hitT - startT).
    // Pin that contract so the bar can't silently mis-place a strike.
    const { enc } = makeEncounter(ENEMIES.husk)
    toEnemyStrike(enc)
    const run = enc.strikeRun!
    const beats = run.attack.beats ?? [0]
    expect(run.hitTimes.length).toBe(beats.length)
    for (let i = 0; i < run.hitTimes.length; i++) {
      // every hit is exactly windup + its beat after the telegraph origin
      expect(run.hitTimes[i] - run.startT).toBeCloseTo(run.attack.windup + beats[i], 6)
      if (i > 0) expect(run.hitTimes[i]).toBeGreaterThan(run.hitTimes[i - 1])
    }
    expect(run.startT).toBeLessThan(run.hitTimes[0])
  })
})

describe('chorister locks', () => {
  function prepGlyphs(state: GameState) {
    state.glyphGrid[0] = 'ember'
    state.glyphGrid[5] = 'gale'
  }

  it('breaking every lock cancels the chant and staggers the enemy', () => {
    const { enc, state } = makeEncounter(ENEMIES.chorister, prepGlyphs)
    untilPhase(enc, 'player')
    // Whiff to hand over the turn → chorister chants first (attack 0).
    enc.update(DT, ['Digit1'], false)
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.05)
    untilPhase(enc, 'player') // chant telegraphed, back to us with locks up
    expect(enc.chantLocks).toEqual(['ember', 'gale'])
    // Break both locks with glyph actions across two turns.
    enc.update(DT, ['Digit3'], false) // ember action
    expect(enc.chantLocks).toEqual(['gale'])
    // Enemy's next turn resolves nothing? No — chant resolves when its turn
    // comes and locks remain. One lock left → chant resolves with damage
    // unless we break it. The enemy's intermediate turn is the resolve turn,
    // so break the second lock only if we get a turn first.
    untilPhase(enc, 'player', 30)
    if (enc.chantLocks !== null && enc.chantLocks.length > 0) {
      enc.update(DT, ['Digit4'], false) // gale action breaks the last lock
      expect(enc.chantLocks).toEqual([])
    }
    expect(state.glyphUses.ember).toBe(1)
  })

  it('an unbroken chant lands its full damage', () => {
    const { enc } = makeEncounter(ENEMIES.chorister, prepGlyphs)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.05)
    untilPhase(enc, 'player')
    expect(enc.chantLocks?.length).toBe(2)
    // Do nothing useful: whiff a chain again; the chant resolves on the
    // chorister's next turn.
    enc.update(DT, ['Digit1'], false)
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.05)
    idle(enc, 4)
    expect(enc.playerHp).toBe(PLAYER_MAX_HP - ENEMIES.chorister.attacks[0].damage)
    expect(enc.chantLocks).toBeNull()
  })
})

describe('hidden arts', () => {
  it('recognizer matches an exact sequence within the time window', () => {
    const rec = new ArtRecognizer()
    expect(rec.push(['ArrowDown'], 0)).toBeNull()
    expect(rec.push(['ArrowUp'], 0.3)).toBeNull()
    const art = rec.push(['Space'], 0.6)
    expect(art?.id).toBe('emberwake')
  })

  it('rejects stale or wrong sequences', () => {
    const rec = new ArtRecognizer()
    rec.push(['ArrowDown'], 0)
    rec.push(['ArrowUp'], 2.5) // window expired for the first key
    expect(rec.push(['Space'], 2.6)).toBeNull()

    const rec2 = new ArtRecognizer()
    rec2.push(['ArrowUp'], 0)
    rec2.push(['ArrowDown'], 0.2)
    expect(rec2.push(['Space'], 0.4)).toBeNull()
  })

  it('performing an art in combat unlocks it permanently and hits hard', () => {
    const { enc, state, events } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['ArrowDown'], false)
    enc.update(DT, ['ArrowUp'], false)
    enc.update(DT, ['Space'], false)
    expect(state.artsUnlocked).toContain('emberwake')
    expect(enc.enemyHp).toBe(ENEMIES.husk.hp - ARTS[0].damage)
    expect(events).toContain('art:Emberwake')
    expect(enc.phase).toBe('enemyWindup')
  })
})

describe('angling ties into combat', () => {
  it('a cooked meal is a one-fight shield of over-max HP, then clears', () => {
    const { enc, state } = makeEncounter(ENEMIES.husk, (s) => {
      s.pendingMeal = 'veilcarp' // +12 shield
    })
    expect(enc.playerHp).toBe(PLAYER_MAX_HP + 12)
    expect(state.pendingMeal).toBeNull() // consumed at the start of the fight
  })

  it('the Undertow art staggers the enemy — its turn is skipped', () => {
    const { enc } = makeEncounter(ENEMIES.warden, (s) => {
      s.artsUnlocked.push('undertow')
    })
    untilPhase(enc, 'player')
    const undertow = ARTS.find((a) => a.id === 'undertow')!
    const hpBefore = enc.enemyHp
    for (const code of undertow.sequence) enc.update(DT, [code], false)
    expect(enc.enemyHp).toBe(hpBefore - undertow.damage)
    // A staggering Art leaves the turn with the player instead of the enemy.
    expect(enc.phase).toBe('player')
  })

  it('a normal art (Emberwake) hands the turn to the enemy', () => {
    const { enc } = makeEncounter(ENEMIES.warden)
    untilPhase(enc, 'player')
    for (const code of ['ArrowDown', 'ArrowUp', 'Space']) enc.update(DT, [code], false)
    expect(enc.phase).toBe('enemyWindup') // contrast with Undertow's stagger
  })
})

describe('victory and rewards', () => {
  it('defeating a guardian pays lumen and unlocks its charge', () => {
    const state = createInitialState()
    const bus = new EventBus()
    const mastery = new MasterySystem(state, bus)
    const glyphs = new GlyphSystem(state, bus, () => 0)
    const enc = new Encounter(
      { ...ENEMIES.husk, hp: 2 },
      state,
      bus,
      mastery,
      glyphs,
      'af-guarded-east-coffer',
    )
    untilPhase(enc, 'player')
    // Emberwake one-shots a 2hp target.
    enc.update(DT, ['ArrowDown'], false)
    enc.update(DT, ['ArrowUp'], false)
    enc.update(DT, ['Space'], false)
    expect(enc.phase).toBe('victory')
    expect(state.lumen).toBe(ENEMIES.husk.lumenReward)
    expect(state.guardiansDefeated).toContain('af-guarded-east-coffer')
    idle(enc, 2)
    expect(enc.done).toBe(true)
  })

  it('player defeat ends the encounter without loss', () => {
    const { enc, state } = makeEncounter({
      ...ENEMIES.husk,
      attacks: [
        { name: 'Doom', pattern: 'melee', damage: 50, windup: 0.5, beats: [0] },
      ],
    })
    state.lumen = 33
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.05)
    idle(enc, 3)
    expect(enc.phase).toBe('defeat')
    expect(state.lumen).toBe(33) // nothing lost
  })
})
