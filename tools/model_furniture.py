"""Reference-shaped RV furniture, in Blender metres (+Y rearward, +Z up)."""
import math


def _chair(a, name, direction=1, cab=False):
    (x, y, z), (w, d, h) = a.placement(name)
    bottom = z - h / 2
    parts = []
    def box(label, offset, size, role, bevel=.02):
        px, py, pz = offset
        obj = a.box(label, (x + px, y + py * direction, bottom + pz), size, role, bevel)
        parts.append(obj)
        return obj
    box('drawer plinth', (0, -.012, .13), (w, d-.024, .26), 'wood.cabinet')
    box('drawer face', (0, d/2-.026, .13), (w-.04, .022, .19), 'wood.cabinet', .009)
    box('drawer pull', (0, d/2-.007, .16), (.13, .014, .022), 'metal.brushed', .005)
    if not cab:
        # Plinth strip washing the floor under each seat base — one of the details that makes
        # the video's cabin read as lit rather than merely bright.
        box('plinth strip', (0, .012, .012), (w-.09, d-.09, .012), 'led.cove', 0)
    parts.append(a.cylinder('swivel pedestal', (x, y, bottom+.30), .09, .1, 'metal.brushed'))
    # Grey leather everywhere the body touches. The video's seats are light grey top to bottom;
    # camel survives only as a wedge low on each outer flank of the backrest and as a small badge
    # on its face. The first pass had the cushion and the whole backrest surround in camel, which
    # is why the render read as orange furniture against photographs of grey ones.
    box('seat bolster', (0, .012, .415), (w-.025, d-.025, .17), 'upholstery.seat', .065)
    box('seat inset', (0, .025, .497), (w-.15, d-.12, .034), 'upholstery.seat', .045)
    box('back bolster', (0, -.187, .755), (w-.025, .145, .43), 'upholstery.seat', .055)
    for level in (.65, .80, .92):
        box('back padded panel', (0, -.102, level), (w-.17, .04, .115), 'upholstery.seat', .026)
    box('camel back base', (0, -.118, .575), (w-.05, .07, .09), 'upholstery.bolster', .03)
    box('camel badge', (0, -.124, .84), (.16, .015, .035), 'upholstery.bolster', .008)
    for side in (-1, 1):
        box('arm support', (side*(w/2-.046), -.09, .54), (.027, .055, .18), 'metal.brushed', .01)
        box('padded armrest', (side*(w/2-.052), .025, .645), (.10, .38, .085), 'upholstery.seat', .038)
    box('headrest', (0, -.18, h-.095), (w-.12, .16, .19), 'upholstery.seat', .063)
    box('headrest inset', (0, -.093, h-.095), (w-.19, .022, .12), 'upholstery.seat', .028)
    return a.group(name, parts)


def build_dinette(a):
    # A 1 + 2 booth: the forward seat faces aft across the table at the pair behind it.
    # direction -1 puts the backrest aft (facing forward), +1 puts it forward (facing aft).
    _chair(a, 'dinette_chair_fwd', 1)
    for name in ('dinette_chair_aft_off', 'dinette_chair_aft_kerb'):
        _chair(a, name, -1)
    (x, y, z), (w, d, h) = a.placement('dinette_table')
    # Reference: a walnut edge band around a pale top, on a chrome column rather than brushed.
    # The pale top sits proud of the walnut band. Flush would put the two top faces on the same
    # plane, and they z-fight — the band wins and the whole table reads as solid walnut.
    parts = [a.box('dinette_table_edge', (x,y,h-.042), (w,d,.076), 'wood.trim', .065),
             a.box('rounded tabletop', (x,y,h-.015), (w-.06,d-.06,.030), 'worktop', .012),
             a.cylinder('dinette_table_pedestal', (x,y,.36), .038, .72, 'metal.chrome'),
             a.box('pedestal foot', (x,y,.022), (.36,.32,.04), 'metal.chrome', .055),
             # 中间是可收纳的餐桌, with a drawer in it — visible under the walnut edge band in the
             # 9:41 frame. Hung under the top rather than let down to the floor, so the pedestal
             # and the knee gaps either side survive.
             a.box('table_drawer', (x,y,h-.128), (w-.10,d-.09,.09), 'wood.cabinet', .012),
             a.box('table_drawer_pull', (x,y-d/2+.048,h-.128), (.15,.016,.020), 'metal.chrome', .006)]
    a.group('dinette_table', parts)


