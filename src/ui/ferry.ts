import type { World } from '../world/world'

interface Mooring {
  regionId: string
  name: string
  x: number
  z: number
}

/**
 * The Ferryman's Bell UI: opens at a mooring, lists the OTHER manifested
 * regions' moorings, and sails you there (a fade, a teleport, a region banner —
 * `onTravel` does the actual move). Toggled via `hidden` with the standard
 * `[hidden]{display:none}` guard; Escape closes it first.
 */
export class FerryPanel {
  private overlay: HTMLElement
  private body: HTMLElement
  visible = false

  constructor(
    private world: World,
    private currentRegionId: () => string | null,
    private onTravel: (m: Mooring) => void,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'esc-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'The Ferryman’s Bell'
    this.body = document.createElement('div')
    this.body.className = 'ledger-body'
    this.overlay.append(title, this.body)
    document.body.appendChild(this.overlay)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.close()
        e.stopPropagation()
      }
    })
  }

  open(): void {
    this.visible = true
    this.overlay.hidden = false
    document.exitPointerLock?.()
    this.render()
  }

  close(): void {
    this.visible = false
    this.overlay.hidden = true
  }

  private render(): void {
    this.body.replaceChildren()
    const here = this.currentRegionId()
    const destinations = this.world.moorings.filter((m) => m.regionId !== here)
    if (destinations.length === 0) {
      const none = document.createElement('div')
      none.className = 'glyph-status'
      none.textContent = 'No other shores are open to you yet.'
      this.body.appendChild(none)
    }
    for (const m of destinations) {
      const b = document.createElement('button')
      b.className = 'glyph-pick'
      b.textContent = `Sail to ${m.name}`
      b.addEventListener('click', () => {
        this.onTravel(m)
        this.close()
      })
      this.body.appendChild(b)
    }
    const hint = document.createElement('div')
    hint.className = 'glyph-status'
    hint.textContent = 'Esc to step back from the bell.'
    this.body.appendChild(hint)
  }
}
