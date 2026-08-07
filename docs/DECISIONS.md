# Decisions & Roads Not Taken

Design/architecture forks where one option was chosen and others set aside — kept so the
**alternatives** (and their tradeoffs, and any "try that later" intent) aren't lost when the
conversation scrolls past. This is the design-decision sibling of `docs/learnings.md`.

- **Backlog** below is the one-glance menu of alternatives still worth trying (the `deferred`
  ones). Start there when you want to explore a road not taken.
- Each entry records: the fork, all options with a one-line tradeoff, what was chosen + why, a
  **status** per rejected option (`deferred — worth trying` / `rejected — <reason>`), and a
  **revisit hook** (the concrete seam where trying it later would plug in).
- Entries are newest-first; IDs (`D1`…) are stable handles (Ctrl-F them), independent of order.
- New forks are appended automatically per the global "decision log" rule in `~/.claude/CLAUDE.md`.

---

## Backlog — alternatives worth trying later

- **A bigger "Perfect" celebration** (see **D4**) — an arena flourish (camera kick / burst /
  slow-mo) on top of today's subtle gold flash + sting, if combat wants more punch.
- **Generate the anime corsair from the reference image** (see **D12**) — Hyper3D Rodin for the
  mesh, then bind it to the same KayKit armature the Surveyor uses; the only path that starts from
  `reference.png`.
- **Roll the Blender-GLB prop pipeline out past the one socket** (see **D11**) — arch, spire,
  recruit huts, mooring posts; each is a one-line `model:` opt-in once the `.glb` exists.
- **Let a GLB landmark be the collider too** (see **D11**) — drops the primitive entirely and makes
  the recessed well physically walkable-into; needs async collider rebuilds.

> ✅ **GLB combat** (was here since M40) shipped at **M41** — the rogue now fights with a KayKit
> sword; see **D10** and D7's M41 note. D7 (the hero-art-style fork) is now fully realized.

> Pure *deferred features* that were never offered as a fork (recruits beyond 8, NG+/post-game
> descent, Palegrove brightness tone-down, Tunic-style manual-as-loot, Outer-Wilds rumor-web Guide)
> live in the build plan's "out of scope" notes, not here — this file is only about **decision forks**.

---

## D12 — A custom hero, and which proportions it wears (2026-08-07, M43)

**Fork A — how to get a hero that's Waystone's own** rather than a stock CC0 rogue.

**Chosen:** **model our own mesh over the KayKit skeleton** and inherit its animation clips. A rig
is a contract of names, so discarding the donor's mesh costs nothing: the clips address bones, not
geometry. Zero animations authored, zero driver code changed. Verified the import→export round-trip
preserves clip names / 41 joints / handslot bones *before* modelling anything.

**Not taken:**
- **Generate the anime corsair from `reference.png` via Hyper3D Rodin, then rig it** — closest to the
  reference art and the only path that starts from the image, but mesh quality is unproven AND the
  animation problem stays unsolved (retargeting onto a foreign skeleton is the risky part).
  · _status: deferred — worth trying_ (the seam makes it a drop-in; see
  `~/projects/img2threejs-test/RESEARCH.md`. **Never** use Hunyuan3D — its licence excludes the EU.)
- **Upgrade the procedural rig in code** — no asset pipeline at all, but bounded by primitives.
  · _status: rejected — that's the thing the GLB path exists to move past_
- **Just recolour the KayKit rogue** — cheapest, but the hero stays someone else's character.
  · _status: rejected — defeats the purpose_

**Fork B — proportions**, surfaced only once the two were rendered side by side: KayKit's rogue is
**chibi** (head ≈ ⅓ of height); sizing geometry from the actual bones gives a **slim, realistic**
figure. Both normalize to 1.7u in game, so this is purely style.

**Chosen:** **slim**, then polish. It matches the procedural hero and the world's realistically-
proportioned props, so the game reads as one art style with the chibi rogue retired.
**Not taken:** **rebuild chibi to match KayKit** — would sit more consistently beside the CC0 KayKit
sword and any future KayKit assets. · _status: rejected — it would make the hero match the borrowed
assets rather than the game_

**Consequence worth recording:** the inherited sword was authored for chibi hands and imported at
112% of the slim hero's height. Fixed by normalizing weapons by measurement (`weaponScaleFor`),
which is swap-proof in both directions.