def build_sofa_slideout(a):
    (x,y,z), (w,d,h) = a.placement('slideout_base')
    # `side` is which flank the slide deploys to, derived rather than written down: the plinth
    # sits flush outboard and the drawers face the aisle, and both follow the sign. A hard-coded
    # +x outboard is precisely the constant that had to be rewritten each time this crossed the
    # cabin.
    side = 1 if x > 0 else -1
    parts = [a.box('walnut bed plinth', (x+side*.02,y,z), (w-.04,d,h), 'wood.cabinet', .02)]
    for j in range(3):
        cy = y-d/2+(j+.5)*d/3
        parts.append(a.box('sofa drawer', (x-side*(w/2-.029),cy,z), (.022,d/3-.025,h-.055), 'wood.cabinet', .009))
        parts.append(a.box('sofa drawer pull', (x-side*(w/2-.009),cy,z+.07), (.018,.14,.025), 'metal.brushed', .007))
    a.group('slideout_base', parts)
    # Plinth strip under the sofa, matching the booth seats. Outside the group: it sits below
    # the placement box, which the bounds check holds every named node to.
    a.box('sofa_plinth_strip', (x-side*(w/2-.10), y, z-h/2+.012), (.16, d-.10, .012), 'led.cove', 0)
    (x,y,z), (w,d,h) = a.placement('slideout_bed')
    # The perimeter foundation retains the published 1280 x 1900 mm outline.
    parts = [a.box('bed mattress foundation', (x,y,z-h/2+.025), (w,d,.05), 'upholstery.sofa', .018)]
    for row in range(3):
        for col in range(2):
            parts.append(a.box('stitched sofa cushion', (x-w/2+(col+.5)*w/2,y-d/2+(row+.5)*d/3,z+.025),
                               (w/2-.012,d/3-.012,.15), 'upholstery.sofa', .04))
    a.group('slideout_bed', parts)
    # The deployed slide-out is a bed, but the reference keeps a back cushion against the
    # outboard wall rather than laying every cushion flat. Deliberately NOT joined into
    # slideout_bed: the cushion rises above that placement box, which carries the published
    # 1280 x 1900 footprint and is checked to the millimetre. Measured off the bed's own
    # outboard face, so it follows the flank.
    a.box('slideout_back', (x+side*(w/2-.07), y, .74), (.12, d-.04, .28), 'upholstery.sofa', .03)


def build_alcove_bed(a):
    (x,y,z), (w,d,h) = a.placement('alcove_bed')
    parts = [a.box('alcove deck', (x,y,z-h/2+.025), (w,d,.05), 'panel.locker', .016),
             a.box('alcove mattress', (x,y,z+.025), (w,d,.15), 'upholstery.sofa', .055)]
    a.group('alcove_bed', parts)
    (x,y,z), (w,d,h) = a.placement('alcove_lockers')
    parts = [a.box('alcove locker carcass', (x,y-.023,z), (w,d-.046,h), 'wood.cabinet', .018)]
    for i in range(3):
        cx = x-w/2+(i+.5)*w/3
        parts.append(a.box('alcove cream door', (cx,y+d/2-.030,z), (w/3-.018,.024,h-.038), 'panel.locker', .035))
        parts.append(a.box('alcove pull', (cx,y+d/2-.009,z-.1), (.12,.018,.02), 'metal.brushed', .006))
    a.group('alcove_lockers', parts)
    # Reading lights either side of the head wall and a small screen at the kerb end, both of
    # which the video shows. Detail meshes: they hang off the locker run rather than filling a
    # volume of their own.
    for sx in (-.62, .62):
        a.cylinder('alcove_reading_light', (sx, y+d/2-.004, z-.20), .028, .014, 'led.cove',
                   rotation=(1.5708, 0, 0))
    a.box('alcove_screen', (.80, y+d/2-.010, z-.21), (.34, .020, .20), 'graphic.screen', .006)


