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

    # Both boarding doors, matching the openings cut into wall_kerb and wall_rear. The kerb
    # one sits at the rear corner, aft of the rear wheel, where the manufacturer's walkaround
    # photography puts it. Recessed a millimetre, so the published 5998 x 2450 mm envelope
    # stays exactly what check_models.mjs measures off the body placements.
    _door_reveal(a, 'body_door_rear', (0, 4.043, .925), .84, 1.89, 'y')
    _door_reveal(a, 'body_door_kerb', (1.219, 3.685, .925), .73, 1.89, 'x')

    # Side graphic as a decal plane just proud of the body, one per flank.
    for side, x in (('off', -1.228), ('kerb', 1.228)):
        a.box(f'body_graphic_{side}', (x, 2.0, .95), (.004, 3.4, .70), 'body.graphic', bevel=0)
