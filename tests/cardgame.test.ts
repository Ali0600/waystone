import { describe, expect, it } from 'vitest'
import { createInitialState, parseGameState, type GameState } from '../src/core/state'
import {
  DECK_LIMIT,
  LADDER_UNLOCK,
  buyCard,
  encounteredCards,
  grantStarterDeck,
  isEncountered,
  opponents,
  recordMatchResult,
  setDeck,
  shopStock,
  type Opponent,
} from '../src/cards/game'
import { cardById } from '../src/content/cards.schema'
import { RECRUITS } from '../src/content/recruits'

function felled(state: GameState, ...ids: string[]) {
  for (const id of ids) state.enemiesFelled[id] = (state.enemiesFelled[id] ?? 0) + 1
}
function recruitAll(state: GameState) {
  for (const r of RECRUITS) state.discoveries[r.personId] = 'found'
}

describe('ownership', () => {
  it('grantStarterDeck gives eight cards and an opening deck, idempotently', () => {
    const s = createInitialState()
    grantStarterDeck(s)
    expect(s.cardsOwned).toHaveLength(8)
    expect(s.deck.length).toBeGreaterThan(0)
    expect(s.deck.length).toBeLessThanOrEqual(DECK_LIMIT)
    grantStarterDeck(s) // again — no duplicates
    expect(s.cardsOwned).toHaveLength(8)
  })

  it('setDeck enforces ≤ limit and subset-of-owned', () => {
    const s = createInitialState()
    grantStarterDeck(s)
    const owned = s.cardsOwned
    expect(setDeck(s, owned.slice(0, 3))).toBe(true)
    expect(s.deck).toHaveLength(3)
    expect(setDeck(s, ['card-cinder-chorister'])).toBe(false) // not owned
    expect(setDeck(s, [...owned, 'x', 'y'])).toBe(false) // > 8 (with junk)
  })
})

describe('the subject-encountered gate', () => {
  it('gates each subject on genuine contact', () => {
    const s = createInitialState()
    // Amberfall/Waystation are home → their cards are always encountered.
    expect(isEncountered(s, cardById('card-amberfall')!)).toBe(true)
    expect(isEncountered(s, cardById('card-waystation')!)).toBe(true)
    // A latent region only after manifest.
    expect(isEncountered(s, cardById('card-veilspire')!)).toBe(false)
    s.regionsManifested.push('veilspire')
    expect(isEncountered(s, cardById('card-veilspire')!)).toBe(true)
    // An enemy only after it's felled.
    expect(isEncountered(s, cardById('card-husk')!)).toBe(false)
    felled(s, 'husk')
    expect(isEncountered(s, cardById('card-husk')!)).toBe(true)
    // A recruit only after found.
    expect(isEncountered(s, cardById('card-iole')!)).toBe(false)
    s.discoveries['af-person-scribe'] = 'found'
    expect(isEncountered(s, cardById('card-iole')!)).toBe(true)
  })

  it('encounteredCards is a subset that only grows', () => {
    const s = createInitialState()
    const before = encounteredCards(s).length
    felled(s, 'husk', 'warden')
    const after = encounteredCards(s).length
    expect(after).toBeGreaterThan(before)
  })
})

describe("the Merchant's shelf", () => {
  it('is deterministic, capped at 3, encountered and unowned only', () => {
    const s = createInitialState()
    felled(s, 'husk', 'warden', 'chorister', 'husk-elder', 'cinder-chorister')
    const a = shopStock(s).map((c) => c.id)
    const b = shopStock(s).map((c) => c.id)
    expect(a).toEqual(b) // deterministic for the same state
    expect(a.length).toBeLessThanOrEqual(3)
    for (const id of a) {
      expect(s.cardsOwned).not.toContain(id)
      expect(isEncountered(s, cardById(id)!)).toBe(true)
    }
  })

  it('buying spends Lumen and adds to owned; refuses when broke or duplicate', () => {
    const s = createInitialState()
    s.lumen = 40
    expect(buyCard(s, 'card-husk', 30)).toBe(true)
    expect(s.lumen).toBe(10)
    expect(s.cardsOwned).toContain('card-husk')
    expect(buyCard(s, 'card-husk', 30)).toBe(false) // already owned
    expect(buyCard(s, 'card-warden', 30)).toBe(false) // can't afford
  })
})

