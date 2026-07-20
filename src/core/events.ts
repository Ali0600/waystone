/** Tiny typed event bus — systems talk through this, not direct references. */
export interface GameEvents {
  'discovery:found': { id: string }
  'discovery:pinned': { id: string }
  'discovery:revealed': { id: string }
  'lumen:changed': { total: number; delta: number }
  'glyphstone:changed': { total: number; delta: number }
  'mastery:tier': { verb: string; tier: number }
  'glyph:inscribed': { slot: number; glyph: string }
  'tool:acquired': { tool: string }
  'path:revealed': { id: string }
  'toast': { text: string; flavor?: 'reward' | 'info' }
}

type Handler<T> = (payload: T) => void

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>()

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<never>)
    return () => set.delete(handler as Handler<never>)
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      ;(handler as Handler<GameEvents[K]>)(payload)
    }
  }
}
