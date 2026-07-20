import * as THREE from 'three'
import { amberfall } from './content/regions/amberfall'
import { veilspire } from './content/regions/veilspire'
import { waystation } from './content/regions/waystation'
import { EventBus } from './core/events'
import { createSaveSystem } from './core/save'
import { DiscoverySystem, type PlayerCapabilities } from './discovery/system'
import { DiscoveryView } from './discovery/view'
import { RegionMap } from './discovery/map'
import { GameAudio } from './engine/audio'
import { Input } from './engine/input'
import { SIM_DT, startLoop } from './engine/loop'
import { SoundingVerb } from './minigames/sounding'
import { Arena } from './combat/arena'
import { Encounter } from './combat/encounter'
import { ENEMIES } from './content/enemies'
import { WorldEnemies, type EnemyContact } from './combat/worldenemies'
import { RECRUITS } from './content/recruits'
import { RecruitSystem } from './hub/recruits'
import { CombatUi } from './ui/combat'
import { Avatar } from './player/avatar'
import { OrbitFollowCamera } from './player/camera'
import { PlayerSim } from './player/controller'
import { GrappleVerb } from './player/grapple'
import { LanternVerb } from './player/verbs'
import { GlyphSystem } from './progression/glyphs'
import { MasterySystem } from './progression/mastery'
import { GlyphPanel } from './ui/glyphpanel'
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
const saves = createSaveSystem(localStorage)
const worldDefs = [amberfall, waystation, veilspire]
const world = new World(
  worldDefs,
  (id) =>
    !worldDefs.find((d) => d.id === id)?.latent ||
    saves.state.regionsManifested.includes(id),
)
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
const bus = new EventBus()
const audio = new GameAudio()
audio.attach(bus)
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
  sounding: saves.state.tools.sounding,
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

// Sounding: the buried world answers in pitch.
const sounding = new SoundingVerb(player, discovery, audio)

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

// World enemies + the encounter lifecycle.
const worldEnemies = new WorldEnemies(world.enemies, saves.state, world.heightAt)
scene.add(worldEnemies.group)
let encounter: Encounter | null = null
let arena: Arena | null = null
let combatUi: CombatUi | null = null
let combatContact: EnemyContact | null = null

// The Glyph Grid — inscription happens beside Iole the Scribe.
const glyphs = new GlyphSystem(saves.state, bus, () => recruits.homeCount())
const scribeDef = RECRUITS.find((r) => r.role === 'scribe')!
const nearScribe = () =>
  saves.state.discoveries[scribeDef.personId] === 'found' &&
  Math.hypot(
    player.position.x - scribeDef.home.x,
    player.position.z - scribeDef.home.z,
  ) < 7
const glyphPanel = new GlyphPanel(glyphs, saves.state, nearScribe, bus)

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
  if (arena) {
    arena.camera.aspect = camera.aspect
    arena.camera.updateProjectionMatrix()
  }
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

// --- The socket: planting a Waystone manifests its latent region ---
function latentAwaiting(): (typeof worldDefs)[number] | null {
  for (const def of worldDefs) {
    if (def.latent && def.socketAt && !world.isManifested(def.id)) return def
  }
  return null
}

function nearSocket(def: (typeof worldDefs)[number]): boolean {
  return (
    Math.hypot(
      player.position.x - def.socketAt!.x,
      player.position.z - def.socketAt!.z,
    ) < 4
  )
}

function plantWaystone(def: (typeof worldDefs)[number]) {
  saves.state.waystones -= 1
  saves.state.regionsManifested.push(def.id)
  const region = world.manifest(def.id)
  if (!region) return
  // Wake the new region's content in every system.
  discovery.addDefs(def.discoverables)
  discoveryView.addDefs(def.discoverables)
  grapple.addPoints(def.grapplePoints)
  latentPaths.addDefs(def.latentPaths)
  world.rebuildCollider(latentPaths.solidGroups())
  worldEnemies.addSpawns(def.enemies)
  bus.emit('toast', { text: 'The Waystone takes root…', flavor: 'reward' })
  bus.emit('toast', {
    text: `The song remembers — ${def.name} is real.`,
    flavor: 'reward',
  })
  bus.emit('toast', { text: 'A way west lies open.', flavor: 'info' })
  hud.announceRegion(`${def.name} — manifested`)
  persist()
}

