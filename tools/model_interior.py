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


def wedge(name, center, size, role, shear, axis=1, bevel=.01):
    """A box whose top-front edge is displaced along `axis`, raking the face it belongs to.

    Enough for a windscreen rake and for the tapered nose of the over-cab moulding, which are
    the two shapes model_exterior needs and cannot get from a cube. `shear` is metres of
    displacement, positive toward +axis, applied to the four vertices that are both at the top
    and at the -axis end.

    The top-front EDGE rather than the whole top face, deliberately. Shearing the face moves
    its rear edge by the same amount, and on body_cab that pushed the mass 340 mm past the
    placement box check_models.mjs holds it to. Displacing only the front edge leaves the rear
    square, and leaves the bottom of the front face where it was — which on body_cab is the
    nose plane at y -1.948, the envelope's length minimum.

    The vertex loop runs in local space after box() applied its scale, so `center` and `size`
    are the same values box() received.
    """
    obj = box(name, center, size, role, bevel=0)
    top, front = size[2] / 2, -size[axis] / 2
    for vert in obj.data.vertices:
        if vert.co[2] > top - 1e-4 and vert.co[axis] < front + 1e-4:
            vert.co[axis] += shear
    if bevel:
        mod = obj.modifiers.new('Edge radius', 'BEVEL')
        mod.width = min(bevel, min(size) * .48)
        mod.segments = 3
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


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


# Objects that write their own UV and must not be re-unwrapped, nor swept into the
# `<module>_details` join that runs before the unwrap. Currently only the livery decals: a
# wordmark cannot tile, so it needs one copy across a known span with a known origin, and
# smart_project gives neither. The join matters as much as the unwrap — an exempt object that
# has already been merged into a metre-scale catch-all no longer exists under its own name.
KEEPS_OWN_UV = ('body_graphic',)


def box_uv(obj, span, flip=False):
    """Planar UV across the object's dominant plane, from 0 to `span` UV units.

    UVMap runs at TEXEL_DENSITY UV/m everywhere else, so `span` must equal the object's size in
    metres on the two axes it spans. The registry's `repeat` then divides it back to one copy.

    `flip` reverses u across the whole object, for artwork that carries lettering and so has a
    handedness. A decal on the off flank is read from -X and one on the kerb flank from +X, so
    one of the two needs it or its wordmark comes out in mirror writing.

    Whole-object, deliberately, not per-face-normal. The glTF export marks these materials
    double-sided, and a 4 mm plane whose two large faces disagree about u shows both copies
    through each other — which is what a per-face version rendered. The far face is never seen
    on its own: an opaque body sits directly behind it.

    v is written as `1 - dv` to pre-compensate for the glTF exporter, which flips every V to
    `1 - v` on the way out. Without that, a UV spanning 0 to `span` exports as `1 - span` to 1,
    and the registry's `1 / span` repeat turns that constant offset into a roll: the image comes
    out sliced across the panel with its top band wrapped round to the bottom.
    """
    mesh = obj.data
    layer = mesh.uv_layers['UVMap'] if mesh.uv_layers else mesh.uv_layers.new(name='UVMap')
    size = list(obj.dimensions)
    thin = size.index(min(size))
    u, v = [i for i in range(3) if i != thin]
    lo = [min(vert.co[i] for vert in mesh.vertices) for i in range(3)]
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop].vertex_index].co
            du = (co[u] - lo[u]) / size[u] * span[0] if size[u] else 0
            dv = (co[v] - lo[v]) / size[v] * span[1] if size[v] else 0
            layer.data[loop].uv = (span[0] - du if flip else du, 1 - dv)


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


