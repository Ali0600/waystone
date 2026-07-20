import type { RegionDef } from '../../world/region'

/**
 * Region 1 — Amberfall Reach. Warm autumn dusk: olive terraces, rust
 * canopies, violet sky. The player wakes here; the dormant waystone socket
 * sits on the central plateau.
 */
export const amberfall: RegionDef = {
  id: 'amberfall',
  name: 'Amberfall Reach',
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
}
