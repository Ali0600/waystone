import type { GameState } from '../core/state'
import { attunementModel, type AttunementModel } from '../progression/attunement'

/** Roman numerals for tiers/levels — the LoD Addition-chart feel. */
const ROMAN = ['I', 'II', 'III']

const SKIN_KEY = 'waystone:attunement-style'
type Skin = 'lod' | 'surveyor'

function loadSkin(): Skin {
  try {
    return localStorage.getItem(SKIN_KEY) === 'surveyor' ? 'surveyor' : 'lod'
  } catch {
    return 'lod'
  }
}

/**
 * The Attunement screen (M30, key `P`) — a full-screen progression chart in the
 * spirit of The Legend of Dragoon's Addition menu: every verb tier, combat
 * chain, tool, glyph, Hidden Art and Resonance, with a "Next LV" counter toward
 * each next step. Locked/unearned entries read `???` (knowledge is a reward).
 *
 * Two skins, user-toggled: **Dragoon** (navy / silver / gold — the LoD look) and
 * **Surveyor** (the game's amber-on-dark palette). The choice persists in a
 * standalone localStorage key (no save-schema coupling — the look-hint precedent).
 *
 * All data comes from the pure `attunementModel`; this class only renders.
 */
export class AttunementPanel {
  private overlay: HTMLElement
  private headEl: HTMLElement
  private panelEl: HTMLElement
  private skin: Skin
  visible = false

  constructor(private state: GameState) {
    this.skin = loadSkin()

    this.overlay = document.createElement('div')
    this.overlay.className = 'attune-overlay'
    this.overlay.hidden = true

    this.headEl = document.createElement('div')
    this.headEl.className = 'attune-head'

    this.panelEl = document.createElement('div')
    this.panelEl.className = 'attune-panel'

    this.overlay.append(this.headEl, this.panelEl)
    document.body.appendChild(this.overlay)
    this.applySkin()

    // Escape closes THIS panel first (registered before EscMenu in main), and
    // stopImmediatePropagation keeps the pause menu from popping open beneath.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.close()
        e.stopImmediatePropagation()
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

  toggle(): void {
    if (this.visible) this.close()
    else this.open()
  }

  private applySkin(): void {
    this.overlay.classList.toggle('lod', this.skin === 'lod')
  }

  private setSkin(skin: Skin): void {
    this.skin = skin
    try {
      localStorage.setItem(SKIN_KEY, skin)
    } catch {
      /* private mode — the look reverts to default next session, no harm */
    }
    this.applySkin()
    this.render()
  }

  // --- render ----------------------------------------------------------------

  private render(): void {
    this.renderHead()
    this.panelEl.replaceChildren()
    const m = attunementModel(this.state)
    this.renderVerbs(m)
    this.renderChains(m)
    this.renderTools(m)
    this.renderGlyphs(m)
    this.renderArtsFusions(m)
  }

  private renderHead(): void {
    this.headEl.replaceChildren()
    const title = document.createElement('div')
    title.className = 'attune-title'
    title.textContent = 'Attunement'
    const toggle = document.createElement('button')
    toggle.className = 'attune-skin-toggle'
    toggle.textContent = this.skin === 'lod' ? 'Skin: Dragoon' : 'Skin: Surveyor'
    toggle.title = 'Toggle the menu style'
    toggle.addEventListener('click', () => this.setSkin(this.skin === 'lod' ? 'surveyor' : 'lod'))
    this.headEl.append(title, toggle)
  }

  private section(title: string, sub?: string): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'attune-section'
    const h = document.createElement('div')
    h.className = 'attune-section-title'
    h.textContent = title
    if (sub) {
      const s = document.createElement('span')
      s.className = 'attune-section-sub'
      s.textContent = ` ${sub}`
      h.appendChild(s)
    }
    wrap.appendChild(h)
    this.panelEl.appendChild(wrap)
    return wrap
  }

