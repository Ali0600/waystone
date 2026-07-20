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

export interface GameState {
  version: 3
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
  tools: { grapple: boolean }
  /** Latent paths made solid by the lantern (region content ids). */
  pathsRevealed: string[]
}

export const SPAWN_REGION = 'amberfall'

export function createInitialState(): GameState {
  return {
    version: 3,
    regionId: SPAWN_REGION,
    // Placeholder until the first save; a fresh boot always uses the
    // region's authored spawn point (see SaveSystem.isFresh).
    playerPos: [0, 0, 0],
    lumen: 0,
    glyphStones: 0,
    discoveries: {},
    mastery: { strike: 0, parry: 0, dash: 0, grapple: 0, lantern: 0 },
    tools: { grapple: false },
    pathsRevealed: [],
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

  if (o.version !== 3) return null
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
  if (typeof tools.grapple !== 'boolean') return null

  if (!Array.isArray(o.pathsRevealed) || o.pathsRevealed.some((p) => typeof p !== 'string')) {
    return null
  }

  return {
    version: 3,
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
    tools: { grapple: tools.grapple },
    pathsRevealed: [...(o.pathsRevealed as string[])],
  }
}
