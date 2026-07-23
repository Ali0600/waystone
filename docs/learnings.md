# Learnings

Teachable concepts that came up while building Waystone.

## Triangle winding & backface culling

A 3D face is only visible from the side its vertices wind counter-clockwise toward; renderers
cull the other side by default (`FrontSide`). Winding is invisible in code review — a mesh with
backward indices builds, collides, and raycasts (when you ask for `DoubleSide`) exactly like a
correct one.

**Why it came up:** Waystone's island terrain was authored with clockwise-wound surface
triangles. The capsule physics worked perfectly (collision math ignores winding), so the player
"walked on air" while the renderer culled the entire walkable surface — what looked like ground
was the mist-sea disc rendering *through* the island. Diagnosed by raycasting from the camera
through the suspicious pixels and asking the scene what was actually there (hit: mist at y=-7,
terrain never intersected).

**Takeaway:** when hand-building indexed geometry, pin the winding with a unit test (face
normals of walkable faces must point up) — physics working is zero evidence that rendering
works, because the two pipelines read different properties of the same triangles.

## Page visibility pauses requestAnimationFrame

A browser tab that isn't visible stops firing `requestAnimationFrame` entirely — a rAF-driven
game loop freezes (position, physics, autosave all stop) while the page otherwise runs
(timers, event listeners, console eval all work).

**Why it came up:** driving Waystone from browser automation, the tab reported
`visibilityState: "hidden"`; the sim never stepped, and input tests read identical positions.
The fix for automation: a `__game.step(n)` QA hook that advances the fixed-timestep update
manually, independent of rAF.

**Takeaway:** never assume a game loop is running when testing through automation — expose a
deterministic manual-step hook gated to dev/QA builds; it doubles as the foundation for
scripted end-to-end tests.

## Design rules as executable tests (content-invariant suites)

When game/app content is data (regions, items, configs), the design rules governing it
("every discoverable pays ≥2 meters", "every secret has a cue", "≥3 locked on first
visit") can be written as unit tests over the content files themselves — turning the
design document into a CI gate.

**Why it came up:** Waystone's brief had hard authoring rules. Encoding them as
`tests/content-invariants.test.ts` meant every new region had to satisfy the pillars to
merge. The suite caught a real bug no read-through spotted: an entire region authored in
island-local coordinates when the convention was world coordinates — the "positions
inside the island" invariant failed with a distance of 211 units vs a 60-unit radius.

**Takeaway:** if content is data, design rules are assertions — write the invariant
suite the day the content format exists, and every authoring mistake becomes a red CI
check instead of a playtest mystery.

## A greedy first-match sequence recognizer swallows suffix patterns

A recognizer that watches a rolling input buffer and returns the *first* pattern whose
sequence matches the buffer's tail will fire a **shorter** pattern that is a suffix of a
**longer** one before the longer pattern can ever complete.

**Why it came up:** the Hidden-Arts recognizer checks each Art against `buffer.slice(-n)`.
Undertow was authored as `↓ ↓ ↑ Space`, whose last three keys are `↓ ↑ Space` — exactly
Emberwake. So performing Undertow always triggered Emberwake on the third key and cleared the
buffer; Undertow was unreachable by input. Caught while writing the combat test, not by the
type system (both are valid `string[]`). Fixed by giving Undertow a tail no shorter Art shares
(`→ ↓ → Space`).

**Takeaway:** when patterns of different lengths share a matcher, no pattern's suffix may equal
a shorter pattern's full sequence — enforce it (a test that every Art is reachable) rather than
trusting authoring. The same trap lives in keybinding chords, command parsers, and gesture
recognizers.

## EffectComposer breaks naive renderer.info readings

Three.js `renderer.info.render` auto-resets on every internal `render()` call. An
EffectComposer issues several internal draws per frame (scene pass, bloom mips, final
quad), so reading `info.render.calls` after `composer.render()` reports the LAST pass —
typically `1 call, 1 triangle` — not the scene.

**Why it came up:** Waystone's F3 debug HUD and perf QA read draw calls; adding the
bloom+vignette composer silently turned the metric into garbage.

**Takeaway:** when adding post-processing, set `renderer.info.autoReset = false` and
call `renderer.info.reset()` once at frame start — then the counters describe the whole
frame again. A metric that keeps reporting after a pipeline change is not necessarily
still measuring the same thing.

## Two writers + two CSS mechanisms = a desynced element

`element.hidden = true` and `element.style.display = 'none'` are independent switches for
the same outcome (visibility). If one code path toggles an element via `style.display`
and another toggles it via the `hidden` attribute, the two states drift: inline
`display` always beats the `hidden` attribute, so `hidden = false` can't reveal an element
that a different path left at `display:none`, and vice-versa.

**Why it came up:** the "Click to look around" hint was written by *two* owners — the
pointer-lock handler (`showClickHint` → `style.display`) and the combat overlay
(`setWorldUiVisible` → `hidden`). Combat-end blindly set `hidden = false`, so the centered
box snapped back after every battle. Fixed by making one pure function
(`clickHintHidden(want, suppressed, learned)`) the single source of truth and one private
`applyClickHint()` the only writer, using the `hidden` attribute alone.

**Takeaway:** an element's visibility must have exactly one owner and one mechanism. When a
second concern needs to hide it, feed that concern into the *same* applier as an input —
don't reach in with a different property. (Related: the `[hidden]{display:none}` guard —
same family, a `display:` rule silently out-ranking the `hidden` attribute.)

