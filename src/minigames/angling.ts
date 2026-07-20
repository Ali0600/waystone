/**
 * Mist-angling (v1 §7): cast into the mist sea, wait for a bite, strike in a
 * tight window, then reel against tension. Fish are consumables (the Cook
 * turns them into pre-fight buffs) and cumulative points unlock a teacher who
 * grants a permanent technique (BoF IV Masters model).
 *
 * AnglingSim is PURE — every source of time and randomness is injected, so the
 * bite timing, species roll, strike window, and tension see-saw are all
 * deterministic under test.
 */

export interface FishSpecies {
  id: string
  name: string
  /** Angling points toward the teacher threshold. */
  points: number
  /** Lumen paid on landing. */
  lumen: number
  /** Selection weight (need not sum to 1). */
  weight: number
}

export const FISH: FishSpecies[] = [
  { id: 'mistminnow', name: 'Mistminnow', points: 1, lumen: 5, weight: 60 },
  { id: 'veilcarp', name: 'Veilcarp', points: 3, lumen: 12, weight: 30 },
  { id: 'ember-eel', name: 'Ember Eel', points: 7, lumen: 25, weight: 10 },
]

/** Angling points needed before Nerei will teach the Undertow. */
export const TEACHER_THRESHOLD = 15

// Bite delay window (seconds).
const BITE_MIN = 2
const BITE_MAX = 6
// Strike window after a bite (seconds) — miss it and the fish is gone.
const STRIKE_WINDOW = 0.35
// Reel model.
const REEL_RATE = 0.5 // progress/sec while reeling (held)
const TENSION_RISE = 0.9 // tension/sec while reeling
const TENSION_FALL = 1.2 // tension/sec while slack (released)
const TENSION_MAX = 1.0
const OVERTENSION_LIMIT = 0.6 // seconds over max before the line snaps

export type AnglingState = 'idle' | 'waiting' | 'bite' | 'reeling' | 'landed' | 'escaped'

/** Weighted species pick from a roll in [0,1). */
export function pickSpecies(roll: number): FishSpecies {
  const total = FISH.reduce((s, f) => s + f.weight, 0)
  let acc = 0
  const target = roll * total
  for (const f of FISH) {
    acc += f.weight
    if (target < acc) return f
  }
  return FISH[FISH.length - 1]
}

export class AnglingSim {
  state: AnglingState = 'idle'
  /** 0..1 reel progress; at 1 the fish is landed. */
  progress = 0
  /** 0..~ line tension; over TENSION_MAX for too long snaps the line. */
  tension = 0
  /** The species that bit / was landed (null until a bite). */
  hooked: FishSpecies | null = null

  private timer = 0 // seconds in the current sub-state
  private biteAt = 0 // when the bite happens (waiting)
  private overtension = 0 // seconds spent above TENSION_MAX

  /** Begin a cast. rng in [0,1) sets the bite delay. */
  cast(rng: number): void {
    this.state = 'waiting'
    this.progress = 0
    this.tension = 0
    this.hooked = null
    this.timer = 0
    this.overtension = 0
    this.biteAt = BITE_MIN + rng * (BITE_MAX - BITE_MIN)
  }

  /**
   * Advance one step.
   * @param held    is the reel input (E) currently down?
   * @param speciesRoll roll in [0,1) used to pick the species when a bite lands
   */
  update(dt: number, held: boolean, speciesRoll: number): void {
    switch (this.state) {
      case 'waiting': {
        this.timer += dt
        if (this.timer >= this.biteAt) {
          this.state = 'bite'
          this.timer = 0
          this.hooked = pickSpecies(speciesRoll)
        }
        break
      }
      case 'bite': {
        // Strike by holding the line the instant it bites.
        if (held) {
          this.state = 'reeling'
          this.timer = 0
          break
        }
        this.timer += dt
        if (this.timer > STRIKE_WINDOW) {
          this.state = 'escaped' // missed the strike
        }
        break
      }
      case 'reeling': {
        if (held) {
          this.progress += REEL_RATE * dt
          this.tension += TENSION_RISE * dt
        } else {
          this.tension = Math.max(0, this.tension - TENSION_FALL * dt)
        }
        if (this.tension > TENSION_MAX) {
          this.overtension += dt
          if (this.overtension > OVERTENSION_LIMIT) {
            this.state = 'escaped' // snapped
            break
          }
        } else {
          this.overtension = 0
        }
        if (this.progress >= 1) {
          this.progress = 1
          this.state = 'landed'
        }
        break
      }
    }
  }

  /** True while a bite is live and still strike-able. */
  get canStrike(): boolean {
    return this.state === 'bite'
  }
}

/** Meal buff: bonus (over-max) HP a cooked fish grants at the next fight. */
export function mealShield(speciesId: string): number {
  switch (speciesId) {
    case 'mistminnow':
      return 6
    case 'veilcarp':
      return 12
    case 'ember-eel':
      return 20
    default:
      return 0
  }
}

/**
 * The Cook turns the best fish in the pack into a pending meal buff, consuming
 * one. Pure: mutates only the two fields it's handed. Returns the fish cooked,
 * or null if the pack is empty.
 */
export function cookBestFish(state: {
  fishHeld: Record<string, number>
  pendingMeal: string | null
}): FishSpecies | null {
  let best: FishSpecies | null = null
  for (const f of FISH) {
    if ((state.fishHeld[f.id] ?? 0) > 0 && (best === null || f.points > best.points)) {
      best = f
    }
  }
  if (best === null) return null
  state.fishHeld[best.id] -= 1
  state.pendingMeal = best.id
  return best
}
