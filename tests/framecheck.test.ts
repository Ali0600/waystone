import { describe, expect, it } from 'vitest'
import { findOverlappingPairs, rectsIntersect, type Box } from '../src/ui/framecheck'

const box = (name: string, top: number, bottom: number, left = 0, right = 800): Box => ({
  name,
  top,
  bottom,
  left,
  right,
})

describe('rectsIntersect', () => {
  it('detects vertical overlap', () => {
    expect(rectsIntersect(box('a', 0, 50), box('b', 40, 90))).toBe(true)
  })

  it('treats edge-touch as NOT overlapping (adjacent clusters may abut)', () => {
    expect(rectsIntersect(box('a', 0, 50), box('b', 50, 90))).toBe(false)
  })

  it('separated boxes do not overlap', () => {
    expect(rectsIntersect(box('a', 0, 40), box('b', 60, 90))).toBe(false)
  })

  it('respects horizontal separation too', () => {
    expect(rectsIntersect(box('a', 0, 100, 0, 100), box('b', 0, 100, 200, 300))).toBe(false)
  })
})

describe('findOverlappingPairs', () => {
  it('catches the real M14 bug: the world controls hint under the combat cluster', () => {
    // The exact rects measured live during the bug (bounding-box tops/bottoms).
    const boxes = [
      box('.hud-controls', 310, 353),
      box('.combat-bottom', 298, 337),
      box('.combat-top', 40, 90),
    ]
    const pairs = findOverlappingPairs(boxes)
    expect(pairs).toContain('.hud-controls ∩ .combat-bottom')
    // combat-top is clear of both.
    expect(pairs).toHaveLength(1)
  })

  it('reports nothing when the world HUD is hidden during combat (the fix)', () => {
    // With .hud-controls hidden it never enters the box list.
    const boxes = [box('.combat-bottom', 298, 337), box('.combat-top', 40, 90)]
    expect(findOverlappingPairs(boxes)).toEqual([])
  })

  it('does not compare same-named boxes (e.g. stacked toasts)', () => {
    const boxes = [box('.toasts', 0, 40), box('.toasts', 30, 70)]
    expect(findOverlappingPairs(boxes)).toEqual([])
  })
})
