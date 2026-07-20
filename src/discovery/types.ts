/**
 * Discoverable content model. Design rules enforced by tests
 * (tests/content-invariants.test.ts):
 *  - every discoverable pays >= 2 meters (layered rewards pillar)
 *  - every discoverable has a cue (no unhinted secrets)
 *  - every region has >= 1 glyphstone and >= 3 locked-on-first-visit
 */

export type DiscoveryKind =
  | 'cache' // openable container
  | 'glyphstone' // blank Glyph Stone pickup
  | 'latent' // Lantern-revealed
  | 'buried' // Sounding minigame dig site (M8)
  | 'guarded' // drops after its elite falls (M6)
  | 'perch' // grapple-reachable ledge cache (M3)
  | 'person' // a recruit — finding them grows the Waystation (M4)
  | 'waystone' // the key that completes a latent region (M7)

/**
 * What must be true before the discoverable can be collected. Anything the
 * player can't do yet auto-pins as a "?" when they get close — backtracking
 * is a shopping list, never a memory test.
 */
export type DiscoveryPrereq =
  | 'none'
  | 'lantern' // must be revealed by a lantern pulse first
  | 'grapple' // needs the Grapple tool (M3)
  | 'sounding' // needs the Sounding dig (M8)
  | 'combat' // needs its guardian defeated (M6)

export interface Payout {
  meter: 'lumen' | 'glyphstone' | 'completion' | 'tool-grapple' | 'waystone'
  amount: number
}

export interface DiscoverableDef {
  id: string
  kind: DiscoveryKind
  /** x/z in region space; y resolved from terrain (+dy). */
  x: number
  z: number
  dy?: number
  /** Player-facing name shown on interact/found. */
  label: string
  /** The discoverable's hint — rumour text, glint, shimmer. Never empty. */
  cue: string
  prereq: DiscoveryPrereq
  payouts: Payout[]
}

/** Distances (world units). */
export const INTERACT_RADIUS = 2.6
export const PIN_RADIUS = 15
export const REVEAL_RADIUS = 7
