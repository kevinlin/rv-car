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


def bowl(name, center, radii, depth, role):
    # Revolved section gives an actual hollow bowl, including a rounded lip and underside.
    section = [(0, -depth), (.3, -depth), (.65, -depth * .9), (.88, -depth * .55),
               (1, -.008), (1.015, 0), (1.04, -.01), (.92, -depth * .65),
               (.7, -depth - .014), (0, -depth - .014)]
    vertices = [(center[0] + radii[0] * r * math.cos(t * math.tau / 32),
                 center[1] + radii[1] * r * math.sin(t * math.tau / 32), center[2] + z)
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


def build_shell():
    c, s = placement('floor')
    box('floor',c,s,'floor',0)
    # Recessed ceiling center leaves 60 mm vertically between cove lip and roof.
    panels = [box('roof_left',(-.715,2.025,2.015),(.93,4.05,.03),'panel.wall',0),
              box('roof_right',(.715,2.025,2.015),(.93,4.05,.03),'panel.wall',0),
              box('roof_front',(0,.525,2.015),(.5,1.05,.03),'panel.wall',0),
              box('roof_back',(0,2.9,2.015),(.5,2.3,.03),'panel.wall',0)]
    group('ceiling',panels)
    wall('wall_off',*placement('wall_off'),[(.15,0,2.05,1.98)])
    wall('wall_kerb',*placement('wall_kerb'),[(.32,.9,1.76,1.36),(2.75,.98,3.45,1.3)])
    # Full-width passage under the overcab mattress and a sleeping opening above it.
    wall('bulkhead',*placement('bulkhead'),[(-1.1,0,1.1,1.98)],axis='y')
    box('wall_rear',*placement('wall_rear'),'panel.wall',.002)
    parts = [wall('slide_back',(-1.745,1.1,1),(.03,1.9,2),[(.32,.86,1.88,1.37)]),
             box('slide_front',(-1.47,.165,1),(.55,.03,2),'panel.wall',.002),
             box('slide_rear',(-1.47,2.035,1),(.55,.03,2),'panel.wall',.002),
             box('slide_floor',(-1.47,1.1,.015),(.55,1.84,.03),'floor',0),
             box('slide_roof',(-1.47,1.1,1.985),(.55,1.84,.03),'panel.wall',0)]
    group('slideout_shell',parts)
    window('dinette_window',1.165,1.04,1.13,1.44,.46)
    window('slideout_window',-1.745,1.1,1.115,1.56,.51)
    window('galley_window',1.165,3.1,1.14,.7,.32)
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
    for x in [-.27,.27]:
        box('hatch_frame',(x,1.4,1.995),(.045,.79,.045),'panel.wall')
    for y in [1.03,1.77]:
        box('hatch_frame',(0,y,1.995),(.5,.045,.045),'panel.wall')
    box('roof_hatch',(0,1.4,2.026),(.5,.7,.006),'glass',0)
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
    bpy.context.scene['modelled_'+module] = True
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'model/rv.blend'))
    print('MODELLED:', module)


if __name__ == '__main__':
    main()
