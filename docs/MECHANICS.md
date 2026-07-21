# Waystone — Mechanics Checklist

Every game mechanic, grouped by system, with the key that triggers it and the test(s)
that cover it. A box is **checked when the mechanic has automated coverage** — either a
headless unit/integration test (`tests/*.test.ts`) or, for render/wiring-only behaviour a
unit test structurally can't observe, the tag **`browser-QA`** (driven via `?qa=1` +
`__game`, screenshots read twice, `auditFrame`).

This doc is enforced by [`tests/mechanics-doc.test.ts`](../tests/mechanics-doc.test.ts):
every test file referenced here must exist, every test suite must be referenced by at
least one row, and every row must cite a test or be tagged `browser-QA`. So the list can't
silently drift from the suite.

> Spoiler policy: mechanics are named, hidden **content** is not — no Hidden-Art key
> sequences, no glyph-combo recipes (find those in play, same line the in-game Ledger walks).

## Movement & Camera

- [x] **Walk / strafe** (`WASD`) — capsule collide-and-slide over a static BVH · `tests/collision.test.ts`
- [x] **Jump** (`Space`) — gravity + ground snap · `tests/collision.test.ts`
- [x] **Dash** (`Shift`) — burst; **T2** longer, **T3** air-dash (tier-gated) · `tests/verbs.test.ts`
- [x] **Fall into the mist → respawn at the last solid shore**, nothing lost · `tests/collision.test.ts` · `tests/mistwalker.test.ts`
- [x] **Mouse-look / pointer-lock camera** (click to look; learn-once hint) · `browser-QA` + `tests/hud.test.ts` (hint state)

## Tools (each is found in the world; the acquire flips a capability flag)

- [x] **Lantern** (`F`) — reveal latent discoverables & solidify ghost walkways; **T3** buried-cache sweep · `tests/verbs.test.ts` · `tests/discovery.test.ts`
- [x] **Grapple** (`Q`) — pull to a crystal pylon **or a prowling foe**; targeting scores pylons + enemies in one aim cone; **T3** mid-air re-grapple · `tests/grapple.test.ts` · `tests/verbs.test.ts`
- [x] **Sounding Rod** (`T`) — pitch/warmth homing to buried caches · `tests/sounding.test.ts`
- [x] **Chime** (`C`) — resonate a `sealed` stone open · `tests/chime.test.ts`
- [x] **Mistwalker** — the mist sea holds your weight on a draining charge; charge-out sinks you · `tests/mistwalker.test.ts`
- [x] **Ferry** (`E` at a mooring) — fast-travel between manifested regions · `tests/ferry.test.ts`
- [x] **Tool metadata** (names/keys/blurbs, ids ⇔ save flags) · `tests/tools.test.ts`

## Discovery & Map

- [x] **Interact to collect** (`E`); every discoverable pays ≥2 meters · `tests/discovery.test.ts`
- [x] **Auto-pin "?"** on seen-but-unreachable; no duplicate pins · `tests/discovery.test.ts`
- [x] **Prereq gating** (lantern/grapple/sounding/chime/combat) · `tests/discovery.test.ts`
- [x] **Completion counter** (found / total) · `tests/discovery.test.ts`
- [x] **Content invariants** (payout layering, cue coverage, density, world-space bounds, unique ids) · `tests/content-invariants.test.ts`
- [x] **Survey Map** (`M`) — canvas render of pins, isles, player · `browser-QA`

## Waystones & World

- [x] **Plant a Waystone at a socket → manifest a latent isle** (ghost → solid) · `tests/world.test.ts`
- [x] **Latent regions** hang as ghosts (no collision/content) until manifested · `tests/world.test.ts`
- [x] **Waystone chains** (Veilspire → Cindervault → Palegrove) · `tests/world.test.ts`
- [x] **Enemy contact begins a duel** — the **nearest** in-range enemy, with a post-fight grace so you don't chain straight into the next; defeated enemies despawn; guardians stay recorded. Reaching a foe by **grapple** (contact fires mid-flight) opens with a crash-in blow · `tests/worldenemies.test.ts`

