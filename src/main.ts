import * as THREE from 'three'
import { amberfall } from './content/regions/amberfall'
import { EventBus } from './core/events'
import { createSaveSystem } from './core/save'
import { DiscoverySystem, type PlayerCapabilities } from './discovery/system'
import { DiscoveryView } from './discovery/view'
import { RegionMap } from './discovery/map'
import { Input } from './engine/input'
import { SIM_DT, startLoop } from './engine/loop'
import { Avatar } from './player/avatar'
import { OrbitFollowCamera } from './player/camera'
import { PlayerSim } from './player/controller'
import { LanternVerb } from './player/verbs'
import { buildRegion } from './world/region'
import { groundHeightBelow } from './world/collision'
import { MistSea, MIST_Y } from './world/mist'
import { Hud } from './ui/hud'
import { Toasts } from './ui/toast'
import './style.css'

const qaMode = new URLSearchParams(location.search).has('qa')

const app = document.querySelector<HTMLDivElement>('#app')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  600,
)

// --- Region ---
const region = buildRegion(amberfall)
scene.add(region.group)
scene.background = new THREE.Color(region.def.palette.sky)
scene.fog = new THREE.Fog(region.def.palette.fog, region.def.fog.near, region.def.fog.far)
scene.add(new THREE.HemisphereLight(region.def.palette.hemiSky, region.def.palette.hemiGround, 1.9))
const sun = new THREE.DirectionalLight(region.def.palette.sun, 2.4)
sun.position.set(...region.def.sunDir).multiplyScalar(60)
scene.add(sun)

const mist = new MistSea(region.def.palette.fog)
scene.add(mist.group)

// --- Player ---
const saves = createSaveSystem(localStorage)
const player = new PlayerSim()
player.params.fallY = MIST_Y - 4
player.setSpawn(region.spawn)
// Restore a saved position only if it still sits on/above today's terrain —
// a stale save from older world content must not bury the player in rock.
const savedPos = saves.state.playerPos
const savedValid =
  !saves.isFresh &&
  saves.state.regionId === region.def.id &&
  Math.hypot(savedPos[0], savedPos[2]) < region.def.island.radius &&
  savedPos[1] > region.heightAt(savedPos[0], savedPos[2]) - 0.5
if (savedValid) {
  player.position.set(savedPos[0], savedPos[1] + 0.05, savedPos[2])
} else {
  player.respawn()
}

const avatar = new Avatar()
scene.add(avatar.group)

// --- Discovery ---
const bus = new EventBus()
const caps: PlayerCapabilities = { lantern: true, grapple: false, sounding: false }
const discovery = new DiscoverySystem(
  region.def.discoverables,
  saves.state,
  bus,
  caps,
  region.heightAt,
)
const discoveryView = new DiscoveryView(region.def.discoverables, discovery, bus)
scene.add(discoveryView.group)
const lantern = new LanternVerb(player, discovery, avatar.lanternLight)
scene.add(lantern.ring)
const map = new RegionMap(region.def, region.def.discoverables, saves.state)

const input = new Input()
const orbit = new OrbitFollowCamera(camera, input)
const hud = new Hud()
const toasts = new Toasts(bus)
void toasts
hud.announceRegion(region.def.name)
hud.setCounters(saves.state.lumen, saves.state.glyphStones)
bus.on('lumen:changed', () => hud.setCounters(saves.state.lumen, saves.state.glyphStones))
bus.on('glyphstone:changed', () =>
  hud.setCounters(saves.state.lumen, saves.state.glyphStones),
)

// --- Pointer lock (QA mode steers with arrow keys instead) ---
if (!qaMode) {
  renderer.domElement.addEventListener('click', () => {
    if (!document.pointerLockElement) {
      renderer.domElement.requestPointerLock()
    }
  })
  document.addEventListener('pointerlockchange', () => {
    hud.showClickHint(!document.pointerLockElement)
  })
  hud.showClickHint(true)
} else {
  hud.showClickHint(false)
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// --- Autosave ---
let saveTimer = 0
function persist() {
  saves.state.regionId = region.def.id
  saves.state.playerPos = [player.position.x, player.position.y, player.position.z]
  saves.save()
}
window.addEventListener('pagehide', persist)

// --- Loop ---
let fps = 60
let lastRender = performance.now()

function update(dt: number) {
  const snap = input.snapshot()
  player.step(dt, snap, orbit.yaw, region.collider)
  orbit.update(dt, snap, player.position, region.collider)
  mist.update(dt)
  const groundY = groundHeightBelow(
    region.collider,
    player.position.x,
    player.position.y + 1.2,
    player.position.z,
  )
  avatar.update(dt, player, groundY)

  // Discovery pass: pins, prompts, interaction, lantern, map.
  discovery.update(player.position.x, player.position.z)
  if (snap.lantern) lantern.tryPulse()
  if (snap.interact) discovery.interact(player.position.x, player.position.z)
  if (snap.map) map.toggle()
  const target = discovery.interactable(player.position.x, player.position.z)
  hud.setPrompt(target ? `E — ${target.label}` : null)
  lantern.update(dt)
  discoveryView.update(dt)
  map.draw(player.position.x, player.position.z, orbit.yaw, discovery.completion())

  saveTimer += dt
  if (saveTimer >= 5) {
    saveTimer = 0
    persist()
  }
}

function render() {
  renderer.render(scene, camera)
  const t = performance.now()
  fps = fps * 0.95 + (1000 / Math.max(1, t - lastRender)) * 0.05
  lastRender = t
  hud.setDebug({
    fps,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    pos: player.position,
    onGround: player.onGround,
  })
}

startLoop({ update, render })

// QA/dev handle for automation and debugging. step() advances the sim
// deterministically even when the tab is hidden and rAF is parked.
if (qaMode || import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__game = {
    THREE,
    player,
    orbit,
    renderer,
    saves,
    region,
    scene,
    step(frames = 1) {
      for (let i = 0; i < frames; i++) update(SIM_DT)
      render()
    },
    teleport(x: number, y: number, z: number) {
      player.position.set(x, y, z)
      player.velocity.set(0, 0, 0)
    },
  }
}
