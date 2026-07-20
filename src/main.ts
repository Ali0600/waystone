import * as THREE from 'three'
import { amberfall } from './content/regions/amberfall'
import { veilspire } from './content/regions/veilspire'
import { waystation } from './content/regions/waystation'
import { cindervault } from './content/regions/cindervault'
import { palegrove } from './content/regions/palegrove'
import { thornmere } from './content/regions/thornmere'
import { EventBus } from './core/events'
import { createSaveSystem } from './core/save'
import { DiscoverySystem, type PlayerCapabilities } from './discovery/system'
import { DiscoveryView } from './discovery/view'
import { RegionMap } from './discovery/map'
import { GameAudio } from './engine/audio'
import { PostFx } from './engine/postfx'
import { Input } from './engine/input'
import { SIM_DT, startLoop } from './engine/loop'
import { SoundingVerb } from './minigames/sounding'
import { AnglingVerb } from './minigames/anglingverb'
import { cookBestFish, TEACHER_THRESHOLD } from './minigames/angling'
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
import { ChimeVerb } from './player/chime'
import { MistCharge } from './player/mistwalker'
import { LanternVerb } from './player/verbs'
import { GlyphSystem } from './progression/glyphs'
import { MasterySystem } from './progression/mastery'
import { GlyphPanel } from './ui/glyphpanel'
import { LatentPaths } from './world/latentpath'
import { World } from './world/world'
import { groundHeightBelow } from './world/collision'
import { MistSea, MIST_Y } from './world/mist'
import { ArchivistPanel } from './ui/archivist'
import { findOverlappingPairs, type Box } from './ui/framecheck'
import { CardTable } from './ui/cardtable'
import { ShopPanel } from './ui/shop'
import { FerryPanel } from './ui/ferry'
import { RewardBoardPanel } from './ui/rewardboard'
import { MooringPosts } from './world/moorings'
import { makeToonMaterial } from './engine/toon'
import { grantStarterDeck } from './cards/game'
import { Hud } from './ui/hud'
import { EscMenu } from './ui/menu'
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
const worldDefs = [amberfall, waystation, veilspire, cindervault, palegrove, thornmere]
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
  chime: saves.state.tools.chime,
  mistwalker: saves.state.tools.mistwalker,
  ferry: saves.state.tools.ferry,
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

// The Chime: sealed stone rings open (Tool 3).
const chime = new ChimeVerb(player, discovery)
scene.add(chime.ring)

// Mist-angling: cast from rim spots once Nerei has taught the cast.
const angling = new AnglingVerb(audio, saves.state, bus)

// Mistwalker: walk the mist sea on a draining charge; a fall respawns at the
// last solid shore stood on.
const mistCharge = new MistCharge()
const lastSolid = world.regions[0].spawn.clone()

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
const postfx = new PostFx(renderer, scene, camera)
const archivist = new ArchivistPanel(world, saves.state)
const cardTable = new CardTable(saves.state, bus)
const shop = new ShopPanel(saves.state, bus)

// The Ferry: fast travel between region moorings, once the Bell is won.
const mooringPosts = new MooringPosts(world.heightAt)
mooringPosts.add(world.moorings)
scene.add(mooringPosts.group)
const ferryFade = document.createElement('div')
ferryFade.className = 'ferry-fade'
document.body.appendChild(ferryFade)
const ferry = new FerryPanel(
  world,
  () => world.regionAt(player.position.x, player.position.z)?.def.id ?? null,
  (m) => ferryTo(m),
)

// The Reward Board: a posted board by the arch, appearing once the hub grows.
const rewardBoard = new RewardBoardPanel(saves.state, () => world.regions.map((r) => r.def), bus)
const boardPos = { x: 6, z: -129 }
const boardProp = (() => {
  const g = new THREE.Group()
  const wood = makeToonMaterial('#6b5540')
  for (const px of [-0.7, 0.7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2, 5), wood)
    post.position.set(px, 1, 0)
    g.add(post)
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 0.1), makeToonMaterial('#8a7a5a'))
  panel.position.set(0, 1.5, 0)
  const notice = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.85, 0.04),
    makeToonMaterial('#e8e2d4', { emissive: '#3a3550', emissiveIntensity: 0.3 }),
  )
  notice.position.set(0, 1.5, 0.08)
  g.add(panel, notice)
  g.position.set(boardPos.x, world.heightAt(boardPos.x, boardPos.z), boardPos.z)
  return g
})()
scene.add(boardProp)

// Recruiting Tam the Cardplayer deals you into the deck game.
bus.on('discovery:found', ({ id }) => {
  if (id === 'cv-person-cardplayer') grantStarterDeck(saves.state)
})

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
  postfx.setSize(window.innerWidth, window.innerHeight)
})