## Glyph Grid (`G`, at the Scribe)

- [x] **Inscribe** a glyph into the 4×4 grid (consumes a finite blank stone) · `tests/glyphs.test.ts`
- [x] **Adjacency combos** fuse neighbouring glyphs (recipes are a discovery) · `tests/glyphs.test.ts`
- [x] **Discovered combos persist** — a resonance survives clearing the grid · `tests/glyphs.test.ts`
- [x] **Re-inscription** (clear a slot for Lumen; gated on hub growth) · `tests/glyphs.test.ts`
- [x] **Per-glyph use counters** · `tests/glyphs.test.ts`
- [x] **Inscription guidance** — three-state scribe status (find her in Amberfall / stand with her at the Waystation / quill ready) + a "select an empty cell" affordance · `tests/glyphpanel.test.ts` · `browser-QA`

## Mastery (use-based; tiers grant properties)

- [x] **Verb tiers** (strike/parry/dash/grapple/lantern) from hidden use counters · `tests/mastery.test.ts`
- [x] **Tier thresholds** → new property unlocks · `tests/mastery.test.ts`
- [x] **Attunement screen** (`P`) — LoD-style progression chart: verb tiers, chain levels, tools, glyph use, Arts/Resonances, each with a next-step counter; unearned entries read `???` (knowledge stays a reward) · `tests/attunement.test.ts`
- [x] **Attunement skins** — toggle between the Dragoon (navy/silver/gold, LoD) and Surveyor (amber) looks; choice persists in localStorage · `browser-QA`

## Combat (touch an enemy → a duel)

- [x] **Beat timing windows** (hit / early / late / expired) · `tests/combat.test.ts`
- [x] **Chains** — timed input strings that level with use (`Space` on the beat) · `tests/combat.test.ts`
- [x] **Parry** — per-hit window (`Space`); **T2** reflect projectiles, **T3** shatter a lock · `tests/combat.test.ts`
- [x] **Parry visibility** — incoming-strike bar (markers gold in-window) + enemy glow + teach line · `browser-QA` + `tests/combat.test.ts` (bar geometry)
- [x] **Chorister Locks** — broken by matching inscribed glyph types · `tests/combat.test.ts`
- [x] **Hidden Arts** — undocumented input sequences, permanent once performed · `tests/combat.test.ts`
- [x] **Command menu** — classic JRPG box (Attack / Glyphs / Defend / Item): arrows navigate, **Enter** confirms/descends, **Esc** backs out, with cursor memory · `tests/menu.test.ts`
- [x] **Defend (Brace)** — halves the next enemy turn's damage and widens the parry window · `tests/combat.test.ts`
- [x] **Item** — eat a held fish to heal in battle (species-scaled, capped at max HP, costs the turn) · `tests/combat.test.ts`
- [x] **Grapple entry blow** — grappling into a foe opens the duel with a tier-scaled crash-in hit (2 / 3 / 5 by grapple mastery), banner + impact · `tests/combat.test.ts`
- [x] **Victory / defeat** — rewards on win; defeat costs nothing (respawn, keep everything) · `tests/combat.test.ts`

## Minigames

- [x] **Sounding** — dig-hunt: rising pitch + screen warmth toward buried caches · `tests/sounding.test.ts`
- [x] **Mist-angling** (`E`) — bite → strike → reel tension see-saw; weighted species · `tests/angling.test.ts`
- [x] **Cook** — a landed fish becomes a one-fight over-max-HP shield · `tests/angling.test.ts` · `tests/combat.test.ts`
- [x] **Angler's teacher threshold** — enough points teaches a Hidden Art · `tests/angling.test.ts`

## Deck Game (the Painted Table, Sel's shop)