## Verify a bug on a surface that can actually exhibit it

A QA/automation surface can be *structurally incapable* of showing the bug you're chasing.
Waystone's `?qa=1` mode deliberately disables pointer lock (automation steers with keys),
so the pointer-lock-driven hint bug simply cannot occur there — and a headless browser
won't grant a real pointer lock from a synthesized click either. Worse, the in-app QA
browser reports a **0×0 JS viewport**, so `getBoundingClientRect`-based overlap audits
collapse every box onto the origin and report phantom overlaps.

**Why it came up:** verifying the M20 fix, QA mode showed the hint always-hidden (can't
reproduce), and `auditFrame` flagged a `.hud-counters ∩ .hud-region` overlap that was pure
0×0-viewport garbage (the region banner was `opacity:0` and, at real desktop width, nowhere
near the counters). The screenshot — which renders at a real size — showed a clean frame.

**Takeaway:** match the verification surface to the defect. Drive pointer-lock/layout bugs
in NON-QA at a real viewport; trust rendered screenshots over JS geometry when the JS
viewport is degenerate; and cover the paths automation can't reach with unit tests over
pure logic + attribute assertions, not live-browser theatrics.

## Test the ABSENCE, not just the presence (spoiler gates & redaction)

When a feature's correctness is partly about what it must NOT show — a spoiler-safe guide
that lists remaining content by hint but never by name, a log that redacts secrets, an API
that omits internal fields — assert the absence directly, and drive it from the real data.

**Why it came up:** the 100% Guide surfaces unfound discoverables by their in-game `cue`
and must never leak their `label`. The gate is a pure function (`guideModel`), and the test
serializes its output and asserts that *every* real discoverable's label is absent from the
JSON while its cue is present — then proves fail-first by making the model emit the label
(3 rows go red). The same assertion was re-run against the live rendered DOM in QA
(`labelsLeaked: []`), because a model that redacts is worthless if the view re-derives the
name some other way.

**Takeaway:** for redaction/spoiler requirements, write a test that would FAIL if the
forbidden value appeared (`expect(serialized.includes(secret)).toBe(false)`), iterate it
over the actual dataset (not one hand-picked case), and verify the same absence one layer
downstream (the DOM the user sees), not only in the model you control.

## A doc that must track the code should be a TESTED artifact — enforced both directions

A checklist/index/coverage doc rots the moment it's only prose: someone adds a feature or a
test file and forgets the doc, and now it lies. The fix is to make the doc machine-checkable
against the code, in BOTH directions, so neither side can drift silently.

