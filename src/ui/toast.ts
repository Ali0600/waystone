import type { EventBus } from '../core/events'

/** How long a toast stays fully visible before it begins to fade. */
export const TOAST_VISIBLE_MS = 5200
/** The fade-out animation length once it starts. */
const TOAST_FADE_MS = 600

/** Bottom-left stacking toasts for rewards and info. */
export class Toasts {
  private container: HTMLElement

  constructor(bus: EventBus, parent: HTMLElement = document.body) {
    this.container = document.createElement('div')
    this.container.className = 'toasts'
    parent.appendChild(this.container)
    bus.on('toast', ({ text, flavor }) => this.push(text, flavor))
    bus.on('lumen:changed', ({ delta }) => {
      if (delta > 0) this.push(`+${delta} Lumen`, 'reward')
    })
    bus.on('glyphstone:changed', ({ delta, total }) => {
      if (delta > 0) this.push(`Blank Glyph Stone (${total} held)`, 'reward')
    })
  }

  push(text: string, flavor: 'reward' | 'info' = 'info'): void {
    const el = document.createElement('div')
    el.className = `toast toast-${flavor}`
    el.textContent = text
    this.container.appendChild(el)
    while (this.container.children.length > 5) {
      this.container.firstElementChild?.remove()
    }
    setTimeout(() => {
      el.classList.add('fading')
      setTimeout(() => el.remove(), TOAST_FADE_MS)
    }, TOAST_VISIBLE_MS)
  }
}
