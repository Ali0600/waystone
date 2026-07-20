import * as THREE from 'three'
import { makeToonMaterial } from '../engine/toon'

/** Hand-placed structures. Few per region — individual meshes are fine. */
export type LandmarkKind = 'arch' | 'spire' | 'socket' | 'stone'

function stoneMat(color: string) {
  return makeToonMaterial(color)
}

function buildArch(rock: string): THREE.Group {
  const g = new THREE.Group()
  const mat = stoneMat(rock)
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.4, 0.9), mat)
  left.position.set(-2.1, 1.7, 0)
  left.rotation.y = 0.12
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.9, 0.9), mat)
  right.position.set(2.1, 1.45, 0)
  right.rotation.y = -0.2
  const top = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.42, 6, 12, Math.PI), mat)
  top.position.y = 3.2
  g.add(left, right, top)
  return g
}

function buildSpire(rock: string): THREE.Group {
  const g = new THREE.Group()
  const mat = stoneMat(rock)
  const main = new THREE.Mesh(new THREE.ConeGeometry(1.7, 13, 6), mat)
  main.position.y = 6.5
  const side = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5, 5), mat)
  side.position.set(1.6, 2.5, 0.4)
  side.rotation.z = -0.12
  g.add(main, side)
  return g
}

/** The dormant waystone socket — the future planting site (M7). */
function buildSocket(rock: string): THREE.Group {
  const g = new THREE.Group()
  const mat = stoneMat(rock)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.7, 10), mat)
  base.position.y = 0.35
  g.add(base)
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.25, 8),
    makeToonMaterial('#2c2638'),
  )
  inner.position.y = 0.75
  g.add(inner)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const h = 0.7 + ((i * 37) % 5) * 0.28
    const stub = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), mat)
    stub.position.set(Math.cos(a) * 2.1, 0.7 + h / 2, Math.sin(a) * 2.1)
    stub.rotation.y = -a
    g.add(stub)
  }
  return g
}

function buildStone(rock: string): THREE.Group {
  const g = new THREE.Group()
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.8, 0.55), stoneMat(rock))
  s.position.y = 1.3
  s.rotation.set(0.05, 0.4, 0.06)
  g.add(s)
  return g
}

export function buildLandmark(kind: LandmarkKind, rock: string): THREE.Group {
  switch (kind) {
    case 'arch':
      return buildArch(rock)
    case 'spire':
      return buildSpire(rock)
    case 'socket':
      return buildSocket(rock)
    case 'stone':
      return buildStone(rock)
  }
}
