# Spec: 无极境500 interior — photoreal Three.js walkthrough

- Date: 2026-09-05
- Status: approved design, ready for implementation planning
- Evidence base: [../research/2026-09-04-dachi-wujijing-500-reference.md](../research/2026-09-04-dachi-wujijing-500-reference.md)
- Skills in play: `threejs-webgl` (runtime), `blender-web-pipeline` (assets)

## 1. What this is

A web page that renders the interior of a 大驰 无极境500 C-type motorhome, close enough to the
manufacturer's own interior imagery to stand as a portfolio piece, and structured so that moving
furniture and changing finishes are cheap to add later.

**Purpose: portfolio / technical demonstration.** That fixes the quality bar at "matches the
reference imagery" and makes visual fidelity the primary success criterion. It also means
customisation is an architectural requirement in v1, not a shipped feature.

### Goals

1. The five interior zones are recognisably this vehicle, at correct scale.
2. Lighting and materials read as the reference imagery does: warm LED cove light in a narrow box.
3. Layout and finishes live in data, so both are editable without touching render code.
4. One finish swap ships, proving the customisation seam works.

### Non-goals

Stated now so they don't get relitigated:

- No exterior bodywork beyond what is visible through the glazing.
- **Slide-out is modelled deployed only.** No retract animation, despite +27 % being a headline claim.
- No furniture-drag UI, no VR, no physics, no persistence, no pricing, no lead capture.
- No cab interior detail beyond seat shells and a blocked-in dash.

### Success criteria

| Axis | Criterion |
|---|---|
| Visual | Three matched camera positions read as the same room as the reference shots, side by side |
| Dimensional | Automated check passes: no footprint overlaps, everything inside the habitation box, aisle ≥ 400 mm |
| Performance | 60 fps at 1080p on desktop; ≥ 30 fps on a mid-range phone |
| Budget | ≤ 350k triangles, ≤ 25 MB transferred, ≤ 40 draw calls |
| Seam | Changing the wood variant restyles every wood surface and nothing else |

## 2. The dimensional problem, and how this spec handles it

The manufacturer publishes no floorplan. Not on the product page, not in any secondary source
found. The plan below is a reconstruction from four published dimensions plus photogrammetric
estimation off the brochure images, calibrated against the two published bed sizes used as
in-frame rulers.

So every dimension in `vehicle.ts` carries a confidence tag:

- `published` — stated by the manufacturer or a named review
- `derived` — arithmetic on published values
- `estimated` — read off photographs

This is one extra field per dimension and it stops the model from quietly pretending to know
things it doesn't. It also tells whoever picks this up later exactly which numbers are safe to
build on.

### Coordinate frame

- 1 Three.js unit = 1 metre. Data is authored in millimetres and converted once, at load.
- Origin: floor level, on the vehicle centreline, at the cab bulkhead.
- `+X` kerb side (right in direction of travel; the vehicle is left-hand drive), `+Y` up, `+Z` rearward.

### Envelope

| Dimension | Value (mm) | Confidence | Note |
|---|---|---|---|
| Overall length | 5998 | published | Pinned by China's C1 blue-plate limit of 6 m |
| Overall width | 2450 | published | |
| Overall height | 3200 | published | |
| Wheelbase | 3300 | published | |
| Front axle from nose | ~1050 | estimated | Iveco Daily single cab |
| Rear axle from nose | 4350 | derived | 1050 + 3300 |
| Cab depth (nose to bulkhead) | ~1950 | estimated | |
| Habitation floor length | ~4050 | derived | 5998 − 1950 |
| Habitation interior width | ~2360 | derived | 2450 − 2 × 45 mm sandwich wall |
| Habitation floor height above ground | ~1050 | estimated | Chassis frame + double floor for tanks and underfloor heating |
| Interior standing height | ~2000 | estimated | Wide band of uncertainty; **grey-box validates this first** |

### Zones along `+Z`

| Zone | `Z` span (mm) | `X` side | Notes |
|---|---|---|---|
| Cab | −1950 → 0 | full | Two swivel captain seats, blocked dash |
| Alcove bed | −1400 → 0, above cab | full width | Overhangs the cab; see below |
| Dinette | 100 → 1900 | kerb (`+X`) | Four swivel chairs face-to-face, one pedestal table |
| Sofa / slide-out | 150 → 2050 | off (`−X`) | Bench sofa; slide-out extends it outboard |
| Wardrobe + fridge column | 2050 → 2300 | both | Boundary between lounge and wet zone |
| Galley | 2300 → 4050 | one side, *estimated* | Entry door adjacent; see open question 5 |
| Washroom | 2300 → 4050 | opposite the galley | Moulded GRP wet room, ~900 × 1100 footprint |

