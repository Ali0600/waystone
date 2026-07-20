import type { RegionDef } from '../../world/region'

/**
 * The Waystation — home. A small isle north of Amberfall Reach across the
 * mist, joined by an old plank bridge. Starts as one ruined arch; every
 * recruit found in the world raises their structure here.
 */
export const waystation: RegionDef = {
  id: 'waystation',
  name: 'The Waystation',
  origin: [0, -135],
  island: {
    seed: 977,
    radius: 26,
    maxHeight: 3,
    terraceStep: 0.3,
    noiseScale: 18,
    plateaus: [
      { x: 0, z: 0, r: 16, h: 2.0 }, // the plaza
      { x: 0, z: 24, r: 7, h: 0.6 }, // bridge landing
    ],
  },
  palette: {
    sky: '#3b3260',
    fog: '#544a80',
    hemiSky: '#8a7fc0',
    hemiGround: '#5a4838',
    sun: '#ffc98a',
    grass: '#7c9464',
    cliff: '#7a6a5c',
    rim: '#57493e',
    underside: '#3a3243',
    trunk: '#5a4634',
    canopy: ['#7c9a5e', '#8fae6a'],
    rock: '#8d8398',
  },
  fog: { near: 40, far: 190 },
  sunDir: [0.55, 1, 0.35],
  landmarks: [
    { kind: 'arch', x: 0, z: -132, yaw: 0.1, scale: 1.4 }, // the ruined arch — where home begins
    { kind: 'stone', x: -6, z: -122, yaw: 0.9 },
    { kind: 'stone', x: 7, z: -145, yaw: 2.2 },
  ],
  scatter: { trees: 10, rocks: 14, seed: 515 },
  spawn: [0, -122],
  minDiscoverables: 5,
  discoverables: [
    {
      id: 'ws-cache-dock',
      kind: 'cache',
      x: 3,
      z: -112.5,
      label: 'Dockside Bundle',
      cue: 'a glint by the bridge landing',
      prereq: 'none',
      payouts: [
        { meter: 'lumen', amount: 10 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'ws-glyph-arch',
      kind: 'latent',
      x: -1.5,
      z: -133,
      label: 'Blank Glyph Stone',
      cue: 'the ruined arch hums when the lantern swings',
      prereq: 'lantern',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 5 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'ws-buried-plaza',
      kind: 'buried',
      x: 8,
      z: -136,
      label: 'Founder’s Cache',
      cue: 'the plaza stones ring hollow near the east edge',
      prereq: 'sounding',
      payouts: [
        { meter: 'lumen', amount: 25 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'ws-tool-sounding-rod',
      kind: 'cache',
      x: -6,
      z: -140,
      label: 'The Sounding Rod',
      cue: 'an old surveyor’s kit rests by the arch',
      prereq: 'none',
      payouts: [
        { meter: 'tool-sounding', amount: 1 },
        { meter: 'lumen', amount: 5 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'ws-latent-north-overlook',
      kind: 'latent',
      x: -4,
      z: -152,
      label: 'Overlook Cache',
      cue: 'the north overlook shimmers at lantern-light',
      prereq: 'lantern',
      payouts: [
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
    {
      id: 'ws-sealed-plaza',
      kind: 'sealed',
      x: 6,
      z: -128,
      label: 'Founder’s Sealed Vault',
      cue: 'a stone drum by the plaza has hummed, sealed, since the founding',
      prereq: 'chime',
      payouts: [
        { meter: 'glyphstone', amount: 1 },
        { meter: 'lumen', amount: 15 },
        { meter: 'completion', amount: 1 },
      ],
    },
  ],
  grapplePoints: [],
  enemies: [], // home is safe
  latentPaths: [
    {
      // The old bridge home — permanent, walkable from the start.
      id: 'ws-bridge-south',
      from: [0, 1.35, -77.5],
      to: [0, 0.75, -110.5],
      reveals: [],
      startSolid: true,
    },
  ],
}
