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
    for end, direction in [('fwd', 1), ('aft', -1)]:
        for side in ('in', 'out'):
            _chair(a, f'dinette_chair_{end}_{side}', direction)
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
    parts = [a.box('walnut bed plinth', (x-.02,y,z), (w-.04,d,h), 'wood.cabinet', .02)]
    for j in range(3):
        cy = y-d/2+(j+.5)*d/3
        parts.append(a.box('sofa drawer', (x+w/2-.029,cy,z), (.022,d/3-.025,h-.055), 'wood.cabinet', .009))
        parts.append(a.box('sofa drawer pull', (x+w/2-.009,cy,z+.07), (.018,.14,.025), 'metal.brushed', .007))
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
    a.box('slideout_back', (-1.66, 1.10, .74), (.12, 1.86, .28), 'upholstery.sofa', .03)


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
            # positioned per run — the two runs are 2.5 m apart, the off pair riding the
            # slide-out at x -1.73 to -1.28.
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
    a.group('cab_dashboard', parts)


def build_galley(a):
    (x,y,z), (w,d,h) = a.placement('galley_run')
    parts = [a.box('galley base floor', (x,y,.045), (w,d,.09), 'wood.cabinet', .016),
             a.box('galley back panel', (x+w/2-.015,y,.45), (.03,d,.80), 'wood.cabinet', .008)]
    # Four strips make an actual countertop opening around the recessed bowl.
    # Reference: square stainless bowl nearest the aisle, induction hob at the rear, so the
    # cook faces the window rather than the rear wall. The counter opening mirrors with it.
    sink_y = y-.39
    parts.extend([
        a.box('counter front length', (x-w/2+.058,y,.879), (.116,d,.042), 'worktop', .01),
        a.box('counter rear length', (x+w/2-.058,y,.879), (.116,d,.042), 'worktop', .01),
        a.box('counter hob field', (x,y+.30,.879), (w-.20,.90,.042), 'worktop', .01),
        a.box('counter aisle end', (x,y-d/2+.048,.879), (w-.20,.096,.042), 'worktop', .01),
        a.bowl('stainless sink', (x,sink_y,.886), (.21,.21), .14, 'metal.chrome', corner=.3)])
    for j in range(3):
        cy = y-d/2+(j+.5)*d/3
        parts.append(a.box('galley cabinet door',(x-w/2+.036,cy,.43),(.028,d/3-.02,.77),'wood.cabinet',.012))
        parts.append(a.box('long cabinet pull',(x-w/2+.011,cy,.74),(.022,.34,.023),'metal.chrome',.007))
    a.group('galley_run',parts)
    parts=[]
    parts.append(a.box('induction glass',(x,y+.40,.906),(.42,.47,.017),'metal.dark',.022))
    for cy,radius in [(y+.50,.10),(y+.27,.075)]:
        circle = [(x+radius*math.cos(t*math.tau/32),cy+radius*math.sin(t*math.tau/32),.917) for t in range(33)]
        parts.append(a.tube('induction ring',circle,.003,'metal.chrome'))
    parts.append(a.tube('black gooseneck',[(x+.19,sink_y,.90),(x+.19,sink_y,1.11),(x+.18,sink_y,1.17),(x+.13,sink_y,1.20),(x+.05,sink_y,1.20),(x,sink_y,1.17),(x,sink_y,1.12)],.012,'metal.dark'))
    a.group('galley_appliances',parts)
    (x,y,z),(w,d,h)=a.placement('galley_overhead')
    parts=[a.box('overhead walnut carcass',(x+.022,y,z),(w-.044,d,h),'wood.cabinet',.016)]
    for i in range(3):
        cy=y-d/2+(i+.5)*d/3
        parts.append(a.box('overhead walnut door',(x-w/2+.032,cy,z),(.023,d/3-.015,h-.024),'wood.cabinet',.016))
        parts.append(a.box('overhead handle',(x-w/2+.008,cy,z-.12),(.016,.12,.023),'metal.chrome',.006))
    a.box('extractor_hood',(x-.02,y-.4,z-h/2-.045),(w-.04,.48,.09),'metal.dark',.02)
    a.group('galley_overhead',parts)
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
    for x,y0,y1 in [(1.125,.29,1.83),(-1.70,.32,1.89)]:
        for y in (y0,y1):
            parts.append(_pleat(a,'gathered lounge curtain',x,y,1.17,.15,.55))
    for x in (-1.075,1.075):
        parts.append(_pleat(a,'alcove curtain',x,-.58,1.59,.31,.53))
    for y in (.38,1.80):
        pillow=a.box('sofa scatter cushion',(-1.49,y,.77),(.16,.34,.30),'textile.curtain',.07)
        pillow.rotation_euler[1]=-.18
        parts.append(pillow)
    parts.append(a.box('alcove folded duvet',(.17,-.72,1.38),(1.55,1.17,.06),'textile.curtain',.035))
    for y in (-1.05,-.39):
        parts.append(a.box('alcove pillow',(-.76,y,1.42),(.44,.53,.13),'textile.curtain',.06))
    a.group('softgoods_fabric',parts)


