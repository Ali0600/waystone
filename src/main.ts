import * as THREE from 'three'
import { amberfall } from './content/regions/amberfall'
import { waystation } from './content/regions/waystation'
import { EventBus } from './core/events'
import { createSaveSystem } from './core/save'
import { DiscoverySystem, type PlayerCapabilities } from './discovery/system'
import { DiscoveryView } from './discovery/view'
import { RegionMap } from './discovery/map'
import { Input } from './engine/input'
import { SIM_DT, startLoop } from './engine/loop'
import { RecruitSystem } from './hub/recruits'
import { Avatar } from './player/avatar'
import { OrbitFollowCamera } from './player/camera'
import { PlayerSim } from './player/controller'
import { GrappleVerb } from './player/grapple'
import { LanternVerb } from './player/verbs'
import { MasterySystem } from './progression/mastery'
import { LatentPaths } from './world/latentpath'
import { World } from './world/world'
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

// --- World: every island in one scene, joined across the mist ---
const world = new World([amberfall, waystation])
scene.add(world.group)
const prime = world.regions[0].def
scene.background = new THREE.Color(prime.palette.sky)
scene.fog = new THREE.Fog(prime.palette.fog, prime.fog.near, prime.fog.far)
scene.add(new THREE.HemisphereLight(prime.palette.hemiSky, prime.palette.hemiGround, 1.9))
const sun = new THREE.DirectionalLight(prime.palette.sun, 2.4)
sun.position.set(...prime.sunDir).multiplyScalar(80)
scene.add(sun)

const mist = new MistSea(prime.palette.fog)
scene.add(mist.group)

// --- Player ---
const saves = createSaveSystem(localStorage)
const bus = new EventBus()
const mastery = new MasterySystem(saves.state, bus)
const player = new PlayerSim(undefined, {
  airDash: () => mastery.tier('dash') >= 3,
  airGrapple: () => mastery.tier('grapple') >= 3,
  dashPower: () => (mastery.tier('dash') >= 2 ? 1.35 : 1),
})
player.params.fallY = MIST_Y - 4
player.setSpawn(world.regions[0].spawn)
// Restore a saved position only if it still sits on/above today's terrain —
// a stale save from older world content must not bury the player in rock.
const savedPos = saves.state.playerPos
const savedRegion = world.regionAt(savedPos[0], savedPos[2])
const savedValid =
  !saves.isFresh &&
  savedRegion !== null &&
  savedPos[1] > world.heightAt(savedPos[0], savedPos[2]) - 0.5
if (savedValid) {
  player.position.set(savedPos[0], savedPos[1] + 0.05, savedPos[2])
} else {
  player.respawn()
}

const avatar = new Avatar()
scene.add(avatar.group)

// --- Discovery ---
const caps: PlayerCapabilities = {
  lantern: true,
  grapple: saves.state.tools.grapple,
  sounding: false,
}
const discovery = new DiscoverySystem(
  world.discoverables,
  saves.state,
  bus,
  caps,
  world.heightAt,
)
const discoveryView = new DiscoveryView(world.discoverables, discovery, bus)
scene.add(discoveryView.group)

// Latent paths (Lantern T2) + the permanent hub bridge join the collider.
const latentPaths = new LatentPaths(world.latentPaths, saves.state, bus, (x, z) =>
  world.regionAt(x, z) ? world.heightAt(x, z) : null,
)
scene.add(latentPaths.group)
world.rebuildCollider(latentPaths.solidGroups())
const lantern = new LanternVerb(player, discovery, avatar.lanternLight, mastery, latentPaths, () =>
  world.rebuildCollider(latentPaths.solidGroups()),
)
scene.add(lantern.ring)

// Grapple pylons.
const grapple = new GrappleVerb(world.grapplePoints, world.heightAt, player)
scene.add(grapple.group)

// The Waystation grows as people come home.
const recruits = new RecruitSystem(
  saves.state,
  bus,
  world.heightAt,
  new Map(
    world.discoverables
      .filter((d) => d.kind === 'person')
      .map((d) => [d.id, { x: d.x, z: d.z }]),
  ),
)
scene.add(recruits.group)

const map = new RegionMap(world, saves.state)

const input = new Input()
const orbit = new OrbitFollowCamera(camera, input)
const hud = new Hud()
const toasts = new Toasts(bus)
void toasts
hud.setCounters(saves.state.lumen, saves.state.glyphStones)
bus.on('lumen:changed', () => hud.setCounters(saves.state.lumen, saves.state.glyphStones))
bus.on('glyphstone:changed', () =>
  hud.setCounters(saves.state.lumen, saves.state.glyphStones),
)

// Region banner on arrival (and at boot).
let currentRegionId = ''
function announceRegionAt(x: number, z: number) {
  const r = world.regionAt(x, z)
  if (r && r.def.id !== currentRegionId) {
    currentRegionId = r.def.id
    hud.announceRegion(r.def.name)
  }
}
announceRegionAt(player.position.x, player.position.z)

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
  saves.state.regionId = currentRegionId || prime.id
  saves.state.playerPos = [player.position.x, player.position.y, player.position.z]
  saves.save()
}
window.addEventListener('pagehide', persist)

// --- Loop ---
let fps = 60
let lastRender = performance.now()
let hubLineCooldown = 0

function update(dt: number) {
  const snap = input.snapshot()
  player.step(dt, snap, orbit.yaw, world.collider)
  orbit.update(dt, snap, player.position, world.collider)
  mist.update(dt)
  const groundY = groundHeightBelow(
    world.collider,
    player.position.x,
    player.position.y + 1.2,
    player.position.z,
  )
  avatar.update(dt, player, groundY)
  recruits.update(dt)
  announceRegionAt(player.position.x, player.position.z)

  // Verbs: lantern, grapple, dash mastery.
  if (snap.lantern) lantern.tryPulse()
  if (caps.grapple) {
    grapple.updateTargeting(orbit.yaw, orbit.pitch, world.collider)
    if (snap.grapple && grapple.tryLaunch()) mastery.record('grapple')
  }
  if (player.stepEvents.dashed) mastery.record('dash')
  grapple.update(dt)

  // Discovery pass: pins, prompts, interaction, map.
  discovery.update(player.position.x, player.position.z)
  hubLineCooldown = Math.max(0, hubLineCooldown - dt)
  const target = discovery.interactable(
    player.position.x,
    player.position.z,
    player.position.y,
  )
  const homeRecruit = target
    ? null
    : recruits.nearbyHome(player.position.x, player.position.z)
  if (snap.interact) {
    if (target) {
      discovery.interact(player.position.x, player.position.z, player.position.y)
    } else if (homeRecruit && hubLineCooldown <= 0) {
      hubLineCooldown = 2
      bus.emit('toast', { text: homeRecruit.homeLine, flavor: 'info' })
    }
  }
  if (snap.map) map.toggle()
  hud.setPrompt(
    target
      ? `E — ${target.label}`
      : homeRecruit
        ? `E — talk to ${homeRecruit.name}`
        : null,
  )
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
    world,
    scene,
    caps,
    grapple,
    discovery,
    mastery,
    recruits,
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
