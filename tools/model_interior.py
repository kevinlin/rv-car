"""Shape the approved block-out, one collection at a time, without resetting other modules.

Blender -b model/rv.blend -P tools/model_interior.py -- shell
Blender -b model/rv.blend -P tools/model_interior.py -- dinette
The explicit collection argument is the only geometry this command replaces.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / 'tools'))
DATA = json.loads((HERE / 'model/placements.json').read_text())
PLACEMENTS = {p['id']: p for p in DATA['objects']}
COLLECTION = None


def placement(name):
    p = PLACEMENTS[name]
    x, z, y = p['location']
    w, h, d = p['dimensions']
    return (x, y, z), (w, d, h)


def finish(obj, name, role):
    obj.name = name
    obj.data.materials.append(bpy.data.materials['role.' + role])
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    COLLECTION.objects.link(obj)
    return obj


def box(name, center, size, role, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Edge radius', 'BEVEL')
        mod.width = min(bevel, min(size) * .48)
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new('Panel normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, role)


def cylinder(name, center, radius, depth, role, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth,
                                      location=center, rotation=rotation)
    obj = bpy.context.object
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return finish(obj, name, role)


def tube(name, points, radius, role):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    COLLECTION.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, name, role)


def bowl(name, center, radii, depth, role, corner=1.0):
    # Revolved section gives an actual hollow bowl, including a rounded lip and underside.
    # corner is the exponent on the unit circle: 1.0 is an ellipse, and lowering it toward 0
    # squares the plan off into a superellipse. The galley bowl in the reference is square.
    def unit(t):
        a = t * math.tau / 32
        c, s = math.cos(a), math.sin(a)
        if corner == 1.0:
            return c, s
        return math.copysign(abs(c) ** corner, c), math.copysign(abs(s) ** corner, s)

    section = [(0, -depth), (.3, -depth), (.65, -depth * .9), (.88, -depth * .55),
               (1, -.008), (1.015, 0), (1.04, -.01), (.92, -depth * .65),
               (.7, -depth - .014), (0, -depth - .014)]
    vertices = [(center[0] + radii[0] * r * unit(t)[0],
                 center[1] + radii[1] * r * unit(t)[1], center[2] + z)
                for r, z in section for t in range(32)]
    faces = [(j * 32 + i, j * 32 + (i + 1) % 32,
              (j + 1) * 32 + (i + 1) % 32, (j + 1) * 32 + i)
             for j in range(len(section) - 1) for i in range(32)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [tuple(reversed(face)) for face in faces])
    obj = bpy.data.objects.new(name, mesh)
    COLLECTION.objects.link(obj)
    for p in mesh.polygons:
        p.use_smooth = True
    return finish(obj, name, role)


TEXEL_DENSITY = 1.0  # UV units per metre on UVMap, held equal across every object


def normalise_uv_density(obj, target=TEXEL_DENSITY):
    """Rescale an unwrap to a fixed UV-units-per-metre.

    smart_project normalises each object into 0..1, so density depends on how big the object
    is: the joined `*_details` catch-all measured 0.056 UV/m against 0.200 for the standalone
    floor, and a tiling map would then run at three different scales on surfaces sharing a
    role. Scaling by the median ratio equalises objects while leaving each unwrap's own
    layout alone. UV2 is untouched, so the baked AO atlas stays valid.
    """
    layer = obj.data.uv_layers['UVMap'].data
    scale = obj.matrix_world.to_scale()
    ratios = []
    for poly in obj.data.polygons:
        world = poly.area * scale.x * scale.y
        if world < 1e-9:
            continue
        loops = [layer[i].uv for i in poly.loop_indices]
        cross = sum(p.x * q.y - q.x * p.y for p, q in zip(loops, loops[1:] + loops[:1]))
        uv_area = abs(cross) / 2
        if uv_area > 1e-12:
            ratios.append((uv_area / world) ** .5)
    if not ratios:
        return
    ratios.sort()
    factor = target / ratios[len(ratios) // 2]
    for loop in layer:
        loop.uv = (loop.uv.x * factor, loop.uv.y * factor)


def group(name, parts):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = placement(name)[0] if name in PLACEMENTS else (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def wall(name, center, size, holes, axis='x'):
    """Panel pieces surrounding rectangular openings, with no coplanar pane cover."""
    # Bounds in horizontal/vertical wall coordinates, holes (left,bottom,right,top).
    x, y, z = center
    w, d, h = size
    u, span = (y, d) if axis == 'x' else (x, w)
    us = sorted({u-span/2, u+span/2, *(v for q in holes for v in (q[0], q[2]))})
    zs = sorted({z-h/2, z+h/2, *(v for q in holes for v in (q[1], q[3]))})
    pieces = []
    for lo, hi in zip(us, us[1:]):
        for bottom, top in zip(zs, zs[1:]):
            if any(a < (lo+hi)/2 < c and b < (bottom+top)/2 < e for a,b,c,e in holes):
                continue
            c = (x, (lo+hi)/2, (bottom+top)/2) if axis == 'x' else ((lo+hi)/2, y, (bottom+top)/2)
            s = (w, hi-lo, top-bottom) if axis == 'x' else (hi-lo, d, top-bottom)
            pieces.append(box(name+'_panel', c, s, 'panel.wall', .002))
    return group(name, pieces)


def window(name, x, y, z, width, height):
    parts = []
    for yy in [y-width/2, y+width/2]:
        parts.append(box(name+'_jamb', (x, yy, z), (.055,.04,height+.08), 'panel.wall'))
    for zz in [z-height/2, z+height/2]:
        parts.append(box(name+'_sill', (x,y,zz), (.055,width,.04), 'panel.wall'))
    parts.append(box(name+'_pane',(x,y,z),(.006,width-.035,height-.035),'glass',0))
    return group(name, parts)


def entry_door(x, y, z, width, height, axis='x'):
    """Leaf, frame and pleated flyscreen filling an opening in a wall.

    `axis` names the wall's normal. 后上门 puts this vehicle's boarding door in the rear wall,
    so 'y' is the variant in use; the door itself is the same either way, which is why this
    takes an axis rather than growing a second copy. Both the kerb wall and the rear wall sit
    at the positive end of their axis, so "into the cabin" is the negative direction on both,
    and `inset` is measured that way.
    """
    def part(name, inset, across, up, thick, wide, tall, role, bevel):
        centre = ((x-inset, y+across, z+up) if axis == 'x' else (x+across, y-inset, z+up))
        size = ((thick, wide, tall) if axis == 'x' else (wide, thick, tall))
        return box(name, centre, size, role, bevel)

    # The leaf is a frame around the glazed aperture, not a slab with a pane laid inside it.
    # A solid leaf buries the 6 mm pane in 35 mm of panel, so the door reads blank from
    # indoors — which is what both boarding doors did until the entry moved somewhere the
    # camera actually looks at it.
    aw, ah = (width-.24)/2, height/6        # aperture half-width, half-height
    ac = height/4                            # aperture centre: RV door glass sits high
    lw, lh = (width-.06)/2, (height-.06)/2   # leaf half-width, half-height
    parts = [part('entry_door_rail', 0, 0, (ac-ah-lh)/2, .035, lw*2, ac-ah+lh, 'panel.wall', .012),
             part('entry_door_rail', 0, 0, (ac+ah+lh)/2, .035, lw*2, lh-ac-ah, 'panel.wall', .012),
             part('entry_door_stile', 0, -(aw+lw)/2, ac, .035, lw-aw, ah*2, 'panel.wall', .012),
             part('entry_door_stile', 0, (aw+lw)/2, ac, .035, lw-aw, ah*2, 'panel.wall', .012),
             part('entry_door_glass', 0, 0, ac, .006, aw*2, ah*2, 'glass', 0),
             part('entry_door_handle', .032, -width/2+.14, 0, .03, .04, .17, 'metal.brushed', .012),
             part('entry_door_head', 0, 0, height/2, .055, width, .04, 'panel.wall', .006),
             # Pleated flyscreen, gathered against one jamb.
             part('entry_door_flyscreen', .05, -width/2+.07, 0, .012, .12, height-.10,
                  'textile.curtain', .004)]
    for side in (-1, 1):
        parts.append(part('entry_door_jamb', 0, side*width/2, 0, .055, .04, height,
                          'panel.wall', .006))
    return group('entry_door', parts)


def build_shell():
    c, s = placement('floor')
    box('floor',c,s,'floor',0)
    # Recessed ceiling center leaves 60 mm vertically between cove lip and roof.
    panels = [box('roof_left',(-.715,2.025,2.015),(.93,4.05,.03),'panel.wall',0),
              box('roof_right',(.715,2.025,2.015),(.93,4.05,.03),'panel.wall',0),
              box('roof_front',(0,.525,2.015),(.5,1.05,.03),'panel.wall',0),
              box('roof_back',(0,2.9,2.015),(.5,2.3,.03),'panel.wall',0)]
    group('ceiling',panels)
    # The off flank carries both of this side's windows: the lounge one over the booth and the
    # galley one over the counter. The slide-out aperture is on the kerb flank, because that is
    # the side the slide deploys to.
    wall('wall_off',*placement('wall_off'),[(.32,.9,1.76,1.36),(2.9,.93,3.54,1.35)])
    # The entry door is an opening in the wall, so it belongs to the shell alongside the
    # windows rather than to a zone. As a furniture placement it overlapped the wardrobe and
    # the galley at once, which is what the overlap check exists to forbid.
    # The kerb flank has no door: the washroom pod takes its rear corner. Its one window lights
    # the aisle between the wardrobe and the pod.
    wall('wall_kerb',*placement('wall_kerb'),
         [(.15,0,2.05,1.98),(2.45,.93,3.0,1.35)])
    # Full-width passage under the overcab mattress and a sleeping opening above it.
    wall('bulkhead',*placement('bulkhead'),[(-1.1,0,1.1,1.98)],axis='y')
    # 后上门: the boarding door is in the rear wall, opening onto the vestibule between the end
    # of the galley run and the washroom pod. Offset off the centreline, because the pod takes
    # the kerb corner of that wall.
    wall('wall_rear',*placement('wall_rear'),[(-.45,0,.25,1.85)],axis='y')
    entry_door(-.10,4.065,.925,.70,1.85,axis='y')
    # The sliding partition. A wall with a doorway in it, not a curtain and not a half-height
    # unit, because the brief is explicit that it has to read as a real room divider. The leaf
    # is drawn back on its track over the wardrobe side, which is the parked daytime state the
    # rest of the model depicts — slide-out deployed, table up.
    wall('partition',*placement('partition'),[(-.38,0,.38,1.84)],axis='y')
    box('partition_leaf',(.78,2.46,.92),(.80,.04,1.84),'wood.cabinet',.008)
    box('partition_track',(.40,2.46,1.8625),(1.56,.045,.045),'metal.brushed',.006)
    box('partition_pull',(.42,2.435,1.00),(.02,.014,.28),'metal.chrome',.006)
    parts = [wall('slide_back',(1.745,1.1,1),(.03,1.9,2),[(.32,.86,1.88,1.37)]),
             box('slide_front',(1.47,.165,1),(.55,.03,2),'panel.wall',.002),
             box('slide_rear',(1.47,2.035,1),(.55,.03,2),'panel.wall',.002),
             box('slide_floor',(1.47,1.1,.015),(.55,1.84,.03),'floor',0),
             box('slide_roof',(1.47,1.1,1.985),(.55,1.84,.03),'panel.wall',0)]
    group('slideout_shell',parts)
    window('dinette_window',-1.165,1.04,1.13,1.44,.46)
    window('slideout_window',1.745,1.1,1.115,1.56,.51)
    window('service_window',1.165,2.725,1.14,.55,.42)
    # Over the counter, which is where the reference puts the galley window.
    window('galley_window',-1.165,3.22,1.14,.64,.42)
    for x in [-1.125,1.125]:
        wall('alcove_flank', (x,-.7,1.675),(.05,1.4,.65),[(-1.15,1.43,-.4,1.82)])
        window('alcove_window',x,-.775,1.625,.75,.39)
    box('alcove_roof',(0,-.7,2.015),(2.3,1.4,.03),'panel.wall',.015)
    box('alcove_front',(0,-1.415,1.675),(2.3,.03,.65),'panel.wall',.015)
    # Cove lips sit 60 mm below the ceiling, strips concealed outboard of the lips.
    for x in [-1.03,1.03]:
        box('cove_fascia',(x,2.025,1.945),(.045,4.05,.06),'wood.trim',.007)
        box('cove_shelf',(x,2.025,1.918),(.22,4.05,.014),'panel.wall',.003)
        box('cove_led',(x + math.copysign(.07,x),2.025,1.957),(.025,4.02,.008),'led.cove',.002)
        for y in [.45,1.9,3.6]:
            cylinder('downlight_trim',(x*.81,y,1.997),.035,.009,'panel.wall')
            cylinder('downlight',(x*.81,y,1.99),.026,.005,'led.cove')
    # Dark surround, per the reference, against the walnut band it is punched through.
    for x in [-.27,.27]:
        box('hatch_frame',(x,1.4,1.995),(.045,.79,.045),'metal.dark')
    for y in [1.03,1.77]:
        box('hatch_frame',(0,y,1.995),(.5,.045,.045),'metal.dark')
    box('roof_hatch',(0,1.4,2.026),(.5,.7,.006),'glass',0)
    # Walnut centre band. The reference ceiling is banded, not flat cream; this is the single
    # largest surface the eye reads in every wide shot. Built in four pieces around the roof
    # hatch rather than as one slab: the hatch is punched through the band in the reference,
    # and a solid band caps the aperture that check_blend.py's upward ray exists to prove open.
    box('ceiling_band_fwd', (0, .525, 1.985), (1.0, 1.05, .03), 'wood.trim', bevel=.004)
    box('ceiling_band_aft', (0, 2.90, 1.985), (1.0, 2.30, .03), 'wood.trim', bevel=.004)
    for side, x in (('off', -.375), ('kerb', .375)):
        box(f'ceiling_band_{side}', (x, 1.40, 1.985), (.25, .70, .03), 'wood.trim', bevel=.004)

    # Stepped cove recesses at both cream-to-wall junctions, each carrying its LED strip.
    for side, x in (('off', -.86), ('kerb', .86)):
        box(f'ceiling_cove_{side}', (x, 2.025, 1.955), (.10, 4.05, .07), 'panel.wall', bevel=.004)
        box(f'cove_strip_{side}_band', (x, 2.025, 1.925), (.04, 4.02, .012), 'led.cove', bevel=0)

    # Open, minimal cab envelope, no exterior bodywork.
    box('cab_floor',(0,-.975,-.02),(2.3,1.95,.04),'floor',.01)
    for x in [-1.125,1.125]:
        box('cab_side',(x,-.975,.57),(.05,1.95,1.14),'panel.wall',.02)
    box('cab_windscreen',(0,-1.94,.85),(2.2,.01,.56),'glass',0)


def setup_materials():
    # Existing 17 role materials only. Use linear values so Blender agrees with registry sRGB.
    from make_starter_blend import ROLE_VIEWPORT, make_material
    for name, color in ROLE_VIEWPORT.items():
        mat = bpy.data.materials.get(name) or make_material(name)
        mat.use_fake_user = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in color[:3])+(1,)
        bsdf.inputs['Roughness'].default_value = .45
        if '.metal.' in name:
            bsdf.inputs['Metallic'].default_value = 1
        if name == 'role.glass':
            bsdf.inputs['Alpha'].default_value = .24
            mat.surface_render_method = 'DITHERED'
        if name == 'role.led.cove':
            bsdf.inputs['Emission Color'].default_value = (1,.69,.35,1)
            bsdf.inputs['Emission Strength'].default_value = 6


def main():
    global COLLECTION
    module = sys.argv[sys.argv.index('--')+1]
    COLLECTION = bpy.data.collections[module]
    for obj in list(COLLECTION.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    if module == 'shell':
        setup_materials()
        build_shell()
    elif module == 'exterior':
        import model_exterior
        model_exterior.build_exterior(sys.modules[__name__])
    else:
        import model_furniture
        getattr(model_furniture,'build_'+module)(sys.modules[__name__])
    extras = [o for o in COLLECTION.objects if o.type == 'MESH' and o.name not in PLACEMENTS]
    if extras:
        group(module+'_details', extras)
    bpy.context.view_layer.update()
    for p in DATA['objects']:
        if p['collection'] == module:
            assert bpy.data.objects.get(p['id']), p['id']
    for obj in COLLECTION.objects:
        if obj.type != 'MESH':
            continue
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name='UVMap')
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.025)
        bpy.ops.object.mode_set(mode='OBJECT')
        normalise_uv_density(obj)
    bpy.context.scene['modelled_'+module] = True
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'model/rv.blend'))
    print('MODELLED:', module)


if __name__ == '__main__':
    main()
