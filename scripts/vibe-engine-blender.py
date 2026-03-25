"""
VIBE ENGINE — Step 2: 3D Model Generation via Blender
Converts NPC portrait images into stylized low-poly 3D characters (.glb).

Run from command line:
  blender --background --python scripts/vibe-engine-blender.py

Or open Blender → Scripting tab → paste and run.

Outputs:
  public/models/moonhaven/{npcId}.glb    — individual NPC model
  public/models/moonhaven/props.glb      — town environment pieces
  public/models/moonhaven/moonhaven.glb  — full scene (optional bake)
"""

import bpy
import os
import sys
import math

# ── Path setup ────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__ if "__file__" in dir() else sys.argv[0]))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
IMAGES_DIR = os.path.join(PROJECT_ROOT, "public", "images", "npcs")
MODELS_DIR = os.path.join(PROJECT_ROOT, "public", "models", "moonhaven")
os.makedirs(MODELS_DIR, exist_ok=True)

# ── NPC definitions: id, height scale, body type ──────────────────────────────
NPC_DEFS = {
    "elder_mira":           {"scale": 0.85, "body": "elder",    "color": (0.5, 0.4, 0.8)},
    "blacksmith_theron":    {"scale": 1.10, "body": "stocky",   "color": (0.3, 0.2, 0.1)},
    "innkeeper_bessie":     {"scale": 0.90, "body": "round",    "color": (0.8, 0.5, 0.2)},
    "guard_captain_aldric": {"scale": 1.05, "body": "armored",  "color": (0.4, 0.4, 0.5)},
    "court_wizard_lysara":  {"scale": 0.95, "body": "slim",     "color": (0.2, 0.1, 0.6)},
    "queen_aelindra":       {"scale": 1.00, "body": "regal",    "color": (0.9, 0.8, 0.2)},
    "village_kid_pip":      {"scale": 0.65, "body": "child",    "color": (0.6, 0.4, 0.2)},
    "town_herald":          {"scale": 1.00, "body": "slim",     "color": (0.7, 0.1, 0.1)},
    "bandit_cutpurse":      {"scale": 0.88, "body": "slim",     "color": (0.2, 0.2, 0.1)},
    "bandit_shadowblade":   {"scale": 0.92, "body": "slim",     "color": (0.1, 0.1, 0.15)},
    "bandit_ironclub":      {"scale": 1.20, "body": "stocky",   "color": (0.25, 0.15, 0.1)},
    "moonhaven_oracle":     {"scale": 1.00, "body": "slim",     "color": (0.7, 0.8, 1.0)},
    "moonhaven_keeper":     {"scale": 0.90, "body": "elder",    "color": (0.5, 0.5, 0.7)},
}

# Body shape vertex offsets (torso width, hip width, shoulder width)
BODY_SHAPES = {
    "slim":    {"torso_w": 0.22, "hip_w": 0.18, "shoulder_w": 0.26},
    "stocky":  {"torso_w": 0.32, "hip_w": 0.28, "shoulder_w": 0.38},
    "round":   {"torso_w": 0.35, "hip_w": 0.32, "shoulder_w": 0.36},
    "armored": {"torso_w": 0.30, "hip_w": 0.24, "shoulder_w": 0.36},
    "elder":   {"torso_w": 0.20, "hip_w": 0.18, "shoulder_w": 0.22},
    "regal":   {"torso_w": 0.22, "hip_w": 0.20, "shoulder_w": 0.26},
    "child":   {"torso_w": 0.16, "hip_w": 0.14, "shoulder_w": 0.18},
}


def clear_scene():
    """Remove everything from the current scene."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)


def create_material(name, base_color, image_path=None, roughness=0.8):
    """Create a stylized material with optional portrait texture."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Specular IOR Level"].default_value = 0.1

    if image_path and os.path.exists(image_path):
        # Load portrait as face texture
        img_node = nodes.new("ShaderNodeTexImage")
        try:
            img = bpy.data.images.load(image_path, check_existing=True)
            img_node.image = img
        except Exception as e:
            print(f"  [WARN] Could not load image {image_path}: {e}")

        uv = nodes.new("ShaderNodeUVMap")
        links.new(uv.outputs["UV"], img_node.inputs["Vector"])
        links.new(img_node.outputs["Color"], shader.inputs["Base Color"])
    else:
        shader.inputs["Base Color"].default_value = (*base_color, 1.0)

    links.new(shader.outputs["BSDF"], out.inputs["Surface"])
    return mat