// --- Autosave ---
let saveTimer = 0
function persist() {
  saves.state.regionId = currentRegionId || prime.id
  saves.state.playerPos = [player.position.x, player.position.y, player.position.z]
  saves.save()
}
window.addEventListener('pagehide', persist)
const escMenu = new EscMenu(saves, persist, bus)
void escMenu

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
  // Stand up any recruits who live on the newly-real island.
  recruits.addWorldFigures(
    def.discoverables
      .filter((d) => d.kind === 'person')
      .map((d) => ({ id: d.id, x: d.x, z: d.z })),
  )
  bus.emit('toast', { text: 'The Waystone takes root…', flavor: 'reward' })
  bus.emit('toast', {
    text: `The song remembers — ${def.name} is real.`,
    flavor: 'reward',
  })
  mooringPosts.add(world.moorings) // the new isle's mooring joins the ferry network
  bus.emit('toast', { text: 'A way west lies open.', flavor: 'info' })
  hud.announceRegion(`${def.name} — manifested`)
  persist()
}

// Ferry travel: sail to a mooring — a fade, a teleport, a fresh region banner.
function ferryTo(m: { regionId: string; name: string; x: number; z: number }) {
  ferryFade.classList.add('flash')
  setTimeout(() => ferryFade.classList.remove('flash'), 40)
  const y = world.heightAt(m.x, m.z) + 1
  player.position.set(m.x, y, m.z)
  player.velocity.set(0, 0, 0)
  lastSolid.set(m.x, y, m.z)
  player.setSpawn(lastSolid)
  currentRegionId = '' // force the arrival banner
  announceRegionAt(m.x, m.z)
  bus.emit('toast', { text: `The ferry brings you to ${m.name}.`, flavor: 'info' })
  persist()
}

// Marou the Cook turns the best fish in the pack into a next-fight buff.
function cookAtMarou() {
  const cooked = cookBestFish(saves.state)
  if (cooked) {
    bus.emit('toast', {
      text: `Marou cooks a ${cooked.name} — you'll fight steadier next duel.`,
      flavor: 'reward',
    })
  } else {
    bus.emit('toast', {
      text: 'Marou: "Bring me something from the mist and I\'ll make a meal of it."',
      flavor: 'info',
    })
  }
}