def build_lockers(a):
    for name in ('lockers_kerb', 'lockers_off'):
        (x,y,z), (w,d,h) = a.placement(name)
        # Doors face the aisle, so the direction is the inboard one: away from the flank the
        # run hugs. Derived, because the two runs swap flanks when the cabin mirrors.
        direction = -1 if x > 0 else 1
        parts = [a.box('locker walnut case', (x-direction*.024,y,z), (w-.048,d,h), 'wood.cabinet', .025)]
        face = x + direction*(w/2-.034)
        for i in range(3):
            cy = y-d/2+(i+.5)*d/3
            # Cream doors inset into a walnut frame, per the reference. The carcass is already
            # walnut, so the frame is a wider reveal rather than a second box: at the old
            # 18/48 mm insets it read as a hairline, and a separate surround would have to be
            # positioned per run — the two runs are 2.5 m apart, the kerb pair riding the
            # slide-out at x 1.28 to 1.73.
            parts.append(a.box('rounded cream locker door', (face,cy,z), (.035,d/3-.05,h-.10), 'panel.locker', .028))
            parts.append(a.box('locker pull', (x+direction*(w/2-.009),cy,z-.13), (.018,.12,.02), 'metal.brushed', .006))
        a.group(name, parts)
        # Under-locker LED strip. Outside the group deliberately: it hangs below the placement
        # box, which the bounds check holds every named node to.
        a.box('locker_strip', (face, y, z-h/2-.006), (.09, d-.04, .010), 'led.cove', 0)


def build_cab(a):
    for name in ('cab_seat_off','cab_seat_kerb'):
        _chair(a, name, -1, True)
    parts = [a.box('dashboard main', (0,-1.78,.70), (1.85,.29,.24), 'upholstery.bolster', .075),
             a.box('dashboard upper', (0,-1.77,.845), (1.85,.30,.07), 'upholstery.seat', .035),
             a.box('centre console', (0,-1.61,.65), (.34,.13,.29), 'upholstery.bolster', .028)]
    for x in (-.70,-.35,.35,.70):
        parts.append(a.box('dashboard vent', (x,-1.621,.77), (.16,.014,.055), 'metal.brushed', .01))
    circle = [(-.625+.16*math.cos(t*math.tau/32),-1.56+.05*math.sin(t*math.tau/32),.90+.15*math.sin(t*math.tau/32)) for t in range(33)]
    parts.append(a.tube('steering wheel', circle,.017,'metal.brushed'))
    # Black-clad tunnel between the seats. Without it the cab renders as an empty white void,
    # and the photographs show it as the dominant mass down there.
    parts.append(a.box('cab_tunnel', (0,-1.30,.28), (.52,1.20,.56), 'metal.dark', .04))
    # Left-hand drive, so the binnacle and wheel hub sit on the off side.
    parts.append(a.box('cab_dash_binnacle', (-.62,-1.78,.96), (.62,.26,.22), 'metal.dark', .03))
    parts.append(a.cylinder('cab_wheel_hub', (-.625,-1.56,.90), .062, .050, 'metal.dark',
                            rotation=(1.15, 0, 0)))
    a.group('cab_dashboard', parts)


