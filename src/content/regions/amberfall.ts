import type { RegionDef } from '../../world/region'

/**
 * Region 1 — Amberfall Reach. Warm autumn dusk: olive terraces, rust
 * canopies, violet sky. The player wakes here; the dormant waystone socket
 * sits on the central plateau.
 */
export const amberfall: RegionDef = {
  id: 'amberfall',
  name: 'Amberfall Reach',
  origin: [0, 0],
  island: {
    seed: 1187,
    radius: 80,
    maxHeight: 7,
    terraceStep: 0.45,
    noiseScale: 26,
    plateaus: [
      { x: 0, z: 0, r: 14, h: 4.2 }, // central rise — the socket
      { x: -38, z: -22, r: 11, h: 6.4 }, // high west terrace — the spire
      { x: 32, z: 30, r: 10, h: 2.6 }, // eastern shelf — standing stones
      { x: 2, z: 56, r: 11, h: 1.2 }, // south landing — spawn
    ],
  },
  palette: {
    sky: '#3b3260',
    fog: '#544a80',
    hemiSky: '#8a7fc0',
    hemiGround: '#5a4838',
    sun: '#ffc98a',
    grass: '#75955c',
    cliff: '#7a6a5c',
    rim: '#57493e',
    underside: '#3a3243',
    trunk: '#5a4634',
    canopy: ['#c96f4a', '#d98e3f', '#b8543f', '#e0b25e'],
    rock: '#8d8398',
  },
  fog: { near: 40, far: 190 },
  sunDir: [0.55, 1, 0.35],
  landmarks: [
    { kind: 'socket', x: 0, z: 0 },
    { kind: 'arch', x: 6, z: 48, yaw: 0.5 },
    { kind: 'spire', x: -38, z: -24 },
    { kind: 'stone', x: 30, z: 28, yaw: 0.3 },
    { kind: 'stone', x: 34, z: 31, yaw: 1.4 },
    { kind: 'stone', x: 31, z: 34, yaw: 2.6 },
    { kind: 'stone', x: 27, z: 31.5, yaw: 4.1 },
  ],
  scatter: { trees: 90, rocks: 70, seed: 4242 },
  spawn: [2, 58],
  // Density budget (v1 brief): ~12 discoverables, ≥3 locked on first visit,
  // ≥1 glyph stone, ≥1 buried cache. Every one cued; every one pays ≥2 meters.
  discoverables: [
    {
      id: 'af-cache-arch',
      kind: 'cache',
      x: 8.5,
      z: 46,
      label: "Traveler's Cache",
      cue: 'a glint beneath the old arch',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-cache-treeline',
      kind: 'cache',
      x: -22,
      z: 30,
      label: 'Fallen Courier’s Pack',
      cue: 'a glint among the amber trees',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-cache-east-rim',
      kind: 'cache',
      x: 58,
      z: 8,
      label: 'Rim-Walker’s Stash',
      cue: 'a glint at the island’s eastern edge',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-cache-north-slope',
      kind: 'cache',
      x: -8,
      z: -52,
      label: 'Surveyor’s Old Kit',
      cue: 'a glint on the far northern slope',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-glyph-spire',
      kind: 'glyphstone',
      x: -36,
      z: -20,
      label: 'Blank Glyph Stone',
      cue: 'something hums near the broken spire',
      prereq: 'none',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 5 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-glyph-stone-circle',
      kind: 'latent',
      x: 30.5,
      z: 31,
      label: 'Blank Glyph Stone',
      cue: 'the standing stones whisper of something unseen',
      prereq: 'lantern',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 5 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-latent-west-hollow',
      kind: 'latent',
      x: -52,
      z: 10,
      label: 'Unsung Cache',
      cue: 'the air shimmers in the western hollow',
      prereq: 'lantern',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-buried-south-meadow',
      kind: 'buried',
      x: -14,
      z: 48,
      label: 'Buried Strongbox',
      cue: 'the ground here sounds hollow underfoot',
      prereq: 'sounding',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-buried-socket-field',
      kind: 'buried',
      x: 12,
      z: -10,
      label: 'Buried Reliquary',
      cue: 'cracked earth rings when stepped on',
      prereq: 'sounding',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-guarded-east-coffer',
      kind: 'guarded',
      x: 44,
      z: -28,
      label: 'Sealed Coffer',
      cue: 'something old watches over a chest',
      prereq: 'combat',
      payouts: [
        { meter: 'lumen', amount: 40 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-perch-spire-shelf',
      kind: 'perch',
      x: -42,
      z: -27,
      dy: 7,
      label: 'Spire-Shelf Coffer',
      cue: 'a chest rests where no path leads',
      prereq: 'grapple',
      payouts: [
        { meter: 'lumen', amount: 30 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-perch-arch-crown',
      kind: 'perch',
      x: 8,
      z: 50.5,
      dy: 4,
      label: 'Arch-Crown Cache',
      cue: 'a glint above the old arch',
      prereq: 'grapple',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-tool-grapple',
      kind: 'cache',
      x: 28,
      z: 34.5,
      label: 'The Surveyor’s Grapple',
      cue: 'the stone circle guards an old tool',
      prereq: 'none',
      payouts: [
        { meter: 'tool-grapple', amount: 1 },
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-islet-cache',
      kind: 'cache',
      x: 76,
      z: -3,
      dy: 2.6,
      label: 'Choir-Isle Reliquary',
      cue: 'a lone islet hangs beyond the eastern rim',
      prereq: 'lantern',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 35 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-person-scribe',
      kind: 'person',
      x: 33,
      z: 27,
      label: 'Iole the Scribe joins the Waystation',
      cue: 'someone hums among the standing stones',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-person-smith',
      kind: 'person',
      x: -12,
      z: -49,
      label: 'Bram the Smith joins the Waystation',
      cue: 'hammer-taps echo on the northern slope',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-person-cartographer',
      kind: 'person',
      x: -50,
      z: 13,
      label: 'Wren the Cartographer joins the Waystation',
      cue: 'a voice caught between notes in the western hollow',
      prereq: 'lantern',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-person-cook',
      kind: 'person',
      x: -17,
      z: 51,
      label: 'Marou the Cook joins the Waystation',
      cue: 'woodsmoke drifts over the south meadow',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-person-archivist',
      kind: 'person',
      x: 74,
      z: -6,
      dy: 2.6,
      label: 'Fen the Archivist joins the Waystation',
      cue: 'a stranded scholar waves from the choir isle',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'af-person-merchant',
      kind: 'person',
      x: 56,
      z: 22,
      label: 'Sel of the Scales joins the Waystation',
      cue: 'a heavily laden traveller rests by the east road',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 20 },
        { meter: 'completion', amount: 1 },
      ],
    },
  ],
  grapplePoints: [
    { x: -42.4, z: -27.4, dy: 8.8 }, // onto the spire-shelf perch ledge
    { x: 8.4, z: 51, dy: 5.6 }, // onto the arch-crown perch ledge
    { x: 2, z: 22, dy: 4.5 }, // mid-slope hop toward the socket plateau
    { x: 55, z: 3, dy: 3.6 }, // east rim rise near the islet overlook
  ],
  latentPaths: [
    {
      // from-y hugs the rim terrain (~0.9 there) so the first plank is a
      // step, not a wall; the walkway climbs gently to the islet.
      id: 'af-path-choir-isle',
      from: [59, 1.15, 5],
      to: [72, 2.5, -1],
      islet: { x: 76, z: -3, y: 2.6, r: 7 },
      reveals: ['af-islet-cache'],
    },
  ],
}
