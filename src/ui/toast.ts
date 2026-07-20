import type { EventBus } from '../core/events'

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
      setTimeout(() => el.remove(), 600)
    }, 3200)
  }
}
