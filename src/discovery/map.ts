import type { GameState } from '../core/state'
import type { World } from '../world/world'

/**
 * The Reopening Map: a top-down schematic of every island with auto-pinned
 * "?" markers. Canvas 2D in a DOM overlay, toggled with M.
 */
export class RegionMap {
  private overlay: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  visible = false
  /** World-bounds → canvas transform, computed once from the region list. */
  private cx: number
  private cz: number
  private scale: number

  constructor(
    private world: World,
    private state: GameState,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'map-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'Survey Map'
    this.canvas = document.createElement('canvas')
    this.canvas.width = 560
    this.canvas.height = 560
    this.overlay.append(title, this.canvas)
    document.body.appendChild(this.overlay)
    this.ctx = this.canvas.getContext('2d')!

    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const r of this.world.regions) {
      const [ox, oz] = r.def.origin
      const rad = r.def.island.radius
      minX = Math.min(minX, ox - rad)
      maxX = Math.max(maxX, ox + rad)
      minZ = Math.min(minZ, oz - rad)
      maxZ = Math.max(maxZ, oz + rad)
    }
    this.cx = (minX + maxX) / 2
    this.cz = (minZ + maxZ) / 2
    const span = Math.max(maxX - minX, maxZ - minZ)
    this.scale = (this.canvas.width - 56) / span

    // Escape closes the map like every other panel. Immediate-stop so the
    // EscMenu (registered later) doesn't pop open beneath the closing map.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.close()
        e.stopImmediatePropagation()
      }
    })
  }

  toggle(): void {
    this.visible = !this.visible
    this.overlay.hidden = !this.visible
  }

  close(): void {
    this.visible = false
    this.overlay.hidden = true
  }

  private toCanvas(x: number, z: number): [number, number] {
    return [
      this.canvas.width / 2 + (x - this.cx) * this.scale,
      this.canvas.height / 2 + (z - this.cz) * this.scale,
    ]
  }

  draw(
    playerX: number,
    playerZ: number,
    playerYaw: number,
    completion: { found: number; total: number },
  ): void {
    if (!this.visible) return
    const ctx = this.ctx
    const w = this.canvas.width
    ctx.clearRect(0, 0, w, w)

    for (const region of this.world.regions) {
      const manifested = this.world.isManifested(region.def.id)
      const [ox, oz] = region.def.origin
      const [rx, ry] = this.toCanvas(ox, oz)
      ctx.fillStyle = manifested
        ? 'rgba(90, 82, 128, 0.4)'
        : 'rgba(140, 200, 220, 0.1)'
      ctx.beginPath()
      ctx.arc(rx, ry, region.def.island.radius * this.scale, 0, Math.PI * 2)
      ctx.fill()
      if (!manifested) {
        // A latent isle: a faint dashed outline of a promise.
        ctx.strokeStyle = 'rgba(160, 216, 232, 0.45)'
        ctx.setLineDash([6, 6])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(160, 216, 232, 0.6)'
        ctx.font = 'italic 12px Georgia'
        ctx.textAlign = 'center'
        ctx.fillText('…latent…', rx, ry + 4)
        continue
      }
      ctx.fillStyle = 'rgba(140, 128, 180, 0.3)'
      for (const p of region.def.island.plateaus) {
        const [px, py] = this.toCanvas(ox + p.x, oz + p.z)
        ctx.beginPath()
        ctx.arc(px, py, p.r * this.scale, 0, Math.PI * 2)
        ctx.fill()
      }
      // Region name.
      ctx.fillStyle = 'rgba(232, 226, 212, 0.6)'
      ctx.font = '12px Georgia'
      ctx.textAlign = 'center'
      ctx.fillText(
        region.def.name,
        rx,
        ry - region.def.island.radius * this.scale - 6,
      )
      // Landmarks.
      ctx.fillStyle = 'rgba(232, 226, 212, 0.75)'
      ctx.font = '12px Georgia'
      for (const lm of region.def.landmarks) {
        const [lx, ly] = this.toCanvas(lm.x, lm.z)
        const icon =
          lm.kind === 'socket' ? '◎' : lm.kind === 'spire' ? '▲' : lm.kind === 'arch' ? '∩' : '•'
        ctx.fillText(icon, lx, ly + 4)
      }
    }

    // Discoveries: pinned "?", found dots.
    for (const def of this.world.discoverables) {
      const status = this.state.discoveries[def.id]
      const [dx, dy] = this.toCanvas(def.x, def.z)
      if (status === 'pinned' || status === 'revealed') {
        ctx.fillStyle = '#ffb347'
        ctx.font = 'bold 14px Georgia'
        ctx.fillText('?', dx, dy + 5)
      } else if (status === 'found') {
        ctx.fillStyle = 'rgba(159, 216, 208, 0.8)'
        ctx.beginPath()
        ctx.arc(dx, dy, 2.2, 0, Math.PI * 2)
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

    ctx.fillStyle = 'rgba(232, 226, 212, 0.85)'
    ctx.font = '14px Georgia'
    ctx.fillText(`${completion.found} / ${completion.total} discovered`, w / 2, w - 8)
  }
}
