# Final comparison set — 2026-09-06

All seven hotspots after the photo-referenced correction, free look and exterior work. Captured
at 1920 x 941 CSS pixels, device pixel ratio 2, then downscaled to 1920 wide.

| Render | Reference slice | What to compare |
|---|---|---|
| [lounge.png](lounge.png) | [interior-lounge-and-overcab.jpg](../reference/interior-lounge-and-overcab.jpg) | Walnut ceiling band with cream shoulders, framed locker doors, grey seats with camel accents, grey herringbone floor |
| [alcove.png](alcove.png) | [interior-lounge-and-overcab.jpg](../reference/interior-lounge-and-overcab.jpg) (third photo) | Head-end lockers, framed prints on the flanks, curtains |
| [slideout.png](slideout.png) | [dinette-and-slideout-bed.jpg](../reference/dinette-and-slideout-bed.jpg) | Cream leather bed with a back cushion still deployed, walnut drawer plinth |
| [galley.png](galley.png) | [galley-wardrobe-dinette.jpg](../reference/galley-wardrobe-dinette.jpg) (second photo) | Square stainless bowl at the aisle end under the window, induction hob at the rear, washer in the rear bay |
| [washroom.png](washroom.png) | [underseat-drawers-washroom.jpg](../reference/underseat-drawers-washroom.jpg) (third photo) | Corner vanity, mirror cabinet, ribbed shell, recessed niches, damask curtain, teak duckboard |
| [cab.png](cab.png) | — | Engine tunnel between the seats, dark binnacle, wheel |
| [exterior.png](exterior.png) | [exterior-hero.jpg](../reference/exterior-hero.jpg) | Envelope and stance. The body is massed, not sculpted — see the caveat below |

## Measured at these viewpoints

| Hotspot | Mode | Draw calls | Triangles | fps |
|---|---|---|---|---|
| Lounge | look | 36 | 66,412 | 83.0 |
| Alcove bed | look | 25 | 53,832 | 86.3 |
| Slide-out bed | look | 29 | 60,684 | 84.8 |
| Galley | look | 18 | 51,288 | 89.2 |
| Washroom | look | 19 | 53,732 | 90.3 |
| Cab | look | 16 | 44,872 | 96.8 |
| Exterior | orbit | 45 | 71,896 | 120.1 (vsync) |

Ceilings are 40 interior and 60 exterior, so both hold with room to spare. The frame rates are
measured over 120 frames into a 3840 x 1882 buffer, which is four times the pixel count of
1080p; the 60 fps criterion is met with a wide margin.

## Where this still departs from the references

- **The exterior is massed rather than sculpted.** Body boxes, wheels, a skirt and a decal, which
  is the scope Task 16 defines. The reference hero shows a shaped Iveco cab, a curved FRP over-cab
  moulding, window apertures and storage hatches, none of which are modelled.
- **The side livery is a stripe band.** The body is smart-projected, so its UV islands start at
  0.034 and span 4.01 over a 3.4 m panel; no repeat setting lands one copy of a logo on the flank
  without cutting it. Logo-free stripes tile honestly instead.
- **No bloom and no GTAO.** Inherited from the parent spec's own list of gaps; section 6 of that
  spec asks for both and neither pass has added a post chain.
- **The washroom remains the weakest zone**, which the parent spec accepts by design.
