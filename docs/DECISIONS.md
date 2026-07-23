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

- **A THEMED CC0 adventurer + GLB combat clips** (see **D7** → tried at M39) — the GLB pipeline
  now ships (RobotExpressive robot, world locomotion, behind a toggle). Still worth trying: swap a
  fantasy-humanoid CC0 `.glb` for the robot placeholder (drop-in + clip remap), and give combat GLB
  clips (a generic pack has no bespoke sword swings — retarget or author them, else combat stays
  procedural). Revisit hook: `GlbHeroDriver` + `glbanim.ts` clip map already exist.
- **A bigger "Perfect" celebration** (see **D4**) — an arena flourish (camera kick / burst /
  slow-mo) on top of today's subtle gold flash + sting, if combat wants more punch.

> Pure *deferred features* that were never offered as a fork (recruits beyond 8, NG+/post-game
> descent, Palegrove brightness tone-down, Tunic-style manual-as-loot, Outer-Wilds rumor-web Guide)
> live in the build plan's "out of scope" notes, not here — this file is only about **decision forks**.

---

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
