import * as THREE from 'three'
import { makeToonMaterial } from '../engine/toon'
import type { RecruitRole } from '../content/recruits'

/**
 * Small role-flavoured structures that appear as recruits come home.
 * Each returns a group whose origin sits on the ground.
 */
export function buildStructure(role: RecruitRole, accent: string): THREE.Group {
  const g = new THREE.Group()
  const wood = makeToonMaterial('#6b5540')
  const cloth = makeToonMaterial(accent)
  const stone = makeToonMaterial('#8d8398')

  const banner = () => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 5), wood)
    pole.position.y = 1.3
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.8), cloth)
    flag.position.set(0, 2.2, 0.42)
    const b = new THREE.Group()
    b.add(pole, flag)
    return b
  }

  switch (role) {
    case 'scribe': {
      // Ink-blue study hut with a peaked roof.
      const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.6), stone)
      base.position.y = 1.1
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 4), cloth)
      roof.position.y = 3
      roof.rotation.y = Math.PI / 4
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 0.6), wood)
      desk.position.set(1.9, 0.35, 0.6)
      g.add(base, roof, desk, banner())
      break
    }
    case 'smith': {
      const forge = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1.6, 6), stone)
      forge.position.y = 0.8
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 5), stone)
      chimney.position.set(-0.5, 2.2, -0.3)
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 6, 5),
        new THREE.MeshBasicMaterial({ color: '#ff9a4a' }),
      )
      ember.position.set(0.5, 1.35, 0.45)
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), wood)
      anvil.position.set(1.6, 0.55, 0.8)
      g.add(forge, chimney, ember, anvil, banner())
      break
    }
    case 'cartographer': {
      // Open map table under an awning.
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.4), wood)
      table.position.y = 0.45
      const map = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 1.1), makeToonMaterial('#e8e2d4'))
      map.position.y = 0.95
      const posts = new THREE.Group()
      for (const [px, pz] of [[-1.2, -0.9], [1.2, -0.9], [-1.2, 0.9], [1.2, 0.9]] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 5), wood)
        post.position.set(px, 1.1, pz)
        posts.add(post)
      }
      const awning = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 2.4), cloth)
      awning.position.y = 2.25
      awning.rotation.z = 0.06
      g.add(table, map, posts, awning, banner())
      break
    }
    case 'cook': {
      const hearth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 7), stone)
      hearth.position.y = 0.4
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.5, 8), makeToonMaterial('#3e3a5c'))
      pot.position.y = 1
      const steam = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 6, 5),
        makeToonMaterial('#e8e2d4', { transparent: true, opacity: 0.5 }),
      )
      steam.position.y = 1.7
      steam.name = 'steam'
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 0.5), wood)
      bench.position.set(0, 0.2, 1.7)
      g.add(hearth, pot, steam, bench, banner())
      break
    }
    case 'archivist': {
      // Shelf columns like standing ledgers.
      for (let i = 0; i < 3; i++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4 - i * 0.35, 1.6), wood)
        shelf.position.set(-1 + i, (2.4 - i * 0.35) / 2, 0)
        g.add(shelf)
        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.4, 0.3), cloth)
        spine.position.set(-1 + i, 1.4 - i * 0.2, 0.4)
        g.add(spine)
      }
      g.add(banner())
      break
    }
    case 'merchant': {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 0.9), wood)
      counter.position.y = 0.5
      const roofL = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1), cloth)
      roofL.position.set(0, 2.3, -0.4)
      roofL.rotation.x = 0.35
      const roofR = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1), makeToonMaterial('#e8e2d4'))
      roofR.position.set(0, 2.3, 0.5)
      roofR.rotation.x = -0.35
      const posts = new THREE.Group()
      for (const px of [-1.3, 1.3]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.3, 5), wood)
        post.position.set(px, 1.15, 0)
        posts.add(post)
      }
      const wares = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), cloth)
      wares.position.set(-0.6, 1.2, 0)
      g.add(counter, roofL, roofR, posts, wares, banner())
      break
    }
    case 'cardplayer': {
      // A round card table under a canopy — the deck game's pavilion.
      const table = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 12), wood)
      table.position.y = 0.9
      const felt = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 12), cloth)
      felt.position.y = 1.18
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 7), wood)
      stool.position.set(1.5, 0.35, 0)
      const posts = new THREE.Group()
      for (const [px, pz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5), wood)
        post.position.set(px, 1.2, pz)
        posts.add(post)
      }
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 4), cloth)
      canopy.position.y = 2.8
      canopy.rotation.y = Math.PI / 4
      g.add(table, felt, stool, posts, canopy, banner())
      break
    }
    case 'angler': {
      // A little dock jutting toward the mist, with a rod and lantern.
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 3), wood)
      deck.position.set(0, 0.4, 1.2)
      const piles = new THREE.Group()
      for (const pz of [0, 1.2, 2.4]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.2, 5), wood)
        pile.position.set(0.6, -0.1, pz)
        const pile2 = pile.clone()
        pile2.position.x = -0.6
        piles.add(pile, pile2)
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 2.6, 4), wood)
      rod.position.set(-0.4, 1.4, 2.4)
      rod.rotation.x = -0.7
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 7, 5),
        new THREE.MeshBasicMaterial({ color: accent }),
      )
      lamp.position.set(0.5, 1.5, 0.2)
      g.add(deck, piles, rod, lamp, banner())
      break
    }
  }

  // Every homecoming adds light + life.
  const glow = new THREE.PointLight(accent, 6, 9, 1.9)
  glow.position.set(0, 2.2, 0)
  g.add(glow)
  return g
}

/** A small standing figure for recruits (world + hub). */
export function buildFigure(accent: string): THREE.Group {
  const g = new THREE.Group()
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.05, 7), makeToonMaterial(accent))
  cloak.position.y = 0.62
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), makeToonMaterial('#4a4570'))
  hood.position.y = 1.18
  g.add(cloak, hood)
  return g
}
