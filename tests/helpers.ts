import type { InputSnapshot } from '../src/engine/input'

/** One place to grow when InputSnapshot gains fields. */
export function idleInput(overrides: Partial<InputSnapshot> = {}): InputSnapshot {
  return {
    moveX: 0,
    moveZ: 0,
    jump: false,
    dash: false,
    interact: false,
    lantern: false,
    grapple: false,
    map: false,
    glyphs: false,
    sounding: false,
    chime: false,
    inventory: false,
    log: false,
    attunement: false,
    codes: [],
    lookDX: 0,
    lookDY: 0,
    ...overrides,
  }
}
