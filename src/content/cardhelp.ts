/**
 * The Painted Table's rules card (M27) — the deck game explained NOWHERE else.
 * Wording derived from the pure engine in `src/cards/rules.ts`, not memory:
 *  - goal / lanes / winner: `scoreMatch` (majority of 3 lanes)
 *  - hand + motes: HAND_SIZE 5, MOTE_BUDGET 10, per-card `cost`
 *  - turn / pass: `play`/`pass` (two passes in a row → score)
 *  - abilities (pinned order quiet→echo→rally→bulwark): `laneTotal`
 *
 * The ability-coverage test pins that every ability keyword in the card schema
 * is described here, so a new ability can't ship undocumented.
 */
export const CARD_RULES: string[] = [
  'Goal: win 2 of the 3 lanes — the higher card total in a lane takes it.',
  'Each match you draw 5 cards and hold 10 motes (◇); every card costs motes to play.',
  'On your turn, play one affordable card into any lane — or pass. Two passes in a row end and score the match.',
  'Quiet — silences every OPPOSING ability in its lane.',
  'Echo — gains +1 for each other friendly card sharing its lane.',
  'Rally — lends +1 to the lane for each other friendly card.',
  'Bulwark — +2 while the enemy leads that lane on raw power (a defender’s comeback).',
  'Lose and you keep everything — sit again whenever you like.',
]