describe('opponents and the ladder', () => {
  it('lists found residents (never Tam) and opens the ladder after enough wins', () => {
    const s = createInitialState()
    recruitAll(s)
    const casual = opponents(s)
    expect(casual.every((o) => !o.rival)).toBe(true)
    expect(casual.some((o) => o.id === 'cv-person-cardplayer')).toBe(false) // Tam hosts, isn't a casual
    // Beat LADDER_UNLOCK distinct residents → rivals appear.
    for (const o of casual.slice(0, LADDER_UNLOCK)) s.cardWins[o.id] = 1
    const withLadder = opponents(s)
    expect(withLadder.some((o) => o.rival)).toBe(true)
    expect(withLadder.some((o) => o.id === 'ladder-tam')).toBe(false) // Tam-final still locked
    // Beat all three rivals → the final unlocks.
    for (const o of withLadder.filter((o) => o.rival)) s.cardWins[o.id] = 1
    expect(opponents(s).some((o) => o.id === 'ladder-tam')).toBe(true)
  })
})

describe('match rewards', () => {
  const casual: Opponent = {
    id: 'af-person-smith',
    name: 'Bram',
    deckIds: [],
    rival: false,
    lumen: 20,
    stones: 0,
    rewardCardId: 'card-bram',
  }
  const rival: Opponent = {
    id: 'rival-mora',
    name: 'Mora',
    deckIds: [],
    rival: true,
    lumen: 40,
    stones: 1,
    rewardCardId: 'card-husk-elder',
  }

  it('a first win pays Lumen and grants the reward card once', () => {
    const s = createInitialState()
    const r1 = recordMatchResult(s, casual, true)
    expect(r1.firstWin).toBe(true)
    expect(s.lumen).toBe(20)
    expect(s.cardsOwned).toContain('card-bram')
    expect(r1.card?.id).toBe('card-bram')
    // A second win pays Lumen again but no duplicate card.
    const r2 = recordMatchResult(s, casual, true)
    expect(r2.firstWin).toBe(false)
    expect(r2.card).toBeUndefined()
    expect(s.cardsOwned.filter((id) => id === 'card-bram')).toHaveLength(1)
    expect(s.lumen).toBe(40)
  })

  it('a ladder win pays rare Glyph Stones; a loss costs nothing', () => {
    const s = createInitialState()
    recordMatchResult(s, rival, true)
    expect(s.glyphStones).toBe(1)
    expect(s.lumen).toBe(40)
    const before = { lumen: s.lumen, stones: s.glyphStones, wins: s.cardWins['rival-mora'] }
    const loss = recordMatchResult(s, rival, false)
    expect(loss).toEqual({ lumen: 0, stones: 0, firstWin: false })
    expect(s.lumen).toBe(before.lumen)
    expect(s.glyphStones).toBe(before.stones)
    expect(s.cardWins['rival-mora']).toBe(before.wins) // a loss isn't a win
  })
})

describe('save v9 → v10 migration', () => {
  it('defaults the deck-game fields', () => {
    const v9 = JSON.stringify({
      ...createInitialState(),
      version: 9,
      cardsOwned: undefined,
      deck: undefined,
      cardWins: undefined,
      enemiesFelled: undefined,
    })
    const parsed = parseGameState(v9)
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(createInitialState().version)
    expect(parsed!.cardsOwned).toEqual([])
    expect(parsed!.deck).toEqual([])
    expect(parsed!.cardWins).toEqual({})
    expect(parsed!.enemiesFelled).toEqual({})
  })

  it('rejects a deck that is not a subset of owned', () => {
    const bad = JSON.stringify({
      ...createInitialState(),
      cardsOwned: ['card-husk'],
      deck: ['card-husk', 'card-warden'], // warden not owned
    })
    expect(parseGameState(bad)).toBeNull()
  })
})
