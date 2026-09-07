"""The tenth collection: the outside of the vehicle.

Every dimension comes from the exterior placements in model/placements.json, which in turn
derive from ENVELOPE. Nothing here is measured independently, so the exterior cannot drift
away from the published envelope.

Blender frame: X lateral (+X kerb), Y rearward, Z up, metres. `a` is tools/model_interior,
passed in by its dispatch, matching how model_furniture's builders are called.
"""


def _door_reveal(a, name, centre, width, height, axis):
    """A door outline scribed into the body: four strips, nothing across the opening.

    Open on purpose. The body is one solid mass, so anything filling this rectangle sits
    between the interior door's glazing and the sky and renders that glazing as a black
    panel from indoors. `axis` is the wall's normal, as in model_interior.entry_door.
    """
    x, y, z = centre
    t = .03
    for across, up, wide, tall in ((0, (height-t)/2, width, t), (0, -(height-t)/2, width, t),
                                   (-(width-t)/2, 0, t, height), ((width-t)/2, 0, t, height)):
        c = (x, y+across, z+up) if axis == 'x' else (x+across, y, z+up)
        s = (.012, wide, tall) if axis == 'x' else (wide, .012, tall)
        a.box(name, c, s, 'body.paint', bevel=.004)


def build_exterior(a):
    # Body masses. The FRP alcove moulding overhangs the cab to full width, which is the
    # shape that makes a C-type read as a C-type from outside.
    for name in ('body_cab', 'body_alcove', 'body_habitation'):
        centre, size = a.placement(name)
        a.box(name, centre, size, 'body.paint', bevel=.06)

    centre, size = a.placement('skirt')
    a.box('skirt', centre, size, 'metal.dark', bevel=.02)

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

    # The one boarding door, matching the opening cut into wall_rear: 后上门, offset off the
    # centreline because the washroom pod takes the off corner of that wall. Scribed just proud
    # of the rear face: at the old 4.043 the strips sat a millimetre INSIDE a solid mass and
    # rendered not at all. The published envelope is unaffected either way — check_models.mjs
    # measures the named bodies, and this is a detail mesh.
    _door_reveal(a, 'body_door_rear', (.10, 4.056, .925), .76, 1.89, 'y')

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
    _door_reveal(a, 'body_window_galley', (kerb, 3.22, 1.14), .70, .48, 'x')
    _door_reveal(a, 'body_window_slideout', (1.806, 1.10, 1.115), 1.62, .57, 'x')
    for x in (-1.226, 1.226):
        _door_reveal(a, 'body_window_cab', (x, -1.30, .84), .84, .52, 'x')
        _door_reveal(a, 'body_window_alcove', (x, -.775, 1.625), .81, .45, 'x')
    _door_reveal(a, 'body_window_lounge', (-1.226, 1.04, 1.13), 1.50, .52, 'x')
    _door_reveal(a, 'body_window_service', (-1.226, 2.25, 1.14), .61, .48, 'x')
    _door_reveal(a, 'body_window_washroom', (-1.226, 3.65, 1.45), .56, .40, 'x')

    # Lower storage bay, the round-porthole washer hatch and the external control panel — the
    # three things the walkaround stops at, in the order it stops at them.
    a.box('hatch_storage', (kerb+.006, 3.30, -.22), (.03, .92, .46), 'metal.dark', bevel=.02)
    a.box('hatch_storage_trim', (kerb+.014, 3.30, -.22), (.014, .96, .50), 'body.paint', bevel=.02)
    a.cylinder('hatch_washer', (kerb+.008, 2.58, -.20), .21, .03, 'metal.dark',
               rotation=(0, 1.5708, 0))
    a.cylinder('hatch_washer_glass', (kerb+.020, 2.58, -.20), .15, .012, 'glass',
               rotation=(0, 1.5708, 0))
    a.box('panel_control', (kerb+.008, 2.24, -.18), (.02, .26, .20), 'graphic.screen', bevel=.01)

    # Rear face: keypad, chrome grab handle, vent grille and the spare-wheel carrier, all of
    # which the video lingers on while explaining 后上门.
    a.box('rear_keypad', (.34, rear+.012, 1.10), (.10, .022, .14), 'graphic.screen', bevel=.008)
    a.box('rear_grab', (.36, rear+.036, .70), (.035, .07, .34), 'metal.chrome', bevel=.014)
    a.box('rear_vent', (-.62, rear+.011, .38), (.34, .020, .16), 'metal.dark', bevel=.006)
    for i in range(5):
        a.box('rear_vent_blade', (-.62, rear+.024, .32+i*.032), (.30, .010, .012),
              'metal.brushed', bevel=.003)
    # Mounted flat against the rear face rather than on a projecting carrier. A real carrier
    # stands 300 mm or more off the back, and this vehicle's published 5998 mm is pinned to the
    # 6 m C1 limit — the envelope check would not catch it, because it measures the named bodies
    # only, so the restraint has to be deliberate.
    a.cylinder('spare_wheel', (-.70, rear+.085, .46), .34, .16, 'tyre', rotation=(1.5708, 0, 0))
    a.cylinder('spare_wheel_face', (-.70, rear+.125, .46), .20, .07, 'wheel', rotation=(1.5708, 0, 0))
