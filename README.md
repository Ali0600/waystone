# Waystone

A browser third-person exploration RPG built on Three.js. The world was *sung into being*
and the song stopped partway — most of it hangs latent over a sea of mist, real enough to
see, not real enough to walk on. You are the last **Surveyor**: your lantern reveals what
is latent, and the Waystones you plant finish what the song abandoned. The people you find
out there come home with you, and home gets bigger.

**Play (latest main build): <https://ali0600.github.io/waystone/>**

> Status: **Phases 1–3 complete, live and playable** — six islands, eight recruits, five
> tools, the full discovery/mastery/combat loop, three minigames, a collectible deck game,
> the Reward Board, a spoiler-safe 100% guide, and per-isle atmosphere.

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
| Discovery | 84 authored discoverables across 6 regions: caches, glyph stones, latents, buried, **sealed**, guarded, perches, people, Waystones |
| The Waystation | A hub isle that starts as one ruined arch; each of 8 recruits found in the world raises their structure (Scribe, Smith, Cartographer, Cook, Archivist, Merchant, Cardplayer, Angler) |
| Glyph Grid | Finite blank stones inscribe 6 glyphs into a 4×4 grid at the Scribe; **adjacent glyphs fuse** (find the recipes yourself); re-inscription unlocks as the hub grows |
| Combat | Touch an enemy → a duel: timed beat **Chains** that level with use, per-hit **Parry** — signposted by an incoming-strike bar whose markers light **gold** in the parry window while the enemy glows (`SPACE` to parry: block → reflect → lock-shatter by tier), Chorister **Locks** broken by matching glyphs, 3 undocumented **Hidden Arts** (one taught by the Angler). 6 enemy variants across 3 readable silhouettes (the Cinder Chorister raises three Locks; the Mist Warden throws two parryable bolts) |
| The Waystones | Three of them: defeat a vault's guardian, carry the Waystone to a dormant socket, and watch a ghost island across the mist become real — terrain, bridge, enemies and all. Amberfall → Veilspire → Cindervault Rise → Palegrove Choir |
| Sounding | A dig-hunt minigame: pings answer in rising pitch + screen warmth as you close on buried caches |
| The Chime | A third tool won from a guardian in Veilspire: ring it (`C`) to resonate **sealed** stone open — visible-but-locked caches that auto-pin as "?" until you carry it back to them |
| The Mistwalker | A fourth tool won in Palegrove: the mist sea holds your weight on a draining charge (it refills on solid ground). Walk out over the void — but a charge-out sinks you, and you wake at the last shore, nothing lost |
| Thornmere Deep | A sixth island with no bridge and no Waystone — it just sits across open mist, visible and out of reach. The only way in is to **mist-walk** the gap and **grapple** up the shore (both endgame tools), into a verdant deep guarded by Thorn Husks (four-beat strings + a two-lock rootsong) |
| The Ferry | A fifth tool won deep in Thornmere: ring the **Ferryman's Bell** at any region's mooring to fast-travel to another — a fade, and you step off at the far shore. Only manifested regions are on the network |
| The Reward Board | A posted board that appears by the arch once four recruits are home: 10 bounties spanning every system (clear a region, fell a boss, land 30 fish, win 5 card matches, master a verb, learn two Hidden Arts, wake three isles) with live progress bars, each paying Lumen — some rare Glyph Stones or a card — once |
| The Surveyor's Ledger | Press `I` anywhere: an **Inventory** tab (what you hold — tools and what they do, catch, a **Treasures** collection listing every named find with the isle it came from and exactly what it yielded, cards, learned Arts with their key sequences, discovered resonances), a **100% Guide** tab kept by Fen the Archivist (everything still to do — remaining discoverables named only by their in-game **cue**, never spoiled; latent isles masked; Arts and fusions as counts), and a **Log** tab (`L`) — a running record of every message the world has shown you this session, kept even when the on-screen toasts scroll away |
| Mist-angling | Once the Angler joins, cast (`E`) from rim spots: wait for a bite, strike, then reel against a tension see-saw. Fish are consumables the **Cook** turns into pre-fight shields; enough angling points earn the Angler's **Undertow** technique |
| The Deck Game | Recruit Tam and play the residents at the Painted Table — a three-lane card game (quiet/echo/rally/bulwark abilities) where every card depicts an enemy, recruit, or place **you've actually met**. Wins pay Lumen, ranked-ladder wins pay rare Glyph Stones; Sel's shop stocks rotating boosters. 26 cards, a greedy AI, a 4-resident → 3-rival → Tam ladder |
| Atmosphere | Each isle has its own authored sky, fog, hemisphere, sun and mist colour — amber night, teal dusk, ember-violet, bone-pale dawn, verdant deep — and the scene eases between them as you cross the mist (frame-rate-independent blend; a discrete ferry hop snaps) |
| Audio | Every sound synthesized in WebAudio — no audio assets; each enemy attack pattern has a distinct audible windup |
| Saves | Autosave to localStorage + validated JSON export/import (corrupt saves are parked, never destroyed) |

## Controls

`WASD` move · `Space` jump · `Shift` dash · mouse look (click to lock) ·
`F` lantern pulse · `Q` grapple · `T` sounding ping · `C` chime · `E` interact ·
`M` survey map · `G` glyph grid · `I` ledger (inventory + guide) · `L` message log · `Esc` menu / save

## Stack

- [Three.js](https://threejs.org/) — WebGL renderer, `MeshToonMaterial` toon shading,
  `BatchedMesh` scenery (~52 draw calls with all six isles live)
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) — capsule collide-and-slide
  character controller, no physics engine
- Vite + TypeScript, vanilla DOM/CSS UI, Web Audio API — no framework, no asset files
- Vitest: 269 tests, including a **content-invariant suite** that enforces the design
  pillars over the authored content (payout layering, cue coverage, density budgets,
  coordinate bounds) and a **mechanics↔tests meta-gate** (`docs/MECHANICS.md` can't
  drift from the suite) — authoring mistakes fail CI, not playtests
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

**[`docs/MECHANICS.md`](docs/MECHANICS.md)** is the complete mechanic checklist — every
system, the key that triggers it, and its covering tests. A meta-test
(`tests/mechanics-doc.test.ts`) keeps it honest in both directions: no dead test refs, no
test suite left off the list, and no mechanic listed without coverage.

## Experience Gained

- Designed and shipped a complete CI/CD pipeline: typecheck + test + build on every PR,
  SHA-pinned actions with least-privilege permissions, and a Pages deploy job that can
  only run after tests pass on `main`.
- Encoded design rules as an executable invariant test suite over game content, turning
  authoring mistakes into CI failures instead of playtest bugs (caught a whole region
  authored in the wrong coordinate space before it was ever loaded).
- Built a deterministic, headless-testable simulation core (fixed-timestep loop, pure
  timing math, event-bus-decoupled combat) with 269 unit/integration tests, including
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
