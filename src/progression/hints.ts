import type { GameState } from '../core/state'
import { HINTS, type HintDef, type HintContext } from '../content/hints'

/** How long a hint stays up before it steps aside. */
const HOLD_SEC = 8
/** Minimum quiet gap between two different hints (rate-limiting). */
const GAP_SEC = 20

/**
 * The contextual-hint scheduler — PURE (no DOM, no bus), so the "one at a time,
 * rate-limited, retire-on-doing" logic is unit-tested and the UI just renders
 * `update()`'s return. Seen hints persist in `state.hintsSeen` (save v15), so a
 * retired hint never returns — including across reloads.
 *
 * `retireOn` bus wiring lives in main (data-driven over HINTS): on that event
 * main calls `markSeen(id)`, so a hint the player pre-empted never shows.
 */
export class HintSystem {
  private clock = 0
  private shownId: string | null = null
  private shownAt = 0
  private lastEndedAt = -Infinity
  private logged = new Set<string>()
  private hold: number
  private gap: number

  constructor(
    private state: GameState,
    private hints: HintDef[] = HINTS,
    /** Called once, the first time a hint appears — feeds the Ledger Log so the
     *  message is re-readable (accessibility). */
    private onShow?: (text: string) => void,
    opts: { hold?: number; gap?: number } = {},
  ) {
    this.hold = opts.hold ?? HOLD_SEC
    this.gap = opts.gap ?? GAP_SEC
  }

  seen(id: string): boolean {
    return this.state.hintsSeen.includes(id)
  }

  markSeen(id: string): void {
    if (!this.seen(id)) this.state.hintsSeen.push(id)
  }

  private byId(id: string): HintDef | undefined {
    return this.hints.find((h) => h.id === id)
  }

  /** Advance by `dt` seconds; return the hint text to display, or null. */
  update(ctx: HintContext, dt: number): string | null {
    this.clock += dt

    // A hint is up — keep, or retire it.
    if (this.shownId) {
      const def = this.byId(this.shownId)!
      const held = this.clock - this.shownAt
      // A panel/duel took the screen: pull it (un-seen, may return later).
      if (ctx.uiOpen || ctx.inCombat) return this.end(false)
      // The player resolved it (pressed F, inscribed, left the mist): retire.
      if (!def.when(ctx)) return this.end(true)
      // Informational one-shot held long enough: teach once, retire.
      if (def.showOnce && held >= this.hold) return this.end(true)
      // Actionable hint held long enough: step aside but keep it un-seen so it
      // can nudge again later until the player actually does the thing.
      if (held >= this.hold) return this.end(false)
      return def.text
    }

    // Nothing up — maybe start one (rate-limited, suppressed under UI/combat).
    if (ctx.uiOpen || ctx.inCombat) return null
    if (this.clock - this.lastEndedAt < this.gap) return null
    for (const def of this.hints) {
      if (this.seen(def.id)) continue
      if (def.minElapsedSec !== undefined && this.clock < def.minElapsedSec) continue
      if (!def.when(ctx)) continue
      this.shownId = def.id
      this.shownAt = this.clock
      if (!this.logged.has(def.id)) {
        this.logged.add(def.id)
        this.onShow?.(def.text)
      }
      return def.text
    }
    return null
  }

  /** Retire the current hint; `markSeen` = the player resolved it for good. */
  private end(markSeen: boolean): null {
    if (markSeen && this.shownId) this.markSeen(this.shownId)
    this.lastEndedAt = this.clock
    this.shownId = null
    return null
  }
}