- [x] **Match rules** — 3-lane engine, pinned ability order (quiet→echo→rally→bulwark) · `tests/cardrules.test.ts`
- [x] **AI opponent** — deterministic greedy chooser (legal, terminates) · `tests/cardrules.test.ts`
- [x] **Ownership + starter deck** (recruiting Tam grants 8, idempotent) · `tests/cardgame.test.ts`
- [x] **Subject-encountered gate** — a card can't appear before you've met its subject · `tests/cardgame.test.ts`
- [x] **Shop + opponents/ladder + rewards** (Lumen; ladder wins pay Glyph Stones) · `tests/cardgame.test.ts`
- [x] **Card library** — one card per enemy/recruit/region/landmark (coverage) · `tests/cards.test.ts`

## Recruits, Hub & Reward Board

- [x] **Recruit home** — hub state derives from `discoveries[personId] === 'found'` · `tests/world.test.ts`
- [x] **Reward Board** — 10 cross-system bounties, live progress, claim-once payout · `tests/bounties.test.ts`
- [x] **Hub structures & services** (Scribe/Smith/Cartographer/Cook/Merchant render + wiring) · `browser-QA`

## The Surveyor's Ledger (`I` ledger · `L` log · and at Fen the Archivist)

- [x] **Guide model** — remaining content by CUE, never name (spoiler gate); latent isles masked · `tests/guide.test.ts`
- [x] **Guide counts & % rollup** across every category · `tests/guide.test.ts`
- [x] **Treasures** — collected named finds with their isle + exact yield; found-only (no spoilers), recruits/tools excluded · `tests/inventory.test.ts`
- [x] **Message Log** (`L`) — session record of every bottom-left message, newest-first; survives the 5-toast stack cap · `tests/messagelog.test.ts`
- [x] **Ledger panel UI** — Inventory (+ Treasures) / Guide / Log tabs, Fen gate, tool blurbs · `browser-QA`
- [x] **Close any panel** (`Esc`) — closes the open overlay (Ledger, map, glyph grid, shop, ferry, board) without popping the pause menu underneath; every overlay shows a faint "Esc · close" hint · `browser-QA`

## Teaching & Onboarding (M27)

- [x] **Contextual hints** — just-in-time, one at a time, rate-limited, retired the moment the player does the thing; persisted per-save (`hintsSeen`, v15); every hint re-readable in the Ledger Log. Spoiler-safe (no Art sequence / combo recipe) · `tests/hints.test.ts`
- [x] **Controls line grows with tools** — Q/T/C appear only once their tool is owned (no dead keys) · `tests/hud.test.ts`
- [x] **Deck-game rules card** — auto-shows on the first sit at the Painted Table, re-openable via "How to play"; every ability keyword documented · `tests/cards.test.ts` (ability coverage) · `browser-QA`
- [x] **Ferry moorings on the Survey Map** — a teal ⚓ per manifested region so a mooring is findable · `browser-QA`
- [x] **Silent-appearance announcements** — first empty Sounding ping, the Reward Board being raised, and lock counterplay in combat each teach once · `browser-QA`

## World Presentation

- [x] **Per-region atmosphere** — sky/fog/hemi/sun/mist blend to each isle (frame-rate-independent) · `tests/atmosphere.test.ts`
- [x] **Toon material** — banded gradient / NearestFilter choke point · `tests/toon.test.ts`
- [x] **Terrain heightfield** + seeded scatter (mulberry32) · `tests/terrain.test.ts`
- [x] **Triangle winding** — walkable faces point up (physics ≠ rendering) · `tests/terrain-winding.test.ts`
- [x] **Frame-audit** — bounding-box overlap detector for HUD QA · `tests/framecheck.test.ts`
- [x] **Audio** — every SFX synthesized in WebAudio (no assets) · `browser-QA`

## Saves

- [x] **Autosave + load** (localStorage) · `tests/save.test.ts`
- [x] **Chained migrations** v1 → v14 (each schema bump) · `tests/save.test.ts` · `tests/angling.test.ts` · `tests/cardgame.test.ts` · `tests/mistwalker.test.ts` · `tests/ferry.test.ts` · `tests/bounties.test.ts`
- [x] **Structural validation** rejects malformed / oversized input (no `eval`) · `tests/save.test.ts`
- [x] **Corrupt-save recovery** — unreadable bytes parked, never destroyed · `tests/save.test.ts`
