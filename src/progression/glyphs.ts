import { COMBOS, GLYPHS, type ComboDef, type GlyphId } from '../content/glyphs'
import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'

export const GRID_SIZE = 4
/** Lumen cost to clear an inscribed slot, once re-inscription is unlocked. */
export const REINSCRIBE_COST = 25
/** Recruits home before the Waystation "remembers" (re-inscription unlock). */
export const REINSCRIBE_RECRUITS = 3

/** Orthogonal neighbours — row-major 4×4 grid, no wrap across row ends. */
export function neighbors(slot: number): number[] {
  const x = slot % GRID_SIZE
  const y = Math.floor(slot / GRID_SIZE)
  const out: number[] = []
  if (x > 0) out.push(slot - 1)
  if (x < GRID_SIZE - 1) out.push(slot + 1)
  if (y > 0) out.push(slot - GRID_SIZE)
  if (y < GRID_SIZE - 1) out.push(slot + GRID_SIZE)
  return out
}

export interface ActiveCombo {
  combo: ComboDef
  slots: [number, number]
}

/** Every adjacent pair matching a combo recipe (either order), deduped. */
export function activeCombos(grid: readonly (GlyphId | null)[]): ActiveCombo[] {
  const out: ActiveCombo[] = []
  for (let i = 0; i < grid.length; i++) {
    const a = grid[i]
    if (a === null) continue
    for (const j of neighbors(i)) {
      if (j < i) continue // count each unordered pair once
      const b = grid[j]
      if (b === null) continue
      const combo = COMBOS.find(
        (c) =>
          (c.pair[0] === a && c.pair[1] === b) ||
          (c.pair[0] === b && c.pair[1] === a),
      )
      if (combo) out.push({ combo, slots: [i, j] })
    }
  }
  return out
}

export class GlyphSystem {
  constructor(
    private state: GameState,
    private bus: EventBus,
    /** Recruits currently home — gates the re-inscription upgrade. */
    private recruitsHome: () => number,
  ) {}

  grid(): readonly (GlyphId | null)[] {
    return this.state.glyphGrid as (GlyphId | null)[]
  }

  combos(): ActiveCombo[] {
    return activeCombos(this.grid())
  }

  canReinscribe(): boolean {
    return this.recruitsHome() >= REINSCRIBE_RECRUITS
  }

  /** Spend a blank stone to permanently inscribe a glyph. */
  inscribe(slot: number, glyph: GlyphId): boolean {
    if (slot < 0 || slot >= GRID_SIZE * GRID_SIZE) return false
    if (this.state.glyphGrid[slot] !== null) return false
    if (this.state.glyphStones < 1) return false
    const combosBefore = this.combos().length
    this.state.glyphStones -= 1
    this.state.glyphGrid[slot] = glyph
    this.bus.emit('glyphstone:changed', { total: this.state.glyphStones, delta: 0 })
    this.bus.emit('glyph:inscribed', { slot, glyph })
    this.bus.emit('toast', { text: `${GLYPHS[glyph].name} inscribed`, flavor: 'reward' })
    const gained = this.combos().length - combosBefore
    if (gained > 0) {
      const latest = this.combos()[this.combos().length - 1]
      this.bus.emit('toast', {
        text: `The glyphs resonate — ${latest.combo.name} awakens!`,
        flavor: 'reward',
      })
    }
    return true
  }

  /** Clear a slot for Lumen (the anti-frustration hub upgrade). */
  clearSlot(slot: number): boolean {
    if (!this.canReinscribe()) return false
    if (slot < 0 || slot >= GRID_SIZE * GRID_SIZE) return false
    if (this.state.glyphGrid[slot] === null) return false
    if (this.state.lumen < REINSCRIBE_COST) return false
    this.state.lumen -= REINSCRIBE_COST
    this.state.glyphGrid[slot] = null
    this.bus.emit('lumen:changed', { total: this.state.lumen, delta: -REINSCRIBE_COST })
    this.bus.emit('toast', { text: 'The slot falls silent — ready to learn again', flavor: 'info' })
    return true
  }

  /** Count a combat use of a glyph (per-glyph mastery, consumed in M6). */
  recordUse(glyph: GlyphId): void {
    this.state.glyphUses[glyph] += 1
  }
}
