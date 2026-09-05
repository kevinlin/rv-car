"""Check the saved model's geometry, not just its placement metadata. Run npm run check:blend."""
import bpy
from mathutils import Vector

scene = bpy.context.scene
assert len(bpy.data.collections) == 9
assert len([m for m in bpy.data.materials if m.name.startswith('role.')]) == 17
modules = ['shell', 'dinette', 'sofa_slideout', 'alcove_bed', 'lockers', 'cab', 'galley', 'softgoods', 'washroom']
assert all(scene.get('modelled_' + name) for name in modules)

# The inside bottoms of all three bowls must face up, including the regenerated binaries.
for name, x, y, z in [('galley_run', .85, 2.91, .746),
                      ('washroom_pod', -.90, 2.86, .72),
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
                          ((-1.3, 1.1, 1.115), (-1, 0, 0)),
                          ((.9, 3.10, 1.14), (1, 0, 0))]:
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

def texel_density(obj):
    """UV units per metre, per polygon. sqrt of the UV-area to world-area ratio."""
    mesh = obj.data
    layer = mesh.uv_layers['UVMap'].data
    scale = obj.matrix_world.to_scale()
    out = []
    for poly in mesh.polygons:
        world = poly.area * scale.x * scale.y
        if world < 1e-9:
            continue
        loops = [layer[i].uv for i in poly.loop_indices]
        cross = 0.0
        for i in range(len(loops)):
            p, q = loops[i], loops[(i + 1) % len(loops)]
            cross += p.x * q.y - q.x * p.y
        uv_area = abs(cross) / 2
        if uv_area < 1e-12:
            continue
        out.append((uv_area / world) ** .5)
    return out


by_role = {}
for obj in scene.objects:
    if obj.type != 'MESH':
        continue
    densities = texel_density(obj)
    for slot in obj.data.materials:
        if slot:
            by_role.setdefault(slot.name, []).extend(densities)

for role, values in sorted(by_role.items()):
    values.sort()
    lo = values[int(len(values) * .05)]
    hi = values[int(len(values) * .95)]
    print('TEXEL_DENSITY', role, 'n=%d' % len(values),
          'p5=%.2f p95=%.2f spread=%.2f' % (lo, hi, hi / lo))

# Tiling maps read as one material only if every object sharing a role carries the same UV
# scale. Before normalise_uv_density() landed, role.floor measured 4.30 and role.metal.chrome
# 8.57, because smart_project normalises each object into 0..1 and the joined *_details
# catch-all is far larger than a standalone box. The threshold is 2.0, not the measured worst
# case of 1.40: 4.0 is where the mismatch becomes visible, and Phase D adds tubes and pleated
# cloth whose own unwraps spread more than a box's.
TEXTURED_ROLES = ['role.wood.cabinet', 'role.wood.trim', 'role.floor', 'role.worktop',
                  'role.upholstery.seat', 'role.upholstery.bolster', 'role.upholstery.sofa',
                  'role.washroom.shell', 'role.textile.curtain']
for role in TEXTURED_ROLES:
    values = sorted(by_role.get(role, []))
    assert values, role
    lo, hi = values[int(len(values) * .05)], values[int(len(values) * .95)]
    assert hi / lo <= 2.0, (role, 'texel density spread %.2f; tiling maps will scale unevenly' % (hi / lo))
    # Every `repeat` in DEFAULT_REGISTRY is authored against TEXEL_DENSITY = 1.0 UV/m, so the
    # absolute scale is as load-bearing as its consistency.
    assert .5 <= values[len(values) // 2] <= 2.0, (role, 'median density %.2f is off 1.0 UV/m' % values[len(values) // 2])

print('SAVED_MODEL_CHECK_PASS')
