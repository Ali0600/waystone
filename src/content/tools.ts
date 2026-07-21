/**
 * The Surveyor's tools — the single source of truth for their names, world
 * keys, and what they do. The Lantern is innate; the other five are found in
 * the world (each pays a `tool-<id>` meter — see DiscoverySystem.interact).
 *
 * `desc` doubles as the acquisition-toast line and the Inventory/Ledger blurb,
 * so it reads as a one-line "how to use it" instruction.
 */
export type ToolId =
  | 'lantern'
  | 'grapple'
  | 'sounding'
  | 'chime'
  | 'mistwalker'
  | 'ferry'

export interface ToolInfo {
  id: ToolId
  name: string
  /** The world key that wields it, or null for passive/innate tools. */
  key: string | null
  desc: string
}

export const TOOL_INFO: Record<ToolId, ToolInfo> = {
  lantern: {
    id: 'lantern',
    name: 'The Lantern',
    key: 'F',
    desc: 'Pulse it (F) to reveal latent ground and solidify ghost walkways.',
  },
  grapple: {
    id: 'grapple',
    name: 'The Surveyor’s Grapple',
    key: 'Q',
    desc: 'Aim at a crystal pylon — or a prowling foe — and press Q to pull yourself across.',
  },
  sounding: {
    id: 'sounding',
    name: 'The Sounding Rod',
    key: 'T',
    desc: 'Press T; the buried world answers in pitch.',
  },
  chime: {
    id: 'chime',
    name: 'The Resonant Chime',
    key: 'C',
    desc: 'Press C to ring sealed stone open.',
  },
  mistwalker: {
    id: 'mistwalker',
    name: 'The Mistwalker',
    key: null,
    desc: 'The mist sea holds your weight, while the charge lasts.',
  },
  ferry: {
    id: 'ferry',
    name: 'The Ferryman’s Bell',
    key: 'E',
    desc: 'Ring it at any mooring (E) to sail between the isles.',
  },
}

export const TOOL_IDS: readonly ToolId[] = [
  'lantern',
  'grapple',
  'sounding',
  'chime',
  'mistwalker',
  'ferry',
]

/**
 * The five acquirable tools (the Lantern is innate). These are EXACTLY the keys
 * of `GameState.tools`, and each maps to a `tool-<id>` payout meter — the
 * `tools.test.ts` invariant pins that correspondence so a new tool can't be
 * added to the save without appearing here.
 */
export const ACQUIRABLE_TOOL_IDS = [
  'grapple',
  'sounding',
  'chime',
  'mistwalker',
  'ferry',
] as const

export type AcquirableToolId = (typeof ACQUIRABLE_TOOL_IDS)[number]
