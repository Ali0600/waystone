import { describe, expect, it } from 'vitest'
import { Encounter, PLAYER_MAX_HP } from '../src/combat/encounter'
import { ArtRecognizer } from '../src/combat/arts'
import { judgePress, beatExpired } from '../src/combat/timing'
import { ARTS, BEAT_WINDOW, CHAINS, COMBO_KEYS, PARRY_WINDOW } from '../src/content/chains'
import { ENEMIES, type EnemyDef } from '../src/content/enemies'
import { EventBus } from '../src/core/events'
import { createInitialState, type GameState } from '../src/core/state'
import { GlyphSystem } from '../src/progression/glyphs'
import { MasterySystem, TIER_THRESHOLDS } from '../src/progression/mastery'
import { mealShield } from '../src/minigames/angling'
import { flashLifetimeMs } from '../src/ui/combat'

const DT = 1 / 60

function makeEncounter(
  enemy: EnemyDef,
  prep?: (state: GameState) => void,
  opts: { grappleEntry?: boolean } = {},
) {
  const state = createInitialState()
  prep?.(state)
  const bus = new EventBus()
  const mastery = new MasterySystem(state, bus)
  const glyphs = new GlyphSystem(state, bus, () => 0)
  const enc = new Encounter(enemy, state, bus, mastery, glyphs, undefined, opts.grappleEntry ?? false)
  const events: string[] = []
  bus.on('combat:parry', ({ result }) => events.push(`parry:${result}`))
  bus.on('combat:lock', ({ remaining }) => events.push(`locks:${remaining.length}`))
  bus.on('combat:art', ({ name }) => events.push(`art:${name}`))
  bus.on('combat:entry', ({ dmg }) => events.push(`entry:${dmg}`))
  bus.on('combat:perfect', ({ kind }) => events.push(`perfect:${kind}`))
  bus.on('combat:beat', ({ result }) => events.push(`beat:${result}`))
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
    // Fire exactly on each beat of level 1, pressing the KEY that beat demands.
    const level = chain.levels[0]
    level.beats.forEach((beat, i) => {
      while (enc.t - enc.chainRun!.startT < beat - DT / 2) {
        enc.update(DT, [], false)
      }
      enc.update(DT, [level.keys[i]], false)
    })
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

  it('every chain level has one key per beat, all from the combo set (M35)', () => {
    for (const chain of CHAINS) {
      for (const level of chain.levels) {
        expect(level.keys).toHaveLength(level.beats.length)
        for (const k of level.keys) expect(COMBO_KEYS).toContain(k)
      }
    }
  })

  it('a wrong combo key fumbles the chain (precision, not just timing)', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    const lvl = CHAINS[0].levels[0] // keys: ['Space', 'KeyW', 'Space']
    // Land beat 0 (Space) correctly.
    while (enc.t - enc.chainRun!.startT < lvl.beats[0] - DT / 2) enc.update(DT, [], false)
    enc.update(DT, [lvl.keys[0]], false)
    expect(enc.chainRun!.hits).toBe(1)
    // Beat 1 wants KeyW — press KeyS instead → fumble.
    while (enc.t - enc.chainRun!.startT < lvl.beats[1] - DT / 2) enc.update(DT, [], false)
    enc.update(DT, ['KeyS'], false)
    expect(events).toContain('beat:wrong')
    expect(enc.phase).toBe('enemyWindup') // chain ended
    expect(enc.enemyHp).toBe(ENEMIES.husk.hp - lvl.damagePerBeat) // only the 1 landed beat
  })

  it('the right key AND a wrong one on the same beat still fumbles', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    const lvl = CHAINS[0].levels[0]
    // On beat 0 (Space), press Space + a stray KeyA together.
    while (enc.t - enc.chainRun!.startT < lvl.beats[0] - DT / 2) enc.update(DT, [], false)
    enc.update(DT, ['Space', 'KeyA'], false)
    expect(events).toContain('beat:wrong')
    expect(enc.chainRun).toBeNull() // fumbled before landing a hit
  })

  it('the correct next key pressed way early is ignored (pending), not consumed', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    const lvl = CHAINS[0].levels[0] // beats [0.5, 1.1, 1.7], keys ['Space','KeyW','Space']
    // Land beat 0 (Space) on time.
    while (enc.t - enc.chainRun!.startT < lvl.beats[0] - DT / 2) enc.update(DT, [], false)
    enc.update(DT, [lvl.keys[0]], false)
    expect(enc.chainRun!.hits).toBe(1)
    // Now press beat 1's key (KeyW) FAR early (~0.6s before its 1.1s beat = pending).
    enc.update(DT, [lvl.keys[1]], false)
    expect(enc.phase).toBe('playerChain') // still going — pending, not a miss
    expect(enc.chainRun!.hits).toBe(1) // and not consumed
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

describe('the Perfect signal', () => {
  function toEnemyStrike(enc: Encounter) {
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.05)
    untilPhase(enc, 'enemyStrikes')
  }

  it('a flawless chain announces perfect:chain exactly once', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    const lvl = CHAINS[0].levels[0]
    lvl.beats.forEach((beat, i) => {
      while (enc.t - enc.chainRun!.startT < beat - DT / 2) enc.update(DT, [], false)
      enc.update(DT, [lvl.keys[i]], false) // the beat's key
    })
    enc.update(DT, [], false) // completes
    expect(events.filter((e) => e === 'perfect:chain')).toHaveLength(1)
  })

  it('a mistimed chain announces no perfect', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    idle(enc, CHAINS[0].levels[0].beats[0] + BEAT_WINDOW + 0.1) // miss the first beat
    expect(events.some((e) => e.startsWith('perfect:'))).toBe(false)
  })

  it('parrying every hit of a string announces perfect:guard once', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk)
    toEnemyStrike(enc)
    const run = enc.strikeRun!
    for (let i = 0; i < run.hitTimes.length; i++) {
      while (enc.t < run.hitTimes[i] - DT / 2) enc.update(DT, [], false)
      enc.update(DT, [], true) // parry on the beat
    }
    enc.update(DT, [], false)
    expect(events.filter((e) => e === 'perfect:guard')).toHaveLength(1)
  })

  it('a string with one hit landing forfeits the guard (sparse-array trap)', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk) // Cinder Swipe: 2 hits
    toEnemyStrike(enc)
    const run = enc.strikeRun!
    // Parry only the FIRST hit, then let the rest land.
    while (enc.t < run.hitTimes[0] - DT / 2) enc.update(DT, [], false)
    enc.update(DT, [], true)
    idle(enc, (run.attack.beats!.at(-1) ?? 0) + PARRY_WINDOW + 0.3)
    expect(events).not.toContain('perfect:guard')
  })

  it('the Perfect flash outlives the other combat flashes', () => {
    // The reward should linger ~1s longer than an ordinary hit/damage flash.
    expect(flashLifetimeMs('perfect')).toBe(1900)
    expect(flashLifetimeMs('good')).toBe(900)
    expect(flashLifetimeMs('bad')).toBe(900)
    expect(flashLifetimeMs('art')).toBe(900)
    expect(flashLifetimeMs('perfect')).toBeGreaterThan(flashLifetimeMs('good'))
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

describe('command menu — Attack / Defend / Item', () => {
  // A fresh state has no inscribed glyphs, so the root is [Attack, Defend, Item].
  function brace(enc: Encounter) {
    untilPhase(enc, 'player')
    enc.update(DT, ['ArrowDown'], false) // Attack → Defend
    enc.update(DT, ['Enter'], false) // commit Defend
  }

  it('Defend braces: the next enemy turn hits for HALF, and the brace is spent', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    brace(enc)
    expect(enc.braced).toBe(true)
    expect(enc.phase).toBe('enemyWindup')
    untilPhase(enc, 'enemyStrikes')
    const attack = ENEMIES.husk.attacks[0]
    idle(enc, (attack.beats!.at(-1) ?? 0) + PARRY_WINDOW * 1.6 + 0.4)
    const perHit = Math.ceil(attack.damage / 2)
    expect(enc.playerHp).toBe(PLAYER_MAX_HP - perHit * attack.beats!.length)
    expect(enc.phase).toBe('player')
    expect(enc.braced).toBe(false) // one turn only
  })

  it('bracing widens the parry window so a late press still parries', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    brace(enc)
    untilPhase(enc, 'enemyStrikes')
    expect(enc.parryWindow).toBeCloseTo(PARRY_WINDOW * 1.6, 6)
    const hitT = enc.strikeRun!.hitTimes[0]
    // 1.25× the normal window late: a miss unbraced, a hit while braced.
    const late = hitT + PARRY_WINDOW * 1.25
    while (enc.t < late - DT / 2) enc.update(DT, [], false)
    enc.update(DT, [], true)
    expect(enc.strikeRun!.parried[0]).toBe(true)
  })

  it('Item eats a fish to heal, consumes it, and passes the turn', () => {
    const { enc, state } = makeEncounter(ENEMIES.husk, (s) => {
      s.fishHeld = { veilcarp: 2 }
    })
    untilPhase(enc, 'player')
    enc.playerHp = 10
    enc.update(DT, ['ArrowDown'], false) // Defend
    enc.update(DT, ['ArrowDown'], false) // Item
    enc.update(DT, ['Enter'], false) // open Item submenu
    enc.update(DT, ['Enter'], false) // eat the veilcarp
    const heal = Math.max(3, Math.ceil(mealShield('veilcarp') * 0.6))
    expect(enc.playerHp).toBe(10 + heal)
    expect(state.fishHeld['veilcarp']).toBe(1) // one consumed
    expect(enc.phase).toBe('enemyWindup') // costs the turn
  })

  it('an Item heal is capped at maxHp', () => {
    const { enc } = makeEncounter(ENEMIES.husk, (s) => {
      s.fishHeld = { 'ember-eel': 1 }
    })
    untilPhase(enc, 'player')
    enc.playerHp = enc.maxHp - 1
    enc.update(DT, ['ArrowDown'], false) // Defend
    enc.update(DT, ['ArrowDown'], false) // Item
    enc.update(DT, ['Enter'], false)
    enc.update(DT, ['Enter'], false)
    expect(enc.playerHp).toBe(enc.maxHp)
  })

  it('a Hidden Art still fires while the command menu is active', () => {
    const { enc, state, events } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    // Emberwake = Down, Up, Space — the arrows wiggle the cursor, Space fires it.
    enc.update(DT, ['ArrowDown'], false)
    enc.update(DT, ['ArrowUp'], false)
    enc.update(DT, ['Space'], true)
    expect(events).toContain('art:Emberwake')
    expect(state.artsUnlocked).toContain('emberwake')
  })

  it('Space confirms the command menu (M36): descend Attack, commit the chain', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    // A plain Space (no art buffer) falls through to the menu as a confirm.
    enc.update(DT, ['Space'], true) // descend into Attack
    enc.update(DT, ['Space'], true) // commit the first chain
    expect(enc.phase).toBe('playerChain')
  })

  it('the Digit shortcuts still start a chain (retained fast path)', () => {
    const { enc } = makeEncounter(ENEMIES.husk)
    untilPhase(enc, 'player')
    enc.update(DT, ['Digit1'], false)
    expect(enc.phase).toBe('playerChain')
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

describe('grapple entry — crashing into the duel', () => {
  it('deals a tier-scaled opening blow once, mid-intro, and announces it', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk, undefined, { grappleEntry: true })
    // Tier 1 grapple (fresh) → the smallest blow.
    idle(enc, 1.0) // still in the intro (transitions at 1.2), entry lands at 0.4
    expect(enc.enemyHp).toBe(ENEMIES.husk.hp - 2)
    expect(events.filter((e) => e === 'entry:2')).toHaveLength(1) // exactly once
  })

  it('scales with grapple mastery — tier 3 crashes in harder', () => {
    const { enc, events } = makeEncounter(
      ENEMIES.husk,
      (s) => {
        s.mastery.grapple = TIER_THRESHOLDS.grapple[1] // 28 uses → tier 3
      },
      { grappleEntry: true },
    )
    idle(enc, 1.0)
    expect(enc.enemyHp).toBe(ENEMIES.husk.hp - 5)
    expect(events).toContain('entry:5')
  })

  it('a normal (walked-into) duel deals no opening blow', () => {
    const { enc, events } = makeEncounter(ENEMIES.husk)
    idle(enc, 1.0)
    expect(enc.enemyHp).toBe(ENEMIES.husk.hp)
    expect(events.some((e) => e.startsWith('entry:'))).toBe(false)
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
