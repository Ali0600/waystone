import type { GameAudio } from '../engine/audio'
import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import { AnglingSim } from './angling'

/** How close to a spot the player must stand to cast. */
export const CAST_RADIUS = 3

/**
 * The mist-angling verb: press E at a rim spot to cast, hold E to strike a
 * bite and reel against tension. Wraps the pure AnglingSim with input, audio,
 * and a small progress/tension HUD bar. Randomness (bite delay, species) is
 * supplied here; the sim itself stays deterministic.
 */
export class AnglingVerb {
  readonly sim = new AnglingSim()
  active = false
  private bar: HTMLElement
  private progressFill: HTMLElement
  private tensionFill: HTMLElement
  private creakCooldown = 0

  constructor(
    private audio: GameAudio,
    private state: GameState,
    private bus: EventBus,
  ) {
    this.bar = document.createElement('div')
    this.bar.className = 'angling-bar'
    this.bar.hidden = true
    const prog = document.createElement('div')
    prog.className = 'angling-track'
    this.progressFill = document.createElement('div')
    this.progressFill.className = 'angling-progress'
    prog.appendChild(this.progressFill)
    const tens = document.createElement('div')
    tens.className = 'angling-track'
    this.tensionFill = document.createElement('div')
    this.tensionFill.className = 'angling-tension'
    tens.appendChild(this.tensionFill)
    this.bar.append(prog, tens)
    document.body.appendChild(this.bar)
  }

  /** Nearest castable spot within CAST_RADIUS, or null. */
  nearestSpot(
    spots: { x: number; z: number }[],
    px: number,
    pz: number,
  ): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null
    let bestD = CAST_RADIUS
    for (const s of spots) {
      const d = Math.hypot(px - s.x, pz - s.z)
      if (d < bestD) {
        best = s
        bestD = d
      }
    }
    return best
  }

  tryCast(): void {
    if (this.active) return
    this.sim.cast(Math.random())
    this.active = true
    this.bar.hidden = false
    this.audio.tone(300, 0.2, 'sine', 0.5, 200) // the line goes out
    this.bus.emit('toast', { text: 'You cast into the mist…', flavor: 'info' })
  }

  /** @param held is the reel input (E) currently down? */
  update(dt: number, held: boolean): void {
    this.creakCooldown = Math.max(0, this.creakCooldown - dt)
    if (!this.active) return
    const prev = this.sim.state
    this.sim.update(dt, held, Math.random())
    const now = this.sim.state
    if (prev === 'waiting' && now === 'bite') {
      this.audio.tone(880, 0.1, 'square', 0.7) // the plink of a bite
      this.bus.emit('toast', { text: 'A bite — hold E to set the hook!', flavor: 'reward' })
    }
    if (now === 'reeling' && this.sim.tension > 0.75 && this.creakCooldown <= 0) {
      this.audio.tone(160, 0.14, 'sawtooth', 0.5) // the line creaks near snapping
      this.creakCooldown = 0.3
    }
    if (now === 'landed') {
      this.land()
    } else if (now === 'escaped') {
      this.audio.tone(140, 0.22, 'sawtooth', 0.5)
      this.bus.emit('toast', { text: 'The line goes slack — it got away.', flavor: 'info' })
      this.end()
    }
    this.render()
  }

  private land(): void {
    const f = this.sim.hooked!
    this.state.fishHeld[f.id] = (this.state.fishHeld[f.id] ?? 0) + 1
    this.state.lumen += f.lumen
    this.state.anglingPoints += f.points
    this.bus.emit('lumen:changed', { total: this.state.lumen, delta: f.lumen })
    this.audio.chord([523, 659, 784], 0.5)
    this.bus.emit('toast', {
      text: `Landed a ${f.name}! +◆${f.lumen}, +${f.points} angling`,
      flavor: 'reward',
    })
    this.end()
  }

  private end(): void {
    this.active = false
    this.sim.state = 'idle'
    this.bar.hidden = true
  }

  /** HUD line describing the current step (null when idle). */
  statusText(): string | null {
    if (!this.active) return null
    switch (this.sim.state) {
      case 'waiting':
        return '…the line drifts in the mist…'
      case 'bite':
        return 'A BITE — hold E!'
      case 'reeling':
        return 'Reel — hold E, release to ease the line'
      default:
        return null
    }
  }

  private render(): void {
    this.progressFill.style.width = `${Math.min(1, this.sim.progress) * 100}%`
    const t = Math.min(1, this.sim.tension)
    this.tensionFill.style.width = `${t * 100}%`
    this.tensionFill.style.background = t > 0.85 ? '#e05a3f' : '#e0b25e'
  }
}
