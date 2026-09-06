# Spec: photo-referenced correction, 360 navigation, exterior view

- Date: 2026-09-05
- Status: approved design, ready for implementation planning
- Extends: [design_rv-interior-3d.md](design_rv-interior-3d.md) — read that first
- Evidence base: [../research/2026-09-04-dachi-wujijing-500-reference.md](../research/2026-09-04-dachi-wujijing-500-reference.md),
  extended by §2 below

## 1. What this is

Three pieces of work on the shipped interior walkthrough:

1. Correct the model against the manufacturer's photography, and drive the surfaces from
   photo-derived textures instead of flat colours.
2. Replace the constrained per-hotspot orbit with a full turn of free look at each stop.
3. Model the outside of the vehicle and add a stop that orbits it.

The parent spec's quality bar is unchanged: match the reference imagery. What changes is that
the reference imagery now drives the materials directly, and the piece is no longer interior-only.

### Two non-goals from the parent spec are reversed here

- §1 said "No exterior bodywork beyond what is visible through the glazing." Section 7 reverses
  this deliberately.
- §1 said "No cab interior detail beyond seat shells and a blocked-in dash." Section 6 extends
  the cab to a dash, wheel and engine tunnel. A modest widening, not a reversal.

Everything else in the parent spec's non-goals still holds. In particular the slide-out is still
modelled deployed only, and there is still no furniture-drag UI, no VR and no persistence.

## 2. New evidence

Gathered 2026-09-05. The product page is a 37-slice vertical marketing poster with no text specs;
all 37 slices were retrieved this time, against 6 previously.