def build_washroom(a):
    (x,y,z),(w,d,h)=a.placement('washroom_pod')
    parts=[a.box('wetroom tray',(x,y,.047),(w,d,.09),'washroom.shell',.04),
           a.box('moulded outer wall',(x-w/2+.025,y,z),(.05,d,h),'washroom.shell',.022),
           a.box('moulded rear wall',(x,y+d/2-.025,z),(w,.05,h),'washroom.shell',.024)]
    # Rounded junction of two real walls; the aisle opening remains accessible.
    radius=.14
    cx=x-w/2+radius+.022
    cy=y+d/2-radius-.022
    for i in range(12):
        angle=(i+.5)*math.pi/24
        wall=a.box('curved GRP corner',(cx-radius*math.cos(angle),cy+radius*math.sin(angle),z),(.04,.022,h),'washroom.shell',.009)
        wall.rotation_euler[2]=-angle
        parts.append(wall)
    for j in range(13):
        parts.append(a.box('teak duckboard slat',(x,y-d/2+.095+j*.10,.107),(w-.10,.080,.028),'washroom.duckboard',.006))
    parts.append(a.box('basin pedestal',(x-.08,y-.35,.39),(.34,.30,.55),'washroom.shell',.075))
    parts.append(a.bowl('oval vanity basin',(x-.04,y-.34,.80),(.26,.22),.15,'washroom.shell'))
    parts.append(a.tube('vanity chrome tap',[(x-.22,y-.34,.80),(x-.22,y-.34,.95),(x-.16,y-.34,.96),(x-.11,y-.34,.93)],.012,'metal.chrome'))
    parts.append(a.box('mirror moulded surround',(x-w/2+.049,y-.31,1.33),(.06,.53,.69),'washroom.shell',.045))
    parts.append(a.box('mirror',(x-w/2+.083,y-.31,1.33),(.012,.46,.61),'metal.chrome',.03))
    parts.append(a.box('toilet pedestal',(x+.04,y+.37,.22),(.32,.43,.22),'washroom.shell',.11))
    parts.append(a.bowl('toilet pan',(x+.04,y+.35,.49),(.18,.23),.15,'washroom.shell'))
    parts.append(a.box('toilet raised lid',(x+.04,y+.55,.61),(.34,.055,.40),'washroom.shell',.10))
    parts.append(a.box('toilet cistern',(x+.04,y+.59,.38),(.37,.13,.47),'washroom.shell',.045))
    parts.append(a.tube('shower riser',[(x-.24,y+.23,.95),(x-.24,y+.23,1.73),(x-.16,y+.23,1.78)],.011,'metal.chrome'))
    parts.append(a.cylinder('shower head',(x-.13,y+.23,1.76),.065,.022,'metal.chrome'))
    parts.append(a.tube('shower hose',[(x-.25,y+.23,1.05),(x-.17,y+.12,.76),(x-.13,y+.12,.81),(x-.21,y+.23,1.30)],.007,'metal.chrome'))
    for level in (1.18,1.48):
        parts.append(a.box('recessed niche shelf',(x-.21,y+.48,level),(.21,.31,.035),'washroom.shell',.016))
        parts.append(a.tube('niche retaining rail',[(x-.105,y+.34,level+.05),(x-.105,y+.62,level+.05)],.008,'metal.chrome'))
    a.group('washroom_pod',parts)