def build_npc_character(npc_id, definition):
    """
    Build a stylized low-poly humanoid character for the given NPC.
    Returns the root object (armature or empty parent).
    """
    scale = definition["scale"]
    body_type = definition["body"]
    base_color = definition["color"]
    shape = BODY_SHAPES.get(body_type, BODY_SHAPES["slim"])

    image_path = os.path.join(IMAGES_DIR, f"{npc_id}.png")
    mat_body = create_material(f"{npc_id}_body", base_color)
    mat_face = create_material(f"{npc_id}_face", (1.0, 0.85, 0.7), image_path)
    mat_hair = create_material(f"{npc_id}_hair", (0.15, 0.1, 0.05))

    parts = []

    # ── HEAD ──────────────────────────────────────────────────────────────────
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.14 * scale, location=(0, 0, 1.5 * scale), segments=8, ring_count=6
    )
    head = bpy.context.active_object
    head.name = f"{npc_id}_head"
    head.data.materials.append(mat_face)
    parts.append(head)

    # Face plane (portrait quad on front of head)
    bpy.ops.mesh.primitive_plane_add(
        size=0.22 * scale, location=(0, 0.145 * scale, 1.5 * scale)
    )
    face_plane = bpy.context.active_object
    face_plane.name = f"{npc_id}_faceplane"
    face_plane.rotation_euler[0] = math.radians(90)
    face_plane.data.materials.append(mat_face)
    parts.append(face_plane)

    # ── TORSO ─────────────────────────────────────────────────────────────────
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.1 * scale))
    torso = bpy.context.active_object
    torso.name = f"{npc_id}_torso"
    torso.scale = (
        shape["torso_w"] * scale * 2,
        0.15 * scale * 2,
        0.22 * scale * 2,
    )
    bpy.ops.object.transform_apply(scale=True)
    torso.data.materials.append(mat_body)
    parts.append(torso)

    # ── HIPS ──────────────────────────────────────────────────────────────────
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.82 * scale))
    hips = bpy.context.active_object
    hips.name = f"{npc_id}_hips"
    hips.scale = (
        shape["hip_w"] * scale * 2,
        0.14 * scale * 2,
        0.12 * scale * 2,
    )
    bpy.ops.object.transform_apply(scale=True)
    hips.data.materials.append(mat_body)
    parts.append(hips)

    # ── LEGS ──────────────────────────────────────────────────────────────────
    for side, x in [("L", 0.1), ("R", -0.1)]:
        # Upper leg
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.07 * scale,
            depth=0.28 * scale,
            location=(x * scale, 0, 0.56 * scale),
            vertices=6,
        )
        leg = bpy.context.active_object
        leg.name = f"{npc_id}_leg_{side}"
        leg.data.materials.append(mat_body)
        parts.append(leg)

        # Lower leg / boot
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.065 * scale,
            depth=0.26 * scale,
            location=(x * scale, 0, 0.28 * scale),
            vertices=6,
        )
        shin = bpy.context.active_object
        shin.name = f"{npc_id}_shin_{side}"
        shin.data.materials.append(mat_body)
        parts.append(shin)

    # ── ARMS ──────────────────────────────────────────────────────────────────
    for side, x in [("L", 1), ("R", -1)]:
        arm_x = x * shape["shoulder_w"] * scale
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.055 * scale,
            depth=0.28 * scale,
            location=(arm_x, 0, 1.08 * scale),
            vertices=6,
        )
        arm = bpy.context.active_object
        arm.name = f"{npc_id}_arm_{side}"
        arm.rotation_euler[2] = math.radians(90 * x)
        bpy.ops.object.transform_apply(rotation=True)
        arm.data.materials.append(mat_body)
        parts.append(arm)

    # ── HAIR / HAT ────────────────────────────────────────────────────────────
    if body_type in ("elder", "regal"):
        # Long hair as a cone behind head
        bpy.ops.mesh.primitive_cone_add(
            radius1=0.15 * scale, radius2=0.05 * scale,
            depth=0.3 * scale,
            location=(0, -0.05 * scale, 1.52 * scale),
            vertices=8,
        )
        hair = bpy.context.active_object
        hair.name = f"{npc_id}_hair"
        hair.data.materials.append(mat_hair)
        parts.append(hair)
    elif body_type == "child":
        # Poof hair
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.12 * scale,
            location=(0, 0, 1.67 * scale),
            segments=6, ring_count=4,
        )
        hair = bpy.context.active_object
        hair.name = f"{npc_id}_hair"
        hair.data.materials.append(mat_hair)
        parts.append(hair)

    # ── JOIN all parts into single mesh ───────────────────────────────────────
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    combined = bpy.context.active_object
    combined.name = npc_id

    # Apply shade smooth + edge split
    bpy.ops.object.shade_smooth()
    mod = combined.modifiers.new("EdgeSplit", "EDGE_SPLIT")
    mod.split_angle = math.radians(30)

    return combined