| Source | Adds |
|---|---|
| [dachirv.cn/sys-pd/60.html](https://www.dachirv.cn/sys-pd/60.html) | On-image dimension callouts, galley/washroom/alcove photography, exterior hero shot, external storage hatches |
| [news.sohu.com/a/1024282184_99893844](https://news.sohu.com/a/1024282184_99893844) | Equipment list, entry sequence, wet/dry sliding door |
| [sina.cn/news/detail/5298543585923480.html](https://www.sina.cn/news/detail/5298543585923480.html) | 2026 model year framing, approximate price |

### Confirmed

- Alcove bed 2200 x 1400 mm and slide-out bed 1280 x 1900 mm are both stated on the
  manufacturer's own graphics. Both `published` tags stand.
- 3300 mm wheelbase, Iveco F1C 3.0T, ZF 8AT, 4.5 t, 5 seats.

### Contradicted, and resolved

Sohu and Sina both give the slide-out bed as 1.35 x 2.0 m. The manufacturer's own poster states
1280 x 1900 mm on the image. The primary source wins; the secondary figures are recorded here so
the discrepancy is not rediscovered later.

### Open question 5 closes

The parent spec left the galley/washroom sides undecided. The galley photograph shows the
habitation entry door immediately beside the galley run. On a Chinese left-hand-drive vehicle
that door is on the kerb side. So galley is kerb side (+X) and washroom is off side (-X), which
is what `PLACEMENTS` already encodes. No data change; the question is answered.

The brochure interior shots cannot settle handedness on their own — they are internally
consistent with either mirroring. The regulatory constraint is what settles it.

**Superseded in part, 2026-09-06.** Handedness stands. The door's position does not: it sits at
the rear corner of the kerb flank, not partway along it. See the layout correction at the end.

### Equipment present in the photographs and absent from the model

Entry door with pleated flyscreen, 5 kg washer-dryer, microwave/steam oven, systems touch panel,
wall-mounted TV, roller blinds, framed art and a family photo wall, external storage hatches.

## 3. The warm cast, and why it comes first

Sampling matched surfaces in `docs/research/tuned/lounge.png` against the reference photograph:

| Surface | Photo | Render | Registry |
|---|---|---|---|
| Seat main panel | `#808182`, saturation 0.015 | — | `#e8e1d5`, saturation 0.08 |
| Seat accent | `#3d2f26`, saturation 0.38 | `#a66127`, saturation 0.76 | `#b08052`, saturation 0.53 |
| Floor vinyl | `#8f9094`, saturation 0.034 | `#8c847a`, saturation 0.13 | `#7c8288`, saturation 0.09 |

The floor's registry value is already a cool neutral grey and still renders warm. That rules out
a palette error as the explanation and points at the image as a whole: `environmentIntensity` was
raised to 2.5 during the acceptance pass, the probe it amplifies is a cubemap of a walnut-lined
room lit by warm LEDs, and ACES saturates the warm end. Every neutral in the scene drifts.

So what reads as "the chairs are orange" is one white-balance bug plus one genuine palette error:
the seat leather is a neutral grey in the photographs, not cream. The parent spec's palette table
and the research note both call it cream leather. That was wrong.

**This is sequenced first.** Remodelling or retexturing against a mis-balanced image would bake
the cast into every judgement that follows.

### The fix

A `?calibrate` mode samples fixed screen-space patches over surfaces that are neutral in the
reference — floor, seat main panel, washroom shell — and reports each patch's saturation. Tune
`toneMappingExposure`, `scene.environmentIntensity` and the cove emissive colour until every
patch lands under 0.08 saturation. For reference the photographs measure 0.015 to 0.034, and the
registry's own floor value sits at 0.09 before any rendering.

Correct `upholstery.seat` in the same pass. Starting value `#c9cac9`, saturation 0.005, tagged
`estimated`: the photograph samples `#808182` in shadow, so the albedo is lighter than the pixel.

## 4. Textures

### Where appearance lives

Today it is split: `data/finishes.ts` owns colour, roughness and metalness, while four roles
(`wood.cabinet`, `wood.trim`, `floor`, `textile.curtain`) share three greyscale maps packed into
their Blender materials by `tools/surface_textures.py` and exported inside the `.glb`s.

This design moves maps to the runtime and leaves the `.glb`s carrying geometry and the baked AO
only. Three reasons:

1. The registry becomes the single owner of appearance, which is the seam the parent spec is
   built around.
2. A finish *variant* can carry its own map, so the shipped wood swap changes grain as well as
   tint. Colour-only variants cannot.
3. The rectified crops are authored outside Blender. Routing them through Blender means importing
   images purely to re-export them, and turns every texture tweak into a Blender plus optimise
   plus nine-file cycle.

Decals are the exception and stay in Blender, because framed art, appliance fascias and screens
are per-object, not per-role.

### Data shape

`data/finishes.ts` still imports nothing. A texture is described, not loaded:

```ts
interface TextureSpec {
  readonly url: string;                          // /textures/<name>.ktx2
  readonly repeat?: readonly [number, number];   // UV tiling, default [1, 1]
  readonly srgb?: boolean;                       // base colour true, normal false
}

interface MaterialParams {
  // ...existing color / roughness / metalness / emissive
  readonly map?: TextureSpec;
  readonly normalMap?: TextureSpec;
  readonly normalScale?: number;
  readonly transparent?: boolean;                // decals and body graphics
}
```

No `roughnessMap` in v1. Add one when a surface demonstrably needs it.

### Runtime

`src/textures.ts` resolves a `TextureSpec` to a `THREE.Texture`, cached by URL, sharing the
KTX2 loader `loader.ts` already creates.

`applyFinishes` gains an optional third argument: a resolver function. It defaults to returning
null, which keeps `finishes.test.ts` running under vitest's node environment, where there is no
WebGL context to decode KTX2 with.

### Authoring

`tools/rectify_textures.mjs` reads a `textures.json` manifest — source image, four corner points,
output size, target role — and emits a perspective-corrected, flat-field-corrected, seam-blended
tile per entry. Flat-field correction matters. A photograph of a lit
cabinet door carries a brightness gradient, and tiling that gradient produces visible hotspots.

Roles receiving maps: `wood.cabinet`, `wood.trim`, `floor`, `worktop`, `upholstery.seat`,
`upholstery.bolster`, `upholstery.sofa`, `washroom.shell`, `textile.curtain`.

### The risk to check first

Tiling maps need consistent texel density on UV1. If the existing unwrap does not have it, wood
grain will run at different scales on adjacent cabinet doors and the whole approach looks wrong.
Verify this before authoring any maps; a re-unwrap at fixed texel density is the fallback.

## 5. Navigation

`OrbitControls` rotates the camera around a target at 1.2 to 3.0 m. The interior is 2.36 m wide,
so releasing the azimuth limit sweeps the camera through both walls. Free look needs the camera
to rotate **in place**, which is a different control, not a loosened clamp.

`src/look.ts` provides yaw and pitch from pointer drag about a fixed eye point. Yaw is
unlimited, pitch is clamped, and the camera position never changes. Roughly forty lines.

`Hotspot` becomes a discriminated union so no field is meaningless in either mode:

```ts
type Hotspot = {
  readonly id: ZoneId;
  readonly label: string;
  readonly camera: { position: [number, number, number]; target: [number, number, number] };
  readonly view:
    | { kind: 'look';  pitch: [number, number] }
    | { kind: 'orbit'; azimuth: [number, number]; polar: [number, number]; distance: [number, number] };
};
```

The six interior stops become `look`. The exterior stop is `orbit`, where orbiting genuinely is
the right verb. `applyHotspotLimits` stays, serving `orbit` stops only. `tweenTo` needs no change:
it already interpolates eye and target, and in look mode the target is the eye plus forward.

`SceneBundle` carries both controllers; `render()` updates whichever is enabled.

## 6. Model corrections

| # | Photograph shows | Where the fix lands |
|---|---|---|
| 1 | Seat leather neutral grey, accents camel | `data/finishes.ts` |
| 2 | Neutrals neutral | §3 calibration |
| 3 | Ceiling walnut centre band, stepped cove, dark hatch surround | Blender `shell` |
| 4 | Locker doors cream in a walnut frame, LED strip beneath | Blender `lockers` |
| 5 | Table with walnut edge band on a chrome pedestal | Blender `dinette` |
| 6 | Sofa keeps a back cushion deployed; walnut drawer plinth | Blender `sofa_slideout` |
| 7 | Square stainless bowl at the aisle end, window over the counter, sink and hob swapped | Blender `galley` |
| 8 | Corner vanity, mirror cabinet, ribbed GRP, damask curtain, grab rails, recessed niches | Blender `washroom` |
| 9 | Iveco dash, steering wheel, engine tunnel between the seats | Blender `cab` |
| 10 | Entry door and flyscreen, washer, oven, systems panel, TV, blinds, wall art | Blender, new placements |

Row 3 is the highest-value geometry change. The ceiling fills roughly a third of every wide shot
and is currently flat cream against a photograph that is banded walnut.

New roles for row 10: `graphic.print` (framed art, photo wall) and `graphic.screen`
(systems panel and TV, emissive).

## 7. Exterior

A new `exterior` collection and `tools/model_exterior.py`: cab and bonnet, FRP over-cab moulding,
body sides, deployed slide-out box, wheels and skirts. Side graphics, the entry door and the
storage hatches are photo decals on flat panels rather than modelled relief.

New roles: `body.paint`, `body.graphic`, `tyre`, `wheel`.

### The geometry is already determined

Every exterior dimension falls out of `ENVELOPE`, so the exterior introduces almost no new
estimated numbers:

| Feature | Value | From |
|---|---|---|
| Ground plane | `Y = -1050` | `floorAboveGround` |
| Nose | `Z = -1948` | `cabDepth` |
| Rear face | `Z = 4050` | `habLength` |
| Body sides | `X = ±1225` | `overallWidth / 2` |
| Roof | `Y = 2150` | `overallHeight - floorAboveGround` |
| Front axle | `Z = -898` | `frontAxleFromNose` |
| Rear axle | `Z = 2402` | front axle + `wheelbase` |
| Wheel radius | 372 mm, `estimated` | 225/75R16 on the Daily 4.5 t |

That leaves 120 mm between the interior ceiling panel and the roof line for roof structure, the
hatch and the air conditioner, which is consistent.

This makes the published envelope verifiable geometry for the first time: §9 asserts the modelled
body measures 5998 x 2450 x 3200 mm.

### Checks that need widening

- `check.ts` excludes the `shell` zone from overlap and containment tests, at the single
  `p.zone !== 'shell'` filter in `furniture()`. `exterior` needs the same exclusion, because the
  body encloses everything by design. `ZONE_VOLUME` and its two `Exclude<ZoneId, 'shell'>` casts
  widen alongside it.
- `binding.ts` only enforces the naming contract once every module is present, so the exterior
  placements and the exterior `.glb` must land in the same change.
- The scene gains a ground plane and a gradient sky, owned by `scene.ts`. This also closes the
  parent spec's recorded gap that the glazing reflects nothing.

### The lighting trap

`installLighting` captures its environment probe from inside the cabin, and the windows currently
read as openings because a bright background composites through 24 %-opaque glazing. Wrap that cabin in an opaque body and the light stops arriving. The fix is a render layer that
holds the exterior body out of the probe capture. Recorded here because it would otherwise
surface as an unexplained darkening the moment the exterior lands, with nothing in the diff to
point at.

## 8. Budget

Current: 64,232 triangles of 350,000; 10.1 MB of 25 MB; 35 draw calls of 40.

- **Triangles.** The exterior adds an estimated 30 k. Comfortable.
- **Bytes.** Nine base-colour maps at 1024² KTX2 come to roughly 3 MB, plus normals only where
  they read — leather, walnut, GRP ribbing, floor. Expect to land near 16 MB. The 25 MB ceiling
  holds and `check_budget.mjs` thresholds do not move.
- **Draw calls.** This is the constraint that breaks. Decals and the exterior will exceed 40.
  Decals are atlased into one mesh per zone. The criterion changes to: **≤ 40 at any interior
  hotspot, ≤ 60 at the exterior stop.**

Draw calls are measured in the browser, not asserted by `check_budget.mjs`. That stays true; the
number is recorded evidence, not an automated gate, and this spec does not pretend otherwise.

## 9. Verification

Each item fails if the thing it guards breaks.

| Check | Kind | Asserts |
|---|---|---|
| Neutral roles | vitest | `floor`, `upholstery.seat`, `washroom.shell` registry colours have saturation < 0.10 |
| Rendered neutrals | browser, `?calibrate` | The same three surfaces sample under 0.08 saturation in a real frame |
| Texel density | `check_blend.py` | UV1 density across objects sharing a role varies within tolerance |
| Exterior envelope | `check_models.mjs` | The modelled body measures 5998 x 2450 x 3200 mm to 1 mm |
| Exterior bounds | `check_models.mjs` | All nine exterior nodes land at their placement world bounds |
| Look mode | vitest | Rotating in look mode never changes `camera.position` |
| Hotspot safety | vitest | Every `look` eye sits inside its volume and outside every placement box; every `orbit` ring clears the exterior body |
| Budget | `check_budget.mjs` | Unchanged: 350 k triangles, 25 MB |
| Draw calls | browser | ≤ 40 interior, ≤ 60 exterior |
| Finish seam | browser | The wood swap now changes grain as well as tint, and touches only the two wood roles |

Visual comparison against the reference shots stays a by-eye judgement, as the parent spec says.
A pixel diff against another renderer's output would mean nothing.

## 10. Phasing

Order is load-bearing. Calibration precedes remodelling so that judgements are made against a
correctly balanced image, and the texel-density check precedes map authoring so geometry is not
remodelled twice.

| Phase | Output | Gate |
|---|---|---|
| A | Calibration mode, white balance tuned, seat leather corrected | Neutral patches under 0.08 saturation |
| B | Texel density verified, rectifier, runtime maps, nine roles textured | Grain runs at one scale across adjacent doors |
| C | `look.ts`, hotspot union, camera tests | Full turn at every stop, camera never leaves the eye point |
| D | Model corrections, rows 3 to 10 | Dimensional checks pass, reference comparison holds |
| E | Exterior module, ground, sky, probe layer exclusion | Envelope check passes, interior brightness unchanged |
| F | Budget and verification pass | Section 9 in full |

## 11. Risks

1. **UV texel density.** The largest technical unknown. If UV1 was unwrapped without consistent
   density, every tiling map is wrong and phase B grows a re-unwrap. Checked first, in phase B.
2. **Baked lighting in the crops.** The source photographs are lit. Flat-field correction in the
   rectifier is what stands between a usable tile and a tile with a hotspot in it.
3. **The reference imagery is probably CG.** Inherited as risk 2 of the parent spec, and
   compounded here: rectifying a render gives another renderer's lighting, not a measured
   material. This is acceptable for the stated goal — matching the reference — and would not be
   acceptable if the goal were physical accuracy.
4. **Provenance.** The maps derive from the manufacturer's imagery, and this is a public
   portfolio piece. The registry seam means any map can be swapped for a clean-provenance
   equivalent without touching geometry or code. Decided knowingly; the exit stays open.
5. **Draw-call ceiling.** Decal atlasing is what keeps the interior under 40. If atlasing does
   not hold, decals are the first thing cut.
6. **Probe darkening from the exterior body.** Section 7 records the mechanism and the layer
   exclusion that prevents it.

## 12. Open questions

1. Wheel and tyre size is estimated from the Daily 4.5 t. No published figure was found. It
   affects ride height in the exterior view only, and nothing dimensional inside.
2. The exterior hero shot shows a two-tone side graphic whose exact artwork is legible but not
   sharp. Treated as a decal reproduced by eye, tagged `estimated`.
3. Whether the alcove bed slides remains unresolved, as in the parent spec. Still modelled
   extended.

## 13. What gets cut if this runs long

The cab (row 9) and the washroom rebuild (row 8), in that order. Both are the least-seen zones,
and the parent spec already records the washroom as the weakest zone by design.

---

## Results (2026-09-06)

Implemented per [plan_rv-photoref-360-exterior.md](plan_rv-photoref-360-exterior.md). Renders in
[../research/final/](../research/final/); the calibration evidence is in
[../research/calibrated/](../research/calibrated/) and the texel-density measurement in
[../research/texel-density.md](../research/texel-density.md).

### Section 9 in full

| Check | Kind | Result |
|---|---|---|
| Neutral roles | vitest | **Pass.** `floor` 0.034, `upholstery.seat` 0.005, `washroom.shell` 0.008, against a threshold of 0.05 |
| Rendered neutrals | browser, `?calibrate` | **Pass.** Floor 0.039, chair panel 0.037, washroom wall 0.051, against 0.08 |
| Texel density | `check_blend.py` | **Pass, after a fix.** See below |
| Exterior envelope | `check_models.mjs` | **Pass.** 2.450 x 5.998 x 3.200 m, to the millimetre |
| Exterior bounds | `check_models.mjs` | **Pass.** All nine exterior nodes land on their placement world bounds |
| Look mode | vitest | **Pass.** Rotation never changes `camera.position`, verified in the browser at all six stops |
| Hotspot safety | vitest | **Pass.** Every `look` eye sits outside every placement box; the `orbit` ring clears the body at 6.0 m against a 1.225 m half-width |
| Budget | `check_budget.mjs` | **Pass.** 71,980 triangles of 350,000; 9.69 MB of `.glb` plus 0.15 MB of textures, against 25 MB |
| Draw calls | browser | **Pass.** 36 worst interior against 40; 45 exterior against 60 |
| Finish seam | browser | **Pass.** Of 23 roles, the wood swap changes exactly `wood.cabinet` and `wood.trim`, and ash changes grain scale (2.6) as well as tint |

Frame rate at all seven stops: 83 to 97 fps interior, 120 (vsync-capped) exterior, measured over
120 frames into a 3840 x 1882 buffer — four times the pixel count of 1080p.

### Risk 1 fired, and the fallback was needed

`role.floor` measured a texel-density spread of 4.30 against the plan's threshold of 4, so the
gate ahead of map authoring failed as designed. The cause was between objects, not within them:
`smart_project` normalises each object into the 0..1 square, so the joined `shell_details`
catch-all sat at 0.056 UV/m beside a standalone floor at 0.200.

`normalise_uv_density()` rescales each unwrap to a fixed 1.0 UV/m. It rescales rather than
re-unwraps, so UV2 and the packed AO atlas stayed valid and no re-bake was required — cheaper
than the fallback §11 anticipated. Worst spread across the model fell from 8.57 to 1.40.

### Three corrections to this spec's own design

1. **Maps carry luminance only; the registry keeps hue.** §4 has the registry own colour *and*
   the map.
   THREE multiplies the two, so a map carrying its own hue tints twice: the camel bolster crop
   has a mean of (125, 82, 46), and multiplied by the registry's `0xb08052` it rendered brick
   red. The rectifier now flattens each map to luminance around a fixed mean and the registry
   keeps hue, which is what the palette tables describe and what the greyscale maps in
   `tools/surface_textures.py` already did. `"colour": true` opts a decal out.
2. **Eight maps, not nine.** `wood.trim` shares `walnut.webp`: the reference shows one veneer on
   both the cabinets and the ceiling band, so a second crop of the same material adds only a
   second way to be wrong.
3. **The cove tint is the white-balance lever.** §3 names `environmentIntensity` first instead.
   Lowering it from 2.5 to 1.2 made the floor patch *worse*, 0.155 to 0.245, because the probe
   carries the cool
   daylight arriving through the glazing and the roof hatch, so weakening it concentrates the
   coves' orange. Cooling the `RectAreaLight` tint from `0xffd9a0` to `0xffeed8` was the whole
   fix; exposure stayed at 1.05.

### Row 10 could not be placements

§6 row 10 and the plan add `entry_door`, `washer`, `oven` and `systems_panel` as placements. All
four overlap existing furniture, and not by a coordinate error: a built-in appliance shares the
volume of the cabinetry it is built into, which is what the overlap check exists to forbid, and
the kerb wall the reference hangs the door on is covered end to end by the wardrobe and the
galley run. The door became shell architecture, cut into `wall_kerb` beside the windows and
excluded from the checks the same way; the appliances and graphics became detail meshes.

The wall TV is dropped: no unobstructed wall remains for it. The wardrobe went from 400 mm deep
to the 250 mm the parent spec states, which also clears floor in front of the door.

### One defect found in the pipeline itself

`vite build` and `pnpm budget` were mutually destructive. The Blender export writes its
uncompressed `.glb` files to `dist/raw`, Vite builds into `dist`, and Vite empties its output
directory by default — so a build deleted the exports, and the next budget check reported
0 triangles against a 350,000 ceiling. A check that passes because its input vanished is worse
than no check. `emptyOutDir: false` in `vite.config.ts` fixes it.

### Still unmet

- **The mid-range phone frame rate has never been measured on hardware**, and this work does not
  change that. The parent spec recorded it open and it stays open. Desktop headroom is now
  larger, but §11's risk 5 concerns a phone's fill rate, which no desktop measurement predicts.
- **No bloom and no GTAO.** The parent spec's §6 asks for both. Neither pass has added a post
  chain, so the cove strips still read as bright geometry rather than light sources.
- **The exterior is massed rather than sculpted.** Boxes, wheels, a skirt and a decal, which is
  the scope Task 16 defines. The hero shot's shaped cab, curved over-cab moulding, window apertures and storage
  hatches are not modelled.
- **The side livery is a stripe band, not the full artwork**, for the UV reason recorded in
  [../research/final/README.md](../research/final/README.md).

---

## Layout correction (2026-09-06)

Driven by [../research/spatial-brief_大驰无极境500MAX.md](../research/spatial-brief_大驰无极境500MAX.md)
and the manufacturer's walkaround photography. Four things about the plan were wrong, and the
evidence for three of them was already sitting in this project's own research note.

### Fixed

| # | Was | Now | Evidence |
|---|---|---|---|
| 1 | Four swivel chairs face to face around the table | Three automotive seats in one row along the kerb wall, table deployed inboard | S4's 中部3人汽车座椅, and the published 5-seat occupancy: two in the cab leaves three |
| 2 | Lounge ran straight into the rear wet zone | Full-width sliding partition at Z 2500, doorway 760 mm, leaf parked over the wardrobe side | 尾部独立厨卫区 — the rear room is only "independent" if something closes it |
| 3 | One boarding door, cut into the kerb wall at Z 2350–3000 | Two: a rear-wall door on the centreline, and the kerb-side door at the rear corner, Z 3350–4020 | 后上门, plus two walkaround stills that put the side door aft of the rear wheel |
| 4 | Galley run 1500 mm, filling the kerb wall to the rear | 750 mm, Z 2550–3300, forward of the door bay | Follows from 3 |

Row 1's four chairs came from a photograph. The photograph was over-read, and the occupancy
figure settles it arithmetically. Row 3's door was over-read the same way: §2 closed open
question 5 by arguing the galley photograph shows the door "immediately beside the galley run",
which is equally true of a door in the rear corner beside a galley that terminates there.

### Checked against the brief and deliberately kept

- **Slide-out bed stays 1280 × 1900.** The brief gives 2000 × 1350, which is the figure §2
  already recorded as contradicted and resolved: the manufacturer's own poster beats Sohu and
  Sina, and the brief's number traces to the 境280 predecessor.
- **Table stays a chrome pedestal.** The brief calls it wall-mounted or folding. The
  photography this spec is built on shows a pedestal, and a photograph beats a text description.
- **Washroom stays 700 × 1400.** The brief's class is 800–950 × 900–1100, which is the same
  floor area to within a few per cent, and the 700 mm width is the parent spec's phase-1 fix
  for a corridor that pinched to 220 mm.
- **Zone id stays `dinette`.** It is the wrong word for a three-seat lounge, but renaming it
  reaches into `ZoneId`, the grey-box palette, the collection names and nine `.glb` filenames
  to buy nothing. The hotspot has read "Lounge" since the first pass.

### Two defects the rework exposed

Both were latent, and both were the same mistake: geometry measured in absolute offsets from a
placement's centre rather than from its own ends.

- `build_galley` put the sink at `y − .39` and the cabinet pulls at a fixed 340 mm. At the
  shortened 750 mm run the sink hung past the front of the cabinet and the pulls overhung both
  ends by 45 mm, which `check_models.mjs` caught as "geometry exceeds placement box". Everything
  fore-aft now derives from the run's two ends, so the module is correct at either length.
- `entry_door` built the leaf as one 35 mm slab with the 6 mm pane buried inside it. The door
  read as a blank panel from indoors. The leaf is now a frame around the aperture. The exterior
  door is a four-strip reveal with nothing across the opening for the same reason: the body is
  one solid mass, so anything filling that rectangle turns the interior glazing black.

### Checks added

| Check | Kind | Asserts |
|---|---|---|
| Lounge seat count | vitest | Three `dinette_chair_*`, and lounge plus cab equals the published five |
| Seat row | vitest | One column of three seats, each at a different Z |
| Partition | vitest | Spans the full habitation width, floor to ceiling, between the lounge and the service zone |
| Stop sides | vitest | Lounge stops forward of the partition, service stops aft of it |
| Rear entry | `check_blend.py` | A ray aft along the lounge centreline reaches y 4.048, through the partition doorway to the rear door; a sealed partition stops it at 2.5 |
| Rear glazing | `check_blend.py` | `role.glass` exists in the rear wall |

### Re-measured

| Axis | Ceiling | Result |
|---|---|---|
| Triangles | 350,000 | 76,036 |
| Bytes | 25 MB | 9.52 MB |
| Draw calls, worst interior | 40 | 32 |
| Draw calls, exterior | 60 | 40 |
| Frame rate | 60 fps at 1080p | 116–120, vsync-capped, at 1600 × 900 |
| vitest + `tsc` | — | 113 tests, clean |

Placement bounds, the exterior envelope (5998 × 2450 × 3200 mm), texel density and the AO wiring
all still pass unchanged.

### Still open

Neither walkaround still shows the rear-wall door; both show only the kerb-side one at the rear
corner. It is modelled because the layout brief is explicit about a rear entry sequence and
because that was the call taken during this pass, but it is the one piece of geometry here with
no photograph behind it. Removing it is a two-line change to `build_shell`.
