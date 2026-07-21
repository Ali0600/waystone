import { describe, expect, it } from 'vitest'
import {
  ACQUIRABLE_TOOL_IDS,
  TOOL_IDS,
  TOOL_INFO,
  type ToolId,
} from '../src/content/tools'
import { createInitialState } from '../src/core/state'

describe('TOOL_INFO invariants', () => {
  it('has an entry for every TOOL_ID, id matching its key', () => {
    for (const id of TOOL_IDS) {
      expect(TOOL_INFO[id], id).toBeDefined()
      expect(TOOL_INFO[id].id).toBe(id)
      expect(TOOL_INFO[id].name.length, id).toBeGreaterThan(3)
      expect(TOOL_INFO[id].desc.length, id).toBeGreaterThan(8)
    }
  })

  it('the acquirable tools are EXACTLY the keys of GameState.tools', () => {
    // This is the load-bearing invariant: DiscoverySystem.interact() maps a
    // `tool-<id>` meter straight onto state.tools[id], so a new save tool that
    // isn't listed here would acquire nothing. Keep them in lockstep.
    const saveToolKeys = Object.keys(createInitialState().tools).sort()
    expect([...ACQUIRABLE_TOOL_IDS].sort()).toEqual(saveToolKeys)
  })

  it('TOOL_IDS = the acquirable tools plus the innate lantern', () => {
    const expected: ToolId[] = ['lantern', ...ACQUIRABLE_TOOL_IDS]
    expect([...TOOL_IDS].sort()).toEqual([...expected].sort())
    expect(TOOL_IDS).toContain('lantern')
    expect(ACQUIRABLE_TOOL_IDS as readonly string[]).not.toContain('lantern')
  })
})