  /** A chart row: NAME cell + any number of value cells (right-aligned). */
  private row(
    parent: HTMLElement,
    name: string,
    cells: string[],
    opts: { head?: boolean; masked?: boolean; nameColor?: string } = {},
  ): HTMLElement {
    const r = document.createElement('div')
    r.className =
      'attune-row' + (opts.head ? ' head' : '') + (opts.masked ? ' masked' : '')
    const n = document.createElement('span')
    n.className = 'attune-cell name'
    if (opts.nameColor) n.style.color = opts.nameColor
    n.textContent = name
    r.appendChild(n)
    for (const c of cells) {
      const cell = document.createElement('span')
      cell.className = 'attune-cell val'
      cell.textContent = c
      r.appendChild(cell)
    }
    parent.appendChild(r)
    return r
  }

  /** A "24 / 36" counter toward the next step, or "MAX". */
  private nextText(next: { atUses: number; toGo: number } | null, uses: number): string {
    return next ? `${uses} / ${next.atUses}` : 'MAX'
  }

  private renderVerbs(m: AttunementModel): void {
    const s = this.section('Verbs', '— tiers deepen with use')
    this.row(s, 'VERB', ['TIER', 'NEXT'], { head: true })
    for (const v of m.verbs) {
      this.row(s, v.name, [ROMAN[v.tier - 1], this.nextText(v.next, v.uses)])
      // Sub-line: what each tier grants — earned ones named, the rest ???.
      const props = document.createElement('div')
      props.className = 'attune-props'
      for (const p of v.properties) {
        const chip = document.createElement('span')
        chip.className = 'attune-prop' + (p.label ? ' earned' : '')
        chip.textContent = `${ROMAN[p.tier - 1]} ${p.label ?? '???'}`
        props.appendChild(chip)
      }
      s.appendChild(props)
    }
  }

  private renderChains(m: AttunementModel): void {
    const s = this.section('Chains', '— your attacks grow, LoD-style')
    this.row(s, 'CHAIN', ['LV', 'NEXT', 'HITS', 'DMG'], { head: true })
    for (const c of m.chains) {
      if (!c.known) {
        this.row(s, '???', ['—', '—', '—', '—'], { masked: true })
        continue
      }
      this.row(s, c.name!, [
        ROMAN[c.level - 1],
        this.nextText(c.next, c.uses),
        `${c.hits}`,
        `${c.dmgPerBeat}`,
      ])
    }
  }

  private renderTools(m: AttunementModel): void {
    const owned = m.tools.filter((t) => t.owned).length
    const s = this.section('Tools', `(${owned} / ${m.tools.length})`)
    for (const t of m.tools) {
      if (!t.owned) {
        this.row(s, '???', ['locked'], { masked: true })
        continue
      }
      const key = t.key ? ` [${t.key}]` : ''
      const r = this.row(s, `${t.name}${key}`, [])
      const d = document.createElement('span')
      d.className = 'attune-tool-desc'
      d.textContent = t.desc ?? ''
      r.appendChild(d)
    }
  }

  private renderGlyphs(m: AttunementModel): void {
    const s = this.section('Glyphs', '— notes you have sounded')
    this.row(s, 'GLYPH', ['USES'], { head: true })
    for (const g of m.glyphs) {
      this.row(s, `${g.rune} ${g.name}`, [`${g.uses}`], { nameColor: g.color })
    }
  }

  private renderArtsFusions(m: AttunementModel): void {
    const s = this.section(
      'Hidden Arts & Resonances',
      `(${m.arts.learned.length} / ${m.arts.total} · ${m.fusions.discovered.length} / ${m.fusions.total})`,
    )
    // Names of what's earned; the rest stay a mystery (never their sequences/recipes).
    const arts = m.arts.learned.length
      ? m.arts.learned.map((a) => a.name).join(' · ')
      : 'none learned yet'
    this.row(s, 'Arts learned', [arts])
    const fus = m.fusions.discovered.length
      ? m.fusions.discovered.map((f) => `${f.rune} ${f.name}`).join('  ')
      : 'none discovered yet'
    this.row(s, 'Resonances', [fus])
  }
}
