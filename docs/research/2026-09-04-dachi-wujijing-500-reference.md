# Reference research: 大驰 无极境500 (Dachi Wuji·Jing 500)

Gathered 2026-09-04 for the RV interior 3D project. This is the evidence base for
[the interior spec](../specs/). Everything below is either from the manufacturer's own
product page or a named secondary source. Anything I inferred is marked **inferred**.

## Sources

| # | Source | What it gives | Trust |
|---|---|---|---|
| S1 | https://www.dachirv.cn/sys-pd/60.html — the model's own product page | 37 brochure images, model name, generation | Primary. Image-only, zero text specs. |
| S2 | https://www.dachirv.cn/h-col-104.html — Dachi news index | Sibling model dimensions, 境280 equipment list | Primary |
| S3 | https://www.163.com/dy/article/KV8B2GQA0527AES8.html — 21世纪房车 review of 无极·御500, 2026-06-12 | Chassis, dimensions, bed sizes, systems, regulatory framing | Secondary, closest documented sibling |
| S4 | https://www.21rv.com/news/article/7c41a93f-... — 无极境280 review | Zone layout of the 境 family | Secondary |

Local copies: [reference/](reference/) (brochure crops + the raw scrape of S1).

## Model identity

- Name: **无极境500** / Wuji·Jing 500. Page headline also reads 5代升级 — "5th generation upgrade".
- Maker: 大驰房车 / Dachi RV (dachirv.cn). Seat and hood badging reads `DACHIRV`.
- Class: China **C-type** (Class C) coachbuilt motorhome, over-cab alcove.
- Sibling at ¥529,800: 无极·御500 (sys-pd/58.html). 境500 is not yet on the public price list.

## The 6-metre constraint (why the dimensions are what they are)

S3 spells out the rule that shapes every Chinese C-type: a **blue-plate vehicle drivable on a
C1 licence must be under 6 m long, under 4.5 t GVM, and seat at most 9**. So the whole segment
sits at 5.99 m. Every interior dimension below is a consequence of that box. Getting this box
right matters more for authenticity than any single piece of furniture.

## Vehicle envelope

| Property | Value | Source |
|---|---|---|
| Overall L × W × H | 5998 × 2450 × 3200 mm | S3 (御500); S2 confirms 5998 across the range |
| Wheelbase | 3300 mm | S1 (brochure states 3300mm 超长轴距) |
| Base chassis | Nanjing Iveco Daily (欧胜) 4.5 t, ladder frame, body-on-frame (非承载式) | S1, S3 |
| Engine / gearbox | Iveco F1C 3.0 T diesel, 132 kW, 400 N·m, ZF 8AT | S1, S3 |
| GVM | 4.5 t standard; 6.5 t version offered | S3 |
| Occupancy | 5 seated (S1: 5人舒适承载); S3 quotes 2–6 for 御500 | S1 |

**Inferred** interior envelope, to be validated during modelling: usable habitation box roughly
**4200 mm long × 2250 mm wide × 1950 mm standing height**, sitting behind the cab bulkhead and
under a 3200 mm exterior roof. Derived from 5998 mm total minus cab and rear overhang, and
2450 mm minus twin sandwich walls. Not published — treat as a starting hypothesis.

## Layout

The 境 family layout, per S4: *前方额头床，中部3人汽车座椅+长条沙发，尾部独立厨卫区* — over-cab
bed at the front, automotive seats plus a long bench sofa in the middle, independent kitchen and
washroom at the rear, entered through a **rear-side door** (后上门).

Reading that against the S1 photos, 境500 resolves to five zones, front to rear:

1. **Cab** — two swivelling captain seats, dash, steering wheel. Continuous with the habitation area.
2. **Over-cab alcove bed** — **2200 × 1400 mm**, described as 加大 (enlarged). Head end against a
   bulkhead carrying three overhead lockers and a shelf; drop curtains on both flanks; side
   windows with blinds; reading lights. S3 notes the sibling's equivalent bed is a **pull-out**
   (推拉式) at 2150 × 1400 — so 境500's is **inferred** to slide too.
3. **Lounge / dinette** — the middle third, split across the aisle:
   - Kerb side (right in the photos): **four swivel captain chairs face-to-face** around a single
     pedestal table with a rounded-corner top. Chairs are cream leather with camel bolsters,
     integrated headrests, three-point belts, `DACHIRV` badge on the backrest.
   - Off side (left): a **long bench sofa** set into the slide-out, white leather cushions on a
     walnut plinth with drawers below.
   - A full-height wardrobe (hanging rail plus three shelves, pale interior) and a tall dark-gloss
     column — **inferred** to be the 148 L fridge — stand at the rear boundary of this zone.