def build_galley(a):
    (x, y, z), (run_len, depth, height) = a.placement('galley_run')
    # The run backs onto the REAR wall and faces forward, so its length is X, across the vehicle,
    # and its depth is Y. The flank-run builder this replaces had those two axes the other way
    # round, which is why it is a rewrite rather than a retune: 后上门 turned out to be a door in
    # the kerb flank, and the room is arranged about the path leading in from it.
    #
    # The discipline is unchanged. Everything across the run is measured from the wall face or
    # the aisle face and everything along it from the run's own two ends, so a resize cannot
    # strand a constant — which is what stranded four of them the last time this moved.
    back, front = y + depth / 2, y - depth / 2      # rear wall face, aisle face
    to_aisle = lambda face, dist: face - dist
    to_wall = lambda face, dist: face + dist
    x0, x1 = x - run_len / 2, x + run_len / 2       # off end, beside the pod; kerb end
    parts = [a.box('galley base floor', (x, y, .045), (run_len, depth, .09), 'wood.cabinet', .016),
             a.box('galley back panel', (x, to_aisle(back, .015), .45), (run_len, .03, .80),
                   'wood.cabinet', .008)]
    # Four strips make an actual countertop opening around the recessed bowl. The basin sits
    # under the rear window, which is where the 3:56 and 4:26 frames put it, and the hob toward
    # the kerb end so the cook stands clear of the boarding door.
    lip = .058                                      # half-width of the counter's front and back rails
    bowl_r = min(.21, (depth - 4 * lip) / 2 - .01)
    sink_x = .09                                    # the rear window's own centre
    split = sink_x + bowl_r
    hob_len = min(.42, (x1 - split) - .18)
    hob_x = x1 - .12 - hob_len / 2
    parts.extend([
        a.box('counter front length', (x, to_wall(front, lip), .879), (run_len, 2 * lip, .042), 'worktop', .01),
        a.box('counter rear length', (x, to_aisle(back, lip), .879), (run_len, 2 * lip, .042), 'worktop', .01),
        a.box('counter hob field', ((split + x1) / 2, y, .879), (x1 - split, depth - 4 * lip, .042), 'worktop', .01),
        a.box('counter off end', ((x0 + sink_x - bowl_r) / 2, y, .879),
              (sink_x - bowl_r - x0, depth - 4 * lip, .042), 'worktop', .01),
        a.bowl('composite sink', (sink_x, y, .886), (bowl_r, bowl_r), .14, 'metal.dark', corner=.3)])
    # Fittings are sized off the bay, not off a fixed constant.
    bay = run_len / 4
    for j in range(4):
        cx = x0 + (j + .5) * bay
        if j == 0:
            # The bay beside the pod holds the electrical gear: the 5 kg washer is outside,
            # in its hatch on the kerb flank, so this is a service cabinet with a systems panel
            # on its door rather than an appliance fascia.
            parts.append(a.box('electrical_cabinet', (cx, to_wall(front, .036), .43), (bay - .02, .028, .77), 'wood.cabinet', .012))
            parts.append(a.box('electrical_panel', (cx, to_wall(front, .018), .66), (min(.22, bay - .18), .026, .10), 'graphic.screen', .006))
            parts.append(a.box('electrical_vent', (cx, to_wall(front, .016), .28), (min(.26, bay - .14), .022, .12), 'metal.brushed', .006))
            continue
        parts.append(a.box('galley cabinet door', (cx, to_wall(front, .036), .43), (bay - .02, .028, .77), 'wood.cabinet', .012))
        parts.append(a.box('long cabinet pull', (cx, to_wall(front, .011), .74), (min(.34, bay - .06), .022, .023), 'metal.chrome', .007))
    a.group('galley_run', parts)
    parts = []
    parts.append(a.box('induction glass', (hob_x, y, .906), (hob_len, depth - .18, .017), 'metal.dark', .022))
    for cx, radius in [(hob_x - hob_len / 4, hob_len * .21), (hob_x + hob_len / 4, hob_len * .16)]:
        circle = [(cx + radius * math.cos(t * math.tau / 32), y + radius * math.sin(t * math.tau / 32), .917)
                  for t in range(33)]
        parts.append(a.tube('induction ring', circle, .003, 'metal.chrome'))
    parts.append(a.tube('black gooseneck', [(sink_x, to_aisle(back, r), zz) for r, zz in
                                            [(.11, .90), (.11, 1.11), (.12, 1.17), (.17, 1.20),
                                             (.25, 1.20), (.30, 1.17), (.30, 1.12)]], .012, 'metal.dark'))
    # Black pegboard accessory wall. The rear window's aperture is the constraint: it spans
    # x -0.36 to 0.54, and with the pod now taking the rear-off corner the run starts at -0.28,
    # so the only clear stretch of backsplash left is the kerb end. Measured from x1 rather than
    # x0 for that reason -- anchored to the off end it would hang across the glazing.
    board_x1 = x1 - .03
    board_x0 = board_x1 - .30
    parts.append(a.box('galley_pegboard', ((board_x0 + board_x1) / 2, to_aisle(back, .014), 1.125),
                       (board_x1 - board_x0, .022, .42), 'metal.dark', .004))
    for level in (.98, 1.05, 1.12, 1.19, 1.26):
        parts.append(a.box('pegboard slat', ((board_x0 + board_x1) / 2, to_aisle(back, .030), level),
                           (board_x1 - board_x0 - .03, .012, .012), 'metal.brushed', .003))
    a.group('galley_appliances', parts)
    (x, y, z), (run_len, depth, height) = a.placement('galley_overhead')
    back, front = y + depth / 2, y - depth / 2
    x0, x1 = x - run_len / 2, x + run_len / 2
    parts = [a.box('overhead walnut carcass', (x, to_aisle(y, .022), z), (run_len, depth - .044, height), 'wood.cabinet', .016)]
    bay = run_len / 4
    for i in range(4):
        cx = x0 + (i + .5) * bay
        parts.append(a.box('overhead walnut door', (cx, to_wall(front, .032), z), (bay - .015, .023, height - .024), 'wood.cabinet', .016))
        parts.append(a.box('overhead handle', (cx, to_wall(front, .008), z - .12), (.12, .016, .023), 'metal.chrome', .006))
    # Extractor hood: brushed stainless, stepped, and louvred. The walkaround shows a bright
    # stainless canopy stepping down toward the aisle over a run of dark intake slots, and it is
    # the largest object in frame at the galley stop.
    hood_w = min(.48, hob_len + .08)
    a.box('extractor_hood', (hob_x, to_aisle(y, .02), z - height / 2 - .040), (hood_w, depth - .04, .07), 'metal.brushed', .014)
    a.box('extractor_lip', (hob_x, to_aisle(y, .10), z - height / 2 - .092), (hood_w - .06, depth - .20, .045), 'metal.brushed', .012)
    # Slots across the underside, on the same pattern as the rear vent's blades and for the same
    # reason: fine dark lines over a bright face read as a grille where a texture cannot.
    for i in range(5):
        a.box('hood_slot', (hob_x + (i - 2) * .048, to_aisle(y, .10), z - height / 2 - .114),
              (.014, depth - .26, .008), 'metal.dark', .003)
    a.group('galley_overhead', parts)
    # The 3-in-1 combi oven, in its own tall shelf against the kerb flank forward of the door —
    # on your right as you come in, where the updated brief puts it. It used to be set into the
    # overhead run, which no longer passes anywhere near the entry.
    (x, y, z), (w, d, h) = a.placement('galley_oven')
    faces = y + d / 2                                # the shelf fronts the entry path, aft
    parts = [a.box('oven shelf carcass', (x + .022, y - .022, z), (w - .044, d - .044, h), 'wood.cabinet', .018)]
    oven_h = .46
    oven_z = z - h / 2 + .95                         # worktop-plus, the usual built-in height
    parts.append(a.box('oven', (x, y - .06, oven_z), (w - .12, d - .12, oven_h), 'metal.dark', .015))
    # Dark glass door with a control strip above it, not a lit panel the size of the door. At
    # full size the graphic.screen emissive read as a glowing blue rectangle where the video
    # shows black glass. Both proud of the shelf's own front face, or they render inside it.
    parts.append(a.box('oven_door', (x, faces - .026, oven_z - .03), (w - .19, .014, oven_h - .14), 'glass', .006))
    parts.append(a.box('oven_fascia', (x, faces - .024, oven_z + oven_h / 2 - .055), (w - .22, .016, .055), 'graphic.screen', .004))
    # Open shelves above it and a drawer below, which is what makes it read as a shelf column
    # rather than a cabinet with an oven buried in it.
    for level in (oven_z + oven_h / 2 + .20, oven_z + oven_h / 2 + .48):
        parts.append(a.box('oven shelf board', (x, y - .03, level), (w - .07, d - .09, .022), 'wood.cabinet', .008))
    parts.append(a.box('oven drawer', (x, faces - .040, z - h / 2 + .22), (w - .09, .028, .34), 'wood.cabinet', .012))
    parts.append(a.box('oven drawer pull', (x, faces - .016, z - h / 2 + .32), (min(.34, w - .16), .022, .023), 'metal.chrome', .007))
    a.group('galley_oven', parts)
    # The fridge and the wardrobe front the aisle from opposite flanks; their door direction is
    # the inboard one, so it derives from which side of the centreline each sits on.
    for name in ('fridge','wardrobe'):
        (x,y,z),(w,d,h)=a.placement(name)
        direction = -1 if x > 0 else 1
        parts=[a.box(name+' carcass',(x-direction*.03,y,z),(w-.06,d,h),'wood.cabinet',.018)]
        face_x=x+direction*(w/2-.043)
        if name=='fridge':
            for low,high in [(.05,1.27),(1.29,1.77)]:
                parts.append(a.box('dark fridge door',(face_x,y,(low+high)/2),(.025,d-.024,high-low),'metal.dark',.015))
                parts.append(a.box('fridge handle',(face_x+direction*.028,y-.12,high-.17),(.03,.025,.22),'metal.chrome',.008))
        else:
            parts.append(a.box('wardrobe door',(face_x,y,z),(.024,d-.022,h-.035),'wood.cabinet',.012))
            parts.append(a.box('wardrobe handle',(face_x+direction*.028,y-.11,z),(.02,.02,.32),'metal.chrome',.008))
        a.group(name,parts)


