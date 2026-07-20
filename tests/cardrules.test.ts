import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../src/core/rng'
import type { CardDef } from '../src/content/cards.schema'
import { ALL_CARDS } from '../src/content/cards.schema'
import {
  HAND_SIZE,
  MOTE_BUDGET,
  createMatch,
  laneTotal,
  legalMoves,
  pass,
  play,
  scoreMatch,
  type MatchCard,
} from '../src/cards/rules'
import { chooseMove } from '../src/cards/ai'

function card(id: string, power: number, ability?: CardDef['ability']): MatchCard {
  return { id, power, cost: 1, ability }
}

describe('laneTotal — pinned ability order', () => {
  it('sums raw power with no abilities', () => {
    expect(laneTotal([card('a', 3), card('b', 2)], [])).toBe(5)
  })

  it('echo adds +1 per other friendly card', () => {
    // two cards, one echo → +1 (one "other")
    expect(laneTotal([card('a', 2, 'echo'), card('b', 2)], [])).toBe(5)
    // three cards, one echo → +2
    expect(laneTotal([card('a', 2, 'echo'), card('b', 2), card('c', 1)], [])).toBe(7)
  })

  it('rally adds +1 to each other friendly card (same lane total)', () => {
    expect(laneTotal([card('a', 2, 'rally'), card('b', 2), card('c', 1)], [])).toBe(7)
  })

  it('bulwark adds +2 only when the opposing raw total is higher', () => {
    // opposing raw 6 > mine 4 → +2
    expect(laneTotal([card('a', 4, 'bulwark')], [card('x', 6)])).toBe(6)
    // opposing raw 2 < mine 4 → no bonus
    expect(laneTotal([card('a', 4, 'bulwark')], [card('x', 2)])).toBe(4)
  })

  it('quiet silences the OPPOSING side — resolved before echo/rally/bulwark', () => {
    const mine = [card('a', 2, 'echo'), card('b', 2, 'rally')]
    // Without quiet: 4 raw + echo(+1) + rally(+1) = 6.
    expect(laneTotal(mine, [])).toBe(6)
    // Opponent plays quiet → my abilities are silenced → just raw 4.
    expect(laneTotal(mine, [card('q', 1, 'quiet')])).toBe(4)
  })

  it('order matters: quiet must precede bulwark (else the total differs)', () => {
    // My bulwark would trigger (their raw 5 > my raw 3) for +2 → 5.
    // But their card is quiet, so my bulwark is silenced → my total is 3.
    // If bulwark were applied before quiet, this would wrongly be 5.
    const mine = [card('a', 3, 'bulwark')]
    const theirs = [card('q', 5, 'quiet')]
    expect(laneTotal(mine, theirs)).toBe(3)
  })
})

describe('match flow', () => {
  const deck = ALL_CARDS.slice(0, 10)

  it('deals HAND_SIZE cards and full motes to each side', () => {
    const s = createMatch(deck, deck, mulberry32(1))
    expect(s.hands.p).toHaveLength(HAND_SIZE)
    expect(s.hands.o).toHaveLength(HAND_SIZE)
    expect(s.motes.p).toBe(MOTE_BUDGET)
    expect(s.turn).toBe('p')
  })

  it('rejects illegal plays (wrong turn, unaffordable, unknown card)', () => {
    const s = createMatch(deck, deck, mulberry32(2))
    expect(play(s, 'o', s.hands.o[0].id, 0)).toBe(false) // not o's turn
    expect(play(s, 'p', 'no-such-card', 0)).toBe(false)
    const dear = { ...s.hands.p[0], cost: 99 }
    s.hands.p[0] = dear
    expect(play(s, 'p', dear.id, 0)).toBe(false) // can't afford
  })

  it('a legal play moves the card, spends motes, and passes the turn', () => {
    const s = createMatch(deck, deck, mulberry32(3))
    const c = s.hands.p[0]
    expect(play(s, 'p', c.id, 1)).toBe(true)
    expect(s.lanes[1].p.map((x) => x.id)).toContain(c.id)
    expect(s.motes.p).toBe(MOTE_BUDGET - c.cost)
    expect(s.turn).toBe('o')
    expect(s.hands.p.find((x) => x.id === c.id)).toBeUndefined()
  })

  it('two passes in a row end and score the match', () => {
    const s = createMatch(deck, deck, mulberry32(4))
    pass(s, 'p')
    expect(s.done).toBe(false)
    pass(s, 'o')
    expect(s.done).toBe(true)
    expect(['p', 'o', 'draw']).toContain(s.winner)
  })

  it('the higher lane in more lanes wins', () => {
    const s = createMatch([], [], mulberry32(5))
    s.lanes[0].p.push(card('a', 5))
    s.lanes[1].p.push(card('b', 5))
    s.lanes[2].o.push(card('c', 9))
    scoreMatch(s)
    expect(s.laneWins).toEqual({ p: 2, o: 1 })
    expect(s.winner).toBe('p')
  })
})

describe('AI opponent', () => {
  it('only ever returns legal moves', () => {
    const s = createMatch(ALL_CARDS.slice(0, 8), ALL_CARDS.slice(4, 12), mulberry32(7))
    // Hand the turn to the opponent.
    pass(s, 'p')
    const move = chooseMove(s, 'o')
    if (move !== null) {
      const legal = legalMoves(s, 'o').some(
        (m) => m.cardId === move.cardId && m.lane === move.lane,
      )
      expect(legal).toBe(true)
    }
  })

  it('a full self-play match terminates with a valid winner', () => {
    const s = createMatch(ALL_CARDS.slice(0, 9), ALL_CARDS.slice(6, 15), mulberry32(11))
    let guard = 0
    while (!s.done && guard++ < 200) {
      const move = chooseMove(s, s.turn)
      if (move === null) pass(s, s.turn)
      else play(s, s.turn, move.cardId, move.lane)
    }
    expect(s.done).toBe(true)
    expect(['p', 'o', 'draw']).toContain(s.winner)
    // No motes overspent.
    expect(s.motes.p).toBeGreaterThanOrEqual(0)
    expect(s.motes.o).toBeGreaterThanOrEqual(0)
  })
})