4. **Side slide-out** — **侧拓展**, one mechanism on the off side. Brochure claims **+27 % space
   utilisation**. Deployed it yields a **double bed of 1280 × 1900 mm**, i.e. the bench sofa's
   platform extends outboard into a flat bed. Own window, curtains, reading lights, LED cove.
5. **Rear wet zone** — galley and washroom, split left/right, with the entry door alongside the galley.
   - **Galley**: light grey stone-look worktop, walnut base cabinets with long horizontal bar pulls,
     single stainless bowl sink, black gooseneck pull-down mixer, induction hob, extractor hood
     branded `DACHIRV`, gloss walnut overhead lockers, warm LED strip under them, a systems
     touch panel high on the left.
   - **Washroom**: a moulded white GRP wet room — oval basin, chrome tap, mirror cabinet,
     cassette / biological toilet, recessed shelf niches, a damask shower curtain, grab rail, and a
     **teak slat duckboard floor** over the drain.

Standing between the galley and the lounge, the walnut washroom door with a chrome lever handle
is visible on the aisle's rear-right.

**No manufacturer floorplan drawing exists on S1 or any source found.** The plan has to be
reconstructed from photographs plus the published dimensions above. This is the single largest
authenticity risk in the project and should be stated as such in the spec.

## Materials and colour palette

Read off the S1 interior photography. Hex values are **inferred by eye** and are a starting
palette, not measured values.

| Surface | Description | Approx. |
|---|---|---|
| Cabinet faces, ceiling trim, plinths | Dark walnut veneer, satin, strong figure; gloss variant on the galley overheads | `#5A3A24` |
| Wall panels, locker doors (lounge / alcove) | Warm cream / bone, soft-touch, gloss on some doors | `#EFE7DA` |
| Seat upholstery | Grey leather main panels, camel-tan bolsters and piping | `#C9CAC9` / `#B08052` |
| Bench sofa cushions | White-cream leather | `#F2EDE4` |
| Worktop | Pale grey stone-look | `#C9C6BE` |
| Floor | Mid-grey vinyl, herringbone / chevron texture, brushed aluminium trim strips | `#7C8288` |
| Washroom | Gloss white moulded GRP, teak duckboard | `#F7F7F5` / `#9A6B3C` |
| Metalwork | Brushed aluminium and chrome; black for the kitchen mixer | `#B8BCC0` / `#1E1E1E` |
| Textiles | Sand / taupe curtains and blinds; accent scatter cushions in ochre, rust, teal, slate | — |

Corrected 2026-09-05 from pixel samples; the original values were estimated by eye.

Lighting, which does most of the work in these photos: recessed ceiling downlights, continuous
warm LED cove strips along both ceiling edges, under-locker strips, a **floor-level plinth strip
under the furniture**, and a rectangular roof hatch / skylight above the aisle.

## Equipment (for props and labelling; not all needs modelling)

Body and insulation: aluminium cage frame, PU keel with embedded aluminium keel forming a
thermal break, high-density XPS insulation, export-grade aluminium sandwich panels, 700 MPa
hot-dip galvanised subframe, one-piece FRP over-cab moulding with carbon fibre reinforcement
(no seam to leak). ENF-grade 18 mm ply for the furniture. Tested −35 °C to +45 °C.

Systems: native 12 V + 48 V architecture, 48 V 300 Ah lithium with low-temperature heating,
6000 W inverter-charger, 1200 W solar (up to 1.1 kWh/h), sub-20 W standby draw, reverse charging
to the chassis battery, 7-pin EV AC charge port with a 15 m cable. 270 L PE anti-bacterial
anti-surge fresh tank (7 days' supply), 75 L electric grey/waste tank, twin frost-resistant water
circuits, self-priming pump, 48 V water heater, constant-temperature underfloor heating, 5 kW
high-altitude diesel air heater, three-mode air conditioning, 148 L fridge, 5 kg washing machine,
microwave / steam-grill oven, biological toilet, pet locker.

## Open questions the spec must resolve or flag

1. Exact interior envelope — no published figure. Needs reconstruction and a stated tolerance.
2. Slide-out travel distance — the +27 % claim gives no millimetres.
3. Whether the alcove bed slides, and by how much.
4. Which side the slide-out is on in the real vehicle. The photos are consistent with the sofa
   being on the off side, but China is left-hand drive and I have not seen an exterior shot of the
   deployed mechanism to confirm.
5. Position of the entry door relative to the galley and the rear axle.
