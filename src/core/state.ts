/**
 * The single serializable game state — the spine every system reads and
 * writes. Everything here must survive JSON round-tripping (no class
 * instances, no THREE objects, no functions).
 */

/** unseen (absent) → pinned (seen but locked) → found. 'revealed' marks a
 *  latent discoverable made solid by the Lantern but not yet collected. */
export type DiscoveryStatus = 'pinned' | 'revealed' | 'found'

export interface GameState {
  version: 2
  regionId: string
  playerPos: [number, number, number]
  /** Global upgrade currency. */
  lumen: number
  /** Blank Glyph Stones — finite, found only in the world. */
  glyphStones: number
  discoveries: Record<string, DiscoveryStatus>
}

export const SPAWN_REGION = 'amberfall'

export function createInitialState(): GameState {
  return {
    version: 2,
    regionId: SPAWN_REGION,
    // Placeholder until the first save; a fresh boot always uses the
    // region's authored spawn point (see SaveSystem.isFresh).
    playerPos: [0, 0, 0],
    lumen: 0,
    glyphStones: 0,
    discoveries: {},
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

  if (o.version !== 2) return null
  if (typeof o.regionId !== 'string' || o.regionId.length === 0) return null
  if (!isVec3(o.playerPos)) return null
  if (!isFiniteNumber(o.lumen) || o.lumen < 0) return null
  if (!isFiniteNumber(o.glyphStones) || o.glyphStones < 0) return null
  const discoveries = parseDiscoveries(o.discoveries)
  if (discoveries === null) return null
  return {
    version: 2,
    regionId: o.regionId,
    playerPos: [o.playerPos[0], o.playerPos[1], o.playerPos[2]],
    lumen: o.lumen,
    glyphStones: o.glyphStones,
    discoveries,
  }
}
