import type { GlyphId } from '../content/glyphs'

/**
 * The classic-JRPG battle command menu — PURE (no DOM), like `timing.ts`, so
 * navigation is unit-tested and the DOM overlay just renders `view()`.
 *
 * Design (from the research): a root command box (Attack / Glyphs / Defend /
 * Item) with arrow navigation, Enter to descend/commit, Esc to back out, and
 * **cursor memory** — the menu reopens each turn on the last category and
 * sub-option chosen, so repeat turns are fast. The menu SELECTS; the existing
 * beat bar / parry still EXECUTE (the Super Mario RPG → Legend of Dragoon →
 * Sea of Stars lineage the brief descends from). Space is NOT a menu key — it
 * stays the beat/parry/art key.
 */

export type MenuCommit =
  | { kind: 'chain'; id: string }
  | { kind: 'glyph'; id: GlyphId }
  | { kind: 'defend' }
  | { kind: 'item'; fishId: string }

/** One selectable entry — a root category (has `submenu`) or a leaf (`commit`). */
export interface MenuEntry {
  /** Stable id for cursor memory (categories: 'attack'/'glyphs'/'defend'/'item'). */
  key: string
  label: string
  disabled?: boolean
  /** Accent colour (glyph entries) for the renderer. */
  color?: string
  /** Trailing detail (a fish count, a chain tier) for the renderer. */
  detail?: string
  /** Present on a category — the options it opens. */
  submenu?: MenuEntry[]
  /** Present on a leaf — what committing it does. */
  commit?: MenuCommit
}

export interface MenuView {
  inSubmenu: boolean
  /** The open category's label while in a submenu, else null. */
  title: string | null
  options: { label: string; disabled: boolean; color?: string; detail?: string }[]
  cursor: number
  footer: string
}

const FOOTER = '↑↓ select · Enter confirm · Esc back'

export class BattleMenu {
  /** [] at the root, ['attack'] inside the Attack submenu. */
  private path: string[] = []
  /** Remembered cursor index per level key ('' = root). */
  private cursors = new Map<string, number>()

  private levelKey(): string {
    return this.path.length > 0 ? this.path[0] : ''
  }

  private entriesFor(root: MenuEntry[]): MenuEntry[] {
    if (this.path.length === 0) return root
    return root.find((e) => e.key === this.path[0])?.submenu ?? []
  }

  private clampedCursor(entries: MenuEntry[]): number {
    if (entries.length === 0) return 0
    const raw = this.cursors.get(this.levelKey()) ?? 0
    return Math.max(0, Math.min(raw, entries.length - 1))
  }

  /** Move the cursor by `dir`, wrapping and skipping disabled entries. */
  private move(entries: MenuEntry[], dir: 1 | -1): void {
    const n = entries.length
    if (n === 0) return
    let i = this.clampedCursor(entries)
    for (let step = 0; step < n; step++) {
      i = (i + dir + n) % n
      if (!entries[i].disabled) break
    }
    this.cursors.set(this.levelKey(), i)
  }

  /**
   * Advance one frame with this turn's freshly-pressed codes over the current
   * root items. Returns a commit the instant the player confirms one, else null.
   */
  step(codes: string[], root: MenuEntry[]): MenuCommit | null {
    for (const code of codes) {
      const entries = this.entriesFor(root)
      if (code === 'ArrowDown') this.move(entries, 1)
      else if (code === 'ArrowUp') this.move(entries, -1)
      else if (code === 'Escape' || code === 'Backspace') {
        if (this.path.length > 0) this.path = []
      } else if (code === 'Enter' || code === 'NumpadEnter') {
        const entry = entries[this.clampedCursor(entries)]
        if (!entry || entry.disabled) continue
        if (entry.submenu) {
          this.path = [entry.key]
          // land on the remembered sub-cursor (clamped on read)
        } else if (entry.commit) {
          // Cursor memory: keep the root cursor on this category (already
          // stored) and this sub-index, then reopen at root next turn.
          this.path = []
          return entry.commit
        }
      }
    }
    return null
  }

  /** Render model for the DOM overlay. */
  view(root: MenuEntry[]): MenuView {
    const entries = this.entriesFor(root)
    const title =
      this.path.length > 0 ? (root.find((e) => e.key === this.path[0])?.label ?? null) : null
    return {
      inSubmenu: this.path.length > 0,
      title,
      options: entries.map((e) => ({
        label: e.label,
        disabled: !!e.disabled,
        color: e.color,
        detail: e.detail,
      })),
      cursor: this.clampedCursor(entries),
      footer: FOOTER,
    }
  }
}
