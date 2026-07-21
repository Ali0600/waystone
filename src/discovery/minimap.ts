import type { GameState } from '../core/state'
import type { World } from '../world/world'
import type { RegionDef } from '../world/region'
import { frameRegions, markerFor } from './map'
import { RECRUITS } from '../content/recruits'

const SIZE = 150
const MARGIN = 10

/**
 * The always-on minimap (M34): a small circular canvas pinned to the top-left,
 * framing the isle the player is on — a static north-up compass of the local
 * area. Reuses the Survey Map's pure framing (`frameRegions`) and marker
 * semantics (`markerFor` — ? to reach, ○ collected, residents ☺), so the two
 * can never disagree about what a marker means.
 *
 * Visibility has ONE owner (`setVisible`, the `hidden` attribute only — the
 * standing two-writers rule): main hides it for combat alongside the rest of
 * the world HUD. Full-screen overlays simply cover it.
 */
export class MiniMap {
  private root: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cx = 0
  private cz = 0
  private scale = 1

  constructor(
    private world: World,
    private state: GameState,
    private currentRegion: () => RegionDef,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'hud-minimap'
    this.canvas = document.createElement('canvas')
    this.canvas.width = SIZE
    this.canvas.height = SIZE
    this.root.appendChild(this.canvas)
    document.body.appendChild(this.root)
    this.ctx = this.canvas.getContext('2d')!
  }

  /** The single visibility writer — combat hides the minimap with the rest of
   *  the world HUD; the world's return restores it. */
  setVisible(v: boolean): void {
    this.root.hidden = !v
  }

  private toCanvas(x: number, z: number): [number, number] {
    return [
      SIZE / 2 + (x - this.cx) * this.scale,
      SIZE / 2 + (z - this.cz) * this.scale,
    ]
  }

  draw(playerX: number, playerZ: number, playerYaw: number): void {
    if (this.root.hidden) return
    const ctx = this.ctx
    ctx.clearRect(0, 0, SIZE, SIZE)

    const cur = this.currentRegion()
    const frame = frameRegions([{ origin: cur.origin, radius: cur.island.radius }], SIZE, MARGIN)
    this.cx = frame.cx
    this.cz = frame.cz
    this.scale = frame.scale

    // Everything clips to the circular face.
    ctx.save()
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2)
    ctx.clip()

    // The isle and its plateaus.
    const [ox, oz] = cur.origin
    const [rx, ry] = this.toCanvas(ox, oz)
    ctx.fillStyle = 'rgba(90, 82, 128, 0.55)'
    ctx.beginPath()
    ctx.arc(rx, ry, cur.island.radius * this.scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(140, 128, 180, 0.35)'
    for (const p of cur.island.plateaus) {
      const [px, py] = this.toCanvas(ox + p.x, oz + p.z)
      ctx.beginPath()
      ctx.arc(px, py, p.r * this.scale, 0, Math.PI * 2)
      ctx.fill()
    }

    // Ferry mooring.
    if (cur.mooring) {
      const [mx, my] = this.toCanvas(cur.mooring.x, cur.mooring.z)
      ctx.fillStyle = 'rgba(143, 208, 216, 0.9)'
      ctx.font = '10px Georgia'
      ctx.textAlign = 'center'
      ctx.fillText('⚓', mx, my + 3)
    }

    // Markers — same semantics as the Survey Map (off-isle spots fall outside
    // the clip, so no filtering is needed).
    for (const def of this.world.discoverables) {
      const marker = markerFor(def.kind, this.state.discoveries[def.id])
      if (!marker) continue
      const [dx, dy] = this.toCanvas(def.x, def.z)
      if (marker === 'pin') {
        ctx.fillStyle = '#ffb347'
        ctx.font = 'bold 11px Georgia'
        ctx.textAlign = 'center'
        ctx.fillText('?', dx, dy + 4)
      } else {
        ctx.strokeStyle = 'rgba(159, 216, 208, 0.45)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(dx, dy, 2, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Residents at their homes (visible when the hub is the current isle).
    ctx.fillStyle = 'rgba(255, 216, 160, 0.9)'
    ctx.font = '10px Georgia'
    ctx.textAlign = 'center'
    for (const r of RECRUITS) {
      if (this.state.discoveries[r.personId] === 'found') {
        const [hx, hy] = this.toCanvas(r.home.x, r.home.z)
        ctx.fillText('☺', hx, hy + 3)
      }
    }

    // The player, north-up (the arrow rotates; the map doesn't).
    const [pxc, pyc] = this.toCanvas(playerX, playerZ)
    ctx.translate(pxc, pyc)
    ctx.rotate(-playerYaw)
    ctx.fillStyle = '#ffe8b0'
    ctx.beginPath()
    ctx.moveTo(0, -5)
    ctx.lineTo(3.2, 3.6)
    ctx.lineTo(-3.2, 3.6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}
