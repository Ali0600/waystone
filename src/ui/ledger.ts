import type { GameState } from '../core/state'
import type { World } from '../world/world'
import { guideModel, guidePercent, type GuideRegion } from '../progression/guide'
import { treasureModel } from '../progression/inventory'
import { TOOL_IDS, TOOL_INFO, type ToolId } from '../content/tools'
import { RECRUITS } from '../content/recruits'
import { ARTS } from '../content/chains'
import { COMBOS } from '../content/glyphs'
import { FISH, mealShield } from '../minigames/angling'
import type { DiscoveryKind } from '../discovery/types'
import type { MessageLog } from './messagelog'

type LedgerTab = 'inventory' | 'guide' | 'log'

const ARCHIVIST_ID = RECRUITS.find((r) => r.role === 'archivist')!.personId

/** Arrow glyphs for a Hidden Art's key sequence (only shown once LEARNED). */
const KEY_GLYPH: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: '␣',
}

/** A small icon per discoverable kind — enough to tell a buried cache from a
 *  sealed stone at a glance, without naming anything. */
const KIND_ICON: Record<DiscoveryKind, string> = {
  cache: '◈',
  glyphstone: '⬡',
  latent: '◇',
  buried: '⛏',
  sealed: '▦',
  guarded: '⚔',
  perch: '↟',
  person: '☺',
  waystone: '◎',
}

/**
 * The Surveyor's Ledger — one panel, two tabs. Inventory (what you hold and
 * what it does) is always open; the 100% Guide is kept by Fen the Archivist and
 * unlocks when he is home. Opened with `I` anywhere, or by talking to Fen (which
 * jumps straight to the Guide tab).
 *
 * The Guide surfaces remaining discoverables by CUE, never by name — see
 * `guideModel`. Hidden Arts show their key sequence only once learned.
 */
export class LedgerPanel {
  private overlay: HTMLElement
  private tabsEl: HTMLElement
  private panelEl: HTMLElement
  private hintEl: HTMLElement
  private tab: LedgerTab = 'inventory'
  visible = false

