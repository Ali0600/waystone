import type { RegionDef } from '../../world/region'

/**
 * Region 4 — Palegrove Choir. A latent isle far west of Cindervault: a bone-
 * pale dawn drowned in mist, ivory terraces under a soft-gold sun (the fourth
 * distinct mood after amber warmth, teal dusk, and ember night). Reached by
 * planting the THIRD Waystone (won deep in Cindervault) at the socket on
 * Cindervault's vault rise. Heavy on latent + sealed content; home of the
 * Mist Warden, and (M16) the Mistwalker prize.
 *
 * All coordinates are WORLD coordinates (origin offsets the island).
 */
export const palegrove: RegionDef = {
  id: 'palegrove',
  name: 'Palegrove Choir',
  origin: [-300, -165],
  latent: true,
  socketAt: { x: -168, z: -182 }, // the dormant socket on Cindervault's vault rise
  island: {
    seed: 6421,
    radius: 56,
    maxHeight: 9,
    terraceStep: 0.5,
    noiseScale: 23,
    plateaus: [
      { x: 0, z: 0, r: 13, h: 5.5 }, // the choir hall
      { x: 46, z: -8, r: 8, h: 1.4 }, // eastern landing — the bridge lands here
      { x: -16, z: -28, r: 9, h: 4.2 }, // north shelf
      { x: 12, z: 26, r: 9, h: 2.5 }, // south terrace
    ],
  },
  palette: {
    sky: '#b8b0a0',
    fog: '#a89f92',
    hemiSky: '#d8d0c0',
    hemiGround: '#8a8478',
    sun: '#fff0d8',
    grass: '#a8b098',
    cliff: '#9a9488',
    rim: '#7a7468',
    underside: '#68625a',
    trunk: '#8a8072',
    canopy: ['#c8c4a8', '#d0ccb0', '#b8b498'],
    rock: '#a8a498',
  },
  fog: { near: 30, far: 160 },
  sunDir: [0.3, 1, -0.5],
  landmarks: [
    { kind: 'spire', x: -316, z: -197, scale: 1.2 },
    { kind: 'arch', x: -254, z: -172, yaw: 1.9 },
    { kind: 'stone', x: -298, z: -161, yaw: 0.4 },
    { kind: 'stone', x: -303, z: -166, yaw: 2.0 },
    { kind: 'stone', x: -296, z: -168, yaw: 3.6 },
  ],
  scatter: { trees: 44, rocks: 50, seed: 7742 },
  spawn: [-252, -172],
  discoverables: [
    {
      id: 'pg-cache-landing',
      kind: 'cache',
      x: -254,
      z: -173,
      label: 'Dawn-Landing Bundle',
      cue: 'a glint where the bridge meets the pale shore',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-cache-north',
      kind: 'cache',
      x: -316,
      z: -193,
      label: 'Shelf Stash',
      cue: 'a glint on the misted north shelf',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-glyph-hall',
      kind: 'glyphstone',
      x: -300,
      z: -167,
      label: 'Blank Glyph Stone',
      cue: 'the choir hall hums a pale, unfinished note',
      prereq: 'none',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-sealed-hall',
      kind: 'sealed',
      x: -296,
      z: -163,
      label: 'Choir Reliquary',
      cue: 'a sealed stone drum rings faintly in the hall',
      prereq: 'chime',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-sealed-south',
      kind: 'sealed',
      x: -288,
      z: -139,
      label: 'Terrace Seal',
      cue: 'the south terrace holds a stone shut with dew',
      prereq: 'chime',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-buried-hall',
      kind: 'buried',
      x: -303,
      z: -162,
      label: 'Choir Cache',
      cue: 'the hall flagstones ring hollow underfoot',
      prereq: 'sounding',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-buried-north',
      kind: 'buried',
      x: -318,
      z: -195,
      label: 'Dew-Buried Box',
      cue: 'cracked pale earth near the north spire',
      prereq: 'sounding',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-latent-terrace',
      kind: 'latent',
      x: -290,
      z: -137,
      label: 'Mist-Veiled Cache',
      cue: 'the air over the terrace shimmers, pale and thick',
      prereq: 'lantern',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-latent-hall',
      kind: 'latent',
      x: -298,
      z: -169,
      label: 'Unsung Glyph Stone',
      cue: 'the hall hides a note the lantern can raise',
      prereq: 'lantern',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-guarded-crown',
      kind: 'guarded',
      x: -302,
      z: -163,
      label: 'Crown of the Choir',
      cue: 'a pale sentinel circles the hall dais',
      prereq: 'combat',
      payouts: [
        { meter: 'lumen', amount: 55 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-guarded-deep',
      kind: 'guarded',
      x: -316,
      z: -190,
      label: 'Heart of the Grove',
      cue: 'an elder keeps the grove’s deepest reliquary',
      prereq: 'combat',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 35 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-perch-shelf',
      kind: 'perch',
      x: -316,
      z: -197,
      dy: 5,
      label: 'Spire-Shelf Coffer',
      cue: 'a chest glints high on the north spire',
      prereq: 'grapple',
      payouts: [
        { meter: 'lumen', amount: 40 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'pg-tool-mistwalker',
      kind: 'guarded',
      x: -282,
      z: -148,
      label: 'The Mistwalker',
      cue: 'a pale sentinel guards a shimmering sole-plate on the terrace',
      prereq: 'combat',
      payouts: [
        { meter: 'tool-mistwalker', amount: 1 },
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
  ],
  anglingSpots: [{ x: -300, z: -216 }], // the pale southern rim over the mist
  grapplePoints: [
    { x: -316.4, z: -197.4, dy: 5.6 }, // onto the spire-shelf perch
    { x: -308, z: -184, dy: 4.2 }, // mid-hop toward the north shelf
  ],
  enemies: [
    { enemyId: 'mist-warden', x: -302, z: -163, patrolR: 3, guards: 'pg-guarded-crown' },
    { enemyId: 'husk-elder', x: -316, z: -190, patrolR: 3, guards: 'pg-guarded-deep' },
    { enemyId: 'warden', x: -292, z: -178, patrolR: 6 },
    { enemyId: 'chorister', x: -288, z: -150, patrolR: 5 },
    { enemyId: 'mist-warden', x: -278, z: -160, patrolR: 5 },
    // A Mist Warden keeps the Mistwalker on the south terrace.
    { enemyId: 'mist-warden', x: -282, z: -148, patrolR: 3, guards: 'pg-tool-mistwalker' },
  ],
  latentPaths: [
    {
      // The long dawn bridge from Cindervault's west rim — real only once
      // Palegrove is manifested.
      id: 'pg-bridge-cindervault',
      from: [-215, 1.3, -181],
      to: [-250, 1.4, -173],
      reveals: [],
      startSolid: true,
    },
  ],
}