**Why it came up:** `docs/MECHANICS.md` lists every game mechanic with its covering test.
`tests/mechanics-doc.test.ts` asserts (1) every `tests/*.test.ts` the doc cites exists,
(2) every real test suite is cited by ≥1 row — so a new suite *forces* a new doc row — and
(3) every row cites a test or a `browser-QA` tag. The forward-only check (refs resolve)
would still let a whole new suite go unlisted; the reverse check (no orphan suites) is what
makes the doc stay complete. Two implementation notes that generalize: read the repo files
the test needs via Vite's `import.meta.glob('./*.test.ts')` + `import doc from '...md?raw'`
(no `@types/node` in a browser tsconfig — and Vite's glob omits the importing module, so
union it back in); and mapping the doc against the suite is itself a coverage audit — it
surfaced one genuinely untested system (`WorldEnemies`).

**Takeaway:** when a doc's whole value is that it mirrors the code (a mechanics list, an API
index, a coverage map), back it with a test that enforces the mirror both ways — refs must
resolve AND every real item must be listed. A one-directional check silently permits the
omission that matters most.

## A modal state that freezes the world re-evaluates stale proximity on resume

When a modal state (combat, a cutscene, a pause menu) freezes the simulation, every
proximity/trigger condition that was true at freeze time is still true on the resume
frame — the player hasn't moved, and neither has anything else. Any trigger checked
per-frame with no grace fires *instantly* on resume.

**Why it came up:** Waystone's duels freeze the world; contact with an enemy starts a duel
with no cooldown. Ending a fight resumed the world with the player standing exactly where
the first enemy touched them — and in isles where patrol arcs overlap the 1.7u touch
radius, a *second* enemy was already in range, so a new duel started the very next frame
("my enemy changed into another one"). Fixed with a `suppress(seconds)` grace applied at
encounter end (patrols keep animating; deliberate re-engagement still works), plus
nearest-wins contact selection instead of first-by-array-order.

**Takeaway:** pair every enter-modal trigger with a resume-side grace (a cooldown, a
must-leave-the-zone latch, or a require-re-approach), and when several triggers overlap,
resolve by *nearest/most-relevant*, never by iteration order. Test the exact resume frame:
"condition still true on the frame after the modal ends" must NOT re-fire.

## `stopPropagation()` does NOT stop other listeners on the same element

`event.stopPropagation()` stops the event from travelling to *other elements* in the
capture/bubble path — it does nothing about sibling listeners attached to the **same**
target. To prevent a later-registered listener on the same element from also running, you
need `event.stopImmediatePropagation()`.

**Why it came up:** every full-screen overlay (Ledger, cards, shop…) and the pause menu
registered their Escape handlers on `window`. An overlay's handler closed itself and called
`stopPropagation()`, expecting the pause-menu handler (also on `window`, registered later)
to be suppressed — but it wasn't, because they share the target. The overlay hid itself,
then the menu's handler ran, saw no overlay open (it had just hidden), and toggled the menu
on. Pressing Esc to close the Ledger *also opened the pause menu underneath*. Switching to
`stopImmediatePropagation()` fixed it (the overlays are all registered before the menu, so
immediate-stop reaches its handler).

**Takeaway:** when two listeners on the *same* element/`window`/`document` must be mutually
exclusive for one event and one has to preempt the other, `stopImmediatePropagation()` is
the tool — and it only preempts listeners registered *after* it, so registration order is
part of the contract. `stopPropagation()` is for cross-element bubbling, a different job.
Verify by reproducing the exact double-fire first (dispatch the real event, assert the
second listener's effect is absent), not just that the first one's effect happened.

## Contextual hints teach best when they retire on *doing*, not on a timer

The tutorial-design literature (CHI 2012 A/B study; the IUI 2017 hint experiment where 81% of
players rated hints unhelpful, mostly for "stating the obvious") converges on: teach a mechanic
*just-in-time* when it first becomes relevant, show one at a time, rate-limit, and **retire the
hint the instant the tracked behaviour proves the player learned it** — an over-firing hint
trains players to ignore the whole channel (hint fatigue).

**Why it came up:** Waystone's teaching pass (M27). Encoded as a pure `HintSystem` whose trigger
is a `when(ctx)` predicate over live state; a hint retires the frame `when()` goes false — i.e.
the player did the thing (pulsed the lantern, inscribed a stone). "Learned" is a *behaviour*
(`mastery.lantern > 0`), not a timer or a view-count. Informational one-shots (no action to
detect) get a `showOnce` flag and retire after a hold. Seen ids persist in the save so a retired
hint never returns. A `retireOn` bus event covers "player did it before the hint could fire".

**Takeaway:** model a hint as `{when, retireOn?, showOnce?}` and drive retirement off the same
signal that proves competence — never a fixed number of shows. Keep the scheduler pure so the
"one at a time / gap / retire" logic is unit-tested, and pin a spoiler gate if the game hides
knowledge (assert no hint text contains a secret sequence/recipe). Corollary for browser QA of
*transient* UI: with `requestAnimationFrame` free-running in the preview pane, a banner that
appears then auto-hides can't be reliably screenshot-synced (the sim advances between your JS
probe and the capture). Verify such elements by attribute + **real-viewport** `getBoundingClientRect`
(resize to 1280×800 first — the in-app QA browser's default geometry is degenerate), the same way
pointer-lock/combat-only UI is verified without a live screenshot.

## A CSS-animated ephemeral element's lifetime lives in TWO places — keep them in lockstep

A common UI pattern: JS creates a transient element, a CSS `animation … forwards` fades it in/out,
and a JS `setTimeout(() => el.remove(), MS)` cleans it up. The element's on-screen lifetime is the
*minimum* of the two: if the CSS animation is shorter than the timeout, the element sits invisible
(animation finished, still in the DOM) for the gap; if the timeout is shorter, it's yanked
mid-animation. They are a coupled pair even though they live in different files.

**Why it came up:** M36 made the "Perfect!" combat flash linger ~1s longer. Bumping only the JS
`setTimeout` (900 → 1900ms) would have left it faded-out-but-present for a second; bumping only the
CSS would have removed it mid-hold. Both had to move together: a dedicated `combat-float-perfect`
1.9s keyframe (holds opacity 1 from 10%–72%, then fades) **and** a `flashLifetimeMs(flavor)` helper
returning 1900 for `perfect` / 900 otherwise, used for the removal timeout.

**Takeaway:** when an element's visible lifetime is set by a CSS animation duration AND a JS removal
timer, treat them as one value with two expressions — change both in the same commit and leave a
comment at each site pointing at the other. Extract the JS side as a tiny pure function
(`flashLifetimeMs`) so the "perfect outlives the rest" invariant is unit-testable (fail-first: make
them equal → red); verify the CSS side by reading the real element's *computed* `animation-duration`
in the browser, not by trusting the timeout constant (verify the rendered outcome, not the proxy).

## Split animation into a PURE semantic layer + a swappable render driver (the "seam")

When you build one implementation of something you know you'll want to swap later (a procedural
character rig now, a downloadable GLB/Mixamo one next), put a seam between *what* it does and
*how* it's drawn. In M37 the split is: `heroanim.ts` is PURE (no THREE) — locomotion *state
names* (`idle/run/sprint/...`), *attack ids* (`overhead/thrust/...`), the `ATTACK_FOR_KEY`
mapping, and keyframe math, all unit-testable headlessly; `rig.ts` turns a pose into a THREE
skeleton and exposes a tiny `HeroDriver` interface (`setLocomotion` / `playAction` /
`currentAction` / `update`). Everything above the driver (the Avatar and Arena wiring, the event
handlers, the id mappings) speaks only the semantic vocabulary and never mentions how a pose
becomes pixels.

**Why it came up:** the user asked for a procedural rig *and* said "I want to test lots of
options (GLB packs, Mixamo) later." A future `GlbHeroDriver` implements the same four methods
over an `AnimationMixer` (state → named loop clip, id → one-shot clipAction, sockets → bones),
and `Avatar`/`Arena` change zero lines. The pure layer means the animation *logic* (which key
swings which way, when a track ends, gait antiphase) is tested without a renderer at all.

**Takeaway:** when a component has a *decision* half and a *rendering* half and the rendering
half is the thing you'll swap, name a narrow interface between them (a handful of verbs in the
domain's own words) and keep the decision half free of the rendering library entirely. Test the
decision half as pure functions; verify the rendering half in the browser. The payoff is that
swapping the backend is a new file, not a refactor — and pairs with the single-writer rule (one
applier owns each rendered property) so the two halves can't fight.

## A config selected by URL-param-OR-localStorage: a reload can drop the param and switch variants

When a feature toggle reads a URL query param first and falls back to localStorage (e.g.
`?char=glb` else `waystone:character-style`), a *reload* — a full navigation, or a Vite HMR
full-reload — can drop the query string while keeping the same page, silently flipping you to the
fallback variant. If you're QA'ing the URL-param variant, your later probes are now measuring the
*other* code path.

**Why it came up:** M39 QA'd the GLB hero via `?char=glb`. Mid-session the query params
vanished (`location.search === ''`), so `characterStyle()` fell back to `procedural`; reading the
(now procedural) driver's non-existent `locoAction` returned null and looked like a "jump
animation bug." Measuring the driver directly — `constructor.name`, `'ready' in driver` — showed it
was a `HeroDriver`, not the `GlbHeroDriver` I thought I was testing. Switching QA to set the
*localStorage* key (the durable source) and reloading fixed it.

**Takeaway:** for a dual-source toggle, assert *which variant is active* inside the same probe
(read the discriminator — a class name, a style field) before trusting any result; and QA the
**durable** source (localStorage/env), not the ephemeral URL param, so a reload can't switch the
target under you. A "bug" that appears right after any reload is a prime suspect for
tested-the-wrong-variant (pairs with "check the instrument before believing a negative").
