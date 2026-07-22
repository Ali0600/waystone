import { GLYPHS, type GlyphId } from '../content/glyphs'
import type { EventBus } from '../core/events'
import { type Encounter } from '../combat/encounter'
import { BEAT_WINDOW } from '../content/chains'
import { inWindow } from '../combat/timing'

/** Beat-bar labels for the combo keys a chain demands (M35). */
const COMBO_GLYPH: Record<string, string> = {
  KeyW: 'W',
  KeyA: 'A',
  KeyS: 'S',
  KeyD: 'D',
  Space: '␣',
}

/**
 * Combat DOM overlay: HP bars, action menu, the beat bar, telegraphs and
 * lock icons. Renders what the Encounter says; owns no rules.
 */
export class CombatUi {
  private root: HTMLElement
  private enemyName: HTMLElement
  private playerBar: HTMLElement
  private enemyBar: HTMLElement
  /** The classic JRPG command box (right side), shown in the player phase. */
  private menuEl: HTMLElement
  private beatBar: HTMLElement
  private banner: HTMLElement
  private locksEl: HTMLElement
  private feedback: HTMLElement
  private enemyMaxHp = 1
  private unsubs: (() => void)[] = []
  private bannerTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    bus: EventBus,
    enemyName: string,
    enemyHp: number,
    /** Retire-once teaching gate (shared HintSystem). Optional so tests/QA can
     *  construct a bare CombatUi. */
    private hints?: { seen(id: string): boolean; markSeen(id: string): void },
  ) {
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
    this.beatBar = document.createElement('div')
    this.beatBar.className = 'combat-beatbar'
    this.beatBar.hidden = true
    bottom.append(this.beatBar, this.playerBar)

    // The command box lives on the right, not in the bottom cluster.
    this.menuEl = document.createElement('div')
    this.menuEl.className = 'combat-menu'
    this.menuEl.hidden = true

    this.banner = document.createElement('div')
    this.banner.className = 'combat-banner'
    this.banner.hidden = true

    this.locksEl = document.createElement('div')
    this.locksEl.className = 'combat-locks'
    this.locksEl.hidden = true

    this.feedback = document.createElement('div')
    this.feedback.className = 'combat-feedback'

    this.root.append(top, this.banner, this.locksEl, this.feedback, bottom, this.menuEl)
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
        // First lock broken → the player has learned the counterplay; retire
        // the teach line for good.
        if (result === 'lockbroken') this.hints?.markSeen('lock-break')
      }),
      bus.on('combat:beat', ({ result }) => {
        if (result === 'hit') this.flash('●', 'good')
        else if (result === 'wrong') this.flash('wrong key!', 'bad')
        else if (result !== 'pending') this.flash(result, 'bad')
      }),
      bus.on('combat:art', ({ name }) => this.flash(name + '!', 'art')),
      bus.on('combat:perfect', ({ kind }) =>
        this.flash(kind === 'chain' ? 'Perfect!' : 'Perfect guard!', 'perfect'),
      ),
      bus.on('combat:entry', ({ dmg }) => {
        this.showBanner(`Crashing entry!  −${dmg}`, 1.6)
      }),
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
    // One-time counterplay hint: how to break a lock (retired on first break).
    if (this.hints && !this.hints.seen('lock-break')) {
      const teach = document.createElement('span')
      teach.className = 'combat-lock-teach'
      teach.textContent = 'Cancel a lock with its matching glyph (the Glyphs menu, or keys 3+).'
      this.locksEl.appendChild(teach)
    }
  }

  private flash(text: string, flavor: 'good' | 'bad' | 'art' | 'perfect'): void {
    const el = document.createElement('div')
    el.className = `combat-flash ${flavor}`
    el.textContent = text
    this.feedback.appendChild(el)
    setTimeout(() => el.remove(), 900)
  }

  /** Per-frame sync of bars, menu and beat bar. */
  update(encounter: Encounter): void {
    const pf = this.playerBar.firstElementChild as HTMLElement
    // Divide by maxHp (not PLAYER_MAX_HP) so a meal shield never overflows 100%.
    pf.style.width = `${Math.min(100, (encounter.playerHp / encounter.maxHp) * 100)}%`
    const ef = this.enemyBar.firstElementChild as HTMLElement
    ef.style.width = `${(encounter.enemyHp / this.enemyMaxHp) * 100}%`

    if (encounter.phase === 'player') {
      this.menuEl.hidden = false
      this.renderMenu(encounter)
    } else {
      this.menuEl.hidden = true
    }

    // The beat bar serves double duty: the player's own Chain, and — the fix
    // for "I couldn't tell when to parry" — the enemy's incoming strikes.
    if (encounter.phase === 'playerChain' && encounter.chainRun) {
      this.beatBar.hidden = false
      this.beatBar.classList.remove('parry')
      this.renderBeats(encounter)
    } else if (encounter.strikeRun) {
      this.beatBar.hidden = false
      this.beatBar.classList.add('parry')
      this.renderParry(encounter)
    } else {
      this.beatBar.hidden = true
    }
  }

  /** The classic command box: root Attack/Glyphs/Defend/Item or an open submenu. */
  private renderMenu(encounter: Encounter): void {
    const view = encounter.menu.view(encounter.menuRoot())
    let html = ''
    if (view.title) html += `<div class="combat-menu-title">${view.title}</div>`
    html += '<div class="combat-menu-list">'
    view.options.forEach((o, i) => {
      const cls =
        'combat-menu-item' + (i === view.cursor ? ' sel' : '') + (o.disabled ? ' disabled' : '')
      const labelStyle = o.color ? ` style="color:${o.color}"` : ''
      const detail = o.detail ? `<span class="combat-menu-detail">${o.detail}</span>` : ''
      html += `<div class="${cls}"><span class="combat-menu-cur">${i === view.cursor ? '▸' : ''}</span><span class="combat-menu-label"${labelStyle}>${o.label}</span>${detail}</div>`
    })
    html += '</div>'
    html += `<div class="combat-menu-foot">${view.footer}</div>`
    if (this.menuEl.innerHTML !== html) this.menuEl.innerHTML = html
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
      // Each beat shows the key it demands (M35 combo); the NEXT beat is emphasized.
      const key = COMBO_GLYPH[run.keys[i]] ?? '?'
      const keyCls = 'beat-key' + (i === run.beatIndex ? ' next' : '')
      html += `<div class="${cls}" style="left:${(b / total) * 100}%"><span class="${keyCls}">${key}</span></div>`
    }
    html += `<div class="beat-cursor" style="left:${Math.min(100, (rel / total) * 100)}%"></div></div>
      <div class="beat-hint">press each key on its beat</div>`
    if (this.beatBar.innerHTML !== html) this.beatBar.innerHTML = html
  }

  /** The incoming-strike bar: each enemy hit as a marker that lights gold in
   *  its parry window. Mirrors renderBeats so parry reads the same as chaining. */
  private renderParry(encounter: Encounter): void {
    const run = encounter.strikeRun!
    const last = run.hitTimes[run.hitTimes.length - 1]
    const total = last - run.startT + 0.4
    const rel = encounter.t - run.startT
    let html = '<div class="beat-track">'
    for (const [i, hitT] of run.hitTimes.entries()) {
      let cls: string
      if (i < run.hitIndex) cls = run.parried[i] ? 'beat done parried' : 'beat done missed'
      else if (inWindow(encounter.t, hitT, encounter.parryWindow)) cls = 'beat live'
      else cls = 'beat'
      html += `<div class="${cls}" style="left:${((hitT - run.startT) / total) * 100}%"></div>`
    }
    html += `<div class="beat-cursor" style="left:${Math.min(100, Math.max(0, (rel / total) * 100))}%"></div></div>
      <div class="beat-hint">SPACE — parry as it lands</div>`
    if (this.beatBar.innerHTML !== html) this.beatBar.innerHTML = html
  }

  dispose(): void {
    for (const u of this.unsubs) u()
    this.root.remove()
  }
}
