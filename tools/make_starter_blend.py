"""Generate model/rv.blend as a correctly-scaled block-out from the placement data.

Every object lands at the right size, in the right place, in the right collection, with the
right name and a role material already assigned. Modelling then means reshaping boxes that are
already correct rather than typing 25 sets of coordinates into the N panel.

Run:
  npm run starter

Safe to re-run: it refuses to overwrite an existing model/rv.blend unless FORCE=1 is set, so it
cannot eat work in progress.
"""
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "model", "placements.json")
OUT = os.path.join(HERE, "model", "rv.blend")

# Must match MODULES in export_modules.py. softgoods has no placements — curtains, cushions and
# bedding are free-named, so it is created empty for the modeller to fill.
COLLECTIONS = [
    "shell", "cab", "alcove_bed", "dinette", "sofa_slideout",
    "galley", "washroom", "lockers", "softgoods",
]

# Every role in src/data/finishes.ts. All are created up front so the modeller can assign any of
# them without inventing a name and tripping the export convention check.
ROLES = [
    "role.wood.cabinet", "role.wood.trim", "role.panel.wall", "role.panel.locker",
    "role.upholstery.seat", "role.upholstery.bolster", "role.upholstery.sofa",
    "role.worktop", "role.floor", "role.washroom.shell", "role.washroom.duckboard",
    "role.metal.brushed", "role.metal.chrome", "role.metal.dark", "role.textile.curtain",
    "role.led.cove", "role.glass",
]

# Rough viewport colours so the block-out is readable. Not the real palette — the runtime
# registry in src/data/finishes.ts owns that, and overwrites all of it at load time.
ROLE_VIEWPORT = {
    "role.wood.cabinet": (0.35, 0.23, 0.14, 1.0),
    "role.wood.trim": (0.35, 0.23, 0.14, 1.0),
    "role.panel.wall": (0.94, 0.91, 0.85, 1.0),
    "role.panel.locker": (0.94, 0.91, 0.85, 1.0),
    "role.upholstery.seat": (0.91, 0.88, 0.84, 1.0),
    "role.upholstery.bolster": (0.69, 0.50, 0.32, 1.0),
    "role.upholstery.sofa": (0.95, 0.93, 0.89, 1.0),
    "role.worktop": (0.79, 0.78, 0.75, 1.0),
    "role.floor": (0.49, 0.51, 0.53, 1.0),
    "role.washroom.shell": (0.97, 0.97, 0.96, 1.0),
    "role.washroom.duckboard": (0.60, 0.42, 0.24, 1.0),
    "role.metal.brushed": (0.72, 0.74, 0.75, 1.0),
    "role.metal.chrome": (0.90, 0.90, 0.92, 1.0),
    "role.metal.dark": (0.12, 0.12, 0.12, 1.0),
    "role.textile.curtain": (0.85, 0.81, 0.75, 1.0),
    "role.led.cove": (1.0, 0.85, 0.63, 1.0),
    "role.glass": (0.87, 0.90, 0.92, 1.0),
    "role.graphic.print": (0.85, 0.84, 0.82, 1.0),
    "role.graphic.screen": (0.10, 0.14, 0.20, 1.0),
    "role.body.trim": (0.12, 0.12, 0.12, 1.0),
    "role.body.chrome": (0.90, 0.90, 0.92, 1.0),
    "role.body.led": (1.0, 0.85, 0.63, 1.0),
    "role.body.screen": (0.10, 0.14, 0.20, 1.0),
    "role.glass.tint": (0.094, 0.145, 0.169, 1.0),
    "role.body.paint": (0.95, 0.95, 0.95, 1.0),
    "role.body.graphic": (0.85, 0.85, 0.85, 1.0),
    "role.tyre": (0.10, 0.10, 0.11, 1.0),
    "role.wheel": (0.66, 0.67, 0.69, 1.0),
}


def make_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_fake_user = True  # Retain the unused canonical roles when the starter is reopened.
    mat.use_nodes = True
    colour = ROLE_VIEWPORT.get(name, (0.8, 0.8, 0.8, 1.0))
    mat.diffuse_color = colour
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = colour
        if name == "role.led.cove":
            bsdf.inputs["Emission Color"].default_value = colour
            bsdf.inputs["Emission Strength"].default_value = 4.0
    return mat


def main():
    if os.path.exists(OUT) and os.environ.get("FORCE") != "1":
        print(f"REFUSING: {OUT} already exists. Re-run with FORCE=1 to overwrite.", file=sys.stderr)
        sys.exit(1)

    with open(DATA) as f:
        data = json.load(f)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"

    materials = {name: make_material(name) for name in ROLES}

    collections = {}
    for name in COLLECTIONS:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        collections[name] = c

    for obj_def in data["objects"]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
        obj = bpy.context.active_object
        obj.name = obj_def["id"]
        obj.data.name = f"{obj_def['id']}_mesh"

        # glTF export uses +Y up; Blender is +Z up. The exporter's export_yup handles the
        # conversion, so author here in Blender's frame: our +Z (rearward) is Blender's +Y,
        # and our +Y (up) is Blender's +Z.
        x, y_up, z_rear = obj_def["location"]
        w, h, d = obj_def["dimensions"]
        obj.location = (x, z_rear, y_up)
        obj.dimensions = (w, d, h)

        obj.data.materials.append(materials[obj_def["material"]])

        for c in obj.users_collection:
            c.objects.unlink(obj)
        collections[obj_def["collection"]].objects.link(obj)

    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    print(f"Wrote {OUT}")
    print(f"  {len(data['objects'])} objects, {len(COLLECTIONS)} collections, {len(ROLES)} role materials")


if __name__ == '__main__':
    main()
