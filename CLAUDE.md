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
  origin and never moves. The Mistwalker adds a soft floor at the mist plane
  (`PlayerSim.mistFloorY`, gated by a draining `MistCharge`); main tracks the last solid
  shore so a fall or charge-out respawns there, nothing lost.
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
  Hidden Arts live in `content/chains.ts`; a longer Art's `sequence` must NOT end with a
  shorter Art's sequence, or the recognizer fires the shorter one first (Undertow's tail
  can't be `…↑ Space` = Emberwake).
- `src/minigames/` — `sounding.ts` (dig) and `angling.ts` (pure `AnglingSim` + species +
  `cookBestFish`/`mealShield`, all rng/time injected) with `anglingverb.ts` the DOM/input
  wrapper. Angling pays fish (Cook → pre-fight shield) + points (Angler teaches Undertow).
- `src/cards/` — the deck game. `rules.ts` = pure three-lane match engine (pinned ability
  order quiet→echo→rally→bulwark, locked by test); `ai.ts` = greedy deterministic opponent;
  `game.ts` = economy (ownership, subject-encountered gate, shop, opponents/ladder, rewards)
  bridging save ↔ matches. UI in `ui/cardtable.ts` + `ui/shop.ts`. Card data in
  `content/cards.schema.ts` (`ALL_CARDS` — one per enemy/recruit/region, coverage-tested).
- `src/progression/` — use-based mastery (verbs) + glyph grid + `bounties.ts` (pure
  Reward-Board evaluator; bounty DATA in `content/bounties.ts`, UI in `ui/rewardboard.ts`) +
  `guide.ts` (pure `guideModel` — the 100% Guide; remaining discoverables carry the `cue`
  only, NEVER the `label` — spoiler gate pinned by `guide.test.ts`).
- `src/hub/` — recruit figures/structures; hub state DERIVES from discovery state.
- Tools: `content/tools.ts` `TOOL_INFO` is the single source of truth for tool
  names/keys/blurbs (reused by the acquire toasts AND the Ledger); `ACQUIRABLE_TOOL_IDS`
  is pinned to `GameState.tools` keys by `tools.test.ts`.
- The Surveyor's Ledger (`ui/ledger.ts`, key `I`, replaces the old archivist panel): an
  `.esc-overlay` with an Inventory tab (always) + a Guide tab gated on Fen the Archivist
  being home. Talking to Fen opens it on the Guide tab. Add it to `uiOpen` in main; note
  `otherOverlayOpen` (excludes the Ledger) lets `I` still close it. Glyph combos now
  persist in `state.combosDiscovered` (save v14) so a resonance survives a grid clear —
  `GlyphSystem.inscribe` records + announces each once; `.discovered()` reads the list.

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
- Never toggle ONE element's visibility from two places with two CSS mechanisms
  (`style.display` in one path, the `hidden` attribute in another) — they desync
  (the click hint snapped back after every battle, M20). Funnel through a single
  applier that writes one property (see `Hud.applyClickHint` + the pure `clickHintHidden`).
- Verbs/UI keys live in `engine/input.ts` snapshot; tests use `tests/helpers.ts
  idleInput()` — grow it there.
- QA: `?qa=1` + `window.__game` (step(n), teleport, startFight, saves, world…).
  rAF parks in hidden tabs — ALWAYS drive QA via `step(n)`, never wall-clock waits.
- Read every QA screenshot TWICE: "did my feature render?" AND "what's overlapping /
  stale / shouldn't be here?" Run `__game.auditFrame()` in every UI-owning state
  (combat, angling, card table, shop, any new overlay) — it flags visible-element
  overlaps + "world HUD during combat". Screenshot states you only proved headlessly.
  Overlap detector is pure (`ui/framecheck.ts`), tested against the real bug's rects.
  Caveat: the in-app QA browser reports a 0×0 JS viewport, so `auditFrame` geometry
  false-positives there (boxes collapse to the origin) — trust screenshots for layout;
  auditFrame's geometry is for real-sized browsers. Pointer-lock bugs need NON-QA
  (`?qa=1` disables pointer lock), and headless can't grant the lock — verify those
  paths by unit-testing the logic + attribute checks, not a live lock.
- Branch + PR + merge-on-green (`gh pr checks N --watch --fail-fast`, unpiped); main
  push deploys to Pages after tests.
- Save schema changes: bump version, chain a migration, extend validation, update the
  v1-migration test, and never let a failed parse destroy the stored bytes.

## Verify in prod after ship

https://ali0600.github.io/waystone/?qa=1 — walk a few steps via `__game.step`, check
`renderer.info.render.calls` (budget < 300; currently ~53 with all islands manifested).