**Revisit hook:** `tools/blender/build_waystone_hero.py` regenerates the mesh (proportions live in
the segment radii and the graded torso profile); `GLB_HERO_URL` + `HERO_CLIPS` in
`src/player/glbanim.ts` point at the asset. A Rodin-generated body would enter at the same place —
build it over this armature and the rest is unchanged.

---

## D11 — Blender-authored GLB props vs procedural primitives (2026-08-07, M42)

**Fork:** with the Blender MCP available, should world props keep being built from Three.js
primitives in code, or be modelled in Blender and shipped as GLB? Probed it by authoring a
replacement for the game's namesake landmark, the waystone socket (a flat drum + a raised dark
octagon + 6 identical boxes), and comparing side-by-side.

**Chosen:** **ship the GLB, scoped to the Amberfall socket only** — a beveled plinth with a
boolean-recessed well, an emissive rune-ring inlay, and 6 irregular broken standing stones
(1,840 tris, 122 KB, same 6u × 2.6u footprint so placements still fit). The primitive stays as
the collider, so the BVH is untouched, and a failed load falls back to it. Scoping to Amberfall
avoids the latent-isle ghost-pass problem entirely. Draw calls actually drop (−8 primitive meshes,
+3 GLB).

**Not taken:**
- **Refine the primitives in code instead** (more/better `THREE` primitives in `landmarks.ts`) —
  no new asset, no loader, no async; but hand-composed primitives can't do bevels, booleans, or
  per-vertex irregularity, which is exactly what made the monument read as carved stone rather than
  stacked boxes. · _status: rejected — it's the thing we were trying to move past_
- **Replace the GLB's rendering wholesale (import its PBR materials/textures)** — closer to the
  Blender look, but it would break the toon art direction and the `makeToonMaterial` choke point.
  Instead the GLB exports **no textures** and its material *names* are re-tooned into the region's
  palette. · _status: rejected — art-direction conflict_
- **Make the GLB the collider too** (drop the primitive) — one source of truth for shape, and the
  recessed well would become physically walkable-into; but it changes the BVH, needs async
  collider rebuilds, and risks a shipped regression for a cosmetic change.
  · _status: deferred — worth trying_ once the visual swap has proven itself
- **Roll out to every landmark at once** (arch, spire, huts, moorings) — consistent art in one
  pass, but a much larger blast radius for a first trial of the pipeline.
  · _status: deferred — worth trying_ (the mechanism is data-driven, so each is a one-line opt-in)
- **Full art-style replacement** (retire procedural props entirely) — · _status: rejected — far
  beyond the calibration question that prompted this_

**Revisit hook:** `LandmarkDef.model` (`src/world/region.ts`) opts any landmark in by name;
`LANDMARK_GLB_URLS` in `src/world/landmarkglb.ts` registers the asset. Rolling out to another prop
= author it in Blender (mirror `tools/blender/build_waystone_socket.py`), drop the `.glb` in
`public/models/waystone/`, add the URL, set `model:` on the landmark. For the latent isles
(Veilspire, Cindervault sockets) `World.applyGhost` must first learn to ghost late-attached meshes —
a content invariant currently blocks that combination on purpose.

---

## D10 — Linking the battle model to the world toggle (2026-07-23, M41)

**Fork:** the world could swap to the KayKit rogue, but combat stayed procedural — should combat
follow the same toggle, and where does the rogue's blade come from (KayKit ships swing clips but no
weapon mesh)?
**Chosen:** **link them** through a **single composition root** (`arena.ts` reads the same
`characterStyle()` `avatar.ts` does) + **download a KayKit weapon** (the pack's CC0 `sword_1handed`,
parented to `handslotr`). The interface (`IHeroCharacter`) already made the swap *possible*; sharing
the *selection* is what makes it *propagate* — an interface alone leaves two `new` sites that diverge.
**Not taken:**
- **Reuse our procedural sword mesh** (attach `buildSword()` to the GLB hand) — _rejected: the user
  chose the KayKit weapon for the best art match; our blocky blade would clash with the rogue._
  (Still the zero-asset fallback if the KayKit weapon ever needs dropping.)
- **Empty-handed** (swing clips, no blade) — _rejected: the clips clearly expect a weapon; the rogue
  would shadow-box._
- **Keep combat procedural** — _rejected: the user explicitly wanted the toggle to change combat too._

