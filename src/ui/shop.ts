import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import type { CardDef } from '../content/cards.schema'
import { buyCard, shopPrice, shopStock } from '../cards/game'

/**
 * Sel's booster shelf: three rotating cards drawn from the encountered-and-
 * unowned pool (deterministic — it only shifts as you play and explore). Buy
 * with Lumen. The overlay toggles via `hidden`; its `display:` rule ships the
 * `[hidden]{display:none}` guard.
 */
export class ShopPanel {
  private overlay: HTMLElement
  private body: HTMLElement
  visible = false

  constructor(
    private state: GameState,
    private bus: EventBus,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'esc-overlay card-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = "Sel's Booster Shelf"
    this.body = document.createElement('div')
    this.body.className = 'card-body'
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
    const info = document.createElement('div')
    info.className = 'glyph-status'
    info.textContent = `You hold ◆${this.state.lumen} Lumen. Every card depicts something you have met.`
    this.body.appendChild(info)

    const stock = shopStock(this.state)
    const shelf = document.createElement('div')
    shelf.className = 'card-hand'
    if (stock.length === 0) {
      const none = document.createElement('div')
      none.className = 'glyph-status'
      none.textContent = 'Sel: "Meet more of the world and I\'ll have more to sell."'
      this.body.appendChild(none)
    }
    stock.forEach((card: CardDef, i: number) => {
      const price = shopPrice(i)
      const wrap = document.createElement('div')
      wrap.className = 'shop-item'
      const el = document.createElement('div')
      el.className = 'pcard'
      el.innerHTML =
        `<span class="pcard-cost">◇${card.cost}</span>` +
        `<span class="pcard-power">${card.power}</span>` +
        `<span class="pcard-name">${card.name}</span>` +
        (card.ability ? `<span class="pcard-ability">${card.ability}</span>` : '')
      const buy = document.createElement('button')
      buy.className = 'glyph-pick'
      buy.textContent = `Buy ◆${price}`
      if (this.state.lumen < price) buy.disabled = true
      buy.addEventListener('click', () => this.buy(card, price))
      wrap.append(el, buy)
      shelf.appendChild(wrap)
    })
    this.body.appendChild(shelf)

    const foot = document.createElement('div')
    foot.className = 'card-foot'
    const leave = document.createElement('button')
    leave.className = 'glyph-pick'
    leave.textContent = 'Leave'
    leave.addEventListener('click', () => this.close())
    foot.appendChild(leave)
    this.body.appendChild(foot)
  }

  private buy(card: CardDef, price: number): void {
    if (buyCard(this.state, card.id, price)) {
      this.bus.emit('lumen:changed', { total: this.state.lumen, delta: -price })
      this.bus.emit('toast', { text: `Bought ${card.name}. Add it to your deck at Tam's table.`, flavor: 'reward' })
      this.render()
    } else {
      this.bus.emit('toast', { text: 'Not enough Lumen for that one.', flavor: 'info' })
    }
  }
}
