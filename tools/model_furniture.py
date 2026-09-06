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
    parts.append(a.cylinder('swivel pedestal', (x, y, bottom+.30), .09, .1, 'metal.brushed'))
    box('seat bolster', (0, .012, .415), (w-.025, d-.025, .17), 'upholstery.bolster', .065)
    box('seat inset', (0, .025, .497), (w-.15, d-.12, .034), 'upholstery.seat', .045)
    box('back bolster', (0, -.187, .755), (w-.025, .145, .43), 'upholstery.bolster', .055)
    for level in (.65, .80, .92):
        box('back padded panel', (0, -.102, level), (w-.17, .04, .115), 'upholstery.seat', .026)
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
             a.box('pedestal foot', (x,y,.022), (.36,.32,.04), 'metal.chrome', .055)]
    a.group('dinette_table', parts)


def build_sofa_slideout(a):
    (x,y,z), (w,d,h) = a.placement('slideout_base')
    # The slide deploys to the kerb flank, so the plinth is flush outboard at +x and the
    # drawers face the aisle at -x. Everything lateral is measured from the base's own two
    # ends rather than from a signed constant, which is what made the mirror a sign flip.
    parts = [a.box('walnut bed plinth', (x+.02,y,z), (w-.04,d,h), 'wood.cabinet', .02)]
    for j in range(3):
        cy = y-d/2+(j+.5)*d/3
        parts.append(a.box('sofa drawer', (x-w/2+.029,cy,z), (.022,d/3-.025,h-.055), 'wood.cabinet', .009))
        parts.append(a.box('sofa drawer pull', (x-w/2+.009,cy,z+.07), (.018,.14,.025), 'metal.brushed', .007))
    a.group('slideout_base', parts)
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
    # 1280 x 1900 footprint and is checked to the millimetre.
    a.box('slideout_back', (1.66, 1.10, .74), (.12, 1.86, .28), 'upholstery.sofa', .03)


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