def _pleat(a,name,x,y,z,width,height,axis='y'):
    """Small actual folded cloth surface, no texture or extra material needed."""
    import bpy
    obj=a.box(name,(x,y,z),(.01,.01,.01),'textile.curtain',0)
    verts=[]
    segments=48
    for row in range(5):
        for i in range(segments+1):
            u=i/segments
            fold=.017*math.cos(u*math.tau*12)*(1-.16*math.sin(row*math.pi/4))
            along=(u-.5)*width
            verts.append((x+fold if axis=='y' else x+along,y+along if axis=='y' else y+fold,z+height*(row/4-.5)))
    faces=[]
    for row in range(4):
        for i in range(segments):
            n=row*(segments+1)+i
            faces.append((n,n+1,n+segments+2,n+segments+1))
    old=obj.data
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.materials.append(old.materials[0])
    obj.data=mesh
    obj.location=(0,0,0)
    bpy.data.meshes.remove(old)
    for poly in mesh.polygons:
        poly.use_smooth=True
    return obj


def build_softgoods(a):
    parts=[]
    # Lounge window curtains on the off wall, slide-out ones on the kerb flank's slide wall.
    for x,y0,y1 in [(-1.125,.29,1.83),(1.70,.32,1.89)]:
        for y in (y0,y1):
            parts.append(_pleat(a,'gathered lounge curtain',x,y,1.17,.15,.55))
    for x in (-1.075,1.075):
        parts.append(_pleat(a,'alcove curtain',x,-.58,1.59,.31,.53))
    for y in (.38,1.80):
        pillow=a.box('sofa scatter cushion',(1.49,y,.77),(.16,.34,.30),'textile.curtain',.07)
        pillow.rotation_euler[1]=.18
        parts.append(pillow)
    parts.append(a.box('alcove folded duvet',(.17,-.72,1.38),(1.55,1.17,.06),'textile.curtain',.035))
    for y in (-1.05,-.39):
        parts.append(a.box('alcove pillow',(-.76,y,1.42),(.44,.53,.13),'textile.curtain',.06))
    a.group('softgoods_fabric',parts)
    # Equipment the photographs show and the model lacked. All detail meshes: none of them is a
    # volume of its own, they are faces applied to walls and cabinetry. Every position here is
    # chosen for visibility -- the kerb wall the reference hangs these on is covered end to end
    # by the galley run and the wardrobe, so a panel on it renders inside a cupboard.
    a.box('systems_panel',(.630,2.225,1.55),(.020,.20,.26),'graphic.screen',.004)
    # Framed calligraphy plaque and the small exterior-camera monitor. The video hangs both on
    # the lounge side walls; here those walls are window below 1.40 and locker run above it, so
    # both go on the partition's lounge face, flanking the doorway, where they read from the
    # lounge stop. Recorded as a deliberate relocation rather than a missing prop.
    a.box('decal_plaque',(-.72,2.494,1.34),(.26,.012,.34),'graphic.print',0)
    a.box('lounge_monitor',(.66,2.492,1.36),(.30,.016,.19),'graphic.screen',.006)
    for name, x, y, z, wide, high in (
            # Wardrobe and fridge faces, both of which front the aisle.
            ('decal_galley_wall', -.575, 2.80, 1.30, .22, .26),
            # Alcove flanks, forward of the window openings cut into them.
            ('decal_alcove_off', -1.094, -1.27, 1.60, .22, .28),
            ('decal_alcove_kerb', 1.094, -1.27, 1.60, .22, .28)):
        a.box(name, (x, y, z), (.006, wide, high), 'graphic.print', 0)


