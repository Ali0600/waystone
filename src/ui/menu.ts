import { MAX_SAVE_BYTES, SAVE_KEY, type SaveSystem } from '../core/save'
import { parseGameState } from '../core/state'
import type { EventBus } from '../core/events'

/**
 * The Esc menu: resume, save, export/import (validated — a hostile or
 * corrupt file becomes an error toast, never a broken game).
 */
export class EscMenu {
  private overlay: HTMLElement
  visible = false

  constructor(
    private saves: SaveSystem,
    private persist: () => void,
    bus: EventBus,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'esc-overlay'
    this.overlay.hidden = true

    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'Waystone'

    const box = document.createElement('div')
    box.className = 'esc-box'

    const mkButton = (label: string, onClick: () => void) => {
      const b = document.createElement('button')
      b.className = 'glyph-pick'
      b.textContent = label
      b.addEventListener('click', onClick)
      box.appendChild(b)
      return b
    }

    mkButton('Resume', () => this.toggle())
    mkButton('Save now', () => {
      this.persist()
      bus.emit('toast', { text: 'Saved.', flavor: 'info' })
      this.toggle()
    })
    mkButton('Export save', () => {
      this.persist()
      const blob = new Blob([JSON.stringify(this.saves.state, null, 2)], {
        type: 'application/json',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'waystone-save.json'
      a.click()
      URL.revokeObjectURL(a.href)
    })

    const importInput = document.createElement('input')
    importInput.type = 'file'
    importInput.accept = 'application/json'
    importInput.hidden = true
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0]
      if (!file) return
      if (file.size > MAX_SAVE_BYTES) {
        bus.emit('toast', { text: 'That file is too large to be a save.', flavor: 'info' })
        return
      }
      void file.text().then((text) => {
        const parsed = parseGameState(text)
        if (parsed === null) {
          bus.emit('toast', { text: 'Not a valid Waystone save.', flavor: 'info' })
          return
        }
        localStorage.setItem(SAVE_KEY, JSON.stringify(parsed))
        location.reload()
      })
    })
    mkButton('Import save…', () => importInput.click())
    box.appendChild(importInput)

    const hint = document.createElement('div')
    hint.className = 'glyph-status'
    hint.textContent =
      'Progress autosaves every few seconds. Exports are plain JSON — keep one as a backup.'
    box.appendChild(hint)

    this.overlay.append(title, box)
    document.body.appendChild(this.overlay)

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return
      // If another overlay (the Ledger) is up, its own handler just closed
      // it — don't open the menu underneath in the same press.
      if (!this.visible && this.otherOverlayOpen()) return
      // In a duel, Escape means "back out of the command submenu" (the battle
      // menu reads it) — never pop the pause menu over live combat.
      if (!this.visible && document.querySelector('.combat-ui')) return
      this.toggle()
    })
  }

  private otherOverlayOpen(): boolean {
    return [...document.querySelectorAll('.esc-overlay')].some(
      (el) => el !== this.overlay && !(el as HTMLElement).hidden,
    )
  }

  toggle(): void {
    this.visible = !this.visible
    this.overlay.hidden = !this.visible
    if (this.visible) document.exitPointerLock?.()
  }
}
