// M0 bootstrap scene: proves the renderer, toon banding, fog and palette.
// Replaced by the real game boot in M1.
import * as THREE from 'three'
import { makeToonMaterial } from './engine/toon'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const duskSky = new THREE.Color('#2a2340')
scene.background = duskSky
scene.fog = new THREE.Fog(duskSky, 18, 70)

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
)
camera.position.set(0, 6, 16)

scene.add(new THREE.HemisphereLight('#7a6fae', '#3b2f2a', 1.6))
const sun = new THREE.DirectionalLight('#ffd9a0', 2.2)
sun.position.set(8, 12, 6)
scene.add(sun)

// A floating-island sketch: rock disc, a spire, scattered toon shapes.
const island = new THREE.Group()
scene.add(island)

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(9, 5.5, 3, 10, 1),
  makeToonMaterial('#4f6b4a'),
)
ground.position.y = -1.5
island.add(ground)

const spire = new THREE.Mesh(
  new THREE.ConeGeometry(1.2, 7, 6),
  makeToonMaterial('#8d86a8'),
)
spire.position.set(-3.5, 3.5, -2)
island.add(spire)

const arch = new THREE.Mesh(
  new THREE.TorusGeometry(2.2, 0.45, 8, 14, Math.PI),
  makeToonMaterial('#b9a06a'),
)
arch.position.set(3, 0, 1)
island.add(arch)

const shapes: THREE.Mesh[] = []
const shapeColors = ['#c96f4a', '#5f8aa6', '#a65f8a', '#e0c26e']
for (let i = 0; i < 8; i++) {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5 + (i % 3) * 0.3, 0),
    makeToonMaterial(shapeColors[i % shapeColors.length]),
  )
  const angle = (i / 8) * Math.PI * 2
  rock.position.set(Math.cos(angle) * 6, 0.4, Math.sin(angle) * 6)
  island.add(rock)
  shapes.push(rock)
}

const title = document.createElement('div')
title.className = 'overlay-label title'
title.textContent = 'WAYSTONE'
document.body.appendChild(title)

const subtitle = document.createElement('div')
subtitle.className = 'overlay-label subtitle'
subtitle.textContent = 'M0 — renderer proof'
document.body.appendChild(subtitle)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime()
  island.rotation.y = t * 0.1
  for (const [i, s] of shapes.entries()) {
    s.position.y = 0.4 + Math.sin(t * 1.2 + i) * 0.15
    s.rotation.x = t * 0.3 + i
  }
  camera.position.y = 6 + Math.sin(t * 0.4) * 0.4
  camera.lookAt(0, 1, 0)
  renderer.render(scene, camera)
})
