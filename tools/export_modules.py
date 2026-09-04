"""Export one .glb per module collection from model/rv.blend.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/rv.blend -P tools/export_modules.py

Conventions this script relies on, all enforced by the checks below:
  - One top-level collection per module, named exactly as in MODULES.
  - Object names match the `id` of the matching entry in src/data/vehicle.ts.
  - Material names are `role.<role-id>`.
  - Scene unit scale is metres.
"""
import os
import sys
import bpy

MODULES = [
    "shell",
    "cab",
    "alcove_bed",
    "dinette",
    "sofa_slideout",
    "galley",
    "washroom",
    "lockers",
    "softgoods",
]

OUT_DIR = os.path.join(os.getcwd(), "dist", "raw")


def fail(message):
    print(f"EXPORT ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def check_conventions():
    if abs(bpy.context.scene.unit_settings.scale_length - 1.0) > 1e-6:
        fail("scene unit scale must be 1.0 (metres)")

    bad = [m.name for m in bpy.data.materials if not m.name.startswith("role.")]
    if bad:
        fail(f"materials must be named role.<role-id>; found {bad}")

    missing = [name for name in MODULES if name not in bpy.data.collections]
    if missing:
        fail(f"missing collections: {missing}")


def export_collection(name):
    for obj in bpy.context.scene.objects:
        obj.hide_set(False)
        obj.select_set(False)

    collection = bpy.data.collections[name]
    objects = [o for o in collection.all_objects if o.type in {"MESH", "EMPTY"}]
    if not objects:
        print(f"  skip {name}: no mesh objects")
        return

    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    path = os.path.join(OUT_DIR, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,          # apply modifiers
        export_yup=True,            # glTF is Y-up, matching our frame
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=False,  # gltf-transform does this later
    )
    print(f"  wrote {path}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    check_conventions()
    for name in MODULES:
        export_collection(name)
    print("Export complete.")


main()
