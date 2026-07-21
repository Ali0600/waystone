import { describe, expect, it } from 'vitest'
import { WorldEnemies } from '../src/combat/worldenemies'
import { createInitialState } from '../src/core/state'
import type { EnemySpawnDef } from '../src/content/enemies'

// Flat world so patrol positions are predictable.
const flat = () => 0

function spawn(over: Partial<EnemySpawnDef> = {}): EnemySpawnDef {
  return { enemyId: 'husk', x: 0, z: 0, patrolR: 0, guards: undefined, ...over }
}

describe('WorldEnemies — touch begins a duel', () => {
  it('returns a contact when the player is within touch range of a live enemy', () => {
    const we = new WorldEnemies([spawn({ x: 10, z: 0, patrolR: 0 })], createInitialState(), flat)
    // Far away → no contact.
    expect(we.update(1 / 60, 0, 0)).toBeNull()
    // On top of it (patrolR 0 keeps it at its spawn) → contact carrying its identity.
    const c = we.update(1 / 60, 10, 0)
    expect(c).not.toBeNull()
    expect(c!.def.id).toBe('husk')
    expect(c!.spawnIndex).toBe(0)
  })

  it('carries the guards id so a victory can unlock the guarded discoverable', () => {
    const we = new WorldEnemies(
      [spawn({ x: 0, z: 0, guards: 'af-tool-grapple' })],
      createInitialState(),
      flat,
    )
    expect(we.update(1 / 60, 0, 0)!.guards).toBe('af-tool-grapple')
  })

  it('a defeated enemy despawns — no more contact', () => {
    const we = new WorldEnemies([spawn()], createInitialState(), flat)
    expect(we.update(1 / 60, 0, 0)).not.toBeNull()
    we.markDefeated(0)
    expect(we.update(1 / 60, 0, 0)).toBeNull()
  })

  it('a guardian already recorded in the save starts defeated (stays cleared forever)', () => {
    const state = createInitialState()
    state.guardiansDefeated.push('af-tool-grapple')
    const we = new WorldEnemies(
      [spawn({ guards: 'af-tool-grapple' })],
      state,
      flat,
    )
    expect(we.update(1 / 60, 0, 0)).toBeNull() // no re-fight
  })

  it('reports only ONE contact even when two enemies overlap the player', () => {
    const we = new WorldEnemies(
      [spawn({ x: 0, z: 0 }), spawn({ x: 0.5, z: 0 })],
      createInitialState(),
      flat,
    )
    const c = we.update(1 / 60, 0, 0)
    expect(c).not.toBeNull()
    expect(c!.spawnIndex).toBe(0) // the first live enemy wins
  })
})
