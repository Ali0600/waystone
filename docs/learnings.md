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
