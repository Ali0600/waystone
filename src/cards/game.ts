import { ALL_CARDS, STARTER_CARDS, cardById, type CardDef } from '../content/cards.schema'
import { RECRUITS } from '../content/recruits'
import type { GameState } from '../core/state'
import { mulberry32 } from '../core/rng'

/**
 * The deck-game economy: the bridge between the pure rules engine and the save
 * state. Ownership, the subject-encountered gate (a card only appears once its
 * subject is genuinely met), the Merchant's rotating stock, opponents, the
 * ladder, and rewards (Lumen always; rare Glyph Stones on the ladder). Pure —
 * no DOM, no THREE — so every rule is testable.
 */

export interface Opponent {
  id: string
  name: string
  deckIds: string[]
  rival: boolean
  /** Lumen paid on a win. */
  lumen: number
  /** Rare Glyph Stones paid on a win (ladder only). */
  stones: number
  /** Card granted the FIRST time you beat this opponent, if any. */
  rewardCardId?: string
  line?: string
}

export const DECK_LIMIT = 8
const SHOP_SIZE = 3
const SHOP_PRICES = [30, 45, 60]
/** Distinct residents you must beat to open the ranked ladder. */
export const LADDER_UNLOCK = 4
/** Non-latent regions are always "encountered" for card purposes — the player
 *  starts among the home isles, and Thornmere is solid-from-boot (traversal-
 *  gated, not manifest-gated), so it has no `regionsManifested` entry. */
const NON_LATENT_REGIONS = new Set(['amberfall', 'waystation', 'thornmere'])

function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  }
  return h >>> 0
}

// --- Ownership ---------------------------------------------------------------

/** Tam's gift: grant the starter cards and set an opening deck (idempotent). */
export function grantStarterDeck(state: GameState): void {
  for (const c of STARTER_CARDS) {
    if (!state.cardsOwned.includes(c.id)) state.cardsOwned.push(c.id)
  }
  if (state.deck.length === 0) {
    state.deck = STARTER_CARDS.slice(0, DECK_LIMIT).map((c) => c.id)
  }
}

export function ownedCards(state: GameState): CardDef[] {
  return state.cardsOwned.map(cardById).filter((c): c is CardDef => c !== undefined)
}

export function deckCards(state: GameState): CardDef[] {
  return state.deck.map(cardById).filter((c): c is CardDef => c !== undefined)
}

/** Replace the deck (must be ⊆ owned and ≤ DECK_LIMIT). */
export function setDeck(state: GameState, ids: string[]): boolean {
  const unique = [...new Set(ids)]
  if (unique.length > DECK_LIMIT) return false
  if (unique.some((id) => !state.cardsOwned.includes(id))) return false
  state.deck = unique
  return true
}

// --- The subject-encountered gate --------------------------------------------

export function isEncountered(state: GameState, card: CardDef): boolean {
  const s = card.subject
  if (s.type === 'enemy') return (state.enemiesFelled[s.enemyId] ?? 0) > 0
  if (s.type === 'recruit') return state.discoveries[s.personId] === 'found'
  // region and landmark both carry a regionId.
  return NON_LATENT_REGIONS.has(s.regionId) || state.regionsManifested.includes(s.regionId)
}

export function encounteredCards(state: GameState): CardDef[] {
  return ALL_CARDS.filter((c) => isEncountered(state, c))
}

// --- The Merchant's booster shelf ---------------------------------------------

/** Three rotating cards from the encountered-and-unowned pool. Deterministic:
 *  the stock only changes as you play matches or find things (no Math.random). */
export function shopStock(state: GameState): CardDef[] {
  const pool = encounteredCards(state).filter((c) => !state.cardsOwned.includes(c.id))
  if (pool.length === 0) return []
  const totalWins = Object.values(state.cardWins).reduce((s, n) => s + n, 0)
  const found = Object.keys(state.discoveries).length
  const rng = mulberry32(hashStr(`shop:${totalWins}:${found}`))
  const a = [...pool]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, SHOP_SIZE)
}

export function shopPrice(index: number): number {
  return SHOP_PRICES[index] ?? SHOP_PRICES[SHOP_PRICES.length - 1]
}

