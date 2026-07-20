/**
 * The Deck Game — data model + card library (v1 §8). The rules engine lives in
 * `src/cards/rules.ts`; this file is DATA. Every card depicts something the
 * player can actually encounter, so the collection is a record of exploration
 * (the four-ingredient contract: ubiquitous opponents, shops as booster packs,
 * collection converts to power, a ranked ladder). Winning pays Lumen and rare
 * Glyph Stones — never only bragging.
 */

/** Cards depict things the player has actually encountered. */
export type CardSubject =
  | { type: 'enemy'; enemyId: string }
  | { type: 'recruit'; personId: string }
  | { type: 'region'; regionId: string }
  | { type: 'landmark'; landmarkKind: string; regionId: string }

export type CardAbility = 'rally' | 'quiet' | 'echo' | 'bulwark'

export interface CardDef {
  id: string
  name: string
  subject: CardSubject
  /** Lane power — the number that fights. */
  power: number
  /** Play cost (mote-flavoured, not real Lumen). */
  cost: number
  /** Rule hook resolved by the rules engine at scoring. */
  ability?: CardAbility
  flavor: string
}

/**
 * The full library. One card per enemy, recruit, and region in the game, plus
 * a handful of landmarks — the content-invariant test enforces that coverage.
 */
export const ALL_CARDS: CardDef[] = [
  // --- Enemies ---
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
    id: 'card-husk-elder',
    name: 'Elder Husk',
    subject: { type: 'enemy', enemyId: 'husk-elder' },
    power: 6,
    cost: 3,
    ability: 'bulwark',
    flavor: 'Older than the harvest it forgot.',
  },
  {
    id: 'card-cinder-chorister',
    name: 'Cinder Chorister',
    subject: { type: 'enemy', enemyId: 'cinder-chorister' },
    power: 7,
    cost: 4,
    ability: 'quiet',
    flavor: 'Three locks, one dirge, no mercy.',
  },
  {
    id: 'card-mist-warden',
    name: 'Mist Warden',
    subject: { type: 'enemy', enemyId: 'mist-warden' },
    power: 5,
    cost: 3,
    ability: 'bulwark',
    flavor: 'Two bolts from the pale dawn — reflect both.',
  },
  // --- Recruits ---
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
    id: 'card-bram',
    name: 'Bram the Smith',
    subject: { type: 'recruit', personId: 'af-person-smith' },
    power: 3,
    cost: 2,
    ability: 'bulwark',
    flavor: '"A forge with a view of the mist. Fine."',
  },
  {
    id: 'card-wren',
    name: 'Wren the Cartographer',
    subject: { type: 'recruit', personId: 'af-person-cartographer' },
    power: 2,
    cost: 1,
    ability: 'echo',
    flavor: 'Every ? on the map is a promise.',
  },
  {
    id: 'card-marou',
    name: 'Marou the Cook',
    subject: { type: 'recruit', personId: 'af-person-cook' },
    power: 2,
    cost: 1,
    ability: 'rally',
    flavor: '"Sit. Eat. The world will still be unfinished after supper."',
  },
  {
    id: 'card-fen',
    name: 'Fen the Archivist',
    subject: { type: 'recruit', personId: 'af-person-archivist' },
    power: 1,
    cost: 1,
    ability: 'echo',
    flavor: 'The ledger grows. The blank pages itch.',
  },
  {
    id: 'card-sel',
    name: 'Sel of the Scales',
    subject: { type: 'recruit', personId: 'af-person-merchant' },
    power: 3,
    cost: 2,
    ability: 'rally',
    flavor: '"Lumen spends. Everything else is decoration."',
  },
  {
    id: 'card-tam',
    name: 'Tam of the Painted Deck',
    subject: { type: 'recruit', personId: 'cv-person-cardplayer' },
    power: 4,
    cost: 2,
    ability: 'rally',
    flavor: 'Every creature you faced is a card waiting to be painted.',
  },
  {
    id: 'card-nerei',
    name: 'Nerei the Angler',
    subject: { type: 'recruit', personId: 'vs-person-angler' },
    power: 3,
    cost: 2,
    ability: 'echo',
    flavor: 'The mist has fish, if you have the patience.',
  },
  // --- Regions ---
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
  {
    id: 'card-veilspire',
    name: 'Veilspire Shallows',
    subject: { type: 'region', regionId: 'veilspire' },
    power: 5,
    cost: 3,
    ability: 'quiet',
    flavor: 'A drowned court, humming under the teal dusk.',
  },
  {
    id: 'card-cindervault',
    name: 'Cindervault Rise',
    subject: { type: 'region', regionId: 'cindervault' },
    power: 6,
    cost: 3,
    ability: 'bulwark',
    flavor: 'Banked coals under a violet night.',
  },
  {
    id: 'card-palegrove',
    name: 'Palegrove Choir',
    subject: { type: 'region', regionId: 'palegrove' },
    power: 6,
    cost: 3,
    ability: 'echo',
    flavor: 'A bone-pale dawn, drowned in mist.',
  },
  // --- Landmarks ---
  {
    id: 'card-spire',
    name: 'The Broken Spire',
    subject: { type: 'landmark', landmarkKind: 'spire', regionId: 'amberfall' },
    power: 2,
    cost: 1,
    ability: 'echo',
    flavor: 'It still points the way it fell.',
  },
  {
    id: 'card-arch',
    name: 'The Ruined Arch',
    subject: { type: 'landmark', landmarkKind: 'arch', regionId: 'waystation' },
    power: 2,
    cost: 1,
    ability: 'rally',
    flavor: 'Where home begins.',
  },
  {
    id: 'card-socket',
    name: 'The Dormant Socket',
    subject: { type: 'landmark', landmarkKind: 'socket', regionId: 'amberfall' },
    power: 1,
    cost: 1,
    ability: 'echo',
    flavor: 'It waits for a Waystone the way a lock waits for a key.',
  },
  {
    id: 'card-standing-stones',
    name: 'The Standing Stones',
    subject: { type: 'landmark', landmarkKind: 'stone', regionId: 'amberfall' },
    power: 3,
    cost: 2,
    flavor: 'They whisper of something unseen.',
  },
  {
    id: 'card-drowned-court',
    name: 'The Drowned Court',
    subject: { type: 'landmark', landmarkKind: 'stone', regionId: 'veilspire' },
    power: 4,
    cost: 2,
    ability: 'bulwark',
    flavor: 'The tide keeps its counsel.',
  },
]

/** Tam's gift: the eight cards a new player starts the deck game with. */
const STARTER_IDS = [
  'card-husk',
  'card-warden',
  'card-iole',
  'card-marou',
  'card-fen',
  'card-waystation',
  'card-amberfall',
  'card-arch',
]

export const STARTER_CARDS: CardDef[] = STARTER_IDS.map(
  (id) => ALL_CARDS.find((c) => c.id === id)!,
)

/** Look up a card by id (for rehydrating owned/deck id lists from a save). */
export function cardById(id: string): CardDef | undefined {
  return ALL_CARDS.find((c) => c.id === id)
}
