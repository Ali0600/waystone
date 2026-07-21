export interface DebugInfo {
  fps: number
  drawCalls: number
  triangles: number
  pos: { x: number; y: number; z: number }
  onGround: boolean
}

/**
 * Single source of truth for the "Click to look around" hint — pure so it can be
 * unit-tested without a DOM. The pointer-lock path and the combat/overlay path
 * once fought over this element with two different CSS mechanisms (`style.display`
 * vs the `hidden` attribute) and desynced it; both now funnel through here.
 * - `wantClickHint`   — the pointer is unlocked (mouse-look needs a click).
 * - `worldUiSuppressed` — a duel or full-screen overlay owns the screen.
 * - `lookLearned`     — the player has locked at least once; retire the hint for good.
 */
export function clickHintHidden(
  wantClickHint: boolean,
  worldUiSuppressed: boolean,
  lookLearned: boolean,
): boolean {
  return lookLearned || worldUiSuppressed || !wantClickHint
}

/** DOM overlay: region banner, control hints, pointer-lock prompt, F3 debug. */
export class Hud {
  private readonly root: HTMLElement
  private readonly regionBanner: HTMLElement
  private readonly controls: HTMLElement
  private readonly clickHint: HTMLElement
  private readonly debugPanel: HTMLElement
  private readonly counters: HTMLElement
  private readonly prompt: HTMLElement
  private readonly mistMeter: HTMLElement
  private readonly mistFill: HTMLElement
  private debugVisible = false
  private wantClickHint = false
  private worldUiSuppressed = false
  private lookLearned = false

  constructor(parent: HTMLElement = document.body, initialLookLearned = false) {
    this.lookLearned = initialLookLearned
    this.root = document.createElement('div')
    this.root.className = 'hud'

    this.regionBanner = document.createElement('div')
    this.regionBanner.className = 'hud-region'

    this.controls = document.createElement('div')
    this.controls.className = 'hud-controls'
    this.controls.textContent =
      'WASD move · Space jump · Shift dash · F lantern · Q grapple · T sounding · C chime · E interact · M map · G glyphs · I ledger · L log'
    const controls = this.controls

    this.clickHint = document.createElement('div')
    this.clickHint.className = 'hud-click-hint'
    this.clickHint.textContent = 'Click to look around'

    this.counters = document.createElement('div')
    this.counters.className = 'hud-counters'

    this.prompt = document.createElement('div')
    this.prompt.className = 'hud-prompt'
    this.prompt.hidden = true

    this.mistMeter = document.createElement('div')
    this.mistMeter.className = 'mist-meter'
    this.mistMeter.hidden = true
    this.mistFill = document.createElement('div')
    this.mistFill.className = 'mist-fill'
    this.mistMeter.appendChild(this.mistFill)

    this.debugPanel = document.createElement('div')
    this.debugPanel.className = 'hud-debug'
    this.debugPanel.hidden = true

    this.root.append(
      this.regionBanner,
      controls,
      this.clickHint,
      this.counters,
      this.prompt,
      this.mistMeter,
      this.debugPanel,
    )
    parent.appendChild(this.root)

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault()
        this.debugVisible = !this.debugVisible
        this.debugPanel.hidden = !this.debugVisible
      }
    })

    // Start hidden until the pointer-lock wiring decides (avoids a boot flash).
    this.applyClickHint()
  }

  announceRegion(name: string): void {
    this.regionBanner.textContent = name
    this.regionBanner.classList.remove('visible')
    // Force a reflow so re-announcing restarts the fade animation.
    void this.regionBanner.offsetWidth
    this.regionBanner.classList.add('visible')
  }

  /** Reflect pointer-lock state: `show` = pointer unlocked, so "click to look
   *  around" is relevant. The first lock (`show === false`) retires the hint for
   *  good (learn-once) so it never nags again — including after every battle. */
  showClickHint(show: boolean): void {
    this.wantClickHint = show
    if (!show) this.lookLearned = true
    this.applyClickHint()
  }

  /** Hide the world HUD (controls hint, click hint, prompt) while a duel or
   *  full-screen overlay owns the screen — otherwise the always-on controls
   *  line bleeds under the combat cluster. Counters/region banner stay.
   *  Restoring does NOT force the click hint on: it re-derives from real state,
   *  so a fight can't resurrect it. */
  setWorldUiVisible(visible: boolean): void {
    this.controls.hidden = !visible
    this.worldUiSuppressed = !visible
    if (!visible) this.prompt.hidden = true
    this.applyClickHint()
  }

  /** The one writer for the click hint — never toggle it from two places with
   *  two CSS mechanisms (that desync shipped once). Uses the `hidden` attribute
   *  only; `.hud-click-hint` has no `display:` rule, so UA `[hidden]{display:none}`
   *  hides it cleanly. Add the guard here if a `display:` rule is ever added. */
  private applyClickHint(): void {
    this.clickHint.hidden = clickHintHidden(
      this.wantClickHint,
      this.worldUiSuppressed,
      this.lookLearned,
    )
  }

  setCounters(lumen: number, glyphStones: number): void {
    this.counters.textContent = `◆ ${lumen}   ⬡ ${glyphStones}`
  }

  setPrompt(text: string | null): void {
    this.prompt.hidden = text === null
    if (text !== null) this.prompt.textContent = text
  }

  /** Mistwalker charge (0..1), or null to hide the meter (unowned or full). */
  setMistCharge(fraction: number | null): void {
    this.mistMeter.hidden = fraction === null
    if (fraction !== null) {
      const f = Math.max(0, Math.min(1, fraction))
      this.mistFill.style.width = `${f * 100}%`
      this.mistFill.style.background = f < 0.25 ? '#e05a3f' : '#bfe8ff'
    }
  }

  setDebug(info: DebugInfo): void {
    if (!this.debugVisible) return
    this.debugPanel.textContent =
      `${info.fps.toFixed(0)} fps · ${info.drawCalls} calls · ${info.triangles} tris\n` +
      `pos ${info.pos.x.toFixed(1)} ${info.pos.y.toFixed(1)} ${info.pos.z.toFixed(1)}` +
      `${info.onGround ? ' · ground' : ' · air'}`
  }
}
