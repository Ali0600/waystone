import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import type { RegionDef } from '../world/region'
import { BOUNTIES, type BountyDef } from '../content/bounties'
import { bountyProgress, claimBounty } from '../progression/bounties'

/**
 * The Reward Board: posted bounties with live progress and a Claim button.
 * Opens at the board prop by the arch. Escape closes it first; toggled via
 * `hidden` with the standard `[hidden]{display:none}` guard.
 */
export class RewardBoardPanel {
  private overlay: HTMLElement
  private body: HTMLElement
  visible = false

  constructor(
    private state: GameState,
    private regions: () => RegionDef[],
    private bus: EventBus,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'esc-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'The Reward Board'
    this.body = document.createElement('div')
    this.body.className = 'board-body'
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
    for (const def of BOUNTIES) {
      this.body.appendChild(this.bountyRow(def))
    }
  }

  private bountyRow(def: BountyDef): HTMLElement {
    const claimed = this.state.bountiesClaimed.includes(def.id)
    const p = bountyProgress(this.state, def, this.regions())
    const row = document.createElement('div')
    row.className = 'board-row' + (claimed ? ' board-done' : '')

    const head = document.createElement('div')
    head.className = 'board-head'
    const name = document.createElement('span')
    name.className = 'board-title'
    name.textContent = def.title
    const reward = document.createElement('span')
    reward.className = 'board-reward'
    reward.textContent =
      `◆${def.reward.lumen}` +
      (def.reward.glyphStones ? ` ⬡${def.reward.glyphStones}` : '') +
      (def.reward.cardId ? ' + card' : '')
    head.append(name, reward)

    const flavor = document.createElement('div')
    flavor.className = 'glyph-status'
    flavor.textContent = def.flavor

    const track = document.createElement('div')
    track.className = 'board-track'
    const fill = document.createElement('div')
    fill.className = 'board-fill'
    fill.style.width = `${p.target > 0 ? Math.min(1, p.current / p.target) * 100 : 0}%`
    track.appendChild(fill)

    const foot = document.createElement('div')
    foot.className = 'board-foot'
    const status = document.createElement('span')
    status.className = 'glyph-status'
    status.textContent = claimed ? 'Claimed.' : `${p.current} / ${p.target}`
    foot.appendChild(status)
    if (!claimed) {
      const btn = document.createElement('button')
      btn.className = 'glyph-pick'
      btn.textContent = p.done ? 'Claim' : 'Not yet'
      btn.disabled = !p.done
      btn.addEventListener('click', () => this.claim(def))
      foot.appendChild(btn)
    }

    row.append(head, flavor, track, foot)
    return row
  }

  private claim(def: BountyDef): void {
    const reward = claimBounty(this.state, def, this.regions())
    if (!reward) return
    this.bus.emit('lumen:changed', { total: this.state.lumen, delta: reward.lumen })
    if (reward.glyphStones) {
      this.bus.emit('glyphstone:changed', { total: this.state.glyphStones, delta: reward.glyphStones })
    }
    const bits = [`Bounty claimed: ${def.title}`, `+◆${reward.lumen}`]
    if (reward.glyphStones) bits.push(`+⬡${reward.glyphStones}`)
    if (reward.cardId) bits.push('a new card')
    this.bus.emit('toast', { text: bits.join('  '), flavor: 'reward' })
    this.render()
  }
}
