import { GLYPHS, type GlyphId } from '../content/glyphs'
import type { EventBus } from '../core/events'
import { PLAYER_MAX_HP, type Encounter } from '../combat/encounter'
import { BEAT_WINDOW } from '../content/chains'
import { inWindow } from '../combat/timing'

/**
 * Combat DOM overlay: HP bars, action menu, the beat bar, telegraphs and
 * lock icons. Renders what the Encounter says; owns no rules.
 */
export class CombatUi {
  private root: HTMLElement
  private enemyName: HTMLElement
  private playerBar: HTMLElement
  private enemyBar: HTMLElement
  private actions: HTMLElement
  private beatBar: HTMLElement
  private banner: HTMLElement
  private locksEl: HTMLElement
  private feedback: HTMLElement
  private enemyMaxHp = 1
  private unsubs: (() => void)[] = []
  private bannerTimer: ReturnType<typeof setTimeout> | null = null

  constructor(bus: EventBus, enemyName: string, enemyHp: number) {
    this.enemyMaxHp = enemyHp
    this.root = document.createElement('div')
    this.root.className = 'combat-ui'

    const top = document.createElement('div')
    top.className = 'combat-top'
    this.enemyName = document.createElement('div')
    this.enemyName.className = 'combat-enemy-name'
    this.enemyName.textContent = enemyName
    this.enemyBar = document.createElement('div')
    this.enemyBar.className = 'combat-bar enemy'
    this.enemyBar.innerHTML = '<div class="combat-bar-fill"></div>'
    top.append(this.enemyName, this.enemyBar)

    const bottom = document.createElement('div')
    bottom.className = 'combat-bottom'
    this.playerBar = document.createElement('div')
    this.playerBar.className = 'combat-bar player'
    this.playerBar.innerHTML = '<div class="combat-bar-fill"></div>'
    this.actions = document.createElement('div')
    this.actions.className = 'combat-actions'
    this.beatBar = document.createElement('div')
    this.beatBar.className = 'combat-beatbar'
    this.beatBar.hidden = true
    bottom.append(this.beatBar, this.actions, this.playerBar)

    this.banner = document.createElement('div')
    this.banner.className = 'combat-banner'
    this.banner.hidden = true

    this.locksEl = document.createElement('div')
    this.locksEl.className = 'combat-locks'
    this.locksEl.hidden = true

    this.feedback = document.createElement('div')
    this.feedback.className = 'combat-feedback'

    this.root.append(top, this.banner, this.locksEl, this.feedback, bottom)
    document.body.appendChild(this.root)

    this.unsubs.push(
      bus.on('combat:telegraph', ({ name, pattern, locks }) => {
        this.showBanner(
          pattern === 'chant' ? `${name} — a chant rises!` : name,
          pattern === 'chant' ? 2.2 : 1.4,
        )
        if (locks.length > 0) this.showLocks(locks as GlyphId[])
      }),
      bus.on('combat:lock', ({ remaining }) => {
        if (remaining.length === 0) this.locksEl.hidden = true
        else this.showLocks(remaining as GlyphId[])
      }),
      bus.on('combat:parry', ({ result }) => {
        const text =
          result === 'parried'
            ? 'Parried!'
            : result === 'reflected'
              ? 'Reflected!'
              : result === 'lockbroken'
                ? 'Lock shattered!'
                : ''
        if (text) this.flash(text, 'good')
      }),
      bus.on('combat:beat', ({ result }) => {
        if (result === 'hit') this.flash('●', 'good')
        else if (result !== 'pending') this.flash(result, 'bad')
      }),
      bus.on('combat:art', ({ name }) => this.flash(name + '!', 'art')),
      bus.on('combat:damage', ({ target, amount }) => {
        if (target === 'player') this.flash(`-${amount}`, 'bad')
      }),
    )
  }

  private showBanner(text: string, seconds: number): void {
    this.banner.textContent = text
    this.banner.hidden = false
    if (this.bannerTimer) clearTimeout(this.bannerTimer)
    this.bannerTimer = setTimeout(() => {
      this.banner.hidden = true
    }, seconds * 1000)
  }

  private showLocks(locks: GlyphId[]): void {
    this.locksEl.hidden = false
    this.locksEl.replaceChildren()
    const label = document.createElement('span')
    label.textContent = 'LOCKS '
    this.locksEl.appendChild(label)
    for (const l of locks) {
      const g = GLYPHS[l]
      const chip = document.createElement('span')
      chip.className = 'combat-lock-chip'
      chip.style.borderColor = g.color
      chip.style.color = g.color
      chip.textContent = `${g.rune} ${g.name}`
      this.locksEl.appendChild(chip)
    }
  }

  private flash(text: string, flavor: 'good' | 'bad' | 'art'): void {
    const el = document.createElement('div')
    el.className = `combat-flash ${flavor}`
    el.textContent = text
    this.feedback.appendChild(el)
    setTimeout(() => el.remove(), 900)
  }

  /** Per-frame sync of bars, menu and beat bar. */
  update(encounter: Encounter): void {
    const pf = this.playerBar.firstElementChild as HTMLElement
    pf.style.width = `${(encounter.playerHp / PLAYER_MAX_HP) * 100}%`
    const ef = this.enemyBar.firstElementChild as HTMLElement
    ef.style.width = `${(encounter.enemyHp / this.enemyMaxHp) * 100}%`

    if (encounter.phase === 'player') {
      this.actions.hidden = false
      this.renderActions(encounter)
    } else {
      this.actions.hidden = true
    }

    if (encounter.phase === 'playerChain' && encounter.chainRun) {
      this.beatBar.hidden = false
      this.renderBeats(encounter)
    } else {
      this.beatBar.hidden = true
    }
  }

  private renderActions(encounter: Encounter): void {
    const chains = encounter.availableChains()
    const glyphs = encounter.availableGlyphs()
    const parts: string[] = []
    chains.forEach((c, i) => {
      const uses = 0
      void uses
      parts.push(`<span class="combat-key">${i + 1}</span> ${c.name}`)
    })
    glyphs.forEach((g, i) => {
      const def = GLYPHS[g]
      parts.push(
        `<span class="combat-key">${i + 3}</span> <span style="color:${def.color}">${def.rune} ${def.name}</span>`,
      )
    })
    const html = parts.join('<span class="combat-sep">·</span>')
    if (this.actions.innerHTML !== html) this.actions.innerHTML = html
  }

  private renderBeats(encounter: Encounter): void {
    const run = encounter.chainRun!
    const rel = encounter.t - run.startT
    const total = run.beats[run.beats.length - 1] + 0.4
    let html = '<div class="beat-track">'
    for (const [i, b] of run.beats.entries()) {
      const cls =
        i < run.beatIndex
          ? 'beat done'
          : inWindow(rel, b, BEAT_WINDOW)
            ? 'beat live'
            : 'beat'
      html += `<div class="${cls}" style="left:${(b / total) * 100}%"></div>`
    }
    html += `<div class="beat-cursor" style="left:${Math.min(100, (rel / total) * 100)}%"></div></div>
      <div class="beat-hint">SPACE on the beat</div>`
    if (this.beatBar.innerHTML !== html) this.beatBar.innerHTML = html
  }

  dispose(): void {
    for (const u of this.unsubs) u()
    this.root.remove()
  }
}
