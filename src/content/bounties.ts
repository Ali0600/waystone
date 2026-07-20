import type { VerbId } from '../progression/mastery'

/**
 * The Reward Board (v1 `M072`): posted bounties that pay when their condition is
 * met and claimed — a completion engine spanning every system. DATA only; the
 * pure evaluator lives in `src/progression/bounties.ts`.
 */

export type BountyCheck =
  | { kind: 'region-complete'; regionId: string }
  | { kind: 'felled'; enemyId: string; count: number }
  | { kind: 'angling-points'; points: number }
  | { kind: 'card-wins'; count: number }
  | { kind: 'mastery'; verb: VerbId; tier: 1 | 2 | 3 }
  | { kind: 'arts'; count: number }
  | { kind: 'regions-manifested'; count: number }

export interface BountyReward {
  lumen: number
  glyphStones?: number
  cardId?: string
}

export interface BountyDef {
  id: string
  title: string
  flavor: string
  check: BountyCheck
  reward: BountyReward
}

export const BOUNTIES: BountyDef[] = [
  {
    id: 'bnt-amberfall-whole',
    title: 'Amberfall, Entire',
    flavor: 'Fen: "Leave no terrace of the Reach unheard."',
    check: { kind: 'region-complete', regionId: 'amberfall' },
    reward: { lumen: 45 },
  },
  {
    id: 'bnt-veilspire-whole',
    title: 'The Drowned Court, Emptied',
    flavor: 'Fen: "The Shallows keep more than one secret. Find them all."',
    check: { kind: 'region-complete', regionId: 'veilspire' },
    reward: { lumen: 55, glyphStones: 1 },
  },
  {
    id: 'bnt-fell-cinder',
    title: 'Silence the Cinder',
    flavor: 'A three-lock dirge deserves an answer.',
    check: { kind: 'felled', enemyId: 'cinder-chorister', count: 1 },
    reward: { lumen: 30 },
  },
  {
    id: 'bnt-fell-thorn',
    title: 'Clear the Deep',
    flavor: 'Twice the Thorn Husk falls, twice the mere quiets.',
    check: { kind: 'felled', enemyId: 'thorn-husk', count: 2 },
    reward: { lumen: 40, glyphStones: 1 },
  },
  {
    id: 'bnt-angler-30',
    title: 'A Patient Line',
    flavor: 'Nerei: "Thirty points from the mist. Then we talk."',
    check: { kind: 'angling-points', points: 30 },
    reward: { lumen: 35, cardId: 'card-nerei' },
  },
  {
    id: 'bnt-card-champ',
    title: 'The Painted Ladder',
    flavor: 'Tam: "Five wins at the table and I paint you a card of your own."',
    check: { kind: 'card-wins', count: 5 },
    reward: { lumen: 40, cardId: 'card-tam' },
  },
  {
    id: 'bnt-strike-master',
    title: 'The Strike, Mastered',
    flavor: 'Bram: "Use a thing enough and it becomes yours."',
    check: { kind: 'mastery', verb: 'strike', tier: 3 },
    reward: { lumen: 50 },
  },
  {
    id: 'bnt-grapple-master',
    title: 'The Grapple, Mastered',
    flavor: 'Reach for what the map says you cannot.',
    check: { kind: 'mastery', verb: 'grapple', tier: 3 },
    reward: { lumen: 40 },
  },
  {
    id: 'bnt-two-arts',
    title: 'Undocumented',
    flavor: 'Fen: "Some knowledge is written nowhere. Bring me two such."',
    check: { kind: 'arts', count: 2 },
    reward: { lumen: 30, glyphStones: 1 },
  },
  {
    id: 'bnt-three-isles',
    title: 'The Song Remembers',
    flavor: 'Wake three sleeping isles from the mist.',
    check: { kind: 'regions-manifested', count: 3 },
    reward: { lumen: 60, glyphStones: 2 },
  },
]
