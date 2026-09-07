"""The tenth collection: the outside of the vehicle.

Every dimension comes from the exterior placements in model/placements.json, which in turn
derive from ENVELOPE. Nothing here is measured independently, so the exterior cannot drift
away from the published envelope.

Blender frame: X lateral (+X kerb), Y rearward, Z up, metres. `a` is tools/model_interior,
passed in by its dispatch, matching how model_furniture's builders are called.
"""
import math



# Rearward displacement of the over-cab moulding's top-front edge, in metres. Kept modest so
# the raked face stays forward of the alcove's interior front panel at y -1.415, and so the
# forward window's flat frame does not sink through it.
ALCOVE_TAPER = .16


def _door_reveal(a, name, centre, width, height, axis, role='metal.dark', t=.055):
    """A frame scribed into the body: four strips, nothing across the opening.

    Open on purpose. The body is one solid mass, so anything filling this rectangle sits
    between the interior door's glazing and the sky and renders that glazing as a black panel
    from indoors. `axis` is the wall's normal, as in model_interior.entry_door.

    The video's window frames are wide and black, and the tint the eye reads is the interior
    pane seen through the hole rather than a second pane out here — one would double the tint
    and re-create that defect. `role` stays overridable because the rear door's outline is a
    panel gap in the paint, not a window frame.
    """
    x, y, z = centre
    for across, up, wide, tall in ((0, (height-t)/2, width, t), (0, -(height-t)/2, width, t),
                                   (-(width-t)/2, 0, t, height), ((width-t)/2, 0, t, height)):
        c = (x, y+across, z+up) if axis == 'x' else (x+across, y, z+up)
        s = (.016, wide, tall) if axis == 'x' else (wide, .016, tall)
        a.box(name, c, s, role, bevel=.006)


