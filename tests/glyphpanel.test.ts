import { describe, expect, it } from 'vitest'
import { scribeStatusLine } from '../src/ui/glyphpanel'

/**
 * The Glyph Grid's guidance line must distinguish THREE player situations —
 * one merged "requires Iole" message shipped and left a player with 8 stones
 * staring at a dead-feeling panel, not knowing whether to FIND the scribe or
 * WALK to her. Pinning all three keeps a refactor from collapsing them again.
 */
describe('scribeStatusLine', () => {
  const notFound = scribeStatusLine(false, false)
  const foundFar = scribeStatusLine(true, false)
  const ready = scribeStatusLine(true, true)

  it('unfound scribe → sends the player hunting (names the isle, not the spot)', () => {
    expect(notFound).toContain('Amberfall')
  })

  it('found but elsewhere → sends the player to her hut', () => {
    expect(foundFar).toContain('Waystation')
    expect(foundFar.toLowerCase()).toContain('stand with')
  })

  it('in range → ready to inscribe', () => {
    expect(ready).toContain('quill ready')
  })

  it('all three situations read differently', () => {
    expect(new Set([notFound, foundFar, ready]).size).toBe(3)
  })

  it('near wins even if found-state were somehow stale', () => {
    // Being in range implies found in practice; the pure function must not
    // depend on that coupling.
    expect(scribeStatusLine(false, true)).toBe(ready)
  })
})