def build_washroom(a):
    """Corner vanity, mirror cabinet, ribbed shell, recessed niches and a drawn curtain.

    The pod is a 900 x 940 mm moulding in the rear corner, off flank. Which flank it hugs follows from
    which side of the centreline it sits on, so `side` is derived rather than written down: every
    position here is measured from the pod's outer wall or its inboard opening, and mirroring the
    pod across the cabin is a data change. Absolute metres are what stranded the basin, the
    toilet and the curtain behind their own walls the last time this moved.
    """
    (x,y,z), (w,d,h) = a.placement('washroom_pod')
    side = 1 if x > 0 else -1              # +1: outer wall on the kerb flank
    outer, inner = x+side*w/2, x-side*w/2  # solid flank, aisle opening
    y0, y1 = y-d/2, y+d/2                  # forward opening, rear wall
    # The outer wall is pierced for the roller-blind window, which lines up with an opening cut
    # through the vehicle's own off wall behind it. Four pieces around the aperture rather than
    # one slab, on the same principle as model_interior.wall(): anything spanning the opening
    # renders the glazing behind it black from inside the pod.
    win_a, win_b, win_lo, win_hi = y+.10, y+.35, 1.28, 1.62
    ow = outer-side*.025
    parts = [a.box('wetroom tray',(x,y,.047),(w,d,.09),'washroom.shell',.04),
             a.box('moulded rear wall',(x,y1-.025,z),(w,.05,h),'washroom.shell',.024)]
    for cy, cd in ((( y0+win_a)/2, win_a-y0), ((win_b+y1)/2, y1-win_b)):
        parts.append(a.box('moulded outer wall',(ow,cy,z),(.05,cd,h),'washroom.shell',.022))
    for cz, ch in (((z-h/2+win_lo)/2, win_lo-(z-h/2)), ((win_hi+z+h/2)/2, z+h/2-win_hi)):
        parts.append(a.box('moulded outer wall',(ow,(win_a+win_b)/2,cz),(.05,win_b-win_a,ch),'washroom.shell',.022))
    # Rounded junction of two real walls; the aisle opening remains accessible.
    radius=.14
    cx=outer-side*(radius+.022)
    cy=y1-radius-.022
    for i in range(12):
        angle=(i+.5)*math.pi/24
        wall=a.box('curved GRP corner',(cx+side*radius*math.cos(angle),cy+radius*math.sin(angle),z),(.04,.022,h),'washroom.shell',.009)
        wall.rotation_euler[2]=side*angle
        parts.append(wall)
    slats=max(1,int((d-.10)/.10))
    pitch=(d-.10)/slats
    for j in range(slats):
        parts.append(a.box('teak duckboard slat',(x,y0+.05+(j+.5)*pitch,.107),(w-.10,pitch*.80,.028),'washroom.duckboard',.006))

    # Corner vanity with a mirror cabinet over it, in the forward corner against the outer wall.
    # Both are sized off the pod so a shorter pod does not put the basin through the toilet.
    vanity_w = min(.50, w-.34)
    vanity_d = min(.36, d-.64)
    basin_x = outer-side*(.05+vanity_w/2)
    basin_y = y0+.01+vanity_d/2
    parts.append(a.box('washroom_vanity',(basin_x,basin_y,.40),(vanity_w,vanity_d,.80),'washroom.shell',.03))
    parts.append(a.bowl('washroom_basin',(basin_x,basin_y,.82),(vanity_w/2-.06,vanity_d/2-.04),.10,'washroom.shell',corner=.6))
    parts.append(a.tube('vanity chrome tap',[(outer-side*.03,basin_y,.80),(outer-side*.03,basin_y,.95),(outer-side*.08,basin_y,.97),(outer-side*.13,basin_y,.95)],.012,'metal.chrome'))
    parts.append(a.box('washroom_mirror_cabinet',(basin_x,y0+.06,1.42),(vanity_w,.12,.52),'washroom.shell',.02))
    parts.append(a.box('mirror',(basin_x,y0+.126,1.42),(vanity_w-.06,.012,.44),'metal.chrome',.01))

    # Ribbed shell: horizontal mouldings on the outer wall, which is what the photograph shows
    # and what the washroom.shell map alone is too subtle to suggest.
    for level in (.45,.85,1.25,1.65):
        parts.append(a.box('washroom_ribs',(outer-side*.058,y,level),(.02,d-.10,.05),'washroom.shell',.008))
    # Ceiling vent fan flanked by two downlights, per the video.
    parts.append(a.box('washroom_vent',(x,y,h-.03),(.20,.20,.03),'metal.brushed',.006))
    for i in range(4):
        parts.append(a.box('vent blade',(x,y-.07+i*.045,h-.045),(.17,.018,.014),'metal.dark',.003))
    for dy in (-.24,.24):
        parts.append(a.cylinder('washroom_downlight',(x,y+dy,h-.045),.032,.008,'led.cove'))
    # Retractable clothesline across the shower end, at head height.
    parts.append(a.tube('washroom_clothesline',[(outer-side*.06,y1-.30,1.72),(inner+side*.10,y1-.30,1.72)],.004,'metal.chrome'))
    parts.append(a.box('clothesline reel',(outer-side*.06,y1-.30,1.72),(.05,.05,.05),'washroom.shell',.012))

    # Recessed, not projecting: the GRP pod is a single moulding, so shelves are formed into it.
    for i, level in enumerate((1.02,1.30)):
        parts.append(a.box(f'washroom_niche_{i}',(outer-side*.05,y0+.70,level),(.06,.44,.16),'washroom.shell',.012))
        parts.append(a.tube('niche retaining rail',[(outer-side*.085,y0+.50,level+.055),(outer-side*.085,y0+.90,level+.055)],.007,'metal.chrome'))

    toilet_x=inner+side*.23
    parts.append(a.box('toilet pedestal',(toilet_x,y1-.33,.22),(.32,.43,.22),'washroom.shell',.11))
    parts.append(a.bowl('toilet pan',(toilet_x,y1-.35,.49),(.18,.23),.15,'washroom.shell'))
    parts.append(a.box('toilet raised lid',(toilet_x,y1-.15,.61),(.34,.055,.40),'washroom.shell',.10))
    parts.append(a.box('toilet cistern',(toilet_x,y1-.11,.38),(.37,.13,.47),'washroom.shell',.045))
    parts.append(a.tube('shower riser',[(outer-side*.11,y1-.47,.95),(outer-side*.11,y1-.47,1.73),(outer-side*.19,y1-.47,1.78)],.011,'metal.chrome'))
    parts.append(a.cylinder('shower head',(outer-side*.22,y1-.47,1.76),.065,.022,'metal.chrome'))
    parts.append(a.tube('shower hose',[(outer-side*.10,y1-.47,1.05),(outer-side*.18,y1-.58,.76),(outer-side*.22,y1-.58,.81),(outer-side*.14,y1-.47,1.30)],.007,'metal.chrome'))

    # Damask curtain on a chrome rail across the inboard opening, gathered against the rear end
    # rather than drawn: full width, it stands between the hotspot and everything the hotspot
    # exists to show. Its length is a fraction of the rail's, so a shorter pod gathers it tighter
    # instead of curtaining the whole opening off.
    rail_a, rail_b = y0+.30, y1-.09
    gathered = (rail_b-rail_a)*.47
    parts.append(a.tube('washroom_rail',[(inner+side*.03,rail_a,1.86),(inner+side*.03,rail_b,1.86)],.010,'metal.chrome'))
    parts.append(a.box('washroom_curtain',(inner+side*.03,rail_b-gathered/2,1.05),(.014,gathered,1.55),'textile.curtain',.004))
    # Grab handle on the rear wall, clear of the cistern below and the niches outboard.
    parts.append(a.tube('washroom_grab',[(outer-side*.05,y1-.09,1.10),(outer-side*.45,y1-.09,1.10)],.012,'metal.chrome'))
    a.group('washroom_pod',parts)

    # Hinged walnut door, chrome lever, full-length mirror on the outer face — the panel the
    # walkthrough shows from the lounge, through the partition doorway. A detail mesh rather than
    # a placement: a leaf swung into the aisle would overlap washroom_pod, which is exactly what
    # the overlap check exists to forbid, and the spec already records that appliances and doors
    # built into other volumes cannot be placements.
    #
    # Modelled open, flat against the pod's inboard face, and hinged at the AFT end. Two
    # constraints fix that: the hotspot sightline crosses this plane at y 3.32, so a leaf hung
    # from the forward jamb would stand between the camera and everything it exists to show; and
    # a leaf swung out into the aisle would cross the centreline and break the ray fired in from
    # the rear side door.
    leaf = inner+side*.018                 # just outboard of the opening, in the aisle
    face = inner+side*.036                 # its aisle-facing side, where the mirror goes
    door_y = y1-.35
    a.box('washroom_door',(leaf,door_y,.925),(.035,.70,1.85),'wood.cabinet',.010)
    a.box('washroom_door_mirror',(face,door_y,1.02),(.012,.58,1.30),'metal.chrome',.006)
    a.box('washroom_door_lever',(face,door_y-.29,.95),(.022,.12,.026),'metal.chrome',.008)
