# Model credits

## waystone/hero.glb — the Surveyor

**Mixed provenance, and the split matters:** the **mesh is original work** for this repo; the
**skeleton and every animation clip are CC0** from the KayKit pack below.

- **Mesh:** original, modelled procedurally in **Blender 5.2 LTS** via the Blender MCP (M43).
  Waystone's own hooded Surveyor, in the procedural hero's palette (`src/player/rig.ts`) at
  slim/realistic proportions — deliberately *not* KayKit's chibi styling; see `docs/DECISIONS.md` D12.
- **Skeleton + animations:** KayKit — "Adventurers" Character Pack (1.0), by
  [Kay Lousberg](https://www.kaylousberg.com/), **CC0 1.0** (public domain). License verified from
  the pack's own `LICENSE.txt`: *"License: (Creative Commons Zero, CC0)"*. Pinned source:
  `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0` @ `672074b`
  (`addons/kaykit_character_pack_adventures/Characters/gltf/Rogue_Hooded.glb`). CC0 permits use,
  modification and redistribution without attribution — this note is courtesy.
  The rogue's own mesh is **not** shipped; only its rig and clips survive into `hero.glb`.
- **Reproducible:** [`tools/blender/build_waystone_hero.py`](../../tools/blender/build_waystone_hero.py)
  imports the pinned rogue for its armature + clips, discards its mesh, rebuilds the Surveyor over
  the same bones, and re-exports — so this `.glb` is a build output. Re-run it to re-tune the hero.
  (Running it needs the rogue GLB, which is no longer committed; re-fetch it from the pinned commit
  above and point `ROGUE` at it.)
- **SHA-256** (as committed): `df77da67…8580` · 1,048 tris · 591 KB · no textures.
- **Clips trimmed 76 → 14** — exactly what `src/player/glbanim.ts` maps, plus `T-Pose`. That's the
  bulk of the 3.5 MB → 591 KB saving, and `tests/glbanim.test.ts` enforces the list both ways.
- Bone names are load-bearing: the lantern rides `handslot.l` and the combat blade `handslot.r`
  (GLTFLoader strips the dots → `handslotl`/`handslotr`).

## kaykit/sword_1handed.gltf (+ .bin, knight_texture.png)

- **Pack:** KayKit — "Adventurers" Character Pack (1.0), the **1-handed sword** weapon
  (`Assets/gltf/sword_1handed.gltf`) with its shared `knight_texture.png` atlas.
- **Author:** [Kay Lousberg](https://www.kaylousberg.com/) — **CC0 1.0** (same pack `LICENSE.txt`
  as the rogue above; CC0 permits use, modification, and redistribution without attribution).
- **Source:** the same commit as the rogue —
  `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0` @ `672074b`.
- **SHA-256** (as committed): `sword_1handed.gltf` `f88345d0…a1958` · `sword_1handed.bin`
  `780ebfd0…9d8a` · `knight_texture.png` `5d250ccc…54d4`.

The rogue's **combat blade** (M41): parented to its right-hand bone (`handslot.r` → `handslotr`
after GLTFLoader strips the dot) with an identity transform, so it inherits the character's scale.
Combat-only — the world rogue roams unarmed (KayKit has no back scabbard). A `.gltf`+`.bin`+texture
triple (not a self-contained `.glb`); GLTFLoader resolves the sidecars relative to the `.gltf` URL.

## waystone/socket.glb

- **Original work** for this repo — no third-party asset, no third-party licence. Modelled
  procedurally in **Blender 5.2 LTS**, driven over the Blender MCP (M42).
- **Reproducible:** [`tools/blender/build_waystone_socket.py`](../../tools/blender/build_waystone_socket.py)
  rebuilds and re-exports it deterministically (hash-noise, no RNG), so this `.glb` is a build
  output rather than an opaque binary. Re-run it to re-tune the monument.
- **SHA-256** (as committed): `4d2b1bd1…71ef`.
- 1,840 tris · 122 KB · footprint ≈ 5.96u Ø × 2.61u tall — deliberately matching the primitive
  `buildSocket()` it replaces (6.0 × 2.5), so `LandmarkDef` placements and `lm.scale` still fit.
- **No textures and no animations.** Three named materials — `rock` · `rock-dark` · `rune` — are
  the re-toon handles: `src/world/landmarkglb.ts` maps them onto `makeToonMaterial(...)` at load
  so the monument wears the region's palette instead of an imported PBR look. One material per
  mesh, which the `applyGhost`/`applySolid` material swaps require.
