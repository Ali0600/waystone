import type { GameState } from '../core/state'
import type { RegionDef } from '../world/region'
import type { DiscoverableDef } from './types'

/**
 * The Reopening Map: a top-down schematic with auto-pinned "?" markers.
 * Canvas 2D in a DOM overlay, toggled with M.
 */
export class RegionMap {
  private overlay: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  visible = false

  constructor(
    private region: RegionDef,
    private defs: DiscoverableDef[],
    private state: GameState,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'map-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = region.name
    this.canvas = document.createElement('canvas')
    this.canvas.width = 520
    this.canvas.height = 520
    this.overlay.append(title, this.canvas)
    document.body.appendChild(this.overlay)
    this.ctx = this.canvas.getContext('2d')!
  }

  toggle(): void {
    this.visible = !this.visible
    this.overlay.hidden = !this.visible
  }

  /** Region-space (x,z) → canvas px. */
  private toCanvas(x: number, z: number): [number, number] {
    const half = this.canvas.width / 2
    const scale = (half - 24) / this.region.island.radius
    return [half + x * scale, half + z * scale]
  }

  draw(playerX: number, playerZ: number, playerYaw: number, completion: { found: number; total: number }): void {
    if (!this.visible) return
    const ctx = this.ctx
    const w = this.canvas.width
    ctx.clearRect(0, 0, w, w)

    // Island disc + plateaus.
    const [cx, cy] = this.toCanvas(0, 0)
    const scale = (w / 2 - 24) / this.region.island.radius
    ctx.fillStyle = 'rgba(90, 82, 128, 0.35)'
    ctx.beginPath()
    ctx.arc(cx, cy, this.region.island.radius * scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(140, 128, 180, 0.28)'
    for (const p of this.region.island.plateaus) {
      const [px, py] = this.toCanvas(p.x, p.z)
      ctx.beginPath()
      ctx.arc(px, py, p.r * scale, 0, Math.PI * 2)
      ctx.fill()
    }

    // Landmarks.
    ctx.fillStyle = 'rgba(232, 226, 212, 0.75)'
    ctx.font = '13px Georgia'
    ctx.textAlign = 'center'
    for (const lm of this.region.landmarks) {
      const [lx, ly] = this.toCanvas(lm.x, lm.z)
      const icon =
        lm.kind === 'socket' ? '◎' : lm.kind === 'spire' ? '▲' : lm.kind === 'arch' ? '∩' : '•'
      ctx.fillText(icon, lx, ly + 4)
    }

    // Discoveries: pinned "?", found dots.
    for (const def of this.defs) {
      const status = this.state.discoveries[def.id]
      const [dx, dy] = this.toCanvas(def.x, def.z)
      if (status === 'pinned' || status === 'revealed') {
        ctx.fillStyle = '#ffb347'
        ctx.font = 'bold 15px Georgia'
        ctx.fillText('?', dx, dy + 5)
      } else if (status === 'found') {
        ctx.fillStyle = 'rgba(159, 216, 208, 0.8)'
        ctx.beginPath()
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Player arrow.
    const [pxc, pyc] = this.toCanvas(playerX, playerZ)
    ctx.save()
    ctx.translate(pxc, pyc)
    ctx.rotate(-playerYaw)
    ctx.fillStyle = '#ffe8b0'
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(4.5, 5)
    ctx.lineTo(-4.5, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Completion.
    ctx.fillStyle = 'rgba(232, 226, 212, 0.85)'
    ctx.font = '14px Georgia'
    ctx.fillText(`${completion.found} / ${completion.total} discovered`, w / 2, w - 8)
  }
}