### Sleeping surfaces

**Alcove bed, 2200 × 1400 (published).** Runs transversely: 2200 mm across the
vehicle, 1400 mm fore-aft. It cannot run fore-aft, because a 2200 mm fore-aft alcove would not
fit the overhang.
So sleepers lie across the vehicle with 2200 mm of stretch each and 700 mm of shoulder room.
The 2450-wide body gives 2360 interior, which accommodates 2200 with 80 mm each side for trim.

The sibling 御500 has a *sliding* alcove bed at 2150 × 1400, so 境500's is inferred to slide
fore-aft too, probably retracted for driving and extended for sleeping. Model it extended.
Flagged as inferred; do not present it as fact in any UI copy.

**Slide-out bed, 1280 × 1900 (published).** Runs longitudinally: 1900 mm fore-aft,
1280 mm outboard. The bench sofa forms the inboard part; the slide-out mechanism extends it.

**Derived slide travel: ~550–600 mm.** From 1280 mm final bed width minus a ~700 mm sofa base
depth. Sanity-checking the brochure's "+27 % space": 600 × 1900 = 1.14 m² added. Against the
whole floor (4050 × 2360 = 9.56 m²) that is +12 %, but against the lounge zone alone
(~2200 × 2360 = 5.19 m²) it is +22 %. So the claim is plausible and lounge-relative. Good enough
to trust the 550–600 mm figure.

### Width budget check

2360 interior = ~1100 dinette (two chairs abreast) + ~700 sofa base + **~560 aisle**. Tight, and
correct for a 2.45 m vehicle. The automated check enforces ≥ 400 mm so a modelling error that
eats the aisle fails the build rather than shipping.

### Grey-box gate

Before any Blender work: build the whole plan as boxes in Three.js, put the camera where the
reference photos were taken, and compare. Proportion errors are near-free to fix here and
expensive to fix after modelling. **No modelling starts until the grey-box matches.**

## 3. Data model

Two files own everything a future customisation feature would need to touch.

`src/data/vehicle.ts` — geometry truth and camera stops:

```ts
type Confidence = 'published' | 'derived' | 'estimated';
type Mm = { v: number; c: Confidence; note?: string };

type Placement = {
  id: string;           // matches the glTF node name
  zone: ZoneId;
  origin: [Mm, Mm, Mm]; // mm, in the frame defined above
  size: [Mm, Mm, Mm];   // bounding footprint, for the overlap check
  movable: boolean;     // the hook future furniture-moving reads
};

type Hotspot = {
  id: ZoneId;
  label: string;
  camera: { position: [number, number, number]; target: [number, number, number] };
  orbit: { azimuth: [number, number]; polar: [number, number]; distance: [number, number] };
};
```

`src/data/finishes.ts` — material registry keyed by role, not by mesh:

```ts
type Role =
  | 'wood.cabinet' | 'wood.trim' | 'panel.wall' | 'panel.locker'
  | 'upholstery.seat' | 'upholstery.bolster' | 'upholstery.sofa'
  | 'worktop' | 'floor' | 'washroom.shell' | 'washroom.duckboard'
  | 'metal.brushed' | 'metal.chrome' | 'metal.dark' | 'textile.curtain'
  | 'led.cove' | 'glass';

type Variant = { id: string; label: string; params: MaterialParams };
type Registry = Record<Role, { active: string; variants: Variant[] }>;
```

Roles are the whole customisation design. A mesh never names a colour; it names a role, and the
registry decides what that role looks like. Adding a finish is a data edit. Adding a whole
finish *category* is one entry in `Role`.

### Baseline palette

From the reference imagery. Values are estimated by eye and are a starting point.

| Role | Description | Approx. |
|---|---|---|
| `wood.cabinet` | Dark walnut veneer, satin; gloss on galley overheads | `#5A3A24` |
| `panel.wall`, `panel.locker` | Warm cream / bone, soft-touch | `#EFE7DA` |
| `upholstery.seat` | Grey leather | `#C9CAC9` |
| `upholstery.bolster` | Camel tan, with piping | `#B08052` |
| `upholstery.sofa` | White-cream leather | `#F2EDE4` |
| `worktop` | Pale grey stone-look | `#C9C6BE` |
| `floor` | Mid-grey vinyl, herringbone texture, aluminium trim strips | `#8F9094` |
| `washroom.shell` | Gloss white moulded GRP | `#F7F7F5` |
| `washroom.duckboard` | Teak slats | `#9A6B3C` |
| `metal.brushed` / `metal.chrome` / `metal.dark` | Aluminium, chrome, black mixer | `#B8BCC0` / `#1E1E1E` |
| `textile.curtain` | Sand / taupe | — |

