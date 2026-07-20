/**
 * The Deck Game — Phase 2 gameplay, Phase 1 DATA MODEL (v1 §8: "design the
 * data model in Phase 1"). Nothing here is playable yet; the shape exists so
 * every system that should feed the deck game (encounters, recruits,
 * regions) already produces referenceable entities.
 *
 * The four-ingredient contract the implementation must honour:
 *  1. ubiquitous opponents  2. shops as booster packs
 *  3. collection converts to power  4. a ranked ladder with a storyline
 * Winning must pay Lumen and rare Glyph Stones — never only bragging.
 */

/** Cards depict things the player has actually encountered. */
export type CardSubject =
  | { type: 'enemy'; enemyId: string }
  | { type: 'recruit'; personId: string }
  | { type: 'region'; regionId: string }
  | { type: 'landmark'; landmarkKind: string; regionId: string }

export interface CardDef {
  id: string
  name: string
  subject: CardSubject
  /** Lane power — the number that fights. */
  power: number
  /** Play cost (Lumen-flavoured motes at the table, not real Lumen). */
  cost: number
  /** Optional rule text hook, resolved by the (future) rules engine. */
  ability?: 'rally' | 'quiet' | 'echo' | 'bulwark'
  flavor: string
}

/** The starter set: one card per thing the slice already made memorable. */
export const STARTER_CARDS: CardDef[] = [
  {
    id: 'card-husk',
    name: 'Amber Husk',
    subject: { type: 'enemy', enemyId: 'husk' },
    power: 3,
    cost: 1,
    flavor: 'It remembers being a verse about harvest.',
  },
  {
    id: 'card-warden',
    name: 'Pale Warden',
    subject: { type: 'enemy', enemyId: 'warden' },
    power: 4,
    cost: 2,
    ability: 'bulwark',
    flavor: 'It guards a door the song never finished.',
  },
  {
    id: 'card-chorister',
    name: 'Hollow Chorister',
    subject: { type: 'enemy', enemyId: 'chorister' },
    power: 5,
    cost: 3,
    ability: 'quiet',
    flavor: 'Its locks are questions. Answer in kind.',
  },
  {
    id: 'card-iole',
    name: 'Iole the Scribe',
    subject: { type: 'recruit', personId: 'af-person-scribe' },
    power: 2,
    cost: 1,
    ability: 'echo',
    flavor: '"Bring me blank stones — I will teach them to speak."',
  },
  {
    id: 'card-waystation',
    name: 'The Waystation',
    subject: { type: 'region', regionId: 'waystation' },
    power: 1,
    cost: 1,
    ability: 'rally',
    flavor: 'Home gets bigger.',
  },
  {
    id: 'card-amberfall',
    name: 'Amberfall Reach',
    subject: { type: 'region', regionId: 'amberfall' },
    power: 4,
    cost: 2,
    flavor: 'Every terrace keeps one more secret than you found.',
  },
]
