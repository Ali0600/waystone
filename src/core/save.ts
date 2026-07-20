import { createInitialState, parseGameState, type GameState } from './state'

export const SAVE_KEY = 'waystone:save'
/** Imports/loads larger than this are rejected outright (corrupt or hostile). */
export const MAX_SAVE_BYTES = 256 * 1024

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface SaveSystem {
  state: GameState
  /** True when the last load found no usable save (fresh start). */
  isFresh: boolean
  save(): void
}

export function createSaveSystem(storage: SaveStorage): SaveSystem {
  let loaded: GameState | null = null
  try {
    const json = storage.getItem(SAVE_KEY)
    if (json !== null && json.length <= MAX_SAVE_BYTES) {
      loaded = parseGameState(json)
      if (loaded === null) {
        console.warn('waystone: save data was malformed, starting fresh')
      }
    }
  } catch (err) {
    // Private-mode browsers can throw on storage access; play sessionless.
    console.warn('waystone: storage unavailable, progress will not persist', err)
  }

  const system: SaveSystem = {
    state: loaded ?? createInitialState(),
    isFresh: loaded === null,
    save() {
      try {
        storage.setItem(SAVE_KEY, JSON.stringify(system.state))
      } catch (err) {
        console.warn('waystone: failed to save', err)
      }
    },
  }
  return system
}