**Shipped proof of the seam:** `wood.cabinet` and `wood.trim` get three variants (walnut, oak, light ash), exposed as three swatches in the UI. Nothing else is user-editable in v1.

## 4. Asset pipeline (Blender → glTF)

One `.blend`, one collection per module. Modules export independently so a single zone can be
re-exported without disturbing the rest:

`shell` · `cab` · `alcove_bed` · `dinette` · `sofa_slideout` · `galley` · `washroom` · `lockers` · `softgoods`

### Contracts between Blender and the runtime

1. Node names match `Placement.id`. The loader binds by name and throws on a mismatch, so a
   rename in Blender fails loudly instead of silently dropping furniture.
2. Material names are roles, prefixed: `role.wood.cabinet`, `role.upholstery.seat`. The
   runtime reads the prefix and looks the rest up in the registry.
3. Metres in Blender, matching the runtime scale, so no import fudge factor exists to get wrong.

### Baking

**Ambient occlusion only, per object, into UV2 → a single `aoMap`.** No full lightmap. This is
the decision that keeps furniture movable: AO travels with the object, so an object that moves
keeps its own contact shading and only loses the (much subtler) bounce from its old neighbours.

### Export and optimisation

- Export via a `bpy` script, one `.glb` per module, to keep it repeatable and diffable.
- Optimise with `gltf-transform`: Draco for geometry, KTX2/Basis for textures. Mature tool, no
  custom compression code.
- The build asserts the budget from §1. Over budget fails.

## 5. Runtime architecture

Vanilla Three.js, no framework. One responsibility per file.

| File | Responsibility | Depends on |
|---|---|---|
| `data/vehicle.ts` | Dimensions, zones, placements, hotspots | nothing |
| `data/finishes.ts` | Role registry and variants | nothing |
| `loader.ts` | Draco/KTX2 setup, load modules, bind nodes to placements | `data/vehicle` |
| `finishes.ts` | Build materials from the registry, apply by role, swap on demand | `data/finishes` |
| `lighting.ts` | IBL, cove emissives, probe capture, shadow caster | `data/vehicle` |
| `camera.ts` | Hotspot tweens, per-hotspot orbit clamps | `data/vehicle` |
| `scene.ts` | Renderer, tone mapping, post chain, frame loop | the above |
| `ui.ts` | Zone buttons, finish swatches | `camera`, `finishes` |
| `check.ts` | The dimensional assertions | `data/vehicle` |

The two `data/` files depend on nothing, which is what makes them safe to edit and safe for a
future customisation UI to write to.

## 6. Lighting

The hard part. The reference imagery is lit almost entirely by indirect light: continuous warm
LED cove strips along both ceiling edges, strips under the lockers, a plinth strip under the
furniture, recessed downlights, and a roof hatch. Real-time rendering is worst at exactly this,
and the no-bake choice means it can't be cheated with a lightmap.

The recipe, in order of how much it contributes:

1. **Interior environment probe.** Render the cabin once to a cubemap with the LED strips
   emissive, and use the result as the scene environment map. One offline-ish pass buys most of
   the bounce light a lightmap would have provided, and unlike a lightmap it doesn't pin the
   furniture in place. Re-capture on demand if a finish swap changes the room's albedo noticeably.
2. A low-resolution HDRI for the world seen through the glazing, so windows read as bright
   openings rather than grey holes.
3. A small number of `RectAreaLight`s for the hero coves, on top of the probe. Keep the count low. They are not cheap and they cast no shadows.
4. Emissive meshes for every strip, so the strips themselves glow in-frame.
5. One shadow-casting light through the roof hatch, for directional contact shadows.
6. **Post:** GTAO and mild bloom on the strips. Nothing heavier. Bloom is what makes an LED strip
   read as a light source rather than a white stripe.
7. ACES Filmic tone mapping, sRGB output, physically-correct lights, exposure tuned against
   the reference shots.

## 7. Verification

Per the goal-driven rule: each of these is a check that fails if the thing breaks.

- **Dimensional** — one `assert`-based script, run in CI and on demand: no two footprints overlap,
  every placement sits inside the habitation box, aisle ≥ 400 mm, both published bed sizes are
  honoured exactly. Small, no framework.
- Visual: three saved camera positions matched to reference shots, rendered and compared side
  by side by eye. Not automated; a pixel diff against someone else's render is meaningless.
