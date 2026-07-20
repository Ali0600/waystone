# Waystone — agent notes

Browser exploration RPG (Three.js + TS + Vite). MVP vertical slice complete (M0–M9);
Phase 2 in progress (M10–M13: Chime, Region 3, mist-angling, deck game).
Play: https://ali0600.github.io/waystone/ · Repo: https://github.com/Ali0600/waystone

## Source of truth for design

Built from `/Users/ah/projects/jrpg-design-codex/GAME_PROMPT.md` (**v1**) **minus Vista
Riddles** — the user chose this explicitly over GAME_PROMPT_V2.md despite the codex
calling v2 "current". Do not "correct" toward v2 (no Marks & Masteries, no dodge/jump
defense layer, no 15-type taxonomy). Sketches don't exist; Sounding pays Glyph Stones +
Lumen; guaranteed-payout rule = ≥1 glyph stone + ≥1 buried cache per region.

## Architecture map

- `src/core/` — `state.ts` is the spine: ONE serializable GameState (version 7),
  chained migrations in `parseGameState`, structural validation of everything loaded.
  `events.ts` typed bus — systems talk through events, not references.
- `src/world/` — `world.ts` puts every island in ONE scene (no region switching);
  latent regions are ghosts (shared material, no collision, dormant content) until
  `manifest(id)`. `region.ts` builds islands from data. Collision = three-mesh-bvh
  static BVH + capsule collide-and-slide (`collision.ts`); the collider lives at world
  origin and never moves.
- `src/content/` — DATA, not code. Regions (`amberfall`, `waystation`, `veilspire`,
  `cindervault` — the last two latent, chained: Amberfall's waystone opens Veilspire,
  Veilspire's opens Cindervault), glyphs, chains, enemies, recruits, cards.schema (deck
  game Phase 2 data model).
  **All content coordinates are WORLD coordinates** (region.origin offsets the island).
  A recruit inside a latent region gets its world figure via `RecruitSystem.addWorldFigures`
  at manifest time (hub structure is always built at boot).
- `src/discovery/` — registry/prereq gating/auto-pin "?" system (headless), view,
  canvas Survey Map. Prereq gate types: `lantern` (reveal latent) · `grapple` ·
  `sounding` (dig buried) · `chime` (resonate `sealed` open, `player/chime.ts`) ·
  `combat`. Each tool-acquire is a `tool-*` payout meter that flips a `tools.*` flag.
- `src/combat/` — `encounter.ts` is fully headless (consumes key codes, emits bus
  events); arena scene + DOM overlay render it but own no rules. `timing.ts` pure.
- `src/progression/` — use-based mastery (verbs) + glyph grid.
- `src/hub/` — recruit figures/structures; hub state DERIVES from discovery state.

## Invariants enforced by tests (tests/content-invariants.test.ts)

Every region: density budget (`minDiscoverables`), ≥2 payout meters per discoverable,
non-empty cues, ≥3 locked-on-first-visit, ≥1 glyphstone + ≥1 buried, coordinates inside
the island (world-space), globally unique ids, recruits resolve. **Add every new region
to the REGIONS list there.** These tests catch authoring mistakes — they found veilspire
authored in island-local coords before it ever loaded.

## Working rules

- Tests ship with the change; prove new gates can fail (sabotage → red → restore).
- `makeToonMaterial` is the only way to create materials (gradientMap NearestFilter
  gotcha lives there). Every `display:` rule on a `hidden`-toggled element needs the
  `[hidden] { display: none }` guard (bit us once).
- Verbs/UI keys live in `engine/input.ts` snapshot; tests use `tests/helpers.ts
  idleInput()` — grow it there.
- QA: `?qa=1` + `window.__game` (step(n), teleport, startFight, saves, world…).
  rAF parks in hidden tabs — ALWAYS drive QA via `step(n)`, never wall-clock waits.
- Branch + PR + merge-on-green (`gh pr checks N --watch --fail-fast`, unpiped); main
  push deploys to Pages after tests.
- Save schema changes: bump version, chain a migration, extend validation, update the
  v1-migration test, and never let a failed parse destroy the stored bytes.

## Verify in prod after ship

https://ali0600.github.io/waystone/?qa=1 — walk a few steps via `__game.step`, check
`renderer.info.render.calls` (budget < 300; currently ~53 with all islands manifested).
