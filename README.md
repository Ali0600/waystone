# Waystone

A browser third-person exploration RPG built on Three.js. The world was *sung into being*
and the song stopped partway — most of it hangs latent over a sea of mist, real enough to
see, not real enough to walk on. You are the last **Surveyor**: your lantern reveals what
is latent, and the Waystones you plant finish what the song abandoned. The people you find
out there come home with you, and home gets bigger.

**Play (latest main build): <https://ali0600.github.io/waystone/>**

> Status: **MVP vertical slice complete** — three islands, six recruits, the full
> discovery/mastery/combat loop, and the Waystone planting ritual.

## The pillar

> **A world that rewards exploration, where everything has upgrades.**

- **Compact and dense, never vast.** Three hand-authored floating islands; no open world,
  no procedural terrain.
- **Everything you do levels itself.** Verbs (Lantern, Grapple, Dash, Strike, Parry) have
  hidden use-counters; tiers grant new *properties* — the lantern learns to solidify
  ghost walkways, the grapple learns to fire mid-air. No XP screen. The world is the trainer.
- **Every discoverable pays at least two meters** (item + Lumen + completion), every secret
  has a visible cue, and anything you can't reach yet auto-pins as a **?** on the Survey
  Map — backtracking is a shopping list, never a memory test.
- **Knowledge is a reward.** Glyph adjacency combos appear in no tooltip; Hidden Arts are
  input sequences the game never documents; enemy chants are puzzles your glyphs answer.

## What's in the slice

| System | Shape |
|---|---|
| Discovery | 61 authored discoverables across 4 regions: caches, glyph stones, latents, buried, **sealed**, guarded, perches, people, Waystones |
| The Waystation | A hub isle that starts as one ruined arch; each of 8 recruits found in the world raises their structure (Scribe, Smith, Cartographer, Cook, Archivist, Merchant, Cardplayer, Angler) |
| Glyph Grid | Finite blank stones inscribe 6 glyphs into a 4×4 grid at the Scribe; **adjacent glyphs fuse** (find the recipes yourself); re-inscription unlocks as the hub grows |
| Combat | Touch an enemy → a duel: timed beat **Chains** that level with use, per-hit **Parry** (block → reflect → lock-shatter by tier), Chorister **Locks** broken by matching glyphs, 2 undocumented **Hidden Arts**. 5 enemy variants across 3 readable silhouettes (the Cinder Chorister raises three Locks at once) |
| The Waystones | Two of them: defeat a vault's guardian, carry the Waystone to a dormant socket, and watch a ghost island across the mist become real — terrain, bridge, enemies and all. Amberfall's opens Veilspire; Veilspire's opens Cindervault Rise |
| Sounding | A dig-hunt minigame: pings answer in rising pitch + screen warmth as you close on buried caches |
| The Chime | A third tool won from a guardian in Veilspire: ring it (`C`) to resonate **sealed** stone open — visible-but-locked caches that auto-pin as "?" until you carry it back to them |
| Audio | Every sound synthesized in WebAudio — no audio assets; each enemy attack pattern has a distinct audible windup |
| Saves | Autosave to localStorage + validated JSON export/import (corrupt saves are parked, never destroyed) |

## Controls

`WASD` move · `Space` jump · `Shift` dash · mouse look (click to lock) ·
`F` lantern pulse · `Q` grapple · `T` sounding ping · `C` chime · `E` interact ·
`M` survey map · `G` glyph grid · `Esc` menu / save

## Stack

- [Three.js](https://threejs.org/) — WebGL renderer, `MeshToonMaterial` toon shading,
  `BatchedMesh` scenery (~53 draw calls with all three islands live)
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) — capsule collide-and-slide
  character controller, no physics engine
- Vite + TypeScript, vanilla DOM/CSS UI, Web Audio API — no framework, no asset files
- Vitest: 127 tests, including a **content-invariant suite** that enforces the design
  pillars over the authored content (payout layering, cue coverage, density budgets,
  coordinate bounds) — authoring mistakes fail CI, not playtests
- GitHub Actions CI → GitHub Pages, deploy gated on green tests

## Development

```bash
npm ci
npm run dev        # dev server at http://localhost:5173/waystone/
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
```

Append `?qa=1` to the URL for the QA harness: no pointer lock, and a `window.__game`
handle with a deterministic `step(n)` that advances the fixed-timestep simulation even in
hidden tabs — the same hook the automated browser QA drives.

## Experience Gained

- Designed and shipped a complete CI/CD pipeline: typecheck + test + build on every PR,
  SHA-pinned actions with least-privilege permissions, and a Pages deploy job that can
  only run after tests pass on `main`.
- Encoded design rules as an executable invariant test suite over game content, turning
  authoring mistakes into CI failures instead of playtest bugs (caught a whole region
  authored in the wrong coordinate space before it was ever loaded).
- Built a deterministic, headless-testable simulation core (fixed-timestep loop, pure
  timing math, event-bus-decoupled combat) with 127 unit/integration tests, including
  capsule-vs-BVH physics regression tests that run in Node.
- Implemented a browser automation QA harness (`?qa=1` + `window.__game.step`) and used it
  to drive scripted end-to-end playthroughs — catching rendering, physics and UX bugs a
  unit suite structurally cannot see.
- Versioned save schema with chained forward migrations, structural validation of untrusted
  input, size caps, and non-destructive corrupt-save recovery.

## Design lineage

Derived from a personal JRPG design-research codex (162 mechanics across 34 games).
Systems descend from: Grandia's use-based skills, Wild ARMs' Tools, FF7's Materia
adjacency, Suikoden II's growing castle, Legend of Dragoon's Additions, Sea of Stars'
Locks, Legend of Legaia's hidden Arts, and FF9's Chocobo Hot & Cold.