- Performance: measured at 1080p desktop and on a mid-range phone against §1.
- Budget: asserted at build time.
- Seam: swap the wood variant, confirm every wood surface changes and nothing else does.

## 8. Phasing

| Phase | Output | Gate |
|---|---|---|
| 1 | `data/vehicle.ts` + grey-box scene of boxes | Proportions match the reference shots. **Blocks everything else.** |
| 2 | Blender shell + export script + `gltf-transform` pass | Shell loads, budget holds, node binding works |
| 3 | Furniture modules, easiest zone first, washroom last | Dimensional check passes |
| 4 | `finishes.ts` + `lighting.ts` | Visual comparison holds up |
| 5 | Hotspot camera, UI, wood swap | All success criteria met |

## 9. Risks

1. **No floorplan exists.** The single biggest risk. Mitigated by the confidence tags, by using
   the published bed sizes as photo calibration, and by the phase-1 grey-box gate.
2. **The reference imagery is probably CG, not photography.** The plants, the fruit, and the light
   in several shots do not look photographed. So the target is matching *another renderer's
   output*, which is easier than matching reality but means there is no ground truth to appeal to
   when something looks off.
3. **The washroom is a moulded GRP shell.** Compound curves, no flat panels. Hardest thing in the
   vehicle to model, and the least visible. Modelled last, and accepted as the weakest zone.
4. **Interior standing height is the shakiest number** (~2000 mm, estimated). It scales the whole
   room. Phase 1 exists largely to catch this.
5. **`RectAreaLight` cost** could break the mobile frame budget. Fallback: drop to the probe alone
   on mobile and accept flatter cove light.

## 10. Open questions

Not blocking; resolve during phase 1 or state as assumptions.

1. Which side is the slide-out on? The photos are consistent with the off side, but no exterior
   shot of the deployed mechanism was found. Assumed off side (`−X`).
2. Where exactly is the entry door relative to the galley and the rear axle? Assumed alongside
   the galley, per the 后上门 (rear-side door) layout of the 境 family.
3. Does the alcove bed slide, and how far? Assumed yes, modelled extended.
4. Is the tall dark-gloss column the 148 L fridge? Assumed yes.
5. Which side is the galley on, and which the washroom? The interior photographs are ambiguous
   about camera heading, so left/right cannot be settled from them. Pick one during phase 1, note
   it as an assumption, and mirror the pair if better evidence appears. The zone *lengths* are
   unaffected either way, so this does not block modelling.

## Phase 1 gate findings (2026-09-05)

Grey-box built from `PLACEMENTS` and reviewed against the reference imagery. Renders saved to
[../research/gate-02-plan.png](../research/gate-02-plan.png) (plan, ceiling and overheads hidden)
and [../research/gate-03-eye-level.png](../research/gate-03-eye-level.png) (aisle at 1.55 m eye
height looking forward, kerb wall cut away).

### Fixed during the gate

1. **The corridor pinched to 220 mm.** The washroom was 1000 mm wide with its inboard edge at
   `X −150`, while the lounge aisle runs `−450 → +70`. Each *slice* passed the ≥ 400 mm test, but
   the two ranges barely overlapped, so the continuously walkable corridor was only 220 mm. The
   per-slice check cannot see this; the plan view showed it immediately. Washroom is now 700 mm
   wide with its inboard edge at `−450`, aligned with the sofa, and the corridor runs straight
   from bulkhead to rear wall.
2. **`habLength` was 4048 mm** (5998 − 1950) while every shell box used 4050, so rear furniture
   flush to the back wall failed containment by 2 mm. `cabDepth` is now 1948 mm, an adjustment
   well inside its `estimated` tolerance, and the two agree exactly.
3. **Galley stopped 50 mm short of the rear wall.** Extended to meet it.

### Checked and accepted

- Standing height 2000 mm reads correctly at eye level against the seated figures in the photos.
- Alcove bed underside at 1150 mm clears the cab seat tops (1100 mm) and leaves 650 mm of
  sleeping headroom, which is normal for the class.
- The slide-out protrudes visibly past the off-side wall, and the bed lands at the published
  1280 × 1900.
- Zone proportions along the length match the 前/中/后 division the 境-family sources describe.

### Open — needs a decision before the furniture is modelled

**Which way does the slide-out move the sofa?** Two readings, and no source settles it:

- **(a) Bed infills inboard.** The sofa base stays put and a panel fills outboard to make the
  1280 mm bed. This is what the data models now. Aisle stays 520 mm deployed.
- **(b) Sofa travels outboard.** The mechanism carries the wall *and* the sofa out by 580 mm, and
  the bed fills the gap left behind. The aisle would then *widen* to ~1100 mm when deployed,
  which is the usual selling point of a slide-out and fits the brochure's "+27 % space" better.

