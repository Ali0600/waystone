import type { EventBus } from '../core/events'

/**
 * All sound is synthesized — no audio assets. Guarded so headless/test
 * environments (no AudioContext) silently no-op. The context resumes on
 * the first user gesture, per autoplay policy.
 */
export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  constructor() {
    const Ctx =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? null)
        : null
    if (Ctx) {
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.14
      this.master.connect(this.ctx.destination)
      const resume = () => {
        void this.ctx?.resume()
      }
      window.addEventListener('pointerdown', resume, { once: true })
      window.addEventListener('keydown', resume, { once: true })
    }
  }

  /** One oscillator blip. */
  tone(
    freq: number,
    duration = 0.12,
    type: OscillatorType = 'sine',
    volume = 1,
    glideTo?: number,
  ): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), t + duration)
    }
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  chord(freqs: number[], duration = 0.4, type: OscillatorType = 'sine'): void {
    freqs.forEach((f, i) => this.tone(f, duration, type, 0.7 / (i * 0.4 + 1)))
  }

  thud(): void {
    this.tone(90, 0.18, 'triangle', 1, 45)
  }

  /** Wire the game's event bus to sounds. */
  attach(bus: EventBus): void {
    bus.on('discovery:found', () => this.chord([523, 659, 784], 0.5))
    bus.on('discovery:revealed', () => this.chord([392, 494], 0.4, 'triangle'))
    bus.on('discovery:pinned', () => this.tone(660, 0.1, 'sine', 0.6))
    bus.on('mastery:tier', () => {
      this.tone(523, 0.12)
      setTimeout(() => this.tone(659, 0.12), 110)
      setTimeout(() => this.tone(880, 0.22), 220)
    })
    bus.on('glyph:inscribed', () => this.chord([440, 554, 659], 0.6, 'triangle'))
    bus.on('path:revealed', () => this.chord([330, 415, 494, 659], 0.9))
    bus.on('tool:acquired', () => this.chord([392, 523, 659], 0.6))
    bus.on('combat:start', () => this.chord([220, 262, 330], 0.5, 'sawtooth'))
    bus.on('combat:beat', ({ result }) => {
      if (result === 'hit') this.tone(880, 0.06, 'square', 0.5)
      else this.tone(180, 0.15, 'sawtooth', 0.5)
    })
    // The parry tell: each pattern has a DISTINCT windup voice.
    bus.on('combat:telegraph', ({ pattern }) => {
      if (pattern === 'melee') this.tone(140, 0.3, 'sawtooth', 0.8)
      else if (pattern === 'projectile') this.tone(300, 0.5, 'sine', 0.7, 900)
      else this.chord([196, 233, 294], 1.0, 'triangle') // chant
    })
    bus.on('combat:parry', ({ result }) => {
      if (result === 'parried') this.tone(1200, 0.08, 'square', 0.6)
      else if (result === 'reflected') this.chord([988, 1319], 0.2, 'square')
      else if (result === 'lockbroken') this.chord([784, 988], 0.25)
      else this.thud()
    })
    bus.on('combat:art', () => this.chord([262, 330, 392, 523], 0.8, 'sawtooth'))
    bus.on('combat:end', ({ victory }) => {
      if (victory) {
        this.tone(523, 0.15)
        setTimeout(() => this.tone(659, 0.15), 140)
        setTimeout(() => this.tone(784, 0.15), 280)
        setTimeout(() => this.chord([523, 659, 784, 1047], 0.7), 430)
      } else {
        this.tone(220, 0.5, 'triangle', 0.8, 110)
      }
    })
  }
}

/** Sounding pitch mapping: closer = higher. Pure — unit-tested. */
export function pitchForDistance(dist: number, maxRange = 30): number {
  const clamped = Math.min(Math.max(dist, 0), maxRange)
  const t = 1 - clamped / maxRange
  return 220 + t * t * 700 // 220 Hz at the edge → 920 Hz on top of it
}
