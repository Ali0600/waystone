import { COMBOS, GLYPHS, GLYPH_IDS, type GlyphId } from '../content/glyphs'
import type { GameState } from '../core/state'
import type { EventBus } from '../core/events'
import {
  GRID_SIZE,
  REINSCRIBE_COST,
  type GlyphSystem,
} from '../progression/glyphs'

/**
 * The Glyph Grid (G). Viewing is free anywhere; inscription requires
 * standing with Iole the Scribe at the Waystation. Combos are shown only
 * once discovered on the grid — never listed in advance.
 */
export class GlyphPanel {
  private overlay: HTMLElement
  private gridEl: HTMLElement
  private sideEl: HTMLElement
  private selectedSlot: number | null = null
  visible = false

  constructor(
    private glyphs: GlyphSystem,
    private state: GameState,
    private nearScribe: () => boolean,
    bus: EventBus,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'glyph-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'The Glyph Grid'
    const row = document.createElement('div')
    row.className = 'glyph-row'
    this.gridEl = document.createElement('div')
    this.gridEl.className = 'glyph-grid'
    this.sideEl = document.createElement('div')
    this.sideEl.className = 'glyph-side'
    row.append(this.gridEl, this.sideEl)
    this.overlay.append(title, row)
    document.body.appendChild(this.overlay)

    bus.on('glyphstone:changed', () => this.render())
    bus.on('glyph:inscribed', () => this.render())
    bus.on('lumen:changed', () => this.render())
  }

  toggle(): void {
    this.visible = !this.visible
    this.overlay.hidden = !this.visible
    if (this.visible) {
      this.selectedSlot = null
      this.render()
      document.exitPointerLock?.()
    }
  }

  private render(): void {
    if (!this.visible) return
    const grid = this.glyphs.grid()
    const combos = this.glyphs.combos()
    const comboSlots = new Set(combos.flatMap((c) => c.slots))

    this.gridEl.replaceChildren()
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const cell = document.createElement('button')
      cell.className = 'glyph-cell'
      const g = grid[i]
      if (g !== null) {
        const def = GLYPHS[g]
        cell.textContent = def.rune
        cell.style.color = def.color
        cell.style.borderColor = def.color
        cell.title = def.name
        if (comboSlots.has(i)) cell.classList.add('combo')
      }
      if (this.selectedSlot === i) cell.classList.add('selected')
      cell.addEventListener('click', () => {
        this.selectedSlot = this.selectedSlot === i ? null : i
        this.render()
      })
      this.gridEl.appendChild(cell)
    }

    // Side: stones, status, picker / clear, discovered combos.
    this.sideEl.replaceChildren()
    const stones = document.createElement('div')
    stones.className = 'glyph-stones'
    stones.textContent = `Blank Glyph Stones: ${this.state.glyphStones}`
    this.sideEl.appendChild(stones)

    const near = this.nearScribe()
    const status = document.createElement('div')
    status.className = 'glyph-status'
    status.textContent = near
      ? 'Iole watches over your shoulder, quill ready.'
      : 'Inscription requires Iole the Scribe at the Waystation.'
    this.sideEl.appendChild(status)

    if (this.selectedSlot !== null) {
      const slotGlyph = grid[this.selectedSlot]
      if (slotGlyph === null) {
        const pickerLabel = document.createElement('div')
        pickerLabel.className = 'glyph-picker-label'
        pickerLabel.textContent = `Inscribe slot ${this.selectedSlot + 1}:`
        this.sideEl.appendChild(pickerLabel)
        for (const id of GLYPH_IDS) {
          const def = GLYPHS[id]
          const btn = document.createElement('button')
          btn.className = 'glyph-pick'
          btn.style.borderColor = def.color
          btn.innerHTML = `<span style="color:${def.color}">${def.rune}</span> ${def.name} — <em>${def.desc}</em>`
          btn.disabled = !near || this.state.glyphStones < 1
          btn.addEventListener('click', () => {
            if (this.glyphs.inscribe(this.selectedSlot!, id)) {
              this.selectedSlot = null
              this.render()
            }
          })
          this.sideEl.appendChild(btn)
        }
      } else {
        const def = GLYPHS[slotGlyph as GlyphId]
        const info = document.createElement('div')
        info.className = 'glyph-status'
        info.textContent = `${def.name}: ${def.desc}`
        this.sideEl.appendChild(info)
        if (this.glyphs.canReinscribe()) {
          const clear = document.createElement('button')
          clear.className = 'glyph-pick'
          clear.textContent = `Unmake (${REINSCRIBE_COST} ◆)`
          clear.disabled = !near || this.state.lumen < REINSCRIBE_COST
          clear.addEventListener('click', () => {
            if (this.glyphs.clearSlot(this.selectedSlot!)) {
              this.selectedSlot = null
              this.render()
            }
          })
          this.sideEl.appendChild(clear)
        }
      }
    }

    if (combos.length > 0) {
      const comboLabel = document.createElement('div')
      comboLabel.className = 'glyph-picker-label'
      comboLabel.textContent = 'Resonances discovered:'
      this.sideEl.appendChild(comboLabel)
      const seen = new Set<string>()
      for (const c of combos) {
        if (seen.has(c.combo.id)) continue
        seen.add(c.combo.id)
        const line = document.createElement('div')
        line.className = 'glyph-combo-line'
        line.innerHTML = `<span style="color:${c.combo.color}">${c.combo.rune} ${c.combo.name}</span> — ${c.combo.desc}`
        this.sideEl.appendChild(line)
      }
    }
    void COMBOS
  }
}
