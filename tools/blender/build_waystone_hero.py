"""
The Surveyor — Waystone's own hero mesh, on the KayKit skeleton (Blender 5.2 LTS).

Authored via the Blender MCP for waystone (github.com/Ali0600/waystone), M43.
Regenerates `public/models/waystone/hero.glb`.

## What this does, and why it's shaped this way

The hard part of a custom character is ANIMATION, not geometry. So this script
does not author any: it imports the CC0 KayKit rogue purely for its **armature
and its animation clips**, throws the rogue's mesh away, builds Waystone's own
hooded Surveyor over the same bones, and re-exports. The game's `GlbHeroDriver`
resolves everything by NAME (clip names via `src/player/glbanim.ts`, hand bones
via `handslot.l`/`handslot.r`), so keeping those names is the entire contract.

Verified before any modelling: a bare import -> export round-trip of the rogue
preserves all 76 clip names, all 41 skin joints and the handslot bones exactly.
If that ever stops holding, this whole approach breaks — re-run the probe first.

## Binding strategy (this is the load-bearing design decision)

Limbs are **rigidly** bound: one vertex group per bone at weight 1.0. A forearm
really is rigid, so this gives zero weight artefacts and needs no auto-weighting.

The TORSO is not rigid — it bends. Building it from stacked rigid cones was tried
and looks like a caterpillar under animation. So the torso and cape are single
volumes with **gradient weights** blended across hips/spine/chest by height.

Every vertex must land in some group: an unweighted vertex collapses to the
origin the moment the armature drives it. The script asserts this at the end.

## Proportions

Deliberately slim/realistic, matching Waystone's PROCEDURAL hero (src/player/rig.ts)
and the world's props — NOT KayKit's chibi proportions. The two styles share this
skeleton but read completely differently; see docs/DECISIONS.md D12.

Palette is the procedural hero's, so both character styles are the same character:
cloak #3e3a5c, hood #544e7d, void #141020, boots #252132, trim #9a93c4, gold #ffcf7d.

Run: paste into Blender's scripting console, or via the MCP execute_blender_code.
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

SCENE = "WaystoneHero"
ROGUE = os.path.expanduser("~/projects/waystone/public/models/Rogue_Hooded.glb")
OUT = os.path.expanduser("~/projects/waystone/public/models/waystone/hero.glb")

# The only clips the game maps (src/player/glbanim.ts) + T-Pose as a rest reference.
# Trimming 76 -> 14 takes the export from ~3.5 MB to ~590 KB.
KEEP_CLIPS = {
    "Idle", "Running_A", "Jump_Idle",
    "1H_Melee_Attack_Chop", "1H_Melee_Attack_Slice_Horizontal",
    "1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Stab",
    "2H_Melee_Attack_Spin", "Hit_A", "Blocking", "Jump_Full_Short",
    "Cheer", "Death_A", "T-Pose",
}

PALETTE = {
    "cloak": "#3e3a5c",
    "hood":  "#544e7d",   # lighter than the cloak — the old flat palette read as a blob
    "void":  "#141020",
    "boot":  "#252132",
    "gold":  "#ffcf7d",
    "strap": "#8a7150",
    "trim":  "#9a93c4",   # pale accent; without it everything sat in one value band
}


# --------------------------------------------------------------------------- utils
def _mat(name, hexs):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    r, g, b = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5))
    m.use_nodes = True
    n = m.node_tree.nodes.get("Principled BSDF")
    if n:
        n.inputs["Base Color"].default_value = (r, g, b, 1)
        n.inputs["Roughness"].default_value = 0.9
    m.diffuse_color = (r, g, b, 1)
    return m


def _solo(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def build():
    # ---- isolated scene; never touch whatever else is open
    sc = bpy.data.scenes.get(SCENE)
    if sc is None:
        bpy.ops.scene.new(type="NEW")
        sc = bpy.context.scene
        sc.name = SCENE
    bpy.context.window.scene = sc
    for ob in list(sc.objects):
        bpy.data.objects.remove(ob, do_unlink=True)

    # ---- import the rogue ONLY for its armature + clips, then discard its mesh
    bpy.ops.import_scene.gltf(filepath=ROGUE)
    arm = next(o for o in sc.objects if o.type == "ARMATURE")
    arm.name = "Rig"
    for ob in [o for o in sc.objects if o.type == "MESH"]:
        bpy.data.objects.remove(ob, do_unlink=True)

    M = {k: _mat(k, v) for k, v in PALETTE.items()}
    B = {b.name: (Vector(b.head_local), Vector(b.tail_local)) for b in arm.data.bones}
    parts = []

    def rigid(ob, bone, mk):
        """One bone, weight 1.0 — correct for genuinely rigid pieces (limbs, head)."""
        ob.data.materials.clear()
        ob.data.materials.append(M[mk])
        ob.vertex_groups.new(name=bone).add(range(len(ob.data.vertices)), 1.0, "REPLACE")
        parts.append(ob)
        return ob

    def seg(name, bone, a, b, r0, r1, mk, sides=6):
        a, b = Vector(a), Vector(b)
        d = b - a
        bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=r0, radius2=r1, depth=d.length)
        ob = bpy.context.active_object
        ob.name = name
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = d.to_track_quat("Z", "Y")
        ob.location = a + d * 0.5
        return rigid(ob, bone, mk)

    def graded(name, profile, mk, z_span, sides=8):
        """A single volume weighted across hips/spine/chest by height, so it BENDS.
        Rigid segments here read as a caterpillar the moment the spine rotates."""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides,
                              radius1=1.0, radius2=1.0, depth=1.0)
        bmesh.ops.subdivide_edges(
            bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-5],
            cuts=7, use_grid_fill=False)
        z0, z1 = z_span
        for v in bm.verts:
            t = min(1.0, max(0.0, v.co.z + 0.5))
            r = profile[0][1]
            for i in range(len(profile) - 1):
                (ta, ra), (tb, rb) = profile[i], profile[i + 1]
                if ta <= t <= tb:
                    r = ra + (rb - ra) * ((t - ta) / (tb - ta) if tb > ta else 0)
                    break
            v.co.x *= r
            v.co.y *= r * 0.86
            v.co.z = z0 + (z1 - z0) * t
        me = bpy.data.meshes.new(name + "Mesh")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        sc.collection.objects.link(ob)
        ob.data.materials.append(M[mk])
        g = {n: ob.vertex_groups.new(name=n) for n in ("hips", "spine", "chest")}
        for i, v in enumerate(ob.data.vertices):
            z = v.co.z
            if z < 0.60:    w = (("hips", 1.0),)
            elif z < 0.80:  w = (("hips", 0.65), ("spine", 0.35))
            elif z < 0.98:  w = (("spine", 0.85), ("hips", 0.15))
            elif z < 1.12:  w = (("spine", 0.45), ("chest", 0.55))
            else:           w = (("chest", 1.0),)
            for gn, wt in w:
                g[gn].add([i], wt, "REPLACE")
        parts.append(ob)
        return ob

    # ---- torso / skirt / belt
    graded("S_Torso",
           [(0.0, 0.190), (0.22, 0.196), (0.50, 0.184), (0.78, 0.208), (0.92, 0.205), (1.0, 0.150)],
           "cloak", (0.40, 1.26))
    seg("S_Skirt", "hips", (0, 0.008, 0.645), (0, 0.02, 0.40), 0.225, 0.275, "cloak", sides=8)
    seg("S_Belt",  "hips", (0, 0, 0.618), (0, 0, 0.658), 0.208, 0.208, "strap", sides=8)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.05, radius2=0.044, depth=0.10,
                                    location=(0.17, -0.055, 0.585))
    rigid(bpy.context.active_object, "hips", "gold")

    # ---- hood: a solid cone has no opening, so CUT one and seat the void inside it
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.198, radius2=0.10, depth=0.345,
                                    location=(0, 0.055, 1.3225))
    hood = bpy.context.active_object
    hood.name = "S_Hood"
    hood.scale = (1.0, 1.06, 1.0)
    _solo(hood)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.106, depth=0.40,
                                        rotation=(math.radians(90), 0, 0),
                                        location=(0, -0.145, 1.285))
    cut = bpy.context.active_object
    b = hood.modifiers.new("Mouth", "BOOLEAN")
    b.operation, b.object, b.solver = "DIFFERENCE", cut, "EXACT"
    _solo(hood)
    bpy.ops.object.modifier_apply(modifier="Mouth")
    bpy.data.objects.remove(cut, do_unlink=True)
    rigid(hood, "head", "hood")
    seg("S_Crown", "head", (0, 0.055, 1.47), (0, 0.10, 1.532), 0.10, 0.042, "hood", sides=6)
    seg("S_Fold",  "head", (0, 0.095, 1.45), (0, 0.185, 1.35), 0.068, 0.026, "hood", sides=5)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.098, depth=0.05,
                                        rotation=(math.radians(90), 0, 0),
                                        location=(0, -0.027, 1.285))
    rigid(bpy.context.active_object, "head", "void")
    # a RING (not a disc — a disc just covers the void) framing the hood mouth
    bpy.ops.mesh.primitive_torus_add(major_radius=0.112, minor_radius=0.017,
                                     major_segments=14, minor_segments=6,
                                     location=(0, -0.03, 1.285),
                                     rotation=(math.radians(90), 0, 0))
    rigid(bpy.context.active_object, "head", "trim")

    # ---- limbs (rigid: a forearm really is rigid)
    for s, sx in (("l", 1), ("r", -1)):
        seg(f"S_Pauldron_{s}", "chest", (sx * 0.125, 0, 1.165), (sx * 0.245, 0, 1.14),
            0.098, 0.082, "hood")
        seg(f"S_UpperArm_{s}", f"upperarm.{s}", *B[f"upperarm.{s}"], 0.088, 0.074, "cloak")
        seg(f"S_LowerArm_{s}", f"lowerarm.{s}", *B[f"lowerarm.{s}"], 0.074, 0.058, "cloak")
        seg(f"S_Wrist_{s}",    f"wrist.{s}",    *B[f"wrist.{s}"],    0.058, 0.055, "strap")
        seg(f"S_Hand_{s}",     f"hand.{s}",     *B[f"hand.{s}"],     0.058, 0.049, "boot")
        seg(f"S_Cuff_{s}", f"lowerarm.{s}", (sx * 0.735, 0, 1.107), (sx * 0.775, 0, 1.107),
            0.070, 0.066, "trim")
        seg(f"S_Strap_{s}", "chest", (sx * 0.10, -0.14, 1.19), (sx * -0.03, -0.155, 0.92),
            0.030, 0.026, "strap", sides=4)
    for s in ("l", "r"):
        sx = 1 if s == "l" else -1
        ft_h, ft_t = B[f"foot.{s}"]
        seg(f"S_UpperLeg_{s}", f"upperleg.{s}", *B[f"upperleg.{s}"], 0.092, 0.076, "boot")
        seg(f"S_LowerLeg_{s}", f"lowerleg.{s}", *B[f"lowerleg.{s}"], 0.076, 0.063, "boot")
        seg(f"S_Foot_{s}", f"foot.{s}", ft_h, (ft_t.x, ft_t.y - 0.055, ft_t.z),
            0.072, 0.063, "boot")
        seg(f"S_BootTop_{s}", f"lowerleg.{s}", (sx * 0.171, -0.004, 0.315),
            (sx * 0.171, 0.002, 0.275), 0.085, 0.080, "trim")

    # ---- collar + hem accents
    seg("S_Collar", "chest", (0, 0.015, 1.145), (0, 0.03, 1.20), 0.175, 0.158, "trim", sides=8)
    seg("S_Hem",    "hips",  (0, 0.018, 0.415), (0, 0.02, 0.395), 0.272, 0.268, "trim", sides=8)

    # ---- cape: gradient-weighted, same reason as the torso
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((0.40, 0.045, 1.0)), verts=bm.verts)
    bmesh.ops.subdivide_edges(
        bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-5],
        cuts=5, use_grid_fill=False)
    for v in bm.verts:
        t = v.co.z + 0.5
        v.co.x *= 0.58 + 0.62 * (1.0 - t)
        v.co.y += 0.105 * (1.0 - t)
    me = bpy.data.meshes.new("S_CapeMesh")
    bm.to_mesh(me)
    bm.free()
    cape = bpy.data.objects.new("S_Cape", me)
    sc.collection.objects.link(cape)
    cape.location = (0, 0.15, 0.87)
    cape.rotation_euler = (math.radians(-4), 0, 0)
    cape.data.materials.append(M["cloak"])
    g = {n: cape.vertex_groups.new(name=n) for n in ("chest", "spine", "hips")}
    for i, v in enumerate(cape.data.vertices):
        z = v.co.z + cape.location.z
        w = (("chest", 1.0),) if z > 1.07 else \
            (("chest", 0.6), ("spine", 0.4)) if z > 0.87 else \
            (("spine", 0.75), ("hips", 0.25)) if z > 0.63 else (("hips", 1.0),)
        for gn, wt in w:
            g[gn].add([i], wt, "REPLACE")
    parts.append(cape)

    # ---- join, then bind BY NAME (ARMATURE_NAME uses our groups; no auto-weights)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bpy.ops.object.shade_flat()
    body = bpy.context.active_object
    body.name = "Surveyor"
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_NAME")

    # an unweighted vertex collapses to the origin under the armature — fail loudly
    orphans = [i for i, v in enumerate(body.data.vertices) if not v.groups]
    assert not orphans, f"{len(orphans)} unweighted vertices would collapse to the origin"

    # ---- trim clips to what the game maps
    arm.animation_data.action = bpy.data.actions["Idle"]
    for a in list(bpy.data.actions):
        if a.name not in KEEP_CLIPS:
            a.use_fake_user = False
            bpy.data.actions.remove(a)
    missing = KEEP_CLIPS - {a.name for a in bpy.data.actions}
    assert not missing, f"expected clips missing after trim: {sorted(missing)}"
    return sc, body


def export(sc, path=OUT):
    bpy.context.window.scene = sc
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_active_scene=True,
        use_selection=False,
        export_apply=True,       # default is False
        export_yup=True,         # Blender Z-up -> glTF / three.js Y-up
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=True,
        export_animation_mode="ACTIONS",   # one glTF animation per action
        export_extras=False,
    )
    return path


if __name__ == "__main__":
    scene, mesh = build()
    print("exported:", export(scene))
