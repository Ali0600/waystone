/**
 * Keyboard + pointer input. Listens on window (so synthetic KeyboardEvents
 * from QA tooling work), tracks held keys and just-pressed edges, and
 * accumulates pointer-lock mouse deltas between simulation steps.
 */
export interface InputSnapshot {
  /** -1..1 strafe (A/D), forward (W/S). */
  moveX: number
  moveZ: number
  jump: boolean
  dash: boolean
  interact: boolean
  lantern: boolean
  grapple: boolean
  map: boolean
  /** Open the World Map (all islands). */
  worldMap: boolean
  glyphs: boolean
  sounding: boolean
  chime: boolean
  /** Open the Surveyor's Ledger (Inventory + Guide). */
  inventory: boolean
  /** Open the Surveyor's Ledger on the Log tab. */
  log: boolean
  /** Open the Attunement screen (progression chart). */
  attunement: boolean
  /** Every key code freshly pressed this step (combat menus, hidden arts). */
  codes: string[]
  lookDX: number
  lookDY: number
}

export class Input {
  private held = new Set<string>()
  private pressed = new Set<string>()
  private lookDX = 0
  private lookDY = 0

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.held.add(e.code)
      this.pressed.add(e.code)
    })
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code)
    })
    target.addEventListener('blur', () => {
      this.held.clear()
      this.pressed.clear()
    })
    target.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.lookDX += e.movementX
        this.lookDY += e.movementY
      }
    })
  }

  isHeld(code: string): boolean {
    return this.held.has(code)
  }

  /** Consumes and returns one simulation step's worth of input. */
  snapshot(): InputSnapshot {
    const snap: InputSnapshot = {
      moveX: (this.held.has('KeyD') ? 1 : 0) - (this.held.has('KeyA') ? 1 : 0),
      moveZ: (this.held.has('KeyS') ? 1 : 0) - (this.held.has('KeyW') ? 1 : 0),
      jump: this.pressed.has('Space'),
      dash: this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight'),
      interact: this.pressed.has('KeyE'),
      lantern: this.pressed.has('KeyF'),
      grapple: this.pressed.has('KeyQ'),
      map: this.pressed.has('KeyM'),
      worldMap: this.pressed.has('KeyN'),
      glyphs: this.pressed.has('KeyG'),
      sounding: this.pressed.has('KeyT'),
      chime: this.pressed.has('KeyC'),
      inventory: this.pressed.has('KeyI'),
      log: this.pressed.has('KeyL'),
      attunement: this.pressed.has('KeyP'),
      codes: [...this.pressed],
      lookDX: this.lookDX,
      lookDY: this.lookDY,
    }
    this.pressed.clear()
    this.lookDX = 0
    this.lookDY = 0
    return snap
  }
}
