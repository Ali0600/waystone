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
