/**
 * Frame-audit primitives — the overlap detector behind `__game.auditFrame()`.
 * Pure (no DOM), so the detection logic is unit-tested in node against real
 * measured rects; the browser helper only feeds it live bounding boxes.
 *
 * Why this exists: a feature-focused screenshot answers "did my thing render?"
 * but not "is anything overlapping / stale / where it shouldn't be?". A
 * mechanical bounding-box check removes "did I notice?" from the loop (a combat
 * HUD-overlap shipped in Phase 2 precisely because I never asked the second
 * question).
 */

export interface Box {
  name: string
  top: number
  bottom: number
  left: number
  right: number
}

/** True when two axis-aligned rectangles share any area (edge-touch is not
 *  an overlap — adjacent UI clusters legitimately abut). */
export function rectsIntersect(a: Box, b: Box): boolean {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
}

/** Every intersecting pair among the boxes, as "nameA ∩ nameB" strings.
 *  Boxes sharing a name (e.g. multiple toasts) are not compared to each other. */
export function findOverlappingPairs(boxes: Box[]): string[] {
  const pairs: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].name === boxes[j].name) continue
      if (rectsIntersect(boxes[i], boxes[j])) {
        pairs.push(`${boxes[i].name} ∩ ${boxes[j].name}`)
      }
    }
  }
  return pairs
}
