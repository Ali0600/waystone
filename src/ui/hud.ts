export interface DebugInfo {
  fps: number
  drawCalls: number
  triangles: number
  pos: { x: number; y: number; z: number }
  onGround: boolean
}

/** DOM overlay: region banner, control hints, pointer-lock prompt, F3 debug. */
export class Hud {
  private readonly root: HTMLElement
  private readonly regionBanner: HTMLElement
  private readonly clickHint: HTMLElement
  private readonly debugPanel: HTMLElement
  private readonly counters: HTMLElement
  private readonly prompt: HTMLElement
  private debugVisible = false

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div')
    this.root.className = 'hud'

    this.regionBanner = document.createElement('div')
    this.regionBanner.className = 'hud-region'

    const controls = document.createElement('div')
    controls.className = 'hud-controls'
    controls.textContent =
      'WASD move · Space jump · Shift dash · F lantern · Q grapple · E interact · M map'

    this.clickHint = document.createElement('div')
    this.clickHint.className = 'hud-click-hint'
    this.clickHint.textContent = 'Click to look around'

    this.counters = document.createElement('div')
    this.counters.className = 'hud-counters'

    this.prompt = document.createElement('div')
    this.prompt.className = 'hud-prompt'
    this.prompt.hidden = true

    this.debugPanel = document.createElement('div')
    this.debugPanel.className = 'hud-debug'
    this.debugPanel.hidden = true

    this.root.append(
      this.regionBanner,
      controls,
      this.clickHint,
      this.counters,
      this.prompt,
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
  }

  announceRegion(name: string): void {
    this.regionBanner.textContent = name
    this.regionBanner.classList.remove('visible')
    // Force a reflow so re-announcing restarts the fade animation.
    void this.regionBanner.offsetWidth
    this.regionBanner.classList.add('visible')
  }

  showClickHint(show: boolean): void {
    this.clickHint.style.display = show ? '' : 'none'
  }

  setCounters(lumen: number, glyphStones: number): void {
    this.counters.textContent = `◆ ${lumen}   ⬡ ${glyphStones}`
  }

  setPrompt(text: string | null): void {
    this.prompt.hidden = text === null
    if (text !== null) this.prompt.textContent = text
  }

  setDebug(info: DebugInfo): void {
    if (!this.debugVisible) return
    this.debugPanel.textContent =
      `${info.fps.toFixed(0)} fps · ${info.drawCalls} calls · ${info.triangles} tris\n` +
      `pos ${info.pos.x.toFixed(1)} ${info.pos.y.toFixed(1)} ${info.pos.z.toFixed(1)}` +
      `${info.onGround ? ' · ground' : ' · air'}`
  }
}