/** Buy a card at a price. Fails if unaffordable or already owned. */
export function buyCard(state: GameState, id: string, price: number): boolean {
  if (state.cardsOwned.includes(id)) return false
  if (state.lumen < price) return false
  if (!cardById(id)) return false
  state.lumen -= price
  state.cardsOwned.push(id)
  return true
}

// --- Opponents & the ladder ---------------------------------------------------

/** A deck of DECK_LIMIT cards. Casual: a seeded spread. Rival: the strongest. */
function buildDeck(seedKey: string, strong: boolean): string[] {
  const pool = [...ALL_CARDS]
  if (strong) {
    pool.sort((a, b) => b.power - a.power)
  } else {
    const rng = mulberry32(hashStr(seedKey))
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
  }
  return pool.slice(0, DECK_LIMIT).map((c) => c.id)
}

function cardForRecruit(personId: string): string | undefined {
  return ALL_CARDS.find((c) => c.subject.type === 'recruit' && c.subject.personId === personId)?.id
}

const RIVALS: Opponent[] = [
  {
    id: 'rival-mora',
    name: 'Mora of the Ninth Lane',
    deckIds: buildDeck('rival-mora', true),
    rival: true,
    lumen: 40,
    stones: 1,
    rewardCardId: 'card-husk-elder',
    line: 'Mora: "You play like someone with something to prove. Good."',
  },
  {
    id: 'rival-kesh',
    name: 'Kesh the Tally-Keeper',
    deckIds: buildDeck('rival-kesh', true),
    rival: true,
    lumen: 45,
    stones: 1,
    rewardCardId: 'card-veilspire',
    line: 'Kesh: "I have counted every card twice. You will still lose."',
  },
  {
    id: 'rival-vesh',
    name: 'Vesh, the Last Table',
    deckIds: buildDeck('rival-vesh', true),
    rival: true,
    lumen: 50,
    stones: 2,
    rewardCardId: 'card-cindervault',
    line: 'Vesh: "Beat me and only the painter himself is left."',
  },
]

const TAM_FINAL: Opponent = {
  id: 'ladder-tam',
  name: 'Tam, the Painted Deck',
  deckIds: buildDeck('ladder-tam', true),
  rival: true,
  lumen: 80,
  stones: 2,
  rewardCardId: 'card-cinder-chorister',
  line: 'Tam: "I painted every card you\'re about to lose to. Sit."',
}

/** The opponents available now: found residents, then the ladder as it opens. */
export function opponents(state: GameState): Opponent[] {
  const casual = RECRUITS.filter(
    (r) => r.role !== 'cardplayer' && state.discoveries[r.personId] === 'found',
  ).map<Opponent>((r) => ({
    id: r.personId,
    name: r.name,
    deckIds: buildDeck(r.personId, false),
    rival: false,
    lumen: 20,
    stones: 0,
    rewardCardId: cardForRecruit(r.personId),
    line: r.homeLine,
  }))

  const list = [...casual]
  const casualBeaten = casual.filter((o) => (state.cardWins[o.id] ?? 0) > 0).length
  if (casualBeaten >= LADDER_UNLOCK) {
    list.push(...RIVALS)
    const rivalsBeaten = RIVALS.filter((o) => (state.cardWins[o.id] ?? 0) > 0).length
    if (rivalsBeaten >= RIVALS.length) list.push(TAM_FINAL)
  }
  return list
}

export interface MatchReward {
  lumen: number
  stones: number
  card?: CardDef
  firstWin: boolean
}

/** Apply a match result to the save. Losses cost nothing (anti-frustration). */
export function recordMatchResult(state: GameState, opp: Opponent, won: boolean): MatchReward {
  if (!won) return { lumen: 0, stones: 0, firstWin: false }
  const firstWin = (state.cardWins[opp.id] ?? 0) === 0
  state.cardWins[opp.id] = (state.cardWins[opp.id] ?? 0) + 1
  state.lumen += opp.lumen
  if (opp.stones > 0) state.glyphStones += opp.stones
  let card: CardDef | undefined
  if (firstWin && opp.rewardCardId) {
    const def = cardById(opp.rewardCardId)
    if (def && !state.cardsOwned.includes(def.id)) {
      state.cardsOwned.push(def.id)
      card = def
    }
  }
  return { lumen: opp.lumen, stones: opp.stones, card, firstWin }
}
