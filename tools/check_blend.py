"""Check the saved model's geometry, not just its placement metadata. Run npm run check:blend."""
import bpy
from mathutils import Vector

scene = bpy.context.scene
assert len(bpy.data.collections) == 10
assert len([m for m in bpy.data.materials if m.name.startswith('role.')]) == 23
modules = ['shell', 'dinette', 'sofa_slideout', 'alcove_bed', 'lockers', 'cab', 'galley', 'softgoods', 'washroom', 'exterior']
assert all(scene.get('modelled_' + name) for name in modules)

# The inside bottoms of all three bowls must face up, including the regenerated binaries.
#
# The galley station is absolute because the run's sink is pinned to the rear window's centre.
# The pod's two are not: build_washroom measures the basin off the pod's forward face and the
# toilet off its rear one, so the stations are read off the pod's own bounds with the builder's
# offsets applied. Written flat they stranded the moment the pod moved to the rear corner, which
# is exactly the failure the "measure from the placement's own ends" convention exists to stop.
def _bounds(name):
    obj = bpy.data.objects[name]
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return [min(c(v) for v in vs) for c in (lambda v: v.x, lambda v: v.y, lambda v: v.z)] + \
           [max(c(v) for v in vs) for c in (lambda v: v.x, lambda v: v.y, lambda v: v.z)]

_px0, _py0, _, _px1, _py1, _ = _bounds('washroom_pod')
_vanity_d = min(.36, (_py1 - _py0) - .64)
for name, x, y, z in [('galley_run', .09, 3.775, .746),
                      # Basin, in the pod's forward corner against the outer (off) wall.
                      ('washroom_pod', _px0 + .05 + min(.50, (_px1 - _px0) - .34) / 2,
                       _py0 + .01 + _vanity_d / 2, .72),
                      # Toilet pan, against the pod's rear wall on the inboard side.
                      ('washroom_pod', _px1 - .23, _py1 - .35, .34)]:
    obj = bpy.data.objects[name]
    faces = [p for p in obj.data.polygons
             if abs((obj.matrix_world @ p.center).z - z) < .001
             and abs((obj.matrix_world @ p.center).x - x) < .1
             and abs((obj.matrix_world @ p.center).y - y) < .1]
    assert faces and all(p.normal.z > .9 for p in faces), (name, 'reversed bowl normals')
    print('BOWL_NORMAL', name, len(faces), 'upward')

# The exterior body encloses the cabin, so it is held out of the interior ray casts exactly as
# check.ts holds it out of the overlap and containment tests. Without this the alcove-entrance
# ray stops on the alcove moulding at y 0 instead of reaching the windscreen.
exterior = [o for o in bpy.data.collections['exterior'].objects]
for obj in exterior:
    obj.hide_viewport = True
bpy.context.view_layer.update()

# Rays must reach glazing, rather than an uncut wall/ceiling behind the visible trim.
depsgraph = bpy.context.evaluated_depsgraph_get()
# Sides follow the layout, and the two halves of the cabin are handed opposite ways: the lounge
# window, the service window and the pod's roller-blind window are on the off flank (-x); the
# slide-out aperture and the boarding door's own glazing are on the kerb flank (+x); and the
# galley's window is in the rear wall, over the counter that backs onto it. The door ray is
# fired at z 1.3875 because that is where entry_door puts its pane — RV door glass sits high.
for origin, direction in [((0, 1.4, 1.8), (0, 0, 1)),
                          ((0, 1.04, 1.13), (-1, 0, 0)),
                          ((1.3, 1.1, 1.115), (1, 0, 0)),
                          ((0, 2.25, 1.14), (-1, 0, 0)),
                          ((.4, 3.31, 1.3875), (1, 0, 0)),
                          ((0, 3.9, 1.14), (0, 1, 0)),
                          # The pod's roller-blind window, fired from inside the pod. Both the
                          # moulding's aperture and the shell's derive from the pod placement,
                          # so this station does too.
                          ((_px1 - .20, (_py0 + _py1) / 2 + .225, 1.45), (-1, 0, 0))]:
    hit, loc, normal, index, obj, matrix = scene.ray_cast(depsgraph, Vector(origin), Vector(direction))
    assert hit
    role = obj.data.materials[obj.data.polygons[index].material_index].name
    assert role == 'role.glass', (origin, role)
    print('APERTURE', origin, role)

hit, loc, *_ = scene.ray_cast(depsgraph, Vector((0, .1, 1.65)), Vector((0, -1, 0)))
assert hit and loc.y < -1, 'alcove entrance blocked by head-end lockers'

# An open partition doorway and a clear service room, in one ray: from the lounge centreline,
# above the counter, the first thing aft must be the rear wall itself. A sealed partition stops
# this at y 2.5, and a pod or an oven shelf grown across the centreline stops it sooner.
hit, loc, *_ = scene.ray_cast(depsgraph, Vector((0, 2.0, 1.0)), Vector((0, 1, 0)))
assert hit and loc.y > 4.0, ('aisle from the lounge must run through the partition doorway '
                             'and over the galley run to the rear wall', loc.y if hit else None)
print('SERVICE_ROOM centreline clear to y=%.3f' % loc.y)

# The boarding door is in the KERB flank, and the path leads straight in from it. Fired inboard
# from just inside the opening, the ray has to cross the centreline before it meets the washroom
# pod: an oven shelf or a counter grown into that path blocks it sooner, and that path is the
# whole organising idea of the room.
door_y = (bpy.data.objects['entry_door'].matrix_world.translation.y
          if 'entry_door' in bpy.data.objects else 3.31)
hit, loc, *_ = scene.ray_cast(depsgraph, Vector((1.10, door_y, 1.0)), Vector((-1, 0, 0)))
assert hit and loc.x < -.2, ('the path in from the boarding door must reach the pod across the '
                             'centreline', loc.x if hit else None)
print('SIDE_ENTRY path clear to x=%.3f' % loc.x)

# And that door is glazed, in the kerb flank, rather than a blank panel.
details = bpy.data.objects['shell_details']
glass = [i for i, m in enumerate(details.data.materials) if m and m.name == 'role.glass']
assert any(p.material_index in glass and (details.matrix_world @ p.center).x > 1.1
           and (details.matrix_world @ p.center).y > 2.5
           for p in details.data.polygons), 'no glazing in the kerb flank aft of the partition'

# The rear wall keeps glazing of its own: the window over the galley run.
assert any(p.material_index in glass and (details.matrix_world @ p.center).y > 4.0
           for p in details.data.polygons), 'no glazing in the rear wall'

for obj in exterior:
    obj.hide_viewport = False
bpy.context.view_layer.update()
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