def build_lockers(a):
    for name, direction in [('lockers_kerb', -1), ('lockers_off', 1)]:
        (x,y,z), (w,d,h) = a.placement(name)
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
    (x,y,z), (w,d,h) = a.placement('galley_run')
    # 后置厨房: the run is against the REAR wall and runs across the vehicle, so `w` is its
    # length and `d` its counter depth — the transpose of the kerb-flank run this replaces.
    # Everything lateral is measured from the run's own two ends and everything fore-aft from
    # its two faces, so the module is correct at any length. Hard-coded offsets are what broke
    # the last time this run was resized.
    x0, x1 = x-w/2, x+w/2                    # off end, aisle end
    front, back = y-d/2, y+d/2               # aisle face, rear wall face
    parts = [a.box('galley base floor', (x,y,.045), (w,d,.09), 'wood.cabinet', .016),
             a.box('galley back panel', (x,back-.015,.45), (w,.03,.80), 'wood.cabinet', .008)]
    # Four strips make an actual countertop opening around the recessed bowl.
    # Reference: square stainless bowl nearest the aisle end, induction hob at the far end, so
    # the cook works away from the boarding door rather than across it.
    lip = .058                               # half-width of the counter's front and back rails
    bowl_r = min(.21, (d-4*lip)/2-.01)       # square bowl, inside the rails
    sink_x = x1-.09-bowl_r
    split = sink_x-bowl_r                    # where the bowl opening ends and the run resumes
    hob_len = min(.42, (split-x0)-.20)
    hob_x = x0+.10+hob_len/2
    parts.extend([
        a.box('counter front length', (x,front+lip,.879), (w,2*lip,.042), 'worktop', .01),
        a.box('counter rear length', (x,back-lip,.879), (w,2*lip,.042), 'worktop', .01),
        a.box('counter hob field', ((x0+split)/2,y,.879), (split-x0,d-4*lip,.042), 'worktop', .01),
        a.box('counter aisle end', ((x1+sink_x+bowl_r)/2,y,.879), (x1-sink_x-bowl_r,d-4*lip,.042), 'worktop', .01),
        a.bowl('stainless sink', (sink_x,y,.886), (bowl_r,bowl_r), .14, 'metal.chrome', corner=.3)])
    # Fittings are sized off the bay, not off a fixed constant.
    bay = w/3
    for j in range(3):
        cx = x0+(j+.5)*bay
        if j == 2:
            # The 5 kg washer-dryer takes the aisle-end bay, under the sink plumbing. Given a
            # wooden door in front of it, it would be a box nobody can see, so it is the door.
            parts.append(a.box('washer',(cx,front+.036,.43),(bay-.02,.028,.77),'metal.brushed',.012))
            parts.append(a.box('washer_door',(cx,front+.018,.40),(min(.34,bay-.06),.026,.34),'metal.dark',.15))
            parts.append(a.box('washer_fascia',(cx,front+.018,.70),(min(.30,bay-.10),.026,.09),'graphic.screen',.008))
            continue
        parts.append(a.box('galley cabinet door',(cx,front+.036,.43),(bay-.02,.028,.77),'wood.cabinet',.012))
        parts.append(a.box('long cabinet pull',(cx,front+.011,.74),(min(.34,bay-.06),.022,.023),'metal.chrome',.007))
    a.group('galley_run',parts)
    parts=[]
    parts.append(a.box('induction glass',(hob_x,y,.906),(hob_len,.42,.017),'metal.dark',.022))
    for cx,radius in [(hob_x+hob_len/4,hob_len*.21),(hob_x-hob_len/4,hob_len*.16)]:
        circle = [(cx+radius*math.cos(t*math.tau/32),y+radius*math.sin(t*math.tau/32),.917) for t in range(33)]
        parts.append(a.tube('induction ring',circle,.003,'metal.chrome'))
    parts.append(a.tube('black gooseneck',[(sink_x,y+.19,.90),(sink_x,y+.19,1.11),(sink_x,y+.18,1.17),(sink_x,y+.13,1.20),(sink_x,y+.05,1.20),(sink_x,y,1.17),(sink_x,y,1.12)],.012,'metal.dark'))
    a.group('galley_appliances',parts)
    (x,y,z),(w,d,h)=a.placement('galley_overhead')
    x0, x1 = x-w/2, x+w/2
    front, back = y-d/2, y+d/2
    parts=[a.box('overhead walnut carcass',(x,y+.022,z),(w,d-.044,h),'wood.cabinet',.016)]
    bay = w/3
    for i in range(3):
        cx=x0+(i+.5)*bay
        parts.append(a.box('overhead walnut door',(cx,front+.032,z),(bay-.015,.023,h-.024),'wood.cabinet',.016))
        parts.append(a.box('overhead handle',(cx,front+.008,z-.12),(.12,.016,.023),'metal.chrome',.006))
    a.box('extractor_hood',(hob_x,y-.02,z-h/2-.045),(min(.48,hob_len+.08),d-.04,.09),'metal.dark',.02)
    a.group('galley_overhead',parts)
    # Microwave/steam oven, set into the overhead run at its aisle end.
    oven_len = min(.42, w*.35)
    oven_x = x1-.05-oven_len/2
    a.box('oven',(oven_x,y-.06,z),(oven_len,d-.12,h-.06),'metal.dark',.015)
    # Proud of the oven's own front face, or it renders inside the box it labels.
    a.box('oven_fascia',(oven_x,front-.004,z),(oven_len-.08,.016,h-.16),'graphic.screen',.006)
    for name,direction in [('fridge',1),('wardrobe',-1)]:
        (x,y,z),(w,d,h)=a.placement(name)
        parts=[a.box(name+' carcass',(x-direction*.03,y,z),(w-.06,d,h),'wood.cabinet',.018)]
        face_x=x+direction*(w/2-.043)
        if name=='fridge':
            for low,high in [(.05,1.27),(1.29,1.77)]:
                parts.append(a.box('dark fridge door',(face_x,y,(low+high)/2),(.025,d-.024,high-low),'metal.dark',.015))
                parts.append(a.box('fridge handle',(face_x+direction*.028,y-.12,high-.17),(.03,.025,.22),'metal.chrome',.008))
        else:
            parts.append(a.box('wardrobe door',(face_x,y,z),(.024,d-.022,h-.035),'wood.cabinet',.012))
            parts.append(a.box('wardrobe handle',(face_x-.028,y-.11,z),(.02,.02,.32),'metal.chrome',.008))
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
    for name, x, y, z, wide, high in (
            # Wardrobe and fridge faces, both of which front the aisle.
            ('decal_galley_wall', -.548, 2.30, 1.30, .22, .26),
            # Alcove flanks, forward of the window openings cut into them.
            ('decal_alcove_off', -1.094, -1.27, 1.60, .22, .28),
            ('decal_alcove_kerb', 1.094, -1.27, 1.60, .22, .28)):
        a.box(name, (x, y, z), (.006, wide, high), 'graphic.print', 0)


