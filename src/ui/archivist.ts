import type { GameState } from '../core/state'
import { RECRUITS } from '../content/recruits'
import { VERB_IDS, tierOf } from '../progression/mastery'
import type { World } from '../world/world'

/**
 * Fen's ledger: the completion tracker. Opens when you talk to the
 * Archivist at the Waystation.
 */
export class ArchivistPanel {
  private overlay: HTMLElement
  private body: HTMLElement
  visible = false

  constructor(
    private world: World,
    private state: GameState,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'esc-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'The Ledger'
    this.body = document.createElement('div')
    this.body.className = 'ledger-body'
    const hint = document.createElement('div')
    hint.className = 'glyph-status'
    hint.textContent = 'Fen: "Every blank line is a place you have not listened yet."'
    this.overlay.append(title, this.body, hint)
    document.body.appendChild(this.overlay)
    // Registered before EscMenu's listener (constructed later in main):
    // Escape closes the ledger first; the menu skips opening beneath it.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) this.toggle()
    })
  }

  toggle(): void {
    this.visible = !this.visible
    this.overlay.hidden = !this.visible
    if (this.visible) this.render()
  }

  private render(): void {
    this.body.replaceChildren()
    const line = (label: string, value: string) => {
      const el = document.createElement('div')
      el.className = 'ledger-line'
      el.innerHTML = `<span>${label}</span><span class="ledger-dots"></span><span>${value}</span>`
      this.body.appendChild(el)
    }
    for (const region of this.world.regions) {
      if (!this.world.isManifested(region.def.id)) {
        line(region.def.name, '…latent…')
        continue
      }
      const defs = region.def.discoverables
      const found = defs.filter((d) => this.state.discoveries[d.id] === 'found').length
      line(region.def.name, `${found} / ${defs.length}`)
    }
    const home = RECRUITS.filter(
      (r) => this.state.discoveries[r.personId] === 'found',
    ).length
    line('People home', `${home} / ${RECRUITS.length}`)
    for (const verb of VERB_IDS) {
      line(
        `${verb[0].toUpperCase()}${verb.slice(1)} mastery`,
        `Tier ${tierOf(verb, this.state.mastery[verb])}`,
      )
    }
    line('Hidden Arts', `${this.state.artsUnlocked.length} known`)
    line('Lumen gathered', `◆ ${this.state.lumen}`)
  }
}
