import type { GameState } from '../core/state'
import type { RegionDef } from '../world/region'
import type { DiscoveryKind } from '../discovery/types'
import { RECRUITS } from '../content/recruits'
import { ARTS } from '../content/chains'
import { ALL_CARDS } from '../content/cards.schema'
import { BOUNTIES } from '../content/bounties'
import { ENEMIES } from '../content/enemies'
import { COMBOS } from '../content/glyphs'
import { ACQUIRABLE_TOOL_IDS } from '../content/tools'
import { VERB_IDS, tierOf } from './mastery'

/**
 * The 100% Guide model — a spoiler-safe "what is left to do" snapshot, kept
 * PURE (no DOM, no THREE) so the ledger UI just renders it and the spoiler gate
 * is unit-testable.
 *
 * The pillar is "knowledge is a reward": remaining discoverables are surfaced by
 * their in-game `cue` (the same hint the auto-pin toast shows) and NEVER their
 * `label` — you get a guided shopping list in the game's own hint language, not
 * a name-everything walkthrough. Hidden Arts and glyph fusions appear as counts
 * until earned. Latent isles are masked (no name) until their Waystone is planted.
 */

/** A remaining discoverable, described only by cue + kind — never its name. */
export interface GuideRemaining {
  kind: DiscoveryKind
  cue: string
  /** ready = Lantern-revealed, go collect; pinned = a "?" on the map; unseen =
   *  not yet encountered (the guide front-loads its cue as a shopping list). */
  status: 'ready' | 'pinned' | 'unseen'
}

export interface GuideRegion {
  id: string
  /** Present only for manifested isles. Latent isles are deliberately unnamed. */
  name: string | null
  latent: boolean
  found: number
  total: number
  remaining: GuideRemaining[]
}

export interface GuideCount {
  current: number
  total: number
}

export interface GuideModel {
  /** One "the song is N% resung" figure across the countable categories. */
  overall: GuideCount
  regions: GuideRegion[]
  people: GuideCount
  tools: GuideCount
  arts: GuideCount
  fusions: GuideCount
  cards: GuideCount
  bounties: GuideCount
  isles: GuideCount
  foes: GuideCount
  /** Verbs at max tier (3). */
  mastery: GuideCount
}

const MAX_TIER = 3

/**
 * Build the guide model. `regions` is the world's full region set; a region is
 * masked until `isManifested(id)` is true. Recruit/tool discoverables also live
 * inside `regions[].discoverables`, so `people`/`tools` are shown as their own
 * lines for the player but NOT double-counted into `overall`.
 */
export function guideModel(
  state: GameState,
  regions: readonly RegionDef[],
  isManifested: (id: string) => boolean,
): GuideModel {
  const regionModels: GuideRegion[] = regions.map((def) => {
    if (!isManifested(def.id)) {
      return { id: def.id, name: null, latent: true, found: 0, total: 0, remaining: [] }
    }
    const defs = def.discoverables
    const found = defs.filter((d) => state.discoveries[d.id] === 'found').length
    const remaining: GuideRemaining[] = []
    for (const d of defs) {
      const st = state.discoveries[d.id]
      if (st === 'found') continue
      const status: GuideRemaining['status'] =
        st === 'revealed' ? 'ready' : st === 'pinned' ? 'pinned' : 'unseen'
      // cue ONLY — never d.label (the spoiler gate, pinned by guide.test).
      remaining.push({ kind: d.kind, cue: d.cue, status })
    }
    return { id: def.id, name: def.name, latent: false, found, total: defs.length, remaining }
  })

  const discoverablesFound = regionModels.reduce((n, r) => n + r.found, 0)
  const discoverablesTotal = regionModels.reduce((n, r) => n + r.total, 0)

  const people: GuideCount = {
    current: RECRUITS.filter((r) => state.discoveries[r.personId] === 'found').length,
    total: RECRUITS.length,
  }
  const tools: GuideCount = {
    current: ACQUIRABLE_TOOL_IDS.filter((id) => state.tools[id]).length,
    total: ACQUIRABLE_TOOL_IDS.length,
  }
  const arts: GuideCount = { current: state.artsUnlocked.length, total: ARTS.length }
  const fusions: GuideCount = { current: state.combosDiscovered.length, total: COMBOS.length }
  const cards: GuideCount = { current: state.cardsOwned.length, total: ALL_CARDS.length }
  const bounties: GuideCount = {
    current: state.bountiesClaimed.length,
    total: BOUNTIES.length,
  }
  const isles: GuideCount = {
    current: regions.filter((r) => isManifested(r.id)).length,
    total: regions.length,
  }
  const enemyIds = Object.keys(ENEMIES)
  const foes: GuideCount = {
    current: enemyIds.filter((id) => (state.enemiesFelled[id] ?? 0) > 0).length,
    total: enemyIds.length,
  }
  const mastery: GuideCount = {
    current: VERB_IDS.filter((v) => tierOf(v, state.mastery[v]) >= MAX_TIER).length,
    total: VERB_IDS.length,
  }

  // Overall excludes people/tools (they ARE discoverables — counting them again
  // would double-weight). Everything else is independent progression.
  const buckets: GuideCount[] = [
    { current: discoverablesFound, total: discoverablesTotal },
    arts,
    fusions,
    cards,
    bounties,
    isles,
    foes,
    mastery,
  ]
  const overall: GuideCount = {
    current: buckets.reduce((n, b) => n + b.current, 0),
    total: buckets.reduce((n, b) => n + b.total, 0),
  }

  return { overall, regions: regionModels, people, tools, arts, fusions, cards, bounties, isles, foes, mastery }
}

/** Whole-number percent, guarding total 0. */
export function guidePercent(c: GuideCount): number {
  return c.total === 0 ? 0 : Math.round((c.current / c.total) * 100)
}
