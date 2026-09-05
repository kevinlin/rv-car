"""Check the saved model's geometry, not just its placement metadata. Run npm run check:blend."""
import bpy
from mathutils import Vector

scene = bpy.context.scene
assert len(bpy.data.collections) == 9
assert len([m for m in bpy.data.materials if m.name.startswith('role.')]) == 17
modules = ['shell', 'dinette', 'sofa_slideout', 'alcove_bed', 'lockers', 'cab', 'galley', 'softgoods', 'washroom']
assert all(scene.get('modelled_' + name) for name in modules)

# The inside bottoms of all three bowls must face up, including the regenerated binaries.
for name, x, y, z in [('galley_run', .85, 3.69, .746),
                      ('washroom_pod', -.84, 3.01, .65),
                      ('washroom_pod', -.76, 3.70, .34)]:
    obj = bpy.data.objects[name]
    faces = [p for p in obj.data.polygons
             if abs((obj.matrix_world @ p.center).z - z) < .001
             and abs((obj.matrix_world @ p.center).x - x) < .1
             and abs((obj.matrix_world @ p.center).y - y) < .1]
    assert faces and all(p.normal.z > .9 for p in faces), (name, 'reversed bowl normals')
    print('BOWL_NORMAL', name, len(faces), 'upward')

# Rays must reach glazing, rather than an uncut wall/ceiling behind the visible trim.
depsgraph = bpy.context.evaluated_depsgraph_get()
for origin, direction in [((0, 1.4, 1.8), (0, 0, 1)),
                          ((0, 1.04, 1.13), (1, 0, 0)),
                          ((-1.3, 1.1, 1.115), (-1, 0, 0))]:
    hit, loc, normal, index, obj, matrix = scene.ray_cast(depsgraph, Vector(origin), Vector(direction))
    assert hit
    role = obj.data.materials[obj.data.polygons[index].material_index].name
    assert role == 'role.glass', (origin, role)
    print('APERTURE', origin, role)

hit, loc, *_ = scene.ray_cast(depsgraph, Vector((0, .1, 1.65)), Vector((0, -1, 0)))
assert hit and loc.y < -1, 'alcove entrance blocked by head-end lockers'
assert bpy.data.images['rv_object_ao'].packed_file
for obj in scene.objects:
    if obj.type == 'MESH':
        assert {uv.name for uv in obj.data.uv_layers} == {'UVMap', 'UV2'}, obj.name
print('SAVED_MODEL_CHECK_PASS')