**Revisit hook:** `GlbHeroDriver({weaponUrl})` attaches any weapon GLB to `handslotr`; swap the
KayKit dagger/axe/etc. (same pack) by changing `SWORD_URL` in `glbanim.ts`.

## D9 — How to preserve rejected options (2026-07-22, meta)

**Fork:** where should the "roads not taken" from each design fork be saved so they aren't lost?
**Chosen:** a committed **`docs/DECISIONS.md`** (this file) + an **automatic capture rule in the
global `~/.claude/CLAUDE.md`** so every project logs its forks as they're decided — durable,
version-controlled, and rich enough to keep the full tradeoffs.
**Not taken:**
- **AI Project Dashboard only** — _rejected: cards are transient and don't preserve the full option
  set + tradeoffs; better as a "pursue it now" surface than an archive._
- **DECISIONS.md + auto-push deferred ones to the Dashboard** — _deferred: nice, but more moving
  parts; promote items to the Dashboard per-item when actually pursuing one, not automatically._
- **Just keep expanding the plan file's "out of scope" sections** — _rejected: build-log churn,
  not browsable, gets archived with the effort._

**Revisit hook:** if the archive grows valuable, wire the `deferred` backlog into the Dashboard
via `/sync-board` or `spawn_task`.

## D8 — WASD in the battle menu (2026-07-22, M38)

**Fork:** should WASD double as arrows everywhere in combat, or only for menu navigation?
**Chosen:** **menu-only** (a `WASD_TO_ARROW` normalize inside `BattleMenu.step`).
**Not taken:**
- **WASD = arrows for the Hidden-Arts recognizer too** — _rejected: routine nav (S→W→Space =
  Down,Up,Space) would fire Emberwake and cost the turn; arts stay on the real arrows._

## D7 — Hero character art style (2026-07-22, M37)

**Fork:** procedural articulated rig, or a downloadable rigged character model?
**Chosen:** **procedural rig** (hand-built from primitives, animated in code) — full control, zero
licensing questions, no assets to commit to a public repo, native toon look. Built behind a
`HeroDriver` seam precisely so the alternatives stay cheap to try later.
**Not taken:**
- **CC0 stylized rigged pack (KayKit / Quaternius-class)** — _deferred — worth trying:_ license-clean
  for a public repo, tiny files, sits natively next to the toon enemies; a full anim library
  (idle/run/attacks/…).
- **Mixamo semi-realistic** — _deferred — try after the CC0 pack:_ the most literally "HD" look and
  a huge free anim library, but visually clashes with the toon world, needs an FBX→GLB conversion
  step, and redistributing the raw assets in a public repo is a licensing gray area.

**Revisit hook:** implement a `GlbHeroDriver` that satisfies `HeroDriver`'s 4-method surface
(`setLocomotion` / `playAction` / `currentAction` / `update`) over a THREE `AnimationMixer` —
mapping `LocoState`→loop clips, `AttackId`→one-shot clips, sockets→bones. `avatar.ts` and
`arena.ts` need no changes (`src/player/rig.ts`, `src/player/heroanim.ts`).

**➡ TRIED at M39 (2026-07-22) — the pipeline shipped; the seam held.** Built `IHeroCharacter` +
`GlbHeroDriver` (`glbdriver.ts`) + a pure clip map (`glbanim.ts`) + a boot toggle
(`?char=glb` / localStorage / Attunement button); default stays procedural. Loaded a verified
**CC0 Quaternius** model (RobotExpressive) and drove world locomotion over its named clips
(idle→Idle, run/sprint→Running, jump/fall→Jump) — `avatar.ts` picks the driver, `arena.ts`
never changed. **Findings (why it stays a trial, not the default):** (1) it's a *robot*, not the
hooded wanderer — a themed fantasy adventurer is a `.glb` swap + clip remap away; (2) a generic
pack has **no bespoke combat clips** (only `Punch`/gestures), so the per-key sword swings (D-era
M37b) don't exist — **combat kept the procedural rig**; (3) the model brings its own PBR
materials (not toon-shaded), so it reads "HD" but off-palette against the toon world. Net: great
for locomotion, seam proven, aesthetic + combat need a themed asset — both still `deferred` (see
Backlog).