  constructor(
    private world: World,
    private state: GameState,
    private messageLog: MessageLog,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'esc-overlay'
    this.overlay.hidden = true

    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'The Surveyor’s Ledger'

    this.tabsEl = document.createElement('div')
    this.tabsEl.className = 'ledger-tabs'

    this.panelEl = document.createElement('div')
    this.panelEl.className = 'ledger-panel'

    this.hintEl = document.createElement('div')
    this.hintEl.className = 'glyph-status'

    this.overlay.append(title, this.tabsEl, this.panelEl, this.hintEl)
    document.body.appendChild(this.overlay)

    // Registered before EscMenu's listener (constructed later in main):
    // Escape closes the ledger first; the menu skips opening beneath it.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.close()
        e.stopPropagation()
      }
    })
  }

  private fenHome(): boolean {
    return this.state.discoveries[ARCHIVIST_ID] === 'found'
  }

  open(tab: LedgerTab): void {
    this.tab = tab
    this.visible = true
    this.overlay.hidden = false
    document.exitPointerLock?.()
    this.render()
  }

  close(): void {
    this.visible = false
    this.overlay.hidden = true
  }

  /** A tab key toggles its OWN tab shut, but switches to it from another tab —
   *  so `I` (inventory) and `L` (log) hop between tabs instead of closing. */
  toggle(tab: LedgerTab = 'inventory'): void {
    if (this.visible && this.tab === tab) this.close()
    else this.open(tab)
  }

  private render(): void {
    this.renderTabs()
    this.panelEl.replaceChildren()
    if (this.tab === 'inventory') this.renderInventory()
    else if (this.tab === 'log') this.renderLog()
    else this.renderGuide()
  }

  private renderTabs(): void {
    this.tabsEl.replaceChildren()
    const mk = (tab: LedgerTab, label: string) => {
      const b = document.createElement('button')
      b.className = 'glyph-pick ledger-tab' + (this.tab === tab ? ' active' : '')
      b.textContent = label
      b.addEventListener('click', () => {
        this.tab = tab
        this.render()
      })
      this.tabsEl.appendChild(b)
    }
    mk('inventory', 'Inventory')
    mk('guide', 'Guide')
    mk('log', 'Log')
  }

  // --- helpers ---------------------------------------------------------------

  private sectionTitle(text: string): void {
    const el = document.createElement('div')
    el.className = 'ledger-section-title'
    el.textContent = text
    this.panelEl.appendChild(el)
  }

  private line(label: string, value: string): void {
    const el = document.createElement('div')
    el.className = 'ledger-line'
    const l = document.createElement('span')
    l.textContent = label
    const dots = document.createElement('span')
    dots.className = 'ledger-dots'
    const v = document.createElement('span')
    v.textContent = value
    el.append(l, dots, v)
    this.panelEl.appendChild(el)
  }

  /** A "label — what it does" descriptive row (no dotted leader). */
  private descRow(head: string, desc: string, color?: string): void {
    const el = document.createElement('div')
    el.className = 'ledger-desc'
    const h = document.createElement('span')
    h.className = 'ledger-desc-head'
    if (color) h.style.color = color
    h.textContent = head
    const d = document.createElement('span')
    d.className = 'ledger-desc-body'
    d.textContent = ` — ${desc}`
    el.append(h, d)
    this.panelEl.appendChild(el)
  }

  // --- Inventory tab ---------------------------------------------------------

  private renderInventory(): void {
    const s = this.state

    this.sectionTitle('Held')
    this.line('Lumen', `◆ ${s.lumen}`)
    this.line('Blank Glyph Stones', `⬡ ${s.glyphStones}`)
    this.line('Waystones', `${s.waystones}`)

    // Tools — owned only (unfound tools stay unspoiled; the Guide counts them).
    const ownedTools = TOOL_IDS.filter((id) => this.hasTool(id))
    this.sectionTitle(`Tools (${ownedTools.length} / ${TOOL_IDS.length})`)
    for (const id of ownedTools) {
      const info = TOOL_INFO[id]
      const key = info.key ? ` [${info.key}]` : ''
      this.descRow(`${info.name}${key}`, info.desc)
    }

    // Fish (Cook fodder).
    const fish = FISH.filter((f) => (s.fishHeld[f.id] ?? 0) > 0)
    if (fish.length > 0 || s.pendingMeal) {
      this.sectionTitle('Catch')
      for (const f of fish) {
        this.descRow(
          `${f.name} ×${s.fishHeld[f.id]}`,
          `cooked at Marou, shields ${mealShield(f.id)} HP next fight`,
        )
      }
      if (s.pendingMeal) {
        const meal = FISH.find((f) => f.id === s.pendingMeal)
        this.descRow(
          'A cooked meal is readied',
          meal ? `shields ${mealShield(meal.id)} HP at your next fight` : 'a buff awaits your next fight',
        )
      }
    }

    // Treasures — the named finds you've collected, and what each one yielded.
    const treasures = treasureModel(s, this.world.regions.map((r) => r.def))
    if (treasures.length > 0) {
      this.sectionTitle(`Treasures (${treasures.length})`)
      for (const t of treasures) {
        const bits = [t.regionName]
        if (t.yields.lumen > 0) bits.push(`◆ ${t.yields.lumen}`)
        if (t.yields.glyphStones > 0) bits.push(`⬡ ${t.yields.glyphStones}`)
        if (t.yields.waystones > 0) bits.push(`◎ ${t.yields.waystones}`)
        this.descRow(`${KIND_ICON[t.kind]} ${t.label}`, bits.join(' · '))
      }
    }

    // Cards — the collection lives at the Painted Table.
    this.sectionTitle('Deck')
    this.line('Cards collected', `${s.cardsOwned.length}`)

    // Hidden Arts — LEARNED ones show their sequence (permanent knowledge).
    const arts = ARTS.filter((a) => s.artsUnlocked.includes(a.id))
    if (arts.length > 0) {
      this.sectionTitle('Hidden Arts learned')
      for (const a of arts) {
        const seq = a.sequence.map((k) => KEY_GLYPH[k] ?? k).join(' ')
        this.descRow(a.name, seq)
      }
    }

    // Resonances discovered.
    const fusions = COMBOS.filter((c) => s.combosDiscovered.includes(c.id))
    if (fusions.length > 0) {
      this.sectionTitle('Resonances discovered')
      for (const c of fusions) {
        this.descRow(`${c.rune} ${c.name}`, c.desc, c.color)
      }
    }

    this.hintEl.textContent = 'Fen: "What you carry, and what it is for."'
  }

  private hasTool(id: ToolId): boolean {
    if (id === 'lantern') return true // innate
    return this.state.tools[id]
  }

  // --- Log tab ---------------------------------------------------------------

  /** Every bottom-left message this session, newest first — including ones the
   *  5-toast stack evicted before they could be read. */
  private renderLog(): void {
    const entries = this.messageLog.entries()
    if (entries.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'ledger-gated'
      empty.textContent = 'Nothing logged yet — messages you see will gather here.'
      this.panelEl.appendChild(empty)
      this.hintEl.textContent = ''
      return
    }
    this.sectionTitle(`Messages (${entries.length})`)
    const list = document.createElement('div')
    list.className = 'ledger-log'
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      const row = document.createElement('div')
      row.className = 'ledger-log-row' + (e.flavor === 'reward' ? ' reward' : '')
      row.textContent = e.text
      list.appendChild(row)
    }
    this.panelEl.appendChild(list)
    this.hintEl.textContent = 'Fen: "Every word the world has said to you, kept in order."'
  }

  // --- Guide tab -------------------------------------------------------------

  private renderGuide(): void {
    if (!this.fenHome()) {
      const gated = document.createElement('div')
      gated.className = 'ledger-gated'
      gated.textContent =
        'Fen would keep this ledger — someone in Amberfall minds the records. Find the Archivist and bring them home.'
      this.panelEl.appendChild(gated)
      this.hintEl.textContent = ''
      return
    }

    const model = guideModel(this.state, this.world.regions.map((r) => r.def), (id) =>
      this.world.isManifested(id),
    )

    // Overall progress.
    const pct = guidePercent(model.overall)
    this.sectionTitle(`The song is ${pct}% resung`)
    this.bar(pct)

    // Per-region breakdown with remaining-by-cue.
    this.sectionTitle('The isles')
    for (const r of model.regions) this.renderRegion(r)

    // Cross-system tallies.
    this.sectionTitle('Across the world')
    this.line('People home', `${model.people.current} / ${model.people.total}`)
    this.line('Tools recovered', `${model.tools.current} / ${model.tools.total}`)
    this.line('Isles woken', `${model.isles.current} / ${model.isles.total}`)
    this.line('Foes faced', `${model.foes.current} / ${model.foes.total}`)
    this.line('Verbs mastered', `${model.mastery.current} / ${model.mastery.total}`)
    this.line('Reward-board bounties', `${model.bounties.current} / ${model.bounties.total}`)
    this.line('Cards collected', `${model.cards.current} / ${model.cards.total}`)
    // Counts only — never the sequences/recipes (knowledge is a reward).
    this.line('Hidden Arts learned', `${model.arts.current} / ${model.arts.total}`)
    this.line('Resonances discovered', `${model.fusions.current} / ${model.fusions.total}`)

    this.hintEl.textContent = 'Fen: "Every blank line is a place you have not listened yet."'
  }

  private renderRegion(r: GuideRegion): void {
    if (r.latent) {
      this.line('— a latent isle —', 'its Waystone waits')
      return
    }
    this.line(r.name ?? '—', `${r.found} / ${r.total}`)
    if (r.remaining.length === 0) return
    const list = document.createElement('div')
    list.className = 'ledger-remaining'
    for (const rem of r.remaining) {
      const row = document.createElement('div')
      row.className = 'ledger-remaining-row'
      const icon = document.createElement('span')
      icon.className = 'ledger-kind'
      icon.textContent = KIND_ICON[rem.kind] ?? '•'
      const cue = document.createElement('span')
      cue.textContent = rem.cue
      row.append(icon, cue)
      if (rem.status !== 'unseen') {
        const tag = document.createElement('span')
        tag.className = 'ledger-tag'
        tag.textContent = rem.status === 'ready' ? 'revealed' : '?'
        row.appendChild(tag)
      }
      list.appendChild(row)
    }
    this.panelEl.appendChild(list)
  }

  private bar(pct: number): void {
    const track = document.createElement('div')
    track.className = 'ledger-bar'
    const fill = document.createElement('div')
    fill.className = 'ledger-bar-fill'
    fill.style.width = `${pct}%`
    track.appendChild(fill)
    this.panelEl.appendChild(track)
  }
}
