"""
Waystone socket monument — reproducible Blender build (Blender 5.2 LTS).

Authored via the Blender MCP for waystone (github.com/Ali0600/waystone).
Replaces the primitive `buildSocket()` in src/world/landmarks.ts.

Contract with the game (do not break these):
  * ONE material per mesh object  — src/world/world.ts applyGhost() and
    latentpath.ts applySolid() both do `mesh.material as THREE.Material`,
    so a multi-material mesh would break the ghost/solid material swap.
  * Material names are the re-toon handles: rock | rock-dark | rune
    -> mapped to makeToonMaterial(...) at load time; no textures are exported.
  * Footprint ~5.96u diameter x 2.61u tall, matching the primitive it replaces
    (6.0 x 2.5) so LandmarkDef placements and `lm.scale` still fit.
  * Flat shading throughout (toon target).

GOTCHA that cost a rebuild: the EXACT boolean solver DISCARDS disjoint shells.
Joining the standing stones into an object that still carried the well BOOLEAN
deleted every stone. Modifiers must be APPLIED before any join.

Run: paste into Blender's scripting console, or via the MCP execute_blender_code.
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

SCENE = "WaystoneSocket"
# Repo destination. Adjust if your checkout lives elsewhere.
OUT = os.path.expanduser("~/projects/waystone/public/models/waystone/socket.glb")


# --------------------------------------------------------------------------- utils
def rnd(*seed):
    """Deterministic hash-noise in [-1, 1] — reproducible builds, no RNG."""
    s = sum((i + 1) * v for i, v in enumerate(seed))
    return (math.sin(s * 12.9898) * 43758.5453) % 2.0 - 1.0


def solo(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_all(ob):
    """Apply every modifier — MUST happen before joining (see boolean gotcha)."""
    solo(ob)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def bevel(ob, width=0.05, segs=2, angle=32):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width, m.segments = width, segs
    m.limit_method, m.angle_limit = "ANGLE", math.radians(angle)


def mat(name, rgba):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = 0.85
    m.diffuse_color = rgba
    return m


# --------------------------------------------------------------------------- build
def build():
    sc = bpy.data.scenes.get(SCENE)
    if sc is None:
        bpy.ops.scene.new(type="NEW")
        sc = bpy.context.scene
        sc.name = SCENE
    bpy.context.window.scene = sc
    for ob in list(sc.objects):
        bpy.data.objects.remove(ob, do_unlink=True)

    m_rock = mat("rock", (0.42, 0.38, 0.34, 1))
    m_dark = mat("rock-dark", (0.14, 0.12, 0.18, 1))
    m_rune = mat("rune", (0.54, 0.85, 0.78, 1))

    # ---- plinth: 12-sided tapered drum with a boolean-recessed well
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=3.0, radius2=2.62, depth=0.70, location=(0, 0, 0.35)
    )
    plinth = bpy.context.active_object
    plinth.name = "WS_Rock"

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=1.20, depth=0.60, location=(0, 0, 0.75)
    )
    cut = bpy.context.active_object

    b = plinth.modifiers.new("Well", "BOOLEAN")
    b.operation, b.object, b.solver = "DIFFERENCE", cut, "EXACT"
    bevel(plinth, width=0.055, segs=2)
    apply_all(plinth)                       # <- before any join
    bpy.data.objects.remove(cut, do_unlink=True)

    # ---- 6 irregular standing stones, broad face outward
    TOP, RING_R = 0.70, 2.22
    stones = []
    for i in range(6):
        a = (i / 6) * math.tau
        h = 0.80 + ((i * 37) % 5) * 0.28     # same height rhythm as the primitive
        w = 0.72 + 0.10 * rnd(i, 3)
        d = 0.40 + 0.05 * rnd(i, 7)

        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector((w, d, h)), verts=bm.verts)
        vedges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-5]
        bmesh.ops.subdivide_edges(bm, edges=vedges, cuts=2, use_grid_fill=False)

        half = h / 2
        for v in bm.verts:
            t = (v.co.z + half) / h          # 0 at base, 1 at crown
            taper = 1.0 - 0.32 * t
            v.co.x *= taper
            v.co.y *= taper
            v.co.x += 0.05 * rnd(i, v.index, 11)
            v.co.y += 0.04 * rnd(i, v.index, 17)
            if t > 0.85:                     # broken, uneven crown
                v.co.z += 0.18 * rnd(i, v.index, 23)
                v.co.x += 0.05 * rnd(i, v.index, 29)
            elif t > 0.05:
                v.co.z += 0.05 * rnd(i, v.index, 31)

        me = bpy.data.meshes.new(f"WS_StoneMesh{i}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"WS_Stone{i}", me)
        sc.collection.objects.link(ob)
        ob.location = (math.cos(a) * RING_R, math.sin(a) * RING_R, TOP - 0.10 + half)
        # +90deg so the WIDE axis runs tangentially: broad face reads from outside
        ob.rotation_euler = (
            math.radians(3.5 * rnd(i, 41)),
            math.radians(3.5 * rnd(i, 43)),
            -a + math.pi / 2,
        )
        bevel(ob, width=0.035, segs=2, angle=40)
        apply_all(ob)
        stones.append(ob)

    bpy.ops.object.select_all(action="DESELECT")
    for ob in stones:
        ob.select_set(True)
    plinth.select_set(True)
    bpy.context.view_layer.objects.active = plinth
    bpy.ops.object.join()
    plinth.data.materials.clear()
    plinth.data.materials.append(m_rock)

    # ---- well floor + rune ring inlay
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=1.17, depth=0.08, location=(0, 0, 0.49)
    )
    f = bpy.context.active_object
    f.name = "WS_WellFloor"
    f.data.materials.clear()
    f.data.materials.append(m_dark)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.58, minor_radius=0.055,
        major_segments=32, minor_segments=6, location=(0, 0, 0.70)
    )
    r = bpy.context.active_object
    r.name = "WS_RuneRing"
    r.data.materials.clear()
    r.data.materials.append(m_rune)

    for ob in sc.objects:
        solo(ob)
        bpy.ops.object.shade_flat()
    return sc


def export(sc, path=OUT):
    bpy.context.window.scene = sc
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_active_scene=True,      # never drag in other scenes
        use_selection=False,
        export_apply=True,          # default is False — must be explicit
        export_yup=True,            # Blender Z-up -> glTF / three.js Y-up
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=False,
    )
    return path


if __name__ == "__main__":
    scene = build()
    print("exported:", export(scene))
