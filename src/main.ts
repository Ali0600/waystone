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
import { MasterySystem, VERB_IDS, tierOf } from './progression/mastery'
import { HintSystem } from './progression/hints'
import { HINTS, type HintContext } from './content/hints'
import { GlyphPanel } from './ui/glyphpanel'
import { LatentPaths } from './world/latentpath'
import { World } from './world/world'
import { groundHeightBelow } from './world/collision'
import { MistSea, MIST_Y } from './world/mist'
import { AtmosphereRig } from './world/atmosphere'
import { LedgerPanel } from './ui/ledger'
import { AttunementPanel } from './ui/attunement'
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
import { MessageLog } from './ui/messagelog'
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
const sceneFog = new THREE.Fog(prime.palette.fog, prime.fog.near, prime.fog.far)
scene.fog = sceneFog
const hemi = new THREE.HemisphereLight(prime.palette.hemiSky, prime.palette.hemiGround, 1.9)
scene.add(hemi)
const sun = new THREE.DirectionalLight(prime.palette.sun, 2.4)
scene.add(sun)

const mist = new MistSea(prime.palette.fog)
scene.add(mist.group)

// Each isle wears its OWN authored mood (sky/fog/hemi/sun/mist); the rig blends
// toward the region the player is in. Owns scene.background + drives sun.position.
const atmosphere = new AtmosphereRig(scene, sceneFog, hemi, sun, mist, prime)

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
// Boot straight into the mood of whatever isle we actually loaded onto — a save
// on Thornmere must not flash Amberfall's amber sky before the ease catches up.
atmosphere.snapTo(world.regionAt(player.position.x, player.position.z)?.def ?? prime)

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

const map = new RegionMap(
  world,
  saves.state,
  // The isle to frame in the LOCAL scope — the one last entered (never null over
  // mist), falling back to the prime isle before the first region is tracked.
  () => world.regions.find((r) => r.def.id === currentRegionId)?.def ?? prime,
)
const postfx = new PostFx(renderer, scene, camera)
// Session message log — the Toasts choke point records every bottom-left
// message here, and the Ledger's Log tab renders it (survives the 5-toast cap).
const messageLog = new MessageLog()
// Contextual teaching hints (M27). Constructed early so the card table + combat
// can share its retire-once gate; each shown message also lands in the Ledger Log.
const hints = new HintSystem(saves.state, HINTS, (text) => messageLog.push(text, 'info'))
const ledger = new LedgerPanel(world, saves.state, messageLog)
// The Attunement screen (P) — the LoD-style progression chart. Constructed
// before EscMenu so its Escape handler closes it first (immediate-stop).
const attunement = new AttunementPanel(saves.state)
const cardTable = new CardTable(saves.state, bus, hints)
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
// Set when a grapple launches at an enemy; a duel begun against that spawn while
// the flag is live opens with a crash-in blow. Expires (flight can't reach) via t.
let grappleEngage: { spawnIndex: number; t: number } | null = null

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
// Learn-once: the "click to look around" hint retires after the first pointer
// lock. Persisted in its own localStorage key (not the game save — no schema
// coupling) so returning players who know the control never see it again.
const LOOK_HINT_KEY = 'waystone:look-hint-seen'
const lookHintSeen = (() => {
  try {
    return localStorage.getItem(LOOK_HINT_KEY) === '1'
  } catch {
    return false
  }
})()
const hud = new Hud(document.body, lookHintSeen)
const toasts = new Toasts(bus, document.body, messageLog)
void toasts
hud.setCounters(saves.state.lumen, saves.state.glyphStones)
bus.on('lumen:changed', () => hud.setCounters(saves.state.lumen, saves.state.glyphStones))
bus.on('glyphstone:changed', () =>
  hud.setCounters(saves.state.lumen, saves.state.glyphStones),
)

// Hint retirement via bus events (data-driven over HINTS), and the controls
// line grows as tools are acquired.
for (const h of HINTS) {
  if (h.retireOn) bus.on(h.retireOn, () => hints.markSeen(h.id))
}
hud.setControls(caps)
bus.on('tool:acquired', () => hud.setControls(caps))