def build_exterior(a):
    # Body masses. The FRP alcove moulding overhangs the cab to full width, which is the
    # shape that makes a C-type read as a C-type from outside.
    #
    # body_habitation and body_alcove stay boxes: between them they carry three of the four
    # envelope extremes — the rear face at y 4.05, both flanks at x +-1.225, and the alcove
    # roof at z 2.15.
    centre, size = a.placement('body_habitation')
    a.box('body_habitation', centre, size, 'body.paint', bevel=.06)

    # The FRP over-cab moulding, tapered. The taper is CARVED OUT of body_alcove rather than
    # added in front of it: a mass in front of the nose plane at y -1.948 would make the
    # vehicle 6318 mm long, and check_models.mjs would not catch it — it measures the eight
    # named bodies, and an added detail mesh is not one of them. Same restraint the spare
    # wheel already documents.
    #
    # Raking the alcove's own front face is free of all four extremes: the top-front edge moves
    # in y only, so the roof stays at z 2.15 and the flanks at x +-1.225, and body_cab still
    # carries the length minimum at the bottom of the nose. The face lands at y -1.788 at the
    # roof line, well forward of the alcove_front panel at -1.415, so nothing interior shows.
    (ax, ay, az), (aw, ad, ah) = a.placement('body_alcove')
    a.wedge('body_alcove', (ax, ay, az), (aw, ad, ah), 'body.paint',
            shear=ALCOVE_TAPER, axis=1, bevel=.06)

    # Its forward window: one filled dark panel, not a four-strip reveal.
    #
    # The raked face slopes 11 deg over the alcove's 0.8 m, so across a 0.40 m window it moves
    # 80 mm in y — five times the 16 mm a reveal strip is thick. A flat frame therefore sinks
    # into the face at one end and floats off it at the other, and rendered as three sides of a
    # frame. A single 100 mm-deep box bridges the slope instead.
    #
    # Filling this aperture is safe, unlike every other one on the body: the rule against it
    # exists because a filled rectangle blacks out the interior glazing behind, and there is no
    # forward-facing glazing here — build_shell puts an opaque alcove_front panel at y -1.415
    # and the alcove's windows on the flanks. So this reads as the tinted forward pane the
    # walkaround shows, and changes nothing seen from the bed.
    nose_at_mid = ay - ad / 2 + ALCOVE_TAPER * .5
    a.box('body_window_alcove_front', (ax, nose_at_mid, az + .04), (1.10, .10, .40),
          'metal.dark', bevel=.02)

    # body_cab carries the fourth extreme, its nose plane at y -1.948, and it stays a BOX.
    #
    # The windscreen rake this pass set out to add is blocked, and by the cab interior rather
    # than by the envelope check. build_cab's seats reach y -1.925 — 23 mm inside that nose
    # plane — and the flat front face is the only thing hiding them. Raking the face pulls it
    # back to -1.705 at seat height, and the seats then burst 220 mm out through the
    # windscreen. Clearing them needs shear <= 28 mm, which is no rake at all.
    #
    # So the cab gets its bonnet, grille and mirrors, which are the rest of what the walkaround
    # shows, and the rake waits for the cab furniture to move aft. Do not re-add a shear here
    # without first checking what build_cab puts in front of y -1.9.
    (cx, cy, cz), (cw, cd, ch) = a.placement('body_cab')
    a.box('body_cab', (cx, cy, cz), (cw, cd, ch), 'body.paint', bevel=.06)
    a.box('cab_bonnet', (cx, cy - cd / 2 + .30, cz - ch / 2 + .26), (cw - .06, .60, .34),
          'body.paint', bevel=.05)
    a.box('cab_grille', (cx, cy - cd / 2 + .012, cz - ch / 2 + .30), (cw * .62, .03, .22),
          'metal.dark', bevel=.02)
    for side in (-1, 1):
        a.box('cab_mirror_arm', (side * (cw / 2 + .07), cy - .18, cz + ch / 2 - .40),
              (.14, .04, .04), 'metal.dark', bevel=.012)
        a.box('cab_mirror', (side * (cw / 2 + .15), cy - .18, cz + ch / 2 - .40),
              (.05, .10, .24), 'metal.dark', bevel=.02)

    # The skirt is interrupted at the rear wheels, rather than running as one unbroken slab.
    #
    # As a slab it buried the rear tyres from z -0.700 upward and left 350 mm of a 744 mm wheel
    # showing, so the vehicle sat on castors where the walkaround shows both wheels standing
    # clear in arches. The front pair never had the problem and needs no opening: the skirt
    # starts at y 0 and they sit at y -0.898, under body_cab.
    #
    # Built as pieces around the openings rather than cut with a boolean, which is how
    # model_interior.wall already makes a window. The joined group keeps the name `skirt` and
    # its fore and aft flank pieces still reach y 0 and y 4.05 at x +-1.225 over the full
    # z -0.700 to -0.400, so the bounds check_models.mjs holds `skirt` to are unmoved.
    (sx, sy, sz), (sw, sd, sh) = a.placement('skirt')
    arch_half, notch = .430, .275           # opening half-length; how far in from each flank
    rear_axle = a.placement('wheel_rear_kerb')[0][1]
    y0, y1 = sy - sd / 2, sy + sd / 2
    edges = [y0, rear_axle - arch_half, rear_axle + arch_half, y1]
    pieces = [a.box('skirt_centre', (sx, sy, sz), (sw - 2 * notch, sd, sh), 'metal.dark', .02)]
    for side in (-1, 1):
        for lo, hi in list(zip(edges, edges[1:]))[::2]:
            pieces.append(a.box('skirt_flank', (side * (sw / 2 - notch / 2), (lo + hi) / 2, sz),
                                (notch, hi - lo, sh), 'metal.dark', .02))
    a.group('skirt', pieces)

    # Arch flares. The plan asked for "an arch cut for the wheel openings" and the sculpting
    # pass never built one, which left every wheel meeting a flat flank on a straight line.
    #
    # A tube along a semicircle rather than a boolean: no named body changes, so the 1 mm
    # envelope assertion cannot move. Each flare follows its own body's flank — the front pair
    # the cab's at half of body_cab's width, the rear pair the habitation's — so nothing here
    # introduces a measured number. Standing 28 mm proud of the flank is the same latitude the
    # awning cassette takes at 55 mm and the mirrors at 20 mm.
    #
    # `tyre` rather than metal.dark, and not only because the walkaround's flares are black
    # rubber: tyre is in EXTERIOR_ROLES, so the arches are hidden at the six interior stops with
    # the rest of the body and stay out of refreshProbe's capture. metal.dark is in neither, and
    # the roof AC already paid for that mistake.
    # Each arc STOPS where it meets the lower edge of the bodywork it is scribed onto, rather
    # than running a fixed half turn. A fixed half turn left the legs hanging in open air below
    # the skirt and the flare read as a hoop bolted to the flank. The cab's edge sits 278 mm
    # above the axle, so the front pair come out as the shallow caps the walkaround shows, and
    # the skirt's sits 22 mm below it, so the rear pair are almost the full half turn.
    (_, _, cab_z), (cab_w, _, cab_h) = a.placement('body_cab')
    (_, _, skirt_z), (hab_w, _, skirt_h) = a.placement('skirt')
    for name in ('wheel_front_off', 'wheel_front_kerb', 'wheel_rear_off', 'wheel_rear_kerb'):
        (wx, wy, wz), (_, _, height) = a.placement(name)
        front = 'front' in name
        flare = (cab_w if front else hab_w) / 2
        radius = height / 2 * 1.22          # the opening clears a 372 mm tyre by ~80 mm
        edge = cab_z - cab_h / 2 if front else skirt_z - skirt_h / 2
        start = math.asin(max(-1.0, min(1.0, (edge - wz) / radius)))
        arc = [(math.copysign(flare, wx), wy + radius * math.cos(t), wz + radius * math.sin(t))
               for t in (start + i * (math.pi - 2 * start) / 18 for i in range(19))]
        a.tube('wheel_arch', arc, .028, 'tyre')

    centre, size = a.placement('slideout_box')
    a.box('slideout_box', centre, size, 'body.paint', bevel=.04)

    # Wheels: a rubber cylinder with an alloy face, rotated about Y so the axis runs across
    # the vehicle. The placement box is the tyre's bounding cube, so its half-width gives the
    # tread width and its half-height the radius.
    for name in ('wheel_front_off', 'wheel_front_kerb', 'wheel_rear_off', 'wheel_rear_kerb'):
        (cx, cy, cz), (width, _, height) = a.placement(name)
        radius = height / 2
        a.cylinder(name, (cx, cy, cz), radius, width, 'tyre', rotation=(0, 1.5708, 0))
        # Alloy face set into the outboard side, which is the one the exterior stop sees.
        outboard = -width * .28 if 'off' in name else width * .28
        a.cylinder(name + '_face', (cx + outboard, cy, cz), radius * .60, width * .44,
                   'wheel', rotation=(0, 1.5708, 0))


    # Livery, both flanks. The kerb flank carries the deployed slide-out box from y 0.15 to
    # 2.05, so its decal sits aft of the box where the artwork is seen face-on rather than at
    # the grazing angle that made an earlier pass drop it.
    #
    # box_uv rather than the dispatch loop's smart_project: a wordmark cannot tile, so it needs
    # exactly one copy across a known span from a known origin. The names start with
    # 'body_graphic', which is what model_interior.KEEPS_OWN_UV exempts from both the
    # `exterior_details` join and the re-unwrap that would otherwise discard this UV.
    for name, x in (('body_graphic_off', -1.228), ('body_graphic_kerb', 1.228)):
        plane = a.box(name, (x, 2.0, .95), (.004, 3.4, .70), 'body.graphic', bevel=0)
        # The kerb flank is read from +X and the off flank from -X, so exactly one of the two
        # needs u reversed or its wordmark comes out in mirror writing. One texture cannot also
        # give both flanks the same fore-aft composition — they are mirror images of each other
        # — so legible lettering wins and the artwork lands chevrons-aft on the kerb flank,
        # which is the flank the reference photograph shows, and chevrons-forward on the off.
        a.box_uv(plane, (3.4, .70), flip=x > 0)

    # Kerb-flank detail. This does NOT mirror with the interior: the video fixes the awning, the
    # external washer, the storage bay and the control panel to the vehicle's right side, and
    # that is also the flank the galley window looks out of. All of it is `exterior_details`
    # rather than named placements, so check_models.mjs's 1 mm envelope assertion — which
    # measures the named bodies only — is unaffected.
    # The body's kerb face is at x 1.225 and its rear face at y 4.05. Every detail below has to
    # straddle or clear those planes: the body is a solid mass, so anything sitting a millimetre
    # inside a face is simply invisible.
    kerb, rear = 1.225, 4.050

    # Dometic-style awning: a cassette along the roof edge with its own LED strip beneath it,
    # both hung outboard of the flank rather than flush into it.
    a.box('awning_cassette', (kerb+.055, 2.05, 2.02), (.16, 3.30, .17), 'body.paint', bevel=.03)
    a.box('awning_led', (kerb+.085, 2.05, 1.925), (.03, 3.24, .016), 'led.cove', bevel=0)

    # Window apertures, scribed the same way as the door: the body is one solid mass, so a filled
    # rectangle here turns the interior glazing black from inside.
    # The one boarding door, matching the opening cut into wall_kerb. It is in the KERB flank
    # forward of the rear corner, not in the rear wall: the 2:38 and 3:23 walkaround frames open
    # it there, hinged on its forward edge, with the grab rail, the keypad and the vent on the
    # stretch of flank left aft of it. Read off the entry_door placement, so the reveal cannot
    # drift from the opening it outlines. Scribed just proud of the flank: a millimetre inside a
    # solid mass and it renders not at all, which is what the rear reveal it replaces had to
    # learn. The envelope is unaffected either way — check_models.mjs measures the named bodies.
    (dx, dy, dz), (_, dd, dh) = a.placement('entry_door')
    _door_reveal(a, 'body_door_side', (kerb, dy, dz), dd + .06, dh + .04, 'x',
                 role='body.paint', t=.03)
    # The galley window moved to the REAR wall with the counter it lights; the stretch of kerb
    # flank it used to occupy is the boarding door now.
    _door_reveal(a, 'body_window_rear', (.09, rear, 1.25), .90, .48, 'y')
    _door_reveal(a, 'body_window_slideout', (1.806, 1.10, 1.115), 1.62, .57, 'x')
    for x in (-1.226, 1.226):
        _door_reveal(a, 'body_window_cab', (x, -1.30, .84), .84, .52, 'x')
        _door_reveal(a, 'body_window_alcove', (x, -.775, 1.625), .81, .45, 'x')
    _door_reveal(a, 'body_window_lounge', (-1.226, 1.04, 1.13), 1.50, .52, 'x')
    _door_reveal(a, 'body_window_service', (-1.226, 2.25, 1.14), .61, .48, 'x')
    _door_reveal(a, 'body_window_washroom', (-1.226, 3.245, 1.45), .56, .40, 'x')

    # Lower storage bay, the washer hatch and the external control panel — the three things the
    # walkaround stops at, in the order it stops at them.
    #
    # All three sat in one low row at z -0.18 to -0.22, and the 2m38s frame shows them stepped up
    # the flank instead: the storage hatch low, the washer about a third of the way up and the
    # control panel higher again, at roughly the height of a standing adult's hand. The flat row
    # also put the washer straight through the rear wheel arch — invisible only for as long as
    # the skirt ran unbroken past the wheel, which is the defect the arches above fix. Heights
    # read off that frame against the two rulers in it, the body's bottom edge at z -0.400 and
    # the slide-out window's sill at z 0.83.
    a.box('hatch_storage', (kerb+.006, 3.30, -.10), (.03, .92, .46), 'metal.dark', bevel=.02)
    a.box('hatch_storage_trim', (kerb+.014, 3.30, -.10), (.014, .96, .50), 'body.paint', bevel=.02)
    # The washing machine, which the walkaround stops at and calls out by capacity. A full
    # front-loader door with a chrome ring, replacing the 210 mm porthole the first pass gave
    # it. `glass` for the window, so it reads as a drum behind a pane rather than a disc.
    # At y 2.50 it clears the storage hatch's forward edge and still starts aft of the deployed
    # slide-out box, which ends at y 2.05 and would otherwise cover it.
    a.box('washer_surround', (kerb+.010, 2.50, .33), (.02, .62, .62), 'metal.dark', bevel=.03)
    a.cylinder('washer_door', (kerb+.026, 2.50, .33), .24, .04, 'metal.chrome',
               rotation=(0, 1.5708, 0))
    a.cylinder('washer_glass', (kerb+.046, 2.50, .33), .18, .02, 'glass',
               rotation=(0, 1.5708, 0))
    a.box('panel_control', (kerb+.008, 2.24, .63), (.02, .26, .20), 'graphic.screen', bevel=.01)

    # Keypad, chrome grab handle and vent grille: on the KERB flank aft of the door, not on the
    # rear face. The walkaround stops at all three in one shot with the door open, and their
    # order aft of it is grab rail, keypad, vent. Positioned off the door's own aft edge, so
    # they follow it rather than sitting at absolute stations.
    aft = dy + dd / 2
    a.box('door_grab', (kerb+.036, aft+.10, 1.16), (.07, .035, .46), 'metal.chrome', bevel=.014)
    a.box('door_keypad', (kerb+.012, aft+.10, .84), (.022, .10, .14), 'graphic.screen', bevel=.008)
    a.box('door_vent', (kerb+.011, aft+.21, .42), (.020, .28, .16), 'metal.dark', bevel=.006)
    for i in range(5):
        a.box('door_vent_blade', (kerb+.024, aft+.21, .36+i*.032), (.010, .24, .012),
              'metal.brushed', bevel=.003)
    # Mounted flat against the rear face rather than on a projecting carrier. A real carrier
    # stands 300 mm or more off the back, and this vehicle's published 5998 mm is pinned to the
    # 6 m C1 limit — the envelope check would not catch it, because it measures the named bodies
    # only, so the restraint has to be deliberate.
    a.cylinder('spare_wheel', (-.70, rear+.085, .46), .34, .16, 'tyre', rotation=(1.5708, 0, 0))
    a.cylinder('spare_wheel_face', (-.70, rear+.125, .46), .20, .07, 'wheel', rotation=(1.5708, 0, 0))

    # Roof air conditioner. It sits above body_alcove's roof line, but it is a detail mesh
    # rather than one of the eight named bodies, so it does not enter the 3200 mm height
    # assertion — the same latitude the spare wheel has, and the same reason to be deliberate
    # about it: 180 mm is a real Dometic-class shroud, not a number chosen to fit.
    #
    # Mounted at y 3.10, over the service room, and NOT at 1.30. The roof hatch spans
    # y 1.05-1.75 and is the interior's only daylight source; an AC at 1.30 covers it
    # completely. Its vent is metal.dark, which is not an EXTERIOR_ROLE, so it stayed visible
    # through refreshProbe's capture and capped that daylight in the bounce light as well —
    # the ?calibrate patches read 0.105/0.089/0.078 there against 0.052/0.083/0.069 here.
    a.box('roof_ac', (0, 3.10, 2.15 + .09), (.72, .98, .18), 'body.paint', bevel=.05)
    a.box('roof_ac_vent', (0, 3.10, 2.15 + .18), (.52, .74, .02), 'metal.dark', bevel=.008)

    # Rear light clusters, inboard of the spare and clear of the boarding door.
    for side in (-1, 1):
        a.box('rear_lamp', (side * .92, rear + .014, .58), (.16, .026, .46),
              'graphic.screen', bevel=.02)

    # Alloy spokes: five slots around each wheel face. The wheel axis runs across the vehicle,
    # so the ring lies in the Y-Z plane and the placement's own half-height sets its radius.
    for name in ('wheel_front_off', 'wheel_front_kerb', 'wheel_rear_off', 'wheel_rear_kerb'):
        (wx, wy, wz), (width, _, height) = a.placement(name)
        outboard = -width * .34 if 'off' in name else width * .34
        for i in range(5):
            angle = i * math.tau / 5
            a.box('wheel_spoke', (wx + outboard, wy + math.cos(angle) * height * .21,
                                  wz + math.sin(angle) * height * .21),
                  (width * .10, height * .13, height * .13), 'wheel', bevel=.006)

    # Mudflaps behind each axle, and the chrome rail beside the boarding door.
    for side in (-1, 1):
        a.box('mudflap', (side * 1.10, 2.98, -.86), (.22, .014, .24), 'metal.dark', bevel=.006)
    # Chrome rail beside the door, on the flank it now opens from.
    a.box('door_rail', (kerb + .040, dy - dd / 2 - .09, 1.20), (.07, .030, .52), 'metal.chrome', bevel=.012)