function startEncounter(contact: EnemyContact) {
  combatContact = contact
  encounter = new Encounter(
    contact.def,
    saves.state,
    bus,
    mastery,
    glyphs,
    contact.guards,
  )
  arena = new Arena(contact.def, bus, window.innerWidth / window.innerHeight)
  combatUi = new CombatUi(bus, contact.def.name, contact.def.hp)
  player.velocity.set(0, 0, 0)
  player.mode = 'normal'
  hud.setPrompt(null)
}

function endEncounter() {
  const victory = encounter!.phase === 'victory'
  if (victory && combatContact) {
    worldEnemies.markDefeated(combatContact.spawnIndex)
  }
  if (!victory) {
    // Defeat costs nothing but the walk: wake at the Waystation.
    player.position.copy(world.regions[1]?.spawn ?? world.regions[0].spawn)
    player.velocity.set(0, 0, 0)
    bus.emit('toast', {
      text: 'You wake at the Waystation. The world keeps what you found.',
      flavor: 'info',
    })
  }
  arena?.dispose()
  combatUi?.dispose()
  encounter = null
  arena = null
  combatUi = null
  combatContact = null
  persist()
}

function update(dt: number) {
  const snap = input.snapshot()

  // --- Combat mode: the duel owns the update ---
  if (encounter && arena && combatUi) {
    encounter.update(dt, snap.codes, snap.jump)
    arena.update(dt, encounter)
    combatUi.update(encounter)
    if (encounter.done) endEncounter()
    return
  }

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

  // Touching an enemy begins a duel.
  const contact = worldEnemies.update(dt, player.position.x, player.position.z)
  if (contact) {
    startEncounter(contact)
    return
  }

  // Verbs: lantern, grapple, dash mastery.
  if (snap.lantern) {
    if (lantern.tryPulse()) audio.chord([392, 494, 587], 0.35, 'triangle')
  }
  if (snap.sounding && caps.sounding) sounding.tryPing()
  sounding.update(dt)
  if (caps.grapple) {
    grapple.updateTargeting(orbit.yaw, orbit.pitch, world.collider)
    if (snap.grapple && grapple.tryLaunch()) {
      mastery.record('grapple')
      audio.tone(240, 0.3, 'sawtooth', 0.5, 720)
    }
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
  const awaiting = latentAwaiting()
  const socketReady = awaiting !== null && nearSocket(awaiting)
  if (snap.interact) {
    if (target) {
      discovery.interact(player.position.x, player.position.z, player.position.y)
    } else if (socketReady && saves.state.waystones > 0) {
      plantWaystone(awaiting)
    } else if (homeRecruit && hubLineCooldown <= 0) {
      hubLineCooldown = 2
      bus.emit('toast', { text: homeRecruit.homeLine, flavor: 'info' })
    }
  }
  if (snap.map) map.toggle()
  if (snap.glyphs) glyphPanel.toggle()
  hud.setPrompt(
    target
      ? `E — ${target.label}`
      : socketReady
        ? saves.state.waystones > 0
          ? 'E — Plant the Waystone'
          : 'The socket waits for a Waystone'
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
  if (encounter && arena) {
    renderer.render(arena.scene, arena.camera)
  } else {
    renderer.render(scene, camera)
  }
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
    glyphs,
    glyphPanel,
    get encounter() {
      return encounter
    },
    startFight(enemyId: string) {
      const idx = world.enemies.findIndex((e) => e.enemyId === enemyId)
      if (idx < 0) return false
      startEncounter({
        def: ENEMIES[enemyId],
        spawnIndex: idx,
        guards: world.enemies[idx].guards,
      })
      return true
    },
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
