import type { RegionDef } from '../../world/region'

/**
 * Region 2 — Veilspire Shallows. A latent isle west of Amberfall: visible
 * as a ghost over the mist until the Waystone is planted at the central
 * socket. Cool teal dusk; a DIFFERENT discovery mix (more guarded/latent,
 * fewer plain caches) and harder guardians.
 */
export const veilspire: RegionDef = {
  id: 'veilspire',
  name: 'Veilspire Shallows',
  origin: [-175, -45],
  latent: true,
  socketAt: { x: 0, z: 0 }, // the dormant socket at Amberfall's heart
  island: {
    seed: 3411,
    radius: 62,
    maxHeight: 9,
    terraceStep: 0.5,
    noiseScale: 22,
    plateaus: [
      { x: 0, z: 0, r: 12, h: 5.5 }, // the drowned court
      { x: 28, z: 18, r: 9, h: 2.2 }, // eastern shallows — bridge landing
      { x: -24, z: -20, r: 10, h: 7.5 }, // the veiled spire
      { x: 12, z: -30, r: 8, h: 3.5 }, // northern shelf
    ],
  },
  palette: {
    sky: '#2c3a56',
    fog: '#3f5a72',
    hemiSky: '#7fa8c0',
    hemiGround: '#38504a',
    sun: '#a8e0d8',
    grass: '#5c8a80',
    cliff: '#5c6b7a',
    rim: '#41525e',
    underside: '#2c3a48',
    trunk: '#4a5a54',
    canopy: ['#5f9a8a', '#6fae9a', '#7ac0b8'],
    rock: '#7a94a8',
  },
  fog: { near: 40, far: 190 },
  sunDir: [-0.4, 1, 0.3],
  landmarks: [
    { kind: 'spire', x: -199, z: -67, scale: 1.3 },
    { kind: 'arch', x: -149, z: -29, yaw: 2.2 },
    { kind: 'socket', x: -168, z: -50 }, // dormant — Cindervault's waystone socket
    { kind: 'stone', x: -173, z: -42, yaw: 0.6 },
    { kind: 'stone', x: -178, z: -47, yaw: 1.9 },
    { kind: 'stone', x: -171, z: -49, yaw: 3.4 },
  ],
  scatter: { trees: 60, rocks: 55, seed: 8181 },
  spawn: [-145, -25],
  discoverables: [
    {
      id: 'vs-cache-landing',
      kind: 'cache',
      x: -149,
      z: -23,
      label: 'Shallows Cache',
      cue: 'a glint by the eastern landing',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-cache-north-shelf',
      kind: 'cache',
      x: -163,
      z: -78,
      label: 'Shelf-Keeper’s Box',
      cue: 'a glint on the northern shelf',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-glyph-court',
      kind: 'glyphstone',
      x: -177,
      z: -39,
      label: 'Blank Glyph Stone',
      cue: 'the drowned court hums low',
      prereq: 'none',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-glyph-veiled',
      kind: 'latent',
      x: -201,
      z: -61,
      label: 'Blank Glyph Stone',
      cue: 'the veiled spire hides an unsung note',
      prereq: 'lantern',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-latent-tidepool',
      kind: 'latent',
      x: -157,
      z: -43,
      label: 'Tidepool Cache',
      cue: 'the shallows shimmer between the terraces',
      prereq: 'lantern',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-buried-court',
      kind: 'buried',
      x: -170,
      z: -37,
      label: 'Court Reliquary',
      cue: 'the court flagstones ring hollow',
      prereq: 'sounding',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-buried-west',
      kind: 'buried',
      x: -213,
      z: -37,
      label: 'Weathered Strongbox',
      cue: 'cracked earth near the western rim',
      prereq: 'sounding',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-guarded-court-crown',
      kind: 'guarded',
      x: -179,
      z: -53,
      label: 'Crown of the Court',
      cue: 'twin sentinels circle a dais',
      prereq: 'combat',
      payouts: [
        { meter: 'lumen', amount: 50 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-guarded-spire-heart',
      kind: 'guarded',
      x: -197,
      z: -71,
      label: 'Heart of the Spire',
      cue: 'a chorus guards the spire’s foot',
      prereq: 'combat',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-perch-spire-crown',
      kind: 'perch',
      x: -203,
      z: -69,
      dy: 8,
      label: 'Spire-Crown Coffer',
      cue: 'a chest glints high on the veiled spire',
      prereq: 'grapple',
      payouts: [
        { meter: 'lumen', amount: 40 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-perch-arch',
      kind: 'perch',
      x: -151,
      z: -32,
      dy: 4.2,
      label: 'Arch-Top Cache',
      cue: 'a glint above the eastern arch',
      prereq: 'grapple',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-tool-chime',
      kind: 'guarded',
      x: -195,
      z: -63,
      label: 'The Resonant Chime',
      cue: 'an elder keeps a humming bell at the foot of the veiled spire',
      prereq: 'combat',
      payouts: [
        { meter: 'tool-chime', amount: 1 },
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-sealed-court',
      kind: 'sealed',
      x: -181,
      z: -44,
      label: 'Drowned-Court Vault',
      cue: 'a sealed stone drum rings faintly in the court',
      prereq: 'chime',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-sealed-north',
      kind: 'sealed',
      x: -160,
      z: -73,
      label: 'Shelf Seal',
      cue: 'the northern shelf holds a stone shut with an old note',
      prereq: 'chime',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-person-angler',
      kind: 'person',
      x: -150,
      z: -30,
      label: 'Nerei the Angler joins the Waystation',
      cue: 'a lone figure casts a line into the mist by the eastern landing',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'vs-waystone-deep',
      kind: 'waystone',
      x: -205,
      z: -55,
      label: 'The Second Waystone',
      cue: 'a cinder-song guards a humming stone west of the spire',
      prereq: 'combat',
      payouts: [
        { meter: 'waystone', amount: 1 },
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
  ],
  mooring: { x: -150, z: -26 }, // the eastern-landing mooring
  anglingSpots: [{ x: -146, z: -18 }], // the eastern shallows over the mist
  grapplePoints: [
    { x: -203.4, z: -69.4, dy: 9.6 },
    { x: -150.6, z: -31.6, dy: 5.6 },
    { x: -173, z: -31, dy: 5 },
  ],
  enemies: [
    { enemyId: 'warden', x: -177, z: -51, patrolR: 4, guards: 'vs-guarded-court-crown' },
    { enemyId: 'chorister', x: -195, z: -73, patrolR: 3, guards: 'vs-guarded-spire-heart' },
    // The Elder Husk keeps the Chime at the spire's foot.
    { enemyId: 'husk-elder', x: -195, z: -63, patrolR: 3, guards: 'vs-tool-chime' },
    { enemyId: 'warden', x: -159, z: -57, patrolR: 6 },
    { enemyId: 'chorister', x: -187, z: -27, patrolR: 5 },
    { enemyId: 'husk-elder', x: -145, z: -65, patrolR: 5 },
    // A Cinder Chorister keeps the Second Waystone west of the spire.
    { enemyId: 'cinder-chorister', x: -205, z: -55, patrolR: 3, guards: 'vs-waystone-deep' },
  ],
  latentPaths: [
    {
      // The way west, real only once Veilspire is manifested.
      id: 'vs-bridge-east',
      from: [-77, 1.2, -12],
      to: [-114.5, 1.4, -27],
      reveals: [],
      startSolid: true,
    },
  ],
}