def build_washroom(a):
    """Corner vanity, mirror cabinet, ribbed shell, recessed niches and a drawn curtain.

    The pod is an 800 x 900 mm moulding — 100 mm wider and 500 mm shorter than it was, because
    the galley took the rear wall — so almost nothing here has room to move. Every position is
    derived from the pod's own four faces rather than written out in absolute metres, which is
    what let the pod be resized at all: the previous version's fixed offsets left the basin,
    the toilet and the curtain 500 mm behind the wall they were measured from.
    """
    (x,y,z), (w,d,h) = a.placement('washroom_pod')
    x0, x1 = x-w/2, x+w/2                  # outer wall, inboard opening
    y0, y1 = y-d/2, y+d/2                  # forward opening, rear wall
    parts = [a.box('wetroom tray',(x,y,.047),(w,d,.09),'washroom.shell',.04),
             a.box('moulded outer wall',(x0+.025,y,z),(.05,d,h),'washroom.shell',.022),
             a.box('moulded rear wall',(x,y1-.025,z),(w,.05,h),'washroom.shell',.024)]
    # Rounded junction of two real walls; the aisle opening remains accessible.
    radius=.14
    cx=x0+radius+.022
    cy=y1-radius-.022
    for i in range(12):
        angle=(i+.5)*math.pi/24
        wall=a.box('curved GRP corner',(cx-radius*math.cos(angle),cy+radius*math.sin(angle),z),(.04,.022,h),'washroom.shell',.009)
        wall.rotation_euler[2]=-angle
        parts.append(wall)
    slats=max(1,int((d-.10)/.10))
    pitch=(d-.10)/slats
    for j in range(slats):
        parts.append(a.box('teak duckboard slat',(x,y0+.05+(j+.5)*pitch,.107),(w-.10,pitch*.80,.028),'washroom.duckboard',.006))

    # Corner vanity with a mirror cabinet over it, in the forward-outer corner. Shallower than
    # before: at 900 mm of depth a 400 mm vanity and the toilet pan would share floor.
    basin_x, basin_y = x0+.20, y0+.13
    parts.append(a.box('washroom_vanity',(basin_x,basin_y,.40),(.40,.26,.80),'washroom.shell',.03))
    parts.append(a.bowl('washroom_basin',(basin_x,basin_y,.82),(.15,.115),.10,'washroom.shell',corner=.6))
    parts.append(a.tube('vanity chrome tap',[(x0+.03,basin_y,.80),(x0+.03,basin_y,.95),(x0+.08,basin_y,.97),(x0+.13,basin_y,.95)],.012,'metal.chrome'))
    parts.append(a.box('washroom_mirror_cabinet',(basin_x,y0+.06,1.42),(.40,.12,.52),'washroom.shell',.02))
    parts.append(a.box('mirror',(basin_x,y0+.126,1.42),(.34,.012,.44),'metal.chrome',.01))

    # Ribbed shell: horizontal mouldings on the outer wall, which is what the photograph shows
    # and what the washroom.shell map alone is too subtle to suggest.
    for level in (.45,.85,1.25,1.65):
        parts.append(a.box('washroom_ribs',(x0+.058,y,level),(.02,d-.10,.05),'washroom.shell',.008))

    # Recessed, not projecting: the GRP pod is a single moulding, so shelves are formed into it.
    for i, level in enumerate((1.02,1.30)):
        parts.append(a.box(f'washroom_niche_{i}',(x0+.05,y0+.65,level),(.06,.44,.16),'washroom.shell',.012))
        parts.append(a.tube('niche retaining rail',[(x0+.085,y0+.45,level+.055),(x0+.085,y0+.85,level+.055)],.007,'metal.chrome'))

    toilet_x=x1-.23
    parts.append(a.box('toilet pedestal',(toilet_x,y1-.33,.22),(.32,.43,.22),'washroom.shell',.11))
    parts.append(a.bowl('toilet pan',(toilet_x,y1-.35,.49),(.18,.23),.15,'washroom.shell'))
    parts.append(a.box('toilet raised lid',(toilet_x,y1-.15,.61),(.34,.055,.40),'washroom.shell',.10))
    parts.append(a.box('toilet cistern',(toilet_x,y1-.11,.38),(.37,.13,.47),'washroom.shell',.045))
    parts.append(a.tube('shower riser',[(x0+.11,y1-.47,.95),(x0+.11,y1-.47,1.73),(x0+.19,y1-.47,1.78)],.011,'metal.chrome'))
    parts.append(a.cylinder('shower head',(x0+.22,y1-.47,1.76),.065,.022,'metal.chrome'))
    parts.append(a.tube('shower hose',[(x0+.10,y1-.47,1.05),(x0+.18,y1-.58,.76),(x0+.22,y1-.58,.81),(x0+.14,y1-.47,1.30)],.007,'metal.chrome'))

    # Damask curtain on a chrome rail across the inboard opening, gathered against the rear end
    # rather than drawn: full width, it stands between the hotspot and everything the hotspot
    # exists to show. Its length is a fraction of the rail's, so a shorter pod gathers it tighter
    # instead of curtaining the whole opening off.
    rail_a, rail_b = y0+.30, y1-.09
    gathered = (rail_b-rail_a)*.47
    parts.append(a.tube('washroom_rail',[(x1-.03,rail_a,1.86),(x1-.03,rail_b,1.86)],.010,'metal.chrome'))
    parts.append(a.box('washroom_curtain',(x1-.03,rail_b-gathered/2,1.05),(.014,gathered,1.55),'textile.curtain',.004))
    # Grab handle on the rear wall, clear of the cistern below and the niches outboard.
    parts.append(a.tube('washroom_grab',[(x0+.05,y1-.09,1.10),(x0+.45,y1-.09,1.10)],.012,'metal.chrome'))
    a.group('washroom_pod',parts)
