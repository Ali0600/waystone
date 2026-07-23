# Model credits

## Rogue_Hooded.glb

- **Pack:** KayKit — "Adventurers" Character Pack (1.0), the **Rogue (Hooded)** character.
- **Author:** [Kay Lousberg](https://www.kaylousberg.com/) — **CC0 1.0** (public domain).
  License verified from the pack's own `LICENSE.txt`: *"License: (Creative Commons Zero, CC0)"*.
- **Source:** the official KayKit GitHub org, pinned to a commit for reproducibility —
  `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0` @ `672074b`
  (`addons/kaykit_character_pack_adventures/Characters/gltf/Rogue_Hooded.glb`).

CC0 permits use, modification, and redistribution without attribution — this note is courtesy.
Used here (M40) to swap the M39 robot placeholder for a hooded fantasy adventurer that matches
the Surveyor, trialling the downloadable-GLB hero path (the D7 "roads not taken" alternative).
Swappable for any other rigged humanoid GLB via the asset-agnostic `GlbHeroDriver` — see
`docs/DECISIONS.md` (D7). The model ships bespoke melee clips, realized in combat at M41.

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
