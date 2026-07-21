import type { GameState } from '../core/state'
import type { RegionDef } from '../world/region'
import type { DiscoveryKind } from '../discovery/types'

/**
 * The Treasures model — a JRPG "key items" record of the named finds you have
 * actually collected, and exactly what each one paid out. Kept PURE (no DOM) so
 * the ledger UI just renders it and the "only found items appear" spoiler rule
 * is unit-testable (mirrors `progression/guide.ts`).
 *
 * Why it exists: a find like "Heart of the Spire" is a flavour name on a payout
 * container — collecting it grants ⬡1 + ◆30 and then the game keeps only
 * `discoveries[id] = 'found'` plus aggregate meters, so the name is never shown
 * again ("just Lumens but I'm not sure"). This re-joins each found id to its def
 * and surfaces the name + isle + yield permanently.
 *
 * Excluded: `person` finds (recruits, shown in the hub, not items) and any find
 * whose payout grants a tool (the Tools section already lists it with a blurb).
 * Everything else that is `found` is a treasure. Nothing unfound is ever
 * included, so the record leaks no spoilers.
 */

export interface TreasureYield {
  lumen: number
  glyphStones: number
  waystones: number
}

export interface TreasureEntry {
  id: string
  kind: DiscoveryKind
  label: string
  /** The isle it was found on — disambiguates duplicate labels (Blank Glyph Stone). */
  regionName: string
  yields: TreasureYield
}

/** True when any payout on this find grants a tool (tool-grapple, tool-ferry, …). */
function grantsTool(def: RegionDef['discoverables'][number]): boolean {
  return def.payouts.some((p) => p.meter.startsWith('tool-'))
}

/**
 * Every collected named find, in world-region order then authoring order.
 * `regions` is the world's full region set; only `found` discoverables appear,
 * so latent/unreached content is naturally absent (no manifest gating needed).
 */
export function treasureModel(state: GameState, regions: readonly RegionDef[]): TreasureEntry[] {
  const entries: TreasureEntry[] = []
  for (const region of regions) {
    for (const def of region.discoverables) {
      if (state.discoveries[def.id] !== 'found') continue
      if (def.kind === 'person') continue // recruits live in the hub, not the bag
      if (grantsTool(def)) continue // tools are shown with their blurb elsewhere
      const yields: TreasureYield = { lumen: 0, glyphStones: 0, waystones: 0 }
      for (const p of def.payouts) {
        if (p.meter === 'lumen') yields.lumen += p.amount
        else if (p.meter === 'glyphstone') yields.glyphStones += p.amount
        else if (p.meter === 'waystone') yields.waystones += p.amount
        // 'completion' and any other meter carry no held value — ignored, as
        // DiscoverySystem.interact() itself ignores them.
      }
      entries.push({ id: def.id, kind: def.kind, label: def.label, regionName: region.name, yields })
    }
  }
  return entries
}
