import { boardMargin, legalMoves, play, type MatchState, type Move, type Side } from './rules'

/** Deep clone of the plain-data match state (for move evaluation). */
function clone(state: MatchState): MatchState {
  return {
    lanes: state.lanes.map((l) => ({ p: [...l.p], o: [...l.o] })),
    hands: { p: [...state.hands.p], o: [...state.hands.o] },
    motes: { ...state.motes },
    passed: { ...state.passed },
    turn: state.turn,
    done: state.done,
    laneWins: { ...state.laneWins },
    winner: state.winner,
  }
}

/**
 * A greedy opponent: pick the legal play that maximizes its own board margin;
 * pass only when nothing keeps the margin at least even (or no move is legal).
 * Deterministic given the state (ties resolve to the first-found best move),
 * and guaranteed to terminate — every play consumes a card and motes.
 */
export function chooseMove(state: MatchState, who: Side): Move | null {
  const moves = legalMoves(state, who)
  if (moves.length === 0) return null
  const passValue = boardMargin(state, who)
  let best: Move | null = null
  let bestVal = -Infinity
  for (const m of moves) {
    const c = clone(state)
    play(c, who, m.cardId, m.lane)
    const val = boardMargin(c, who)
    if (val > bestVal) {
      bestVal = val
      best = m
    }
  }
  // Develop the board while it doesn't cost position; otherwise hold.
  return bestVal >= passValue ? best : null
}
