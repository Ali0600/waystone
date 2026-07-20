import { beforeEach, describe, expect, it } from 'vitest'
import { COMBOS, GLYPHS, type GlyphId } from '../src/content/glyphs'
import { EventBus } from '../src/core/events'
import { createInitialState, type GameState } from '../src/core/state'
import {
  activeCombos,
  GlyphSystem,
  neighbors,
  REINSCRIBE_COST,
  REINSCRIBE_RECRUITS,
} from '../src/progression/glyphs'

describe('grid adjacency', () => {
  it('corner slots have 2 neighbors, edges 3, centre 4', () => {
    expect(neighbors(0).sort((a, b) => a - b)).toEqual([1, 4])
    expect(neighbors(3).sort((a, b) => a - b)).toEqual([2, 7])
    expect(neighbors(1).sort((a, b) => a - b)).toEqual([0, 2, 5])
    expect(neighbors(5).sort((a, b) => a - b)).toEqual([1, 4, 6, 9])
  })

  it('does NOT wrap across row ends (slot 3 and 4 are not adjacent)', () => {
    expect(neighbors(3)).not.toContain(4)
    expect(neighbors(4)).not.toContain(3)
    expect(neighbors(7)).not.toContain(8)
  })
})

describe('activeCombos', () => {
  const empty = (): (GlyphId | null)[] => Array(16).fill(null)

  it('detects a recipe pair in either order, exactly once', () => {
    const grid = empty()
    grid[5] = 'ember'
    grid[6] = 'gale'
    expect(activeCombos(grid)).toHaveLength(1)
    expect(activeCombos(grid)[0].combo.id).toBe('levin')

    const flipped = empty()
    flipped[5] = 'gale'
    flipped[6] = 'ember'
    expect(activeCombos(flipped)[0]?.combo.id).toBe('levin')
  })

  it('ignores non-adjacent and non-recipe pairs', () => {
    const grid = empty()
    grid[0] = 'ember'
    grid[2] = 'gale' // same row, one gap
    grid[8] = 'stone'
    grid[9] = 'light' // adjacent but no recipe
    expect(activeCombos(grid)).toHaveLength(0)
  })

  it('a row-end pair is not a combo (3|4 wrap trap)', () => {
    const grid = empty()
    grid[3] = 'ember'
    grid[4] = 'gale'
    expect(activeCombos(grid)).toHaveLength(0)
  })

  it('one glyph can resonate with multiple neighbors', () => {
    const grid = empty()
    grid[5] = 'ember'
    grid[1] = 'gale'
    grid[9] = 'gale'
    expect(activeCombos(grid)).toHaveLength(2)
  })
})

describe('GlyphSystem', () => {
  let state: GameState
  let bus: EventBus
  let home: number
  let sys: GlyphSystem

  beforeEach(() => {
    state = createInitialState()
    bus = new EventBus()
    home = 0
    sys = new GlyphSystem(state, bus, () => home)
  })

  it('inscription consumes a finite blank stone', () => {
    expect(sys.inscribe(0, 'ember')).toBe(false) // no stones
    state.glyphStones = 2
    expect(sys.inscribe(0, 'ember')).toBe(true)
    expect(state.glyphStones).toBe(1)
    expect(state.glyphGrid[0]).toBe('ember')
  })

  it('cannot inscribe into an occupied slot', () => {
    state.glyphStones = 2
    sys.inscribe(0, 'ember')
    expect(sys.inscribe(0, 'gale')).toBe(false)
    expect(state.glyphStones).toBe(1)
  })

  it('re-inscription is locked until enough recruits are home, then costs Lumen', () => {
    state.glyphStones = 1
    sys.inscribe(0, 'ember')
    state.lumen = 100
    expect(sys.clearSlot(0)).toBe(false) // hub too empty
    home = REINSCRIBE_RECRUITS
    expect(sys.clearSlot(0)).toBe(true)
    expect(state.lumen).toBe(100 - REINSCRIBE_COST)
    expect(state.glyphGrid[0]).toBeNull()
    // Clearing an empty slot or with no lumen fails.
    expect(sys.clearSlot(0)).toBe(false)
  })

  it('records per-glyph uses', () => {
    sys.recordUse('tide')
    sys.recordUse('tide')
    expect(state.glyphUses.tide).toBe(2)
  })
})

describe('glyph content invariants', () => {
  it('combos reference real glyphs and distinct pairs', () => {
    const pairs = new Set<string>()
    for (const c of COMBOS) {
      expect(GLYPHS[c.pair[0]], c.id).toBeDefined()
      expect(GLYPHS[c.pair[1]], c.id).toBeDefined()
      expect(c.pair[0]).not.toBe(c.pair[1])
      const key = [...c.pair].sort().join('+')
      expect(pairs.has(key), `duplicate recipe ${key}`).toBe(false)
      pairs.add(key)
    }
    expect(COMBOS.length).toBeGreaterThanOrEqual(2)
  })
})
