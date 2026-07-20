import type { CardDef } from '../content/cards.schema'
import type { Rng } from '../core/rng'

/**
 * The Deck Game (v1 §8) — a compact three-lane card game. This module is the
 * PURE rules engine: no DOM, no THREE, all randomness injected. The UI drives
 * it; the AI (ai.ts) picks moves through the same legal-move surface a player
 * would use.
 *
 * A card's `ability` resolves in a PINNED order at scoring (pinned by a test —
 * it's the kind of ordering that silently regresses when someone appends a new
 * ability): quiet → echo → rally → bulwark.
 */

export type Side = 'p' | 'o'
export const LANES = 3
export const HAND_SIZE = 5
export const MOTE_BUDGET = 10

export interface MatchCard {
  id: string
  power: number
  cost: number
  ability?: CardDef['ability']
}

interface LaneCards {
  p: MatchCard[]
  o: MatchCard[]
}

export interface MatchState {
  lanes: LaneCards[]
  hands: { p: MatchCard[]; o: MatchCard[] }
  motes: { p: number; o: number }
  passed: { p: boolean; o: boolean }
  turn: Side
  done: boolean
  /** Lanes each side won, once scored. */
  laneWins: { p: number; o: number }
  winner: Side | 'draw' | null
}

function toMatchCard(def: CardDef): MatchCard {
  return { id: def.id, power: def.power, cost: def.cost, ability: def.ability }
}

/** Fisher–Yates using the injected rng (so a seed reproduces a match). */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Deal a fresh match from two decks. Player 'p' moves first. */
export function createMatch(playerDeck: CardDef[], oppDeck: CardDef[], rng: Rng): MatchState {
  const draw = (deck: CardDef[]) => shuffle(deck, rng).slice(0, HAND_SIZE).map(toMatchCard)
  return {
    lanes: Array.from({ length: LANES }, () => ({ p: [], o: [] })),
    hands: { p: draw(playerDeck), o: draw(oppDeck) },
    motes: { p: MOTE_BUDGET, o: MOTE_BUDGET },
    passed: { p: false, o: false },
    turn: 'p',
    done: false,
    laneWins: { p: 0, o: 0 },
    winner: null,
  }
}

export interface Move {
  cardId: string
  lane: number
}

/** Every legal play for a side: an affordable card into any lane. */
export function legalMoves(state: MatchState, who: Side): Move[] {
  if (state.done) return []
  const moves: Move[] = []
  for (const card of state.hands[who]) {
    if (card.cost > state.motes[who]) continue
    for (let lane = 0; lane < LANES; lane++) {
      moves.push({ cardId: card.id, lane })
    }
  }
  return moves
}

function other(who: Side): Side {
  return who === 'p' ? 'o' : 'p'
}

/**
 * Lane total for `mine` against `theirs`, abilities resolved in pinned order.
 *  1. quiet  — if theirs holds a 'quiet' card, mine's abilities are silenced
 *  2. echo   — +1 for each OTHER card on my side in this lane, per echo card
 *  3. rally  — +1 to each OTHER friendly card, per rally card (same lane total)
 *  4. bulwark— +2 per bulwark card IF the opposing RAW power total is higher
 */
export function laneTotal(mine: MatchCard[], theirs: MatchCard[]): number {
  const myRaw = mine.reduce((s, c) => s + c.power, 0)
  const theirRaw = theirs.reduce((s, c) => s + c.power, 0)
  let total = myRaw
  const silenced = theirs.some((c) => c.ability === 'quiet') // (1) quiet first
  if (silenced) return total
  const others = Math.max(0, mine.length - 1)
  const echoCount = mine.filter((c) => c.ability === 'echo').length
  const rallyCount = mine.filter((c) => c.ability === 'rally').length
  const bulwarkCount = mine.filter((c) => c.ability === 'bulwark').length
  total += echoCount * others // (2) echo
  total += rallyCount * others // (3) rally
  if (theirRaw > myRaw) total += bulwarkCount * 2 // (4) bulwark
  return total
}

/** Board margin (my totals − their totals across lanes) for a side. */
export function boardMargin(state: MatchState, who: Side): number {
  const opp = other(who)
  let margin = 0
  for (const lane of state.lanes) {
    margin += laneTotal(lane[who], lane[opp]) - laneTotal(lane[opp], lane[who])
  }
  return margin
}

/** Play a card into a lane. Returns false if the move is illegal. */
export function play(state: MatchState, who: Side, cardId: string, lane: number): boolean {
  if (state.done || state.turn !== who) return false
  if (lane < 0 || lane >= LANES) return false
  const idx = state.hands[who].findIndex((c) => c.id === cardId)
  if (idx < 0) return false
  const card = state.hands[who][idx]
  if (card.cost > state.motes[who]) return false
  state.hands[who].splice(idx, 1)
  state.lanes[lane][who].push(card)
  state.motes[who] -= card.cost
  state.passed[who] = false
  state.passed[other(who)] = false // a play re-opens the other player's option
  state.turn = other(who)
  return true
}

/** Pass the turn. Two passes in a row end and score the match. */
export function pass(state: MatchState, who: Side): void {
  if (state.done || state.turn !== who) return
  state.passed[who] = true
  if (state.passed[other(who)]) {
    scoreMatch(state)
    return
  }
  state.turn = other(who)
}

/** Score all lanes and set the winner (majority of lanes). */
export function scoreMatch(state: MatchState): void {
  let p = 0
  let o = 0
  for (const lane of state.lanes) {
    const pt = laneTotal(lane.p, lane.o)
    const ot = laneTotal(lane.o, lane.p)
    if (pt > ot) p++
    else if (ot > pt) o++
  }
  state.laneWins = { p, o }
  state.winner = p > o ? 'p' : o > p ? 'o' : 'draw'
  state.done = true
}