**➡ M40 (2026-07-22) — swapped in the fantasy adventurer.** Replaced the robot with **KayKit
"Adventurers" — Rogue (Hooded)** (verified CC0, Kay Lousberg; the license text says so
verbatim). It's a hooded low-poly rogue — matches the Surveyor AND sits natively in the toon
world (finding #1 + #3 resolved). Same `GlbHeroDriver`, only `glbanim.ts` (76 real clips) +
two model-specific tweaks changed: `MODEL_YAW = 0` (KayKit faces +Z) and the hand-bone lookup
(**GLTFLoader strips dots**, so `handslot.l` loads as `handslotl`). The pack ships bespoke melee
clips, so finding #2 is now solvable — **GLB combat is the one remaining deferred piece** (see
Backlog). Asset SHA-pinned in `public/models/CREDITS.md`.

**➡ M41 (2026-07-23) — combat-GLB shipped; D7 fully realized.** `arena.ts` now holds an
`IHeroCharacter` picked via the SAME `characterStyle()` as `avatar.ts` (the single composition
root), so the toggle drives combat too; the rogue fights with a CC0 KayKit `sword_1handed` on
`handslotr`, and sword ownership moved into the drivers. The last D7 deferred item is done — the
fork is now **D10**.

## D6 — Combo-chain input design (2026-07-22, M35)

**Fork:** how should WASD+Space combo chains be structured?
**Chosen:** **authored per level** (memorizable, LoD-style; leveling changes the pattern), **a wrong
key breaks the chain** (precision + timing), **gentle intro** (Traveler's L1 = ␣-W-␣).
**Not taken:** randomly-generated patterns (_rejected: not memorizable_); wrong key ignored
(_rejected: removes the precision layer the user asked for_).

## D5 — Two maps (2026-07-22, M32)

**Fork:** keys + framing for a local vs world map.
**Chosen:** **`M` = local isle** (titled by isle name) / **`N` = World Map**; M/N switch while open,
same key closes. **Not taken:** a single toggling map / Tab-cycling (_rejected: less discoverable;
Tab needs preventDefault_).

## D4 — The "Perfect" signal (2026-07-21, M31)

**Fork:** how loud should a flawless chain / fully-parried string be signalled?
**Chosen:** **subtle** — a gold flash + rising audio sting (no arena flourish); scope = Chains +
Perfect Guard.
**Not taken:**
- **Arena flourish** (camera kick / particle burst / brief slow-mo) — _deferred — worth trying:_ if
  combat wants more spectacle later (see Backlog).

## D3 — The Attunement (progression) screen (2026-07-21, M30)

**Fork:** show a progression/upgrade screen at all (v1 said "no XP screen"), and in what skin?
**Chosen:** a dedicated full-screen chart on **`P`**, **both skins** (Dragoon + Surveyor) toggleable
+ persisted, **"everything" scope** (verbs/chains/tools/glyphs/arts/resonances). Deliberately
**revises v1's "no XP screen"** (the user asked for it), keeping knowledge-as-reward via `???`
masking of unearned entries.
**Not taken:** one skin only (_rejected: user wanted both_); no screen / keep it diegetic
(_rejected: user explicitly wanted the LoD-style chart_).

## D2 — Grapple-into-combat entry blow (2026-07-21, M29)

**Fork:** what does crashing into a foe by grapple do, and when is it available?
**Chosen:** a **tier-scaled opening blow** (2/3/5 by grapple mastery), **available as soon as the
grapple tool is owned** (no tier gate).
**Not taken:** a fixed blow (_rejected: doesn't reward grapple mastery_); gate it behind a tier
(_rejected: more gating, less "just fun to engage"_).

## D1 — Source brief: v1 minus Vista Riddles, not v2 (2026-07-20, foundational)

**Fork:** build Waystone from `GAME_PROMPT.md` **v1** or the "current" **v2**?
**Chosen:** **v1, with Vista Riddles cut** — the coherent, buildable slice the user wanted.
**Not taken:**
- **v2 ("current" per the codex)** — _rejected by design:_ its whole branch (Marks & Masteries, the
  dodge/jump/break defense layer, the 15-type taxonomy) and **Vista Riddles / Sketches** are
  deliberately out. Do NOT "correct" toward v2. See [[waystone-builds-from-v1-brief]].

**Revisit hook:** none intended — this is a foundational identity choice; adopting v2 would be a
different game, not a feature toggle.
