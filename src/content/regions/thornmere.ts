import type { RegionDef } from '../../world/region'

/**
 * Region 5 — Thornmere Deep. A dark verdant night-garden far north of
 * Palegrove, across open mist. UNLIKE the other outer isles it is NOT latent
 * and NOT waystone-gated: it is solid from the first frame, visible as a real
 * island beyond the mist — the gate is the MISTWALKER itself. No bridge exists;
 * the only approach is to walk the mist sea across the gap and GRAPPLE up the
 * south rim onto the landing — both endgame tools required. (The rim-to-rim gap
 * is pinned within Mistwalker range by a content invariant.)
 *
 * All coordinates are WORLD coordinates (origin offsets the island).
 */
export const thornmere: RegionDef = {
  id: 'thornmere',
  name: 'Thornmere Deep',
  origin: [-300, -300],
  // Non-latent: no `latent`, no `socketAt`. Always solid; traversal-gated.
  island: {
    seed: 8117,
    radius: 52,
    maxHeight: 9,
    terraceStep: 0.5,
    noiseScale: 22,
    plateaus: [
      { x: 0, z: 0, r: 12, h: 5 }, // the deep hall
      { x: 0, z: 40, r: 9, h: 1 }, // south landing — the mist-stair climbs here
      { x: -24, z: -10, r: 8, h: 3.5 }, // west shelf
      { x: 22, z: 14, r: 8, h: 2.5 }, // east grove
    ],
  },
  palette: {
    sky: '#0e1a14',
    fog: '#1a2a20',
    hemiSky: '#3a5a48',
    hemiGround: '#1a2a1e',
    sun: '#a8e0b0',
    grass: '#2a5a3a',
    cliff: '#2a4a38',
    rim: '#1e3a2c',
    underside: '#12241a',
    trunk: '#2a3a2e',
    canopy: ['#3a7a4a', '#4a8a5a', '#2a6a3a'],
    rock: '#3a5a48',
  },
  fog: { near: 34, far: 170 },
  sunDir: [0.2, 1, -0.4],
  landmarks: [
    { kind: 'spire', x: -324, z: -312, scale: 1.2 },
    { kind: 'arch', x: -300, z: -258, yaw: 0.1 },
    { kind: 'stone', x: -298, z: -298, yaw: 0.5 },
    { kind: 'stone', x: -303, z: -303, yaw: 2.2 },
    { kind: 'stone', x: -296, z: -304, yaw: 3.8 },
  ],
  scatter: { trees: 56, rocks: 44, seed: 3391 },
  spawn: [-300, -258], // the south landing (where the mist-stair arrives)
  discoverables: [
    {
      id: 'tm-cache-landing',
      kind: 'cache',
      x: -300,
      z: -258,
      label: 'Deep-Landing Bundle',
      cue: 'a glint where the mist-stair meets the green',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-cache-west',
      kind: 'cache',
      x: -322,
      z: -308,
      label: 'Thornshelf Stash',
      cue: 'a glint among the west brambles',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-glyph-hall',
      kind: 'glyphstone',
      x: -300,
      z: -296,
      label: 'Blank Glyph Stone',
      cue: 'the deep hall hums beneath the thorns',
      prereq: 'none',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-sealed-hall',
      kind: 'sealed',
      x: -296,
      z: -302,
      label: 'Deep Reliquary',
      cue: 'a sealed drum rings under the roots',
      prereq: 'chime',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-sealed-east',
      kind: 'sealed',
      x: -278,
      z: -286,
      label: 'Grove Seal',
      cue: 'the east grove holds a stone shut with thornvine',
      prereq: 'chime',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-buried-hall',
      kind: 'buried',
      x: -303,
      z: -303,
      label: 'Rootbound Cache',
      cue: 'the hall floor rings hollow between the roots',
      prereq: 'sounding',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-buried-west',
      kind: 'buried',
      x: -326,
      z: -312,
      label: 'Bramble-Buried Box',
      cue: 'turned earth beneath the west spire',
      prereq: 'sounding',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-latent-grove',
      kind: 'latent',
      x: -276,
      z: -288,
      label: 'Fireflit Cache',
      cue: 'motes drift where the lantern could raise something',
      prereq: 'lantern',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-latent-hall',
      kind: 'latent',
      x: -298,
      z: -304,
      label: 'Unsung Glyph Stone',
      cue: 'the hall hides a note the lantern can wake',
      prereq: 'lantern',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-guarded-crown',
      kind: 'guarded',
      x: -302,
      z: -298,
      label: 'Crown of Thorns',
      cue: 'a thornbound elder circles the hall',
      prereq: 'combat',
      payouts: [
        { meter: 'lumen', amount: 55 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-guarded-deep',
      kind: 'guarded',
      x: -322,
      z: -306,
      label: 'Heart of the Deep',
      cue: 'an elder keeps the mere’s deepest reliquary',
      prereq: 'combat',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 35 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-perch-hall',
      kind: 'perch',
      x: -300,
      z: -292,
      dy: 5,
      label: 'Canopy Coffer',
      cue: 'a chest glints high in the thorn canopy',
      prereq: 'grapple',
      payouts: [
        { meter: 'lumen', amount: 40 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'tm-tool-ferry',
      kind: 'guarded',
      x: -318,
      z: -300,
      label: 'The Ferryman’s Bell',
      cue: 'a thorn-elder keeps a green bronze bell in the deep',
      prereq: 'combat',
      payouts: [
        { meter: 'tool-ferry', amount: 1 },
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
  ],
  mooring: { x: -300, z: -256 }, // the south-landing mooring
  anglingSpots: [{ x: -300, z: -348 }], // the deep southern rim over the mist
  grapplePoints: [
    // The mist-ascent: from the mist sea, grapple up onto the south rim. This
    // is the only way onto Thornmere — you need the Mistwalker to cross the gap
    // AND the Grapple to climb the shore (no bridge, no waystone).
    { x: -300, z: -250, dy: 3 },
    { x: -300.4, z: -292.4, dy: 5.6 }, // onto the canopy perch
    { x: -312, z: -300, dy: 4.2 }, // mid-hop toward the west shelf
  ],
  enemies: [
    { enemyId: 'thorn-husk', x: -302, z: -298, patrolR: 3, guards: 'tm-guarded-crown' },
    { enemyId: 'thorn-husk', x: -322, z: -306, patrolR: 3, guards: 'tm-guarded-deep' },
    { enemyId: 'mist-warden', x: -290, z: -280, patrolR: 6 },
    { enemyId: 'chorister', x: -312, z: -288, patrolR: 5 },
    { enemyId: 'thorn-husk', x: -284, z: -312, patrolR: 5 },
    // A Thorn Husk keeps the Ferryman's Bell in the deep.
    { enemyId: 'thorn-husk', x: -318, z: -300, patrolR: 3, guards: 'tm-tool-ferry' },
  ],
  // No bridge and no waystone: the approach is the mist itself. Walk the sea
  // across the gap (Mistwalker) to below the south rim, then grapple up onto
  // the landing (the rim grapple point above). Both endgame tools required.
  latentPaths: [],
}
