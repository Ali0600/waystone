/**
 * The single serializable game state — the spine every system reads and
 * writes. Everything here must survive JSON round-tripping (no class
 * instances, no THREE objects, no functions).
 */

/** unseen (absent) → pinned (seen but locked) → found. 'revealed' marks a
 *  latent discoverable made solid by the Lantern but not yet collected. */
export type DiscoveryStatus = 'pinned' | 'revealed' | 'found'

export interface MasteryCounters {
  strike: number
  parry: number
  dash: number
  grapple: number
  lantern: number
}

export type GlyphSlot =
  | 'ember'
  | 'gale'
  | 'stone'
  | 'tide'
  | 'light'
  | 'shade'
  | null

export interface GameState {
  version: 13
  regionId: string
  playerPos: [number, number, number]
  /** Global upgrade currency. */
  lumen: number
  /** Blank Glyph Stones — finite, found only in the world. */
  glyphStones: number
  discoveries: Record<string, DiscoveryStatus>
  /** Use-based mastery counters (tiers derive from thresholds). */
  mastery: MasteryCounters
  /** World tools owned (the lantern is innate). */
  tools: { grapple: boolean; sounding: boolean; chime: boolean; mistwalker: boolean; ferry: boolean }
  /** Latent paths made solid by the lantern (region content ids). */
  pathsRevealed: string[]
  /** The 4×4 Glyph Grid, row-major. Inscription is permanent-ish. */
  glyphGrid: GlyphSlot[]
  /** Per-glyph use counters (each authored glyph levels with use). */
  glyphUses: Record<Exclude<GlyphSlot, null>, number>
  /** Per-chain use counters (each Chain levels with use). */
  chainUses: Record<string, number>
  /** Hidden Arts performed at least once — permanently known. */
  artsUnlocked: string[]
  /** Guarded discoverables whose guardian has fallen (id = discoverable). */
  guardiansDefeated: string[]
  /** Waystones held — plant one at a socket to manifest a latent region. */
  waystones: number
  /** Latent regions completed by a planted waystone. */
  regionsManifested: string[]
  /** Fish landed from the mist, by species id (consumed by the Cook). */
  fishHeld: Record<string, number>
  /** Cumulative angling points — unlock the Angler's technique at a threshold. */
  anglingPoints: number
  /** A cooked meal buff waiting to be spent on the next encounter. */
  pendingMeal: string | null
  /** Deck-game cards owned (ids into the card library). */
  cardsOwned: string[]
  /** The chosen deck (subset of cardsOwned, ≤ 8). */
  deck: string[]
  /** Deck-game wins by opponent id (drives the ladder + first-win rewards). */
  cardWins: Record<string, number>
  /** Enemies defeated in the world, by id — gates which cards can appear. */
  enemiesFelled: Record<string, number>
  /** Reward-board bounty ids already claimed (paid once). */
  bountiesClaimed: string[]
}

export const SPAWN_REGION = 'amberfall'

export function createInitialState(): GameState {
  return {
    version: 13,
    regionId: SPAWN_REGION,
    // Placeholder until the first save; a fresh boot always uses the
    // region's authored spawn point (see SaveSystem.isFresh).
    playerPos: [0, 0, 0],
    lumen: 0,
    glyphStones: 0,
    discoveries: {},
    mastery: { strike: 0, parry: 0, dash: 0, grapple: 0, lantern: 0 },
    tools: { grapple: false, sounding: false, chime: false, mistwalker: false, ferry: false },
    pathsRevealed: [],
    glyphGrid: Array<GlyphSlot>(16).fill(null),
    glyphUses: { ember: 0, gale: 0, stone: 0, tide: 0, light: 0, shade: 0 },
    chainUses: {},
    artsUnlocked: [],
    guardiansDefeated: [],
    waystones: 0,
    regionsManifested: [],
    fishHeld: {},
    anglingPoints: 0,
    pendingMeal: null,
    cardsOwned: [],
    deck: [],
    cardWins: {},
    enemiesFelled: {},
    bountiesClaimed: [],
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every(isFiniteNumber)
}

const DISCOVERY_STATUSES: readonly string[] = ['pinned', 'revealed', 'found']

function parseDiscoveries(v: unknown): Record<string, DiscoveryStatus> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const out: Record<string, DiscoveryStatus> = {}
  for (const [key, val] of Object.entries(v)) {
    if (typeof val !== 'string' || !DISCOVERY_STATUSES.includes(val)) return null
    out[key] = val as DiscoveryStatus
  }
  return out
}