def window(name, x, y, z, width, height, axis='x'):
    """Jambs, sills and a pane filling an opening. `axis` names the wall's normal, as in
    entry_door: 'x' for a flank window, 'y' for the rear wall's, which is the one over the
    galley run now that the run backs onto that wall."""
    def part(nm, across, up, thick, wide, tall, role, bevel=.01):
        centre = ((x, y+across, z+up) if axis == 'x' else (x+across, y, z+up))
        size = ((thick, wide, tall) if axis == 'x' else (wide, thick, tall))
        return box(nm, centre, size, role, bevel)

    parts = []
    for across in [-width/2, width/2]:
        parts.append(part(name+'_jamb', across, 0, .055, .04, height+.08, 'panel.wall'))
    for up in [-height/2, height/2]:
        parts.append(part(name+'_sill', 0, up, .055, width, .04, 'panel.wall'))
    parts.append(part(name+'_pane', 0, 0, .006, width-.035, height-.035, 'glass', 0))
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
    # The lounge and the service room are handed opposite ways, so neither flank carries a
    # matched pair. The off flank takes the lounge window over the booth and the service window
    # that lights the aisle beside the washroom pod; the kerb flank takes the slide-out aperture
    # and, aft of it, the galley window over the counter — the one the exterior walkaround
    # looks through.
    wall('wall_off',*placement('wall_off'),
         [(.32,.9,1.76,1.36),(1.975,.93,2.525,1.35),(3.12,1.28,3.37,1.62)])
    # The entry door is an opening in the wall, so it belongs to the shell alongside the
    # windows rather than to a zone. As a furniture placement it overlapped the wardrobe and
    # the galley at once, which is what the overlap check exists to forbid.
    #
    # The KERB flank carries it, forward of the rear corner, where the walkaround opens it —
    # taking the stretch the old galley window occupied, because that window looked over a
    # flank run the galley no longer is. Its span comes off the entry_door placement so the
    # opening cannot drift from the leaf that fills it or from check.ts's aisle bound.
    (dx, dy, dz), (dw, dd, dh) = placement('entry_door')
    wall('wall_kerb',*placement('wall_kerb'),
         [(.15,0,2.05,1.98),(dy-dd/2,0,dy+dd/2,dh)])
    # Full-width passage under the overcab mattress and a sleeping opening above it.
    wall('bulkhead',*placement('bulkhead'),[(-1.1,0,1.1,1.98)],axis='y')
    # The rear wall carries a window over the galley run rather than the boarding door. It is
    # the window the 3:56 and 4:26 frames show above the basin, and it keeps check_blend.py's
    # rear-glazing assertion honest now that the glazed door has moved to the kerb flank.
    wall('wall_rear',*placement('wall_rear'),[(-.36,.98,.54,1.30)],axis='y')
    window('rear_window',.09,4.0525,1.14,.86,.32,axis='y')
    # The leaf hangs on the kerb wall's inner face and is built a little under the opening, so
    # its jambs, head and flyscreen land inside the entry_door box rather than through it.
    entry_door(dx+dw/2-.030,dy,dz,dd-.04,dh-.05,axis='x')
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
    window('service_window',-1.165,2.25,1.14,.55,.42)
    # High and small, between two of the pod's ribs, matching the aperture cut through the
    # moulding in build_washroom. The video gives it a roller blind.
    window('washroom_window',-1.165,3.245,1.45,.50,.34)
    # Over the counter, which is where the reference puts the galley window.
    window('galley_window',1.165,3.22,1.14,.64,.42)
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

    # The dark charcoal fascia each locker run sits in, which is what separates the gloss walnut
    # locker fronts from the cream ceiling in every wide shot of the video. One per run, over its
    # own placement, between the locker top at 1.85 and the cove shelf at 1.911.
    #
    # There is deliberately no walnut wall band in here. The video's cabin is walnut-dominant,
    # but in the lounge that walnut is the locker fronts and this fascia: the side walls are
    # window from 0.90 to 1.40 and locker run from 1.40 up, so no wall is left showing to clad.
    # A band added at 1.42 to 1.90 rendered inside the locker carcasses.
    for name, x in (('off', -.925), ('kerb', 1.505)):
        box(f'locker_fascia_{name}', (x, 1.05, 1.883), (.45, 1.90, .046), 'metal.dark', .006)

    # Roof-hatch projector, hanging just forward of the hatch and throwing aft down the cabin.
    box('projector_body', (0, 1.09, 1.938), (.20, .17, .085), 'metal.dark', .012)
    cylinder('projector_lens', (0, 1.005, 1.938), .028, .012, 'glass', rotation=(1.5708, 0, 0))

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
    extras = [o for o in COLLECTION.objects if o.type == 'MESH' and o.name not in PLACEMENTS
              and not o.name.startswith(KEEPS_OWN_UV)]
    if extras:
        group(module+'_details', extras)
    bpy.context.view_layer.update()
    for p in DATA['objects']:
        if p['collection'] == module:
            assert bpy.data.objects.get(p['id']), p['id']
    for obj in COLLECTION.objects:
        if obj.type != 'MESH':
            continue
        if obj.name.startswith(KEEPS_OWN_UV):
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
