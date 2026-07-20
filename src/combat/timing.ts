/**
 * Pure timing-window math. All times are seconds on the encounter's own
 * clock (advanced by fixed sim steps — deterministic under QA stepping).
 */

export type BeatJudgement = 'hit' | 'early' | 'late' | 'pending'

/**
 * Judge a press against a beat time. 'pending' = too early to matter yet
 * (not consumed); 'early'/'late' = a miss that consumes the beat.
 */
const EPS = 1e-9 // inclusive boundaries must survive float subtraction

export function judgePress(
  pressT: number,
  beatT: number,
  window: number,
  graceEarly = 0.35,
): BeatJudgement {
  const d = pressT - beatT
  if (Math.abs(d) <= window + EPS) return 'hit'
  if (d < -window) {
    return d < -window - graceEarly ? 'pending' : 'early'
  }
  return 'late'
}

/** Has the beat passed beyond any chance of a hit? */
export function beatExpired(nowT: number, beatT: number, window: number): boolean {
  return nowT > beatT + window
}

/** Is `nowT` inside the live window around a beat? (UI highlight) */
export function inWindow(nowT: number, beatT: number, window: number): boolean {
  return Math.abs(nowT - beatT) <= window
}