// Region banner on arrival (and at boot).
let currentRegionId = ''
function announceRegionAt(x: number, z: number) {
  const r = world.regionAt(x, z)
  if (r && r.def.id !== currentRegionId) {
    currentRegionId = r.def.id
    hud.announceRegion(r.def.name)
    atmosphere.setTarget(r.def) // ease the sky/fog/light to this isle's mood
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
    const locked = !!document.pointerLockElement
    hud.showClickHint(!locked)
    if (locked) {
      // First lock = the player learned to look around: retire the hint for good.
      try {
        localStorage.setItem(LOOK_HINT_KEY, '1')
      } catch {
        // Storage disabled (private mode): learn-once still holds for the session.
      }
    }
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
  // A ferry hop is a discrete jump under the fade — snap the mood, don't ease.
  atmosphere.snapTo(world.regionAt(m.x, m.z)?.def ?? prime)
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

function startEncounter(contact: EnemyContact, grappleEntry = false) {
  combatContact = contact
  encounter = new Encounter(
    contact.def,
    saves.state,
    bus,
    mastery,
    glyphs,
    contact.guards,
    grappleEntry,
  )
  arena = new Arena(contact.def, bus, window.innerWidth / window.innerHeight)
  combatUi = new CombatUi(bus, contact.def.name, contact.def.hp, hints)
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
  // Grace before the next touch registers, so a neighbouring patrol can't chain
  // you straight into a second duel the instant this one ends — walk away, or
  // step back in deliberately.
  worldEnemies.suppress(2)
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
  atmosphere.update(dt) // ease sky/fog/light toward the current isle's mood
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

  // A grapple aimed at a foe stays "hot" for a short window (its flight, plus a
  // margin) — a duel begun against that same spawn while it's live crashes in.
  if (grappleEngage) {
    grappleEngage.t -= dt
    if (grappleEngage.t <= 0) grappleEngage = null
  }

  // Touching an enemy begins a duel.
  const contact = worldEnemies.update(dt, player.position.x, player.position.z)
  if (contact) {
    const viaGrapple = grappleEngage?.spawnIndex === contact.spawnIndex
    grappleEngage = null
    worldEnemies.setGrappleHighlight(null) // drop the aim glow before the duel
    startEncounter(contact, viaGrapple)
    return
  }

  // Verbs: lantern, grapple, dash mastery.
  if (snap.lantern) {
    if (lantern.tryPulse()) audio.chord([392, 494, 587], 0.35, 'triangle')
  }
  if (snap.sounding && caps.sounding) {
    const ping = sounding.tryPing()
    // First empty ping: a dull thock alone reads as a broken key — say so once.
    if (ping.kind === 'miss' && !hints.seen('sounding-nothing')) {
      hints.markSeen('sounding-nothing')
      bus.emit('toast', { text: 'Only a dull thock — nothing buried within reach.', flavor: 'info' })
    }
  }
  sounding.update(dt)
  if (snap.chime && caps.chime) {
    if (chime.tryResonate()) audio.chord([587, 784, 988], 0.5, 'sine')
  }
  chime.update(dt)
  if (caps.grapple) {
    const foes = worldEnemies.liveTargets().map((t) => ({ id: t.spawnIndex, pos: t.pos }))
    grapple.updateTargeting(orbit.yaw, orbit.pitch, world.collider, foes)
    worldEnemies.setGrappleHighlight(grapple.dynamicTargetId())
    if (snap.grapple && grapple.tryLaunch()) {
      mastery.record('grapple')
      audio.tone(240, 0.3, 'sawtooth', 0.5, 720)
      // Zipping at a foe arms the crash-in; contact (mid-flight) reads the flag.
      const foe = grapple.dynamicTargetId()
      grappleEngage = foe !== null ? { spawnIndex: foe, t: 2.8 } : null
    }
  } else {
    worldEnemies.setGrappleHighlight(null)
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
  // Announce it the first time it's raised — else it appears silently and a
  // player can finish the game never knowing it exists.
  if (boardProp.visible && !hints.seen('board-raised')) {
    hints.markSeen('board-raised')
    bus.emit('toast', { text: 'A notice board has been raised beside the arch.', flavor: 'info' })
  }
  const nearBoard =
    !target &&
    !nearMooring &&
    boardProp.visible &&
    Math.hypot(player.position.x - boardPos.x, player.position.z - boardPos.z) < 3
  // `otherOverlayOpen` excludes the Ledger so `I` can still close it; `uiOpen`
  // includes it so E-interact and M/G stay blocked while any panel owns the screen.
  const otherOverlayOpen = cardTable.visible || shop.visible || ferry.visible || rewardBoard.visible
  const uiOpen = otherOverlayOpen || ledger.visible || attunement.visible
  // The Ledger and the Attunement screen each toggle on their own key but must
  // not open over one another (otherOverlayOpen excludes both; the sibling flag
  // blocks the stack). E-interact / M / G stay gated on the full uiOpen.
  if (snap.inventory && !angling.active && !otherOverlayOpen && !attunement.visible) ledger.toggle('inventory')
  if (snap.log && !angling.active && !otherOverlayOpen && !attunement.visible) ledger.toggle('log')
  if (snap.attunement && !angling.active && !otherOverlayOpen && !ledger.visible) attunement.toggle()
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
        ledger.open('guide')
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
  // Gate the map/glyph toggles too, so M/G can't open a panel *underneath* an
  // open overlay (card table, shop, ferry, board, or the Ledger).
  if (snap.map && !uiOpen) map.toggle('local')
  if (snap.worldMap && !uiOpen) map.toggle('world')
  if (snap.glyphs && !uiOpen) glyphPanel.toggle()
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
  // Contextual hints: same-frame context the prompt chain used. Suppressed
  // while any panel owns the screen; combat is handled by the early return +
  // setWorldUiVisible force-hide, so inCombat is false here.
  const st = saves.state
  const hintCtx: HintContext = {
    lanternUses: st.mastery.lantern,
    totalVerbUses: VERB_IDS.reduce((n, v) => n + st.mastery[v], 0),
    reachedAnyTier: VERB_IDS.some((v) => tierOf(v, st.mastery[v]) >= 2),
    glyphStones: st.glyphStones,
    gridEmpty: st.glyphGrid.every((c) => c === null),
    onMist: caps.mistwalker && player.position.y < MIST_Y + 1,
    hasGrapple: caps.grapple,
    felledAnyEnemy: Object.values(st.enemiesFelled).some((n) => n > 0),
    uiOpen: uiOpen || map.visible || glyphPanel.visible || escMenu.visible,
    inCombat: false,
  }
  hud.setHint(hints.update(hintCtx, dt))
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
    ledger,
    attunement,
    map,
    worldEnemies,
    hints,
    discovery,
    mastery,
    recruits,
    glyphs,
    glyphPanel,
    get encounter() {
      return encounter
    },
    startFight(enemyId: string, grappleEntry = false) {
      const idx = world.enemies.findIndex((e) => e.enemyId === enemyId)
      if (idx < 0) return false
      startEncounter(
        {
          def: ENEMIES[enemyId],
          spawnIndex: idx,
          guards: world.enemies[idx].guards,
        },
        grappleEntry,
      )
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
        '.combat-menu',
        '.angling-bar',
        '.mist-meter',
        '.card-overlay',
        '.toasts',
        '.hud-hint',
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
      // The world HUD (controls line AND teaching hint) must be hidden in a duel.
      const worldHudVisibleInCombat = (sel: string): boolean => {
        if (!combatActive) return false
        const el = document.querySelector<HTMLElement>(sel)
        return !!el && !el.hidden && getComputedStyle(el).display !== 'none'
      }
      const combatLeaks = ['.hud-controls', '.hud-hint'].filter(worldHudVisibleInCombat)
      return {
        visible: shown,
        overlaps,
        problems: [
          ...overlaps.map((o) => `overlap: ${o}`),
          ...combatLeaks.map((s) => `world HUD (${s}) visible during combat`),
        ],
        clean: overlaps.length === 0 && combatLeaks.length === 0,
      }
    },
  }
}