/**
 * Structural validation for anything loaded from storage or user import.
 * Returns null for anything malformed — callers fall back to a fresh state.
 * Older versions are migrated forward. Never trust persisted bytes.
 */
export function parseGameState(json: string): GameState | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>

  // v1 → v2: discovery economy fields did not exist yet.
  if (o.version === 1) {
    o.version = 2
    o.glyphStones = 0
    o.discoveries = {}
  }
  // v2 → v3: mastery, tools, latent paths.
  if (o.version === 2) {
    o.version = 3
    o.mastery = { strike: 0, parry: 0, dash: 0, grapple: 0, lantern: 0 }
    o.tools = { grapple: false }
    o.pathsRevealed = []
  }
  // v3 → v4: the Glyph Grid.
  if (o.version === 3) {
    o.version = 4
    o.glyphGrid = Array(16).fill(null)
    o.glyphUses = { ember: 0, gale: 0, stone: 0, tide: 0, light: 0, shade: 0 }
  }
  // v4 → v5: combat (chains, hidden arts, guardians).
  if (o.version === 4) {
    o.version = 5
    o.chainUses = {}
    o.artsUnlocked = []
    o.guardiansDefeated = []
  }
  // v5 → v6: waystones and latent regions.
  if (o.version === 5) {
    o.version = 6
    o.waystones = 0
    o.regionsManifested = []
  }
  // v6 → v7: the Sounding Rod.
  if (o.version === 6) {
    o.version = 7
    ;(o.tools as Record<string, unknown>).sounding = false
  }
  // v7 → v8: the Chime.
  if (o.version === 7) {
    o.version = 8
    ;(o.tools as Record<string, unknown>).chime = false
  }
  // v8 → v9: mist-angling (fish, points, cooked meal).
  if (o.version === 8) {
    o.version = 9
    o.fishHeld = {}
    o.anglingPoints = 0
    o.pendingMeal = null
  }
  // v9 → v10: the deck game (owned cards, deck, wins, felled enemies).
  if (o.version === 9) {
    o.version = 10
    o.cardsOwned = []
    o.deck = []
    o.cardWins = {}
    o.enemiesFelled = {}
  }
  // v10 → v11: the Mistwalker.
  if (o.version === 10) {
    o.version = 11
    ;(o.tools as Record<string, unknown>).mistwalker = false
  }
  // v11 → v12: the Ferry.
  if (o.version === 11) {
    o.version = 12
    ;(o.tools as Record<string, unknown>).ferry = false
  }
  // v12 → v13: the Reward Board.
  if (o.version === 12) {
    o.version = 13
    o.bountiesClaimed = []
  }

  if (o.version !== 13) return null
  if (typeof o.regionId !== 'string' || o.regionId.length === 0) return null
  if (!isVec3(o.playerPos)) return null
  if (!isFiniteNumber(o.lumen) || o.lumen < 0) return null
  if (!isFiniteNumber(o.glyphStones) || o.glyphStones < 0) return null
  const discoveries = parseDiscoveries(o.discoveries)
  if (discoveries === null) return null

  const m = o.mastery as Record<string, unknown> | null
  if (typeof m !== 'object' || m === null) return null
  const verbs = ['strike', 'parry', 'dash', 'grapple', 'lantern'] as const
  for (const v of verbs) {
    if (!isFiniteNumber(m[v]) || (m[v] as number) < 0) return null
  }

  const tools = o.tools as Record<string, unknown> | null
  if (typeof tools !== 'object' || tools === null) return null
  if (
    typeof tools.grapple !== 'boolean' ||
    typeof tools.sounding !== 'boolean' ||
    typeof tools.chime !== 'boolean' ||
    typeof tools.mistwalker !== 'boolean' ||
    typeof tools.ferry !== 'boolean'
  ) {
    return null
  }

  if (!Array.isArray(o.pathsRevealed) || o.pathsRevealed.some((p) => typeof p !== 'string')) {
    return null
  }

  const GLYPH_IDS = ['ember', 'gale', 'stone', 'tide', 'light', 'shade'] as const
  const grid = o.glyphGrid
  if (!Array.isArray(grid) || grid.length !== 16) return null
  for (const cell of grid) {
    if (cell !== null && !GLYPH_IDS.includes(cell as (typeof GLYPH_IDS)[number])) {
      return null
    }
  }
  const uses = o.glyphUses as Record<string, unknown> | null
  if (typeof uses !== 'object' || uses === null) return null
  for (const g of GLYPH_IDS) {
    if (!isFiniteNumber(uses[g]) || (uses[g] as number) < 0) return null
  }

  const chainUses = o.chainUses as Record<string, unknown> | null
  if (typeof chainUses !== 'object' || chainUses === null || Array.isArray(chainUses)) {
    return null
  }
  for (const v of Object.values(chainUses)) {
    if (!isFiniteNumber(v) || v < 0) return null
  }
  const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((s) => typeof s === 'string')
  if (!isStringArray(o.artsUnlocked) || !isStringArray(o.guardiansDefeated)) {
    return null
  }
  if (!isFiniteNumber(o.waystones) || o.waystones < 0) return null
  if (!isStringArray(o.regionsManifested)) return null

  const fishHeld = o.fishHeld as Record<string, unknown> | null
  if (typeof fishHeld !== 'object' || fishHeld === null || Array.isArray(fishHeld)) return null
  for (const v of Object.values(fishHeld)) {
    if (!isFiniteNumber(v) || v < 0) return null
  }
  if (!isFiniteNumber(o.anglingPoints) || (o.anglingPoints as number) < 0) return null
  if (o.pendingMeal !== null && typeof o.pendingMeal !== 'string') return null

  // Deck game. Structural only: unknown ids are filtered at render (cardById),
  // so a hostile import can inject at worst an unplayable no-op card.
  if (!isStringArray(o.cardsOwned) || !isStringArray(o.deck)) return null
  if ((o.deck as string[]).length > 8) return null
  const owned = new Set(o.cardsOwned as string[])
  if ((o.deck as string[]).some((d) => !owned.has(d))) return null
  const cardWins = o.cardWins as Record<string, unknown> | null
  if (typeof cardWins !== 'object' || cardWins === null || Array.isArray(cardWins)) return null
  for (const v of Object.values(cardWins)) {
    if (!isFiniteNumber(v) || v < 0) return null
  }
  const enemiesFelled = o.enemiesFelled as Record<string, unknown> | null
  if (typeof enemiesFelled !== 'object' || enemiesFelled === null || Array.isArray(enemiesFelled)) {
    return null
  }
  for (const v of Object.values(enemiesFelled)) {
    if (!isFiniteNumber(v) || v < 0) return null
  }
  if (!isStringArray(o.bountiesClaimed)) return null

  return {
    version: 13,
    regionId: o.regionId,
    playerPos: [o.playerPos[0], o.playerPos[1], o.playerPos[2]],
    lumen: o.lumen,
    glyphStones: o.glyphStones,
    discoveries,
    mastery: {
      strike: m.strike as number,
      parry: m.parry as number,
      dash: m.dash as number,
      grapple: m.grapple as number,
      lantern: m.lantern as number,
    },
    tools: {
      grapple: tools.grapple,
      sounding: tools.sounding,
      chime: tools.chime,
      mistwalker: tools.mistwalker,
      ferry: tools.ferry,
    },
    pathsRevealed: [...(o.pathsRevealed as string[])],
    glyphGrid: [...(grid as GlyphSlot[])],
    glyphUses: {
      ember: uses.ember as number,
      gale: uses.gale as number,
      stone: uses.stone as number,
      tide: uses.tide as number,
      light: uses.light as number,
      shade: uses.shade as number,
    },
    chainUses: { ...(chainUses as Record<string, number>) },
    artsUnlocked: [...o.artsUnlocked],
    guardiansDefeated: [...o.guardiansDefeated],
    waystones: o.waystones,
    regionsManifested: [...o.regionsManifested],
    fishHeld: { ...(fishHeld as Record<string, number>) },
    anglingPoints: o.anglingPoints,
    pendingMeal: o.pendingMeal,
    cardsOwned: [...(o.cardsOwned as string[])],
    deck: [...(o.deck as string[])],
    cardWins: { ...(cardWins as Record<string, number>) },
    enemiesFelled: { ...(enemiesFelled as Record<string, number>) },
    bountiesClaimed: [...(o.bountiesClaimed as string[])],
  }
}