def export_glb(obj, filepath):
    """Export a single object as .glb"""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_draco_mesh_compression_enable=False,
    )
    print(f"  GLB: {os.path.basename(filepath)}")


def build_moonhaven_props():
    """
    Build reusable Moonhaven environment props:
    - Moon fountain (central plaza feature)
    - Lantern posts
    - Market stall
    - Stone archway
    """
    props = []

    # Moon Fountain — central plaza
    bpy.ops.mesh.primitive_cylinder_add(radius=1.2, depth=0.3, location=(0, 0, 0), vertices=16)
    basin = bpy.context.active_object
    basin.name = "fountain_basin"
    mat_stone = create_material("stone", (0.6, 0.6, 0.65))
    basin.data.materials.append(mat_stone)
    props.append(basin)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=1.2, location=(0, 0, 0.75), vertices=8)
    column = bpy.context.active_object
    column.name = "fountain_column"
    column.data.materials.append(mat_stone)
    props.append(column)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0, 0, 1.5), segments=8, ring_count=6)
    orb = bpy.context.active_object
    orb.name = "fountain_moon_orb"
    mat_moon = create_material("moon_glow", (0.85, 0.9, 1.0), roughness=0.1)
    orb.data.materials.append(mat_moon)
    props.append(orb)

    # Lantern post
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=2.5, location=(0, 0, 1.25), vertices=6)
    pole = bpy.context.active_object
    pole.name = "lantern_pole"
    mat_iron = create_material("iron", (0.15, 0.15, 0.15))
    pole.data.materials.append(mat_iron)
    props.append(pole)

    bpy.ops.mesh.primitive_cube_add(size=0.25, location=(0, 0, 2.6))
    lantern_box = bpy.context.active_object
    lantern_box.name = "lantern_box"
    mat_lantern = create_material("lantern_glass", (1.0, 0.8, 0.3), roughness=0.05)
    lantern_box.data.materials.append(mat_lantern)
    props.append(lantern_box)

    # Ground tile (single 2x2 cobble)
    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0, 0, 0))
    tile = bpy.context.active_object
    tile.name = "cobble_tile"
    mat_cobble = create_material("cobble", (0.45, 0.42, 0.40))
    tile.data.materials.append(mat_cobble)
    props.append(tile)

    return props


def main():
    print("\n🌙 MOONHAVEN VIBE ENGINE — Blender 3D Model Generation\n")

    # ── Generate individual NPC models ────────────────────────────────────────
    for npc_id, definition in NPC_DEFS.items():
        out_path = os.path.join(MODELS_DIR, f"{npc_id}.glb")
        if os.path.exists(out_path):
            print(f"  SKIP: {npc_id}.glb (already exists)")
            continue

        print(f"  BUILD: {npc_id}...")
        clear_scene()
        obj = build_npc_character(npc_id, definition)
        export_glb(obj, out_path)

    # ── Generate environment props ────────────────────────────────────────────
    props_path = os.path.join(MODELS_DIR, "props.glb")
    if not os.path.exists(props_path):
        print("\n  BUILD: moonhaven props...")
        clear_scene()
        build_moonhaven_props()
        # Select all and export
        bpy.ops.object.select_all(action="SELECT")
        if bpy.context.selected_objects:
            bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
        bpy.ops.export_scene.gltf(
            filepath=props_path,
            use_selection=True,
            export_format="GLB",
            export_apply=True,
        )
        print(f"  GLB: props.glb")

    print("\n✅ Done! All models in public/models/moonhaven/")
    print("Next step: load MoonhavenClient.tsx — it will auto-load these GLB files.")


if __name__ == "__main__":
    main()