// Nerei the Angler teaches the Undertow once you've landed enough from the mist.
function talkToNerei() {
  const angler = RECRUITS.find((r) => r.role === 'angler')!
  if (
    saves.state.anglingPoints >= TEACHER_THRESHOLD &&
    !saves.state.artsUnlocked.includes('undertow')
  ) {
    saves.state.artsUnlocked.push('undertow')
    bus.emit('toast', {
      text: 'Nerei teaches you the Undertow — → ↓ → Space, mid-duel.',
      flavor: 'reward',
    })
    bus.emit('tool:acquired', { tool: 'undertow' })
  } else if (saves.state.artsUnlocked.includes('undertow')) {
    bus.emit('toast', { text: angler.homeLine, flavor: 'info' })
  } else {
    const left = TEACHER_THRESHOLD - saves.state.anglingPoints
    bus.emit('toast', {
      text: `Nerei: "Land a little more from the mist — about ${left} more — and I'll teach you a trick."`,
      flavor: 'info',
    })
  }
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
  hud.setWorldUiVisible(false) // the duel owns the screen; hide the world HUD
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
  hud.setWorldUiVisible(true) // the world resumes; restore the HUD
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

  // Mistwalker: while owned and charged, the mist sea is a floor.
  player.mistFloorY = caps.mistwalker && mistCharge.active() ? MIST_Y + 0.05 : null
  player.step(dt, snap, orbit.yaw, world.collider)
  mistCharge.update(dt, player.position.y)
  // Track the last SOLID shore so a fall (or a charge-out) respawns there,
  // never on the mist — nothing lost.
  if (player.onGround && player.position.y > MIST_Y + 1) {
    lastSolid.copy(player.position)
    player.setSpawn(lastSolid)
  }
  hud.setMistCharge(caps.mistwalker && mistCharge.fraction() < 0.999 ? mistCharge.fraction() : null)
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
  mooringPosts.update(dt)
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
  if (snap.chime && caps.chime) {
    if (chime.tryResonate()) audio.chord([587, 784, 988], 0.5, 'sine')
  }
  chime.update(dt)
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
  const anglingOpen = saves.state.discoveries['vs-person-angler'] === 'found'
  const nearSpot =
    !target && !socketReady && anglingOpen && !angling.active
      ? angling.nearestSpot(world.anglingSpots, player.position.x, player.position.z)
      : null
  const nearMooring =
    !target && !socketReady && !nearSpot && caps.ferry
      ? world.moorings.find(
          (m) => Math.hypot(player.position.x - m.x, player.position.z - m.z) < 3,
        ) ?? null
      : null
  // The board appears once the Waystation has visibly grown (≥4 recruits home).
  boardProp.visible = recruits.homeCount() >= 4
  const nearBoard =
    !target &&
    !nearMooring &&
    boardProp.visible &&
    Math.hypot(player.position.x - boardPos.x, player.position.z - boardPos.z) < 3
  const uiOpen = cardTable.visible || shop.visible || ferry.visible || rewardBoard.visible
  if (angling.active) {
    // Angling in progress: E is the reel; every other interact waits.
  } else if (snap.interact && !uiOpen) {
    if (target) {
      discovery.interact(player.position.x, player.position.z, player.position.y)
    } else if (socketReady && saves.state.waystones > 0) {
      plantWaystone(awaiting)
    } else if (nearSpot) {
      angling.tryCast()
    } else if (nearMooring) {
      ferry.open()
    } else if (nearBoard) {
      rewardBoard.open()
    } else if (homeRecruit && hubLineCooldown <= 0) {
      hubLineCooldown = 2
      if (homeRecruit.role === 'archivist') {
        archivist.toggle()
      } else if (homeRecruit.role === 'cook') {
        cookAtMarou()
      } else if (homeRecruit.role === 'cardplayer') {
        cardTable.open()
      } else if (homeRecruit.role === 'merchant') {
        shop.open()
      } else if (homeRecruit.role === 'angler') {
        talkToNerei()
      } else {
        bus.emit('toast', { text: homeRecruit.homeLine, flavor: 'info' })
      }
    }
  }
  angling.update(dt, input.isHeld('KeyE'))
  if (snap.map) map.toggle()
  if (snap.glyphs) glyphPanel.toggle()
  hud.setPrompt(
    angling.statusText() ??
      (target
        ? `E — ${target.label}`
        : socketReady
          ? saves.state.waystones > 0
            ? 'E — Plant the Waystone'
            : 'The socket waits for a Waystone'
          : nearSpot
            ? 'E — cast into the mist'
            : nearMooring
              ? 'E — ring the Ferryman’s Bell'
              : nearBoard
                ? 'E — read the Reward Board'
                : homeRecruit
                  ? `E — talk to ${homeRecruit.name}`
                  : null),
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

// The composer issues several internal draws per frame; reset the info
// counters ourselves so the F3 numbers describe the SCENE, not the last
// fullscreen quad.
renderer.info.autoReset = false

function render() {
  renderer.info.reset()
  if (encounter && arena) {
    postfx.render(arena.scene, arena.camera)
  } else {
    postfx.render(scene, camera)
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
    chime,
    angling,
    mistCharge,
    cardTable,
    shop,
    ferry,
    rewardBoard,
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
    /**
     * Frame audit: catch layout bugs a feature-focused screenshot misses.
     * Returns every intersecting pair of currently-visible key UI elements,
     * plus named invariants (the world HUD must be hidden during combat).
     * Run this in every UI-owning state BEFORE trusting a screenshot.
     */
    auditFrame() {
      const SELECTORS = [
        '.hud-controls',
        '.hud-prompt',
        '.hud-counters',
        '.hud-region',
        '.combat-top',
        '.combat-bottom',
        '.angling-bar',
        '.mist-meter',
        '.card-overlay',
        '.toasts',
      ]
      const boxes: Box[] = []
      const shown: string[] = []
      for (const sel of SELECTORS) {
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 1 || r.height < 1) {
            continue
          }
          boxes.push({ name: sel, top: r.top, bottom: r.bottom, left: r.left, right: r.right })
          shown.push(sel)
        }
      }
      const overlaps = findOverlappingPairs(boxes)
      const combatActive = !!document.querySelector('.combat-ui')
      const worldControls = document.querySelector<HTMLElement>('.hud-controls')
      const worldHudDuringCombat =
        combatActive &&
        !!worldControls &&
        !worldControls.hidden &&
        getComputedStyle(worldControls).display !== 'none'
      return {
        visible: shown,
        overlaps,
        problems: [
          ...overlaps.map((o) => `overlap: ${o}`),
          ...(worldHudDuringCombat ? ['world HUD visible during combat'] : []),
        ],
        clean: overlaps.length === 0 && !worldHudDuringCombat,
      }
    },
  }
}
