import { describe, expect, it } from 'vitest'
import { createSaveSystem, MAX_SAVE_BYTES, SAVE_KEY, type SaveStorage } from '../src/core/save'
import { createInitialState, parseGameState } from '../src/core/state'

function memoryStorage(initial: Record<string, string> = {}): SaveStorage & {
  data: Record<string, string>
} {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
    removeItem: (k) => {
      delete data[k]
    },
  }
}

describe('parseGameState', () => {
  it('round-trips a valid state', () => {
    const state = createInitialState()
    state.lumen = 12
    state.playerPos = [1.5, 2.25, -3]
    expect(parseGameState(JSON.stringify(state))).toEqual(state)
  })

  it('migrates a v1 save forward with default discovery fields', () => {
    const v1 = JSON.stringify({
      version: 1,
      regionId: 'amberfall',
      playerPos: [1, 2, 3],
      lumen: 42,
    })
    const parsed = parseGameState(v1)
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(2)
    expect(parsed!.lumen).toBe(42)
    expect(parsed!.glyphStones).toBe(0)
    expect(parsed!.discoveries).toEqual({})
  })

  it('rejects malformed discoveries map', () => {
    const bad = JSON.stringify({
      ...createInitialState(),
      discoveries: { x: 'exploded' },
    })
    expect(parseGameState(bad)).toBeNull()
  })

  it.each([
    ['not json', 'nope{'],
    ['null', 'null'],
    ['wrong version', JSON.stringify({ ...createInitialState(), version: 99 })],
    ['missing region', JSON.stringify({ version: 1, playerPos: [0, 0, 0], lumen: 0 })],
    ['NaN position', '{"version":1,"regionId":"amberfall","playerPos":[0,null,0],"lumen":0}'],
    ['short position', JSON.stringify({ ...createInitialState(), playerPos: [1, 2] })],
    ['negative lumen', JSON.stringify({ ...createInitialState(), lumen: -5 })],
    ['string lumen', JSON.stringify({ ...createInitialState(), lumen: 'many' })],
  ])('rejects %s', (_label, json) => {
    expect(parseGameState(json)).toBeNull()
  })
})

describe('createSaveSystem', () => {
  it('starts fresh with no stored save', () => {
    const sys = createSaveSystem(memoryStorage())
    expect(sys.isFresh).toBe(true)
    expect(sys.state).toEqual(createInitialState())
  })

  it('loads a valid stored save', () => {
    const stored = createInitialState()
    stored.lumen = 7
    const sys = createSaveSystem(memoryStorage({ [SAVE_KEY]: JSON.stringify(stored) }))
    expect(sys.isFresh).toBe(false)
    expect(sys.state.lumen).toBe(7)
  })

  it('persists via save()', () => {
    const storage = memoryStorage()
    const sys = createSaveSystem(storage)
    sys.state.lumen = 99
    sys.save()
    expect(parseGameState(storage.data[SAVE_KEY])?.lumen).toBe(99)
  })

  it('falls back to fresh on malformed data', () => {
    const sys = createSaveSystem(memoryStorage({ [SAVE_KEY]: '{"version":1' }))
    expect(sys.isFresh).toBe(true)
  })

  it('ignores oversized saves outright', () => {
    const huge = JSON.stringify({ ...createInitialState(), pad: 'x'.repeat(MAX_SAVE_BYTES) })
    const sys = createSaveSystem(memoryStorage({ [SAVE_KEY]: huge }))
    expect(sys.isFresh).toBe(true)
  })

  it('survives a storage that throws (private mode)', () => {
    const sys = createSaveSystem({
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(sys.isFresh).toBe(true)
    expect(() => sys.save()).not.toThrow()
  })
})
