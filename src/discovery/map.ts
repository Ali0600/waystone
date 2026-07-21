import type { GameState, DiscoveryStatus } from '../core/state'
import type { World } from '../world/world'
import type { RegionDef } from '../world/region'
import type { DiscoveryKind } from './types'
import { RECRUITS } from '../content/recruits'

export type MapScope = 'local' | 'world'

/**
 * What marker a discoverable draws on the map, given its collection status:
 *  - `'pin'` — an orange "?" for a discovered-but-uncollected spot (pinned/revealed).
 *  - `'ring'` — a faint hollow ring for a COLLECTED spot (a record it's emptied).
 *  - `null`  — nothing: unseen spots stay hidden, and a collected PERSON is dropped
 *    (they walked home — they're drawn as a resident ☺ at their home, not a stale
 *    dot at the place you first met them). Keeps the map in sync with the world.
 */
export function markerFor(
  kind: DiscoveryKind,
  status: DiscoveryStatus | undefined,
): 'pin' | 'ring' | null {
  if (status === 'pinned' || status === 'revealed') return 'pin'
  if (status === 'found') return kind === 'person' ? null : 'ring'
  return null
}

/** A world→canvas transform: centre in world coords + uniform px-per-unit scale. */
export interface MapFrame {
  cx: number
  cz: number
  scale: number
}

/**
 * Frame a set of islands into a square canvas — pure so it's unit-tested. The
 * bounds are origin ± radius folded over the regions; the larger axis sets the
 * scale so the whole extent fits with a `margin` px gutter each side.
 */
export function frameRegions(
  regions: { origin: [number, number]; radius: number }[],
  canvasW: number,
  margin = 28,
): MapFrame {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const r of regions) {
    const [ox, oz] = r.origin
    minX = Math.min(minX, ox - r.radius)
    maxX = Math.max(maxX, ox + r.radius)
    minZ = Math.min(minZ, oz - r.radius)
    maxZ = Math.max(maxZ, oz + r.radius)
  }
  const span = Math.max(maxX - minX, maxZ - minZ)
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    scale: (canvasW - margin * 2) / span,
  }
}

/**
 * The Survey Map: a top-down schematic with auto-pinned "?" markers. Canvas 2D
 * in a DOM overlay. Two scopes (M28→M32): **local** frames the isle you're on
 * (titled by its name), **world** frames every island (titled "World Map"). `M`
 * opens local, `N` opens world; while open, M/N switch and same-key closes. The
 * frame is recomputed per draw from the scope (so a manifest never staleness-
 * caches it, and the local view follows you between isles).
 */
export class RegionMap {
  private overlay: HTMLElement
  private titleEl: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  visible = false
  scope: MapScope = 'world'
  /** World-bounds → canvas transform, recomputed each draw from the scope. */
  private cx = 0
  private cz = 0
  private scale = 1

  constructor(
    private world: World,
    private state: GameState,
    /** The isle the player is currently on (or last stood on) — the local frame. */
    private currentRegion: () => RegionDef,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'map-overlay'
    this.overlay.hidden = true
    this.titleEl = document.createElement('div')
    this.titleEl.className = 'map-title'
    this.titleEl.textContent = 'World Map'
    this.canvas = document.createElement('canvas')
    this.canvas.width = 560
    this.canvas.height = 560
    const legend = document.createElement('div')
    legend.className = 'map-legend'
    legend.textContent =
      '?  undiscovered   ○  collected   ☺  resident   ⚓  mooring   ◎  socket   ≋  fishing'
    this.overlay.append(this.titleEl, this.canvas, legend)
    document.body.appendChild(this.overlay)
    this.ctx = this.canvas.getContext('2d')!

    // Escape closes the map like every other panel. Immediate-stop so the
    // EscMenu (registered later) doesn't pop open beneath the closing map.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.close()
        e.stopImmediatePropagation()
      }
    })
  }

  /** Open the given scope; switch to it if a different scope is open; close if
   *  it's already the open scope (so M/N both toggle and swap — Ledger tab UX). */
  toggle(scope: MapScope): void {
    if (this.visible && this.scope === scope) {
      this.close()
      return
    }
    this.scope = scope
    this.visible = true
    this.overlay.hidden = false
    this.updateTitle()
  }

  close(): void {
    this.visible = false
    this.overlay.hidden = true
  }

  private updateTitle(): void {
    const t = this.scope === 'world' ? 'World Map' : this.currentRegion().name
    if (this.titleEl.textContent !== t) this.titleEl.textContent = t
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

    // Frame the current scope (a cheap 6-region fold). Local = the isle you're
    // on; world = all islands, latent ghosts included.
    const cur = this.currentRegion()
    const frame =
      this.scope === 'world'
        ? frameRegions(
            this.world.regions.map((r) => ({ origin: r.def.origin, radius: r.def.island.radius })),
            w,
          )
        : frameRegions([{ origin: cur.origin, radius: cur.island.radius }], w)
    this.cx = frame.cx
    this.cz = frame.cz
    this.scale = frame.scale
    this.updateTitle()

    const local = this.scope === 'local'

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
      // Ferry mooring — the fast-travel node (teal anchor), so it's findable.
      if (region.def.mooring) {
        const [mx, my] = this.toCanvas(region.def.mooring.x, region.def.mooring.z)
        ctx.fillStyle = 'rgba(143, 208, 216, 0.9)'
        ctx.font = '13px Georgia'
        ctx.fillText('⚓', mx, my + 4)
      }
      // Angling spots — only worth showing at the isle-level zoom; a teal ripple.
      // Not a spoiler: the spots are plainly visible in-world at the rim.
      if (local && region.def.anglingSpots) {
        ctx.fillStyle = 'rgba(120, 200, 220, 0.7)'
        ctx.font = '13px Georgia'
        for (const s of region.def.anglingSpots) {
          const [sx, sy] = this.toCanvas(s.x, s.z)
          ctx.fillText('≋', sx, sy + 4)
        }
      }
    }

    // Discoveries: an orange "?" for a spot still to reach, a faint hollow ring
    // for one you've emptied. A collected PERSON draws nothing here (they walked
    // home — see the residents pass below), so the map never lies about a dot.
    for (const def of this.world.discoverables) {
      const marker = markerFor(def.kind, this.state.discoveries[def.id])
      if (!marker) continue
      const [dx, dy] = this.toCanvas(def.x, def.z)
      if (marker === 'pin') {
        ctx.fillStyle = '#ffb347'
        ctx.font = 'bold 14px Georgia'
        ctx.textAlign = 'center'
        ctx.fillText('?', dx, dy + 5)
      } else {
        ctx.strokeStyle = 'rgba(159, 216, 208, 0.45)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(dx, dy, 2.6, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Residents: recruited people drawn where they actually LIVE (their hub home),
    // so the marker tracks the person, not the spot you first met them at.
    ctx.fillStyle = 'rgba(255, 216, 160, 0.9)'
    ctx.font = '12px Georgia'
    ctx.textAlign = 'center'
    for (const r of RECRUITS) {
      if (this.state.discoveries[r.personId] === 'found') {
        const [hx, hy] = this.toCanvas(r.home.x, r.home.z)
        ctx.fillText('☺', hx, hy + 4)
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
    ctx.textAlign = 'center'
    ctx.fillText(`${completion.found} / ${completion.total} discovered`, w / 2, w - 8)
  }
}
