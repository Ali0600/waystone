/**
 * Fixed-timestep game loop: simulation always steps at SIM_DT so movement,
 * physics and (later) combat timing behave identically at any display Hz.
 */
export const SIM_DT = 1 / 60
/** Guard against the spiral of death after a background-tab stall. */
const MAX_STEPS_PER_FRAME = 5

export interface LoopHooks {
  update(dt: number): void
  render(): void
}

export function startLoop(
  hooks: LoopHooks,
  schedule: (cb: () => void) => void = (cb) =>
    requestAnimationFrame(() => cb()),
  now: () => number = () => performance.now(),
): () => void {
  let last = now()
  let accumulator = 0
  let running = true

  const frame = () => {
    if (!running) return
    const t = now()
    accumulator += Math.min((t - last) / 1000, SIM_DT * MAX_STEPS_PER_FRAME)
    last = t
    while (accumulator >= SIM_DT) {
      hooks.update(SIM_DT)
      accumulator -= SIM_DT
    }
    hooks.render()
    schedule(frame)
  }
  schedule(frame)

  return () => {
    running = false
  }
}
