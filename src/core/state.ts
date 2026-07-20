/**
 * The single serializable game state — the spine every system reads and
 * writes. Everything here must survive JSON round-tripping (no class
 * instances, no THREE objects, no functions).
 */
export interface GameState {
  version: 1
  regionId: string
  playerPos: [number, number, number]
  /** Global upgrade currency. */
  lumen: number
}

export const SPAWN_REGION = 'amberfall'

export function createInitialState(): GameState {
  return {
    version: 1,
    regionId: SPAWN_REGION,
    // Placeholder until the first save; a fresh boot always uses the
    // region's authored spawn point (see SaveSystem.isFresh).
    playerPos: [0, 0, 0],
    lumen: 0,
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every(isFiniteNumber)
}

/**
 * Structural validation for anything loaded from storage or user import.
 * Returns null for anything malformed — callers fall back to a fresh state.
 * Never trust persisted bytes: they may come from an edited export file.
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
  if (o.version !== 1) return null
  if (typeof o.regionId !== 'string' || o.regionId.length === 0) return null
  if (!isVec3(o.playerPos)) return null
  if (!isFiniteNumber(o.lumen) || o.lumen < 0) return null
  return {
    version: 1,
    regionId: o.regionId,
    playerPos: [o.playerPos[0], o.playerPos[1], o.playerPos[2]],
    lumen: o.lumen,
  }
}
