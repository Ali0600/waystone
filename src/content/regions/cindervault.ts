import type { RegionDef } from '../../world/region'

/**
 * Region 3 — Cindervault Rise. A latent isle far northwest, beyond Veilspire:
 * an ember-lit ruin of banked coals under a deep-violet night. Reached by
 * planting the SECOND Waystone (won deep in Veilspire) at the socket in
 * Veilspire's drowned court. A DIFFERENT discovery mix again — heavy on
 * sealed vaults (the Chime showcase) and guarded fights, and it hosts the
 * Cardplayer who opens the deck game.
 *
 * All coordinates are WORLD coordinates (origin offsets the island).
 */
export const cindervault: RegionDef = {
  id: 'cindervault',
  name: 'Cindervault Rise',
  origin: [-160, -190],
  latent: true,
  socketAt: { x: -168, z: -50 }, // the dormant socket in Veilspire's court
  island: {
    seed: 5273,
    radius: 62,
    maxHeight: 10,
    terraceStep: 0.55,
    noiseScale: 24,
    plateaus: [
      { x: 0, z: 0, r: 14, h: 6.5 }, // the deep vault — ember heart
      { x: -4, z: 54, r: 8, h: 1.4 }, // bridge landing from Veilspire
      { x: -30, z: -12, r: 9, h: 4.5 }, // western coal-shelf
      { x: 26, z: 16, r: 9, h: 2.6 }, // eastern terrace — the card pavilion
    ],
  },
  palette: {
    sky: '#241436',
    fog: '#3a2246',
    hemiSky: '#7a5aa0',
    hemiGround: '#5a2c28',
    sun: '#ff8a4a',
    grass: '#7c5648',
    cliff: '#5e4450',
    rim: '#4a2f38',
    underside: '#241826',
    trunk: '#4a3038',
    canopy: ['#c65a3f', '#e0803a', '#a8442f', '#d97a4a'],
    rock: '#8a6a7a',
  },
  fog: { near: 36, far: 180 },
  sunDir: [-0.5, 1, -0.35],
  landmarks: [
    { kind: 'spire', x: -190, z: -206, scale: 1.4 },
    { kind: 'arch', x: -164, z: -138, yaw: 1.6 },
    { kind: 'stone', x: -158, z: -186, yaw: 0.5 },
    { kind: 'stone', x: -163, z: -191, yaw: 2.1 },
    { kind: 'stone', x: -156, z: -193, yaw: 3.7 },
  ],
  scatter: { trees: 48, rocks: 62, seed: 9314 },
  spawn: [-164, -134],
  discoverables: [
    {
      id: 'cv-cache-landing',
      kind: 'cache',
      x: -166,
      z: -138,
      label: 'Ashfall Bundle',
      cue: 'a glint where the bridge meets the rise',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-cache-west',
      kind: 'cache',
      x: -188,
      z: -198,
      label: 'Coal-Shelf Stash',
      cue: 'a glint on the western coal-shelf',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-glyph-vault',
      kind: 'glyphstone',
      x: -160,
      z: -186,
      label: 'Blank Glyph Stone',
      cue: 'the deep vault glows with a banked note',
      prereq: 'none',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-sealed-vault',
      kind: 'sealed',
      x: -156,
      z: -192,
      label: 'Cinder Reliquary',
      cue: 'a sealed drum rings hot at the vault’s heart',
      prereq: 'chime',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-sealed-east',
      kind: 'sealed',
      x: -132,
      z: -172,
      label: 'Pavilion Seal',
      cue: 'the eastern terrace holds a stone shut with heat',
      prereq: 'chime',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-buried-heart',
      kind: 'buried',
      x: -163,
      z: -193,
      label: 'Ember Cache',
      cue: 'the vault floor rings hollow underfoot',
      prereq: 'sounding',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-buried-west',
      kind: 'buried',
      x: -192,
      z: -203,
      label: 'Slag-Buried Box',
      cue: 'cracked slag near the western spire',
      prereq: 'sounding',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-latent-terrace',
      kind: 'latent',
      x: -136,
      z: -178,
      label: 'Kindling Cache',
      cue: 'the air over the terrace shimmers with heat-haze',
      prereq: 'lantern',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-guarded-crown',
      kind: 'guarded',
      x: -158,
      z: -195,
      label: 'Crown of Coals',
      cue: 'a cinder-song circles the vault crown',
      prereq: 'combat',
      payouts: [
        { meter: 'lumen', amount: 55 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-guarded-deep',
      kind: 'guarded',
      x: -162,
      z: -188,
      label: 'Heart of the Cindervault',
      cue: 'an elder keeps the vault’s deepest ember',
      prereq: 'combat',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 35 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-perch-spire',
      kind: 'perch',
      x: -190,
      z: -206,
      dy: 6,
      label: 'Spire-Top Coffer',
      cue: 'a chest glints high on the western spire',
      prereq: 'grapple',
      payouts: [
        { meter: 'lumen', amount: 40 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'cv-person-cardplayer',
      kind: 'person',
      x: -134,
      z: -172,
      label: 'Tam of the Painted Deck joins the Waystation',
      cue: 'someone shuffles a painted deck on the eastern terrace',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
  ],
  grapplePoints: [
    { x: -190.4, z: -206.4, dy: 6.6 }, // onto the spire-top perch
    { x: -178, z: -200, dy: 4.5 }, // mid-hop toward the western shelf
  ],
  enemies: [
    { enemyId: 'cinder-chorister', x: -158, z: -195, patrolR: 3, guards: 'cv-guarded-crown' },
    { enemyId: 'husk-elder', x: -162, z: -188, patrolR: 3, guards: 'cv-guarded-deep' },
    { enemyId: 'warden', x: -176, z: -180, patrolR: 6 },
    { enemyId: 'chorister', x: -142, z: -196, patrolR: 5 },
    { enemyId: 'cinder-chorister', x: -184, z: -172, patrolR: 5 },
  ],
  latentPaths: [
    {
      // The long bridge from Veilspire's northern rim, real only once
      // Cindervault is manifested.
      id: 'cv-bridge-veilspire',
      from: [-172, 1.3, -100],
      to: [-165, 1.5, -132],
      reveals: [],
      startSolid: true,
    },
  ],
}
