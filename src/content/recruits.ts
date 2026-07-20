/**
 * The six recruitable people of the vertical slice. Each is a `person`-kind
 * discoverable out in Amberfall Reach; finding them sends them home to the
 * Waystation, where their structure appears (hub state derives entirely
 * from `discoveries[personId] === 'found'` — no extra save fields).
 */
export type RecruitRole =
  | 'scribe'
  | 'smith'
  | 'cartographer'
  | 'cook'
  | 'archivist'
  | 'merchant'
  | 'cardplayer'
  | 'angler'

export interface RecruitDef {
  /** Matches the person discoverable id in the region content. */
  personId: string
  role: RecruitRole
  name: string
  /** Cloak accent colour (world figure + hub figure + banner). */
  color: string
  /** Where their structure appears on the Waystation isle (world coords). */
  home: { x: number; z: number; yaw: number }
  foundLine: string
  homeLine: string
}

export const RECRUITS: RecruitDef[] = [
  {
    personId: 'af-person-scribe',
    role: 'scribe',
    name: 'Iole the Scribe',
    color: '#9fd8d0',
    home: { x: -8, z: -138, yaw: 0.8 },
    foundLine: 'Iole: "Glyphs, stones, the unfinished song… I can work with this. Take me home, Surveyor."',
    homeLine: 'Iole: "Bring me blank stones — I will teach them to speak."',
  },
  {
    personId: 'af-person-smith',
    role: 'smith',
    name: 'Bram the Smith',
    color: '#d98e3f',
    home: { x: 8, z: -139, yaw: -0.7 },
    foundLine: 'Bram: "A forge with a view of the mist? Fine. FINE. I\'m coming."',
    homeLine: 'Bram: "That grapple of yours could bite harder. Give me time."',
  },
  {
    personId: 'af-person-cartographer',
    role: 'cartographer',
    name: 'Wren the Cartographer',
    color: '#8ab8e0',
    home: { x: -13, z: -129, yaw: 1.6 },
    foundLine: 'Wren: "You walk without a map?! Unacceptable. I\'m fixing this."',
    homeLine: 'Wren: "Every ? on your map is a promise. Keep them."',
  },
  {
    personId: 'af-person-cook',
    role: 'cook',
    name: 'Marou the Cook',
    color: '#c96f4a',
    home: { x: 13, z: -130, yaw: -1.5 },
    foundLine: 'Marou: "You look underfed and over-walked. Come, my kitchen travels."',
    homeLine: 'Marou: "Sit. Eat. The world will still be unfinished after supper."',
  },
  {
    personId: 'af-person-archivist',
    role: 'archivist',
    name: 'Fen the Archivist',
    color: '#a65f8a',
    home: { x: -3, z: -144, yaw: 0.2 },
    foundLine: 'Fen: "Every found thing wants remembering. I will keep your ledger."',
    homeLine: 'Fen: "The ledger grows. The blank pages itch."',
  },
  {
    personId: 'af-person-merchant',
    role: 'merchant',
    name: 'Sel of the Scales',
    color: '#e0c26e',
    home: { x: 3, z: -126, yaw: 3.1 },
    foundLine: 'Sel: "A settlement with no shop is a rumour, not a town. Lead on."',
    homeLine: 'Sel: "Lumen spends, Surveyor. Everything else is decoration."',
  },
  {
    personId: 'cv-person-cardplayer',
    role: 'cardplayer',
    name: 'Tam of the Painted Deck',
    color: '#c65a3f',
    home: { x: -16, z: -140, yaw: 0.6 },
    foundLine: 'Tam: "You’ve met half the world and never PLAYED it? Come — I deal you in."',
    homeLine: 'Tam: "Every creature you’ve faced is a card waiting to be painted. Sit."',
  },
  {
    personId: 'vs-person-angler',
    role: 'angler',
    name: 'Nerei the Angler',
    color: '#5aa0c6',
    home: { x: 16, z: -142, yaw: -0.6 },
    foundLine: 'Nerei: "The mist has fish, if you’ve the patience. I’ll teach you the cast."',
    homeLine: 'Nerei: "Land enough from the mist and I’ll show you a trick worth keeping."',
  },
]