**Resolved 2026-09-05: (a), bed infills inboard.** The data already modelled this, so nothing
changed. The consequence to keep in mind while modelling: the slide-out buys sleeping width, not
floor space, and the aisle stays 520 mm deployed.


## Modelling correction (2026-09-05)

The detailed alcove view exposed an error that was hard to read in the grey-box: full-width
lockers at Z -300 to 0 mm blocked the sleeping-area entrance. Their estimated fore-aft origin
is now -1400 mm, placing them at the head end visible in the reference. The 2200 × 1400 mm bed,
locker size, confidence tags and 520 mm habitation aisle are unchanged. The updated placement
and exported geometry pass their dimensional checks.

## Verification (2026-09-05)

Closes the two acceptance steps the modelling handover left open: Task 14 step 5 (lighting tuned
against the references) and Task 15 step 5 (hotspot cameras and success criteria). Renders in
[../research/tuned/](../research/tuned/), captured at 1920 × 941 CSS pixels, device pixel ratio 2.

### Lighting values settled

| Knob | Was | Now | Why |
|---|---|---|---|
| `toneMappingExposure` | 1.0 | 1.05 | The room was under-exposed; past ~1.2 the cream panels clip |
| `scene.environmentIntensity` | 1.1 | 2.5 | The probe was too weak to lift the floor and the lower walls |
| Cove `intensity` | 12 | 26 | The coves barely registered against the probe fill |
| `led.cove` `emissiveIntensity` | 6 | 14 | So the strips read as light sources, not white stripes |

Two changes beyond the four knobs the plan lists:

- **`scene.background` is now daylight, not near-black.** The glazing is 24 % opaque, so the
  panes were compositing over a dark world and reading as grey holes. §6 asks for a
  low-resolution HDRI here; a flat daylight colour buys the same "bright opening" read for one
  line, and `led.cove`-style emissive on the `glass` role makes the panes glow the way the
  reference shots do. An HDRI would additionally give the glass something to reflect.
- **`aoMapIntensity` is held at 0.4.** The bake shares one 2048 px atlas across 29 objects, so
  the ceiling and the long walls get few texels each and read as blotches at full strength.
  At 0.4 the contact shading survives and the blotching does not. The real fix is a second
  atlas page for the shell, not a runtime constant.

### Cameras

All six hotspots were re-placed against the modelled furniture; the grey-box values sat too
close, and two sat inside geometry that did not exist when they were chosen — the cab camera in
the alcove mattress, the washroom camera in the storage band. `camera.test.ts` now fails if any
hotspot position lands inside a placement box.

`tweenTo` released the azimuth and distance limits for the flight but not the polar ones, so the
previous zone's polar floor dragged the arrival off its pose — the slide-out shot landed 0.3 m
low after a visit to the alcove. Fixed, and covered by a test.

### Results against §1

| Axis | Criterion | Result |
|---|---|---|
| Visual | Three viewpoints read as the same room as the references | Lounge, alcove and galley hold up side by side; see the caveats below |
| Dimensional | Automated check passes | 84 tests, `tsc` clean |
| Performance | 60 fps at 1080p desktop | 120 fps (vsync-capped), 32 draws, 60 k triangles |
| Performance | ≥ 30 fps mid-range phone | **Not measured** — see below |
| Budget | ≤ 350 k triangles, ≤ 25 MB, ≤ 40 draw calls | 64,232 triangles, 10.1 MB, 13–32 draws per zone |
| Seam | Wood swap restyles every wood surface and nothing else | Confirmed by material diff: only `role.wood.cabinet` and `role.wood.trim` change |

The seam check reads every material in the live scene before and after clicking a swatch. Walnut
`#5a3a24` → oak `#a97f4f` on both wood roles, every other role byte-identical.

### The phone number is still missing

No physical device was available. As a partial substitute the scene was run at a 412 × 915
mobile viewport with 4× and 20× CPU throttling and held 120 fps at both, which says the frame
loop is not CPU-bound — it says nothing about a phone GPU's fill rate, which is what risk 5
predicts would break first. Treat the mobile criterion as open until someone runs it on hardware.

### Known fidelity gaps

- No bloom or GTAO. §6 asks for both; Task 14 shipped without a post chain and this pass did not
  add one. Bloom is what would make the cove strips read as light rather than bright geometry.
- The world outside is a flat colour, so the glazing reflects nothing and the windows carry no
  scene beyond brightness.
- The washroom stays the weakest zone, as §9 accepted: projecting shelves rather than recessed
  niches, and no shower curtain.
