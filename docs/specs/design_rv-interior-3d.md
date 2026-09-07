# Spec: 大驰 无极境500 — photoreal Three.js walkthrough

- Date: 2026-09-05, merged and brought current 2026-09-06
- Status: implemented
- Evidence base: [../research/2026-09-04-dachi-wujijing-500-reference.md](../research/2026-09-04-dachi-wujijing-500-reference.md),
  [../research/spatial-brief_大驰无极境500MAX.md](../research/spatial-brief_大驰无极境500MAX.md),
  and the manufacturer's stills and walkthrough video (sources listed in the record)
- Skills in play: `threejs-webgl` (runtime), `blender-web-pipeline` (assets)
- Plans: [plan_rv-interior-3d.md](plan_rv-interior-3d.md) built §1–§3, §5–§7 and §10–§14;
  [plan_rv-photoref-360-exterior.md](plan_rv-photoref-360-exterior.md) added §4, §7's calibration
  and probe trap, §8, §9 and §10's raised draw-call ceiling

**This document absorbed `design_rv-photoref-360-exterior.md`**, which was written as a child spec
covering the photo-referenced correction, free look and the exterior. Sections 1 to 14 describe
the design as built. The [implementation record](#implementation-record) keeps the dated passes in
order, including the readings each one replaced — three of the corrections reversed layout
decisions that the numbered sections now state only in their final form.

## 1. What this is

A web page that renders a 大驰 无极境500 C-type motorhome: six interior stops with free look
inside the cabin, and one stop that orbits the body from outside. Close enough to the
manufacturer's own imagery to stand as a portfolio piece, and structured so that moving furniture
and changing finishes stay cheap.

**Purpose: portfolio / technical demonstration.** That fixes the quality bar at "matches the
reference imagery" and makes visual fidelity the primary success criterion. It also means
customisation is an architectural requirement, not a shipped feature.

### Goals

1. The interior zones are recognisably this vehicle, at correct scale.
2. Lighting and materials read as the reference imagery does: warm LED cove light in a narrow box,
   and neutrals that stay neutral.
3. Layout and finishes live in data, so both are editable without touching render code.
4. Surfaces are driven by photo-derived textures, so a finish variant can change grain as well as
   tint.
5. One finish swap ships, proving the customisation seam works.
6. The published envelope is verifiable geometry rather than a number in a table.

### Non-goals

Stated so they don't get relitigated:

- **Slide-out is modelled deployed only.** No retract animation, despite +27 % being a headline
  claim. The stowable booth table follows the same rule, for the same reason.
- No furniture-drag UI, no VR, no physics, no persistence, no pricing, no lead capture.
- No orthographic camera. The plan stop in §8 uses the existing perspective camera from high up;
  a second camera type would fork `scene.ts`, `camera.ts` and every resize path.
- No rectified photograph for the body livery. The presenter stands in front of the flank in every
  frame that shows enough of it, so rectifying bakes a person and a showroom into the paintwork.

Three non-goals from earlier passes were reversed on purpose and are now scope: exterior bodywork
(§9), cab interior detail beyond seat shells and a blocked dash (§5's `cab` module), and the
sculpted exterior — the over-cab taper, hand-drawn livery, black window frames and fittings that
§9 now carries. The windscreen rake is the one part of that reversal still outstanding, and §14
records why.

### Success criteria

| Axis | Criterion |
|---|---|
| Visual | Three matched camera positions read as the same room as the reference shots, side by side |
| Dimensional | Automated check passes: no overlaps, everything inside its volume, aisle ≥ 400 mm, both published bed sizes exact |
| Envelope | The modelled body measures 5998 × 2450 × 3200 mm to the millimetre |
| Neutral balance | Floor, seat panel and washroom shell sample under 0.08 saturation in a rendered frame |
| Performance | 60 fps at 1080p on desktop; ≥ 30 fps on a mid-range phone |
| Budget | ≤ 350k triangles, ≤ 25 MB transferred |
| Draw calls | ≤ 40 at any interior stop, ≤ 60 at the exterior stop |
| Seam | Changing the wood variant restyles every wood surface — grain and tint — and nothing else |

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
| Cab depth (nose to bulkhead) | 1948 | estimated | Set so `habLength` lands on 4050 |
| Habitation floor length | 4050 | derived | 5998 − 1948 |
| Habitation interior width | 2360 | derived | 2450 − 2 × 45 mm sandwich wall |
| Habitation floor height above ground | ~1050 | estimated | Chassis frame + double floor for tanks and underfloor heating |
| Interior standing height | ~2000 | estimated | Wide band of uncertainty; the grey-box gate validated it first |
| Slide travel | 580 | derived | 1280 bed width minus a ~700 mm sofa base |

### Zones along `+Z`

The layout as built, after the three corrections recorded at the end of this document. It is a
后置厨卫 plan: lounge forward, a full-width sliding partition, and an independent service room
behind it.

| Zone | `Z` span (mm) | `X` side | Notes |
|---|---|---|---|
| Cab | −1948 → 0 | full | Two swivel captain seats, dash binnacle, wheel, engine tunnel |
| Alcove bed | −1400 → 0, above cab | full width | Transverse 2200 × 1400, head-end lockers |
| Lounge — 卡座 booth | 100 → 2000 | off (`−X`) | One seat forward facing aft, two abreast facing forward, stowable table between; overhead lockers run the length |
| Slide-out / sofa bed | 150 → 2050 | kerb (`+X`) | Bench base plus the 1280 × 1900 bed; deploys 580 mm outboard |
| Storage band | 2100 → 2500 | fridge off, wardrobe kerb | The 148 L fridge column starts the line the galley continues |
| Sliding partition | 2500 | full width | Floor to ceiling, 760 mm doorway, leaf parks over the wardrobe side |
| Galley | 2550 → 3750 | off (`−X`) | 1200 mm run, overheads above it, window over the counter |
| Washroom pod | 3050 → 4050 | kerb (`+X`), rear corner | 900 × 1000 moulded GRP corner pod |
| Rear boarding door | in the rear wall at 4050 | 100 mm off the centreline | 后上门; the only entry, since the pod takes the kerb rear corner |

Enter through the rear door and the counter is on your left, the washroom door on your right, and
the partition doorway ahead. The aisle between the counter and the pod is 800 mm.

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
1280 mm outboard. The bench base forms the inboard part; the slide-out mechanism extends it.
Secondary sources disagree — Sohu and Sina give 1.35 × 2.0 m, the spatial brief gives
2000 × 1350 — but the manufacturer's own poster states 1280 × 1900 on the image, and the primary
source wins. Recorded so the discrepancy is not rediscovered.

**Derived slide travel: 580 mm.** From 1280 mm final bed width minus a ~700 mm sofa base
depth. Sanity-checking the brochure's "+27 % space": 580 × 1900 = 1.10 m² added. Against the
whole floor (4050 × 2360 = 9.56 m²) that is +12 %, but against the lounge zone alone
(~2200 × 2360 = 5.19 m²) it is +21 %. So the claim is plausible and lounge-relative.

**The slide-out buys sleeping width, not floor space.** The bed infills inboard: the base stays
put and a panel fills outboard to reach 1280 mm. The alternative reading — the mechanism carries
the whole sofa outboard and widens the aisle to ~1100 mm — was considered and rejected during the
phase 1 gate.

### Width budget check

Across the 2360 mm interior at seat height, deployed: 30 mm clearance at the off wall + 1040 mm
of booth (`X` −1150 → −110) + **560 mm aisle** + 730 mm of slide-out base inboard of the kerb
wall line, with the remaining 550 mm of the 1280 mm base sitting out in the deployed box. Tight,
and correct for a 2.45 m vehicle. The automated check enforces ≥ 400 mm so a modelling error that
eats the aisle fails the build rather than shipping.

### Grey-box gate

Before any Blender work: build the whole plan as boxes in Three.js, put the camera where the
reference photos were taken, and compare. Proportion errors are near-free to fix here and
expensive to fix after modelling. **No modelling starts until the grey-box matches.** `greybox.ts`
survives as the fallback for a checkout with no `public/models/`.

## 3. Data model

Two files own everything a customisation feature would need to touch, and neither imports
Three.js.

`src/data/vehicle.ts` — geometry truth and camera stops:

```ts
type Confidence = 'published' | 'derived' | 'estimated';
type Mm = { v: number; c: Confidence; note?: string };

type Placement = {
  id: string;           // matches the glTF node name
  zone: ZoneId;
  origin: [Mm, Mm, Mm]; // minimum corner, mm, in the frame defined above
  size: [Mm, Mm, Mm];   // positive extents, for the overlap check
  movable: boolean;     // the hook future furniture-moving reads
};

type Hotspot = {
  readonly id: ZoneId;
  readonly label: string;
  readonly camera: { position: [number, number, number]; target: [number, number, number] };
  readonly view:
    | { kind: 'look';  pitch: [number, number] }
    | { kind: 'orbit'; azimuth: [number, number]; polar: [number, number]; distance: [number, number] };
};
```

`view` is a discriminated union so no field is meaningless in either mode: an interior stop has no
orbit radius, and the exterior stop has no pitch clamp. See §8.

`src/data/finishes.ts` — material registry keyed by role, not by mesh:

```ts
type Role =
  | 'wood.cabinet' | 'wood.trim' | 'panel.wall' | 'panel.locker'
  | 'upholstery.seat' | 'upholstery.bolster' | 'upholstery.sofa'
  | 'worktop' | 'floor' | 'washroom.shell' | 'washroom.duckboard'
  | 'metal.brushed' | 'metal.chrome' | 'metal.dark' | 'textile.curtain'
  | 'led.cove' | 'glass'
  | 'graphic.print' | 'graphic.screen'          // framed art, photo wall; systems panel, TV
  | 'body.paint' | 'body.graphic' | 'tyre' | 'wheel';   // exterior

interface TextureSpec {
  readonly url: string;                          // /textures/<name>.webp
  readonly repeat?: readonly [number, number];   // tiles per metre; default [1, 1]
  readonly srgb?: boolean;                       // base colour true, normal false
}

interface MaterialParams {
  readonly color: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
  readonly map?: TextureSpec;
  readonly normalMap?: TextureSpec;
  readonly normalScale?: number;
  readonly transparent?: boolean;                // decals and body graphics
}

type Variant = { id: string; label: string; params: MaterialParams };
type Registry = Record<Role, { active: string; variants: Variant[] }>;
```

Roles are the whole customisation design. A mesh never names a colour; it names a role, and the
registry decides what that role looks like. Adding a finish is a data edit. Adding a whole
finish *category* is one entry in `Role`.

No `roughnessMap`. Add one when a surface demonstrably needs it.

### Baseline palette

From the reference imagery, sampled rather than eyeballed where the photographs allowed it.

| Role | Description | Approx. |
|---|---|---|
| `wood.cabinet` | Dark walnut veneer, satin; gloss on galley overheads | `#5A3A24` |
| `panel.wall`, `panel.locker` | Warm cream / bone, soft-touch | `#EFE7DA` |
| `upholstery.seat` | Grey leather — **not cream**; see §7 | `#C9CAC9` |
| `upholstery.bolster` | Camel tan, with piping | `#B08052` |
| `upholstery.sofa` | White-cream leather | `#F2EDE4` |
| `worktop` | Pale grey stone-look | `#C9C6BE` |
| `floor` | Mid-grey vinyl, herringbone texture, aluminium trim strips | `#8F9094` |
| `washroom.shell` | Gloss white moulded GRP, ribbed | `#F7F7F5` |
| `washroom.duckboard` | Teak slats | `#9A6B3C` |
| `metal.brushed` / `metal.chrome` / `metal.dark` | Aluminium, chrome, black mixer | `#B8BCC0` / `#1E1E1E` |
| `textile.curtain` | Sand / taupe | — |

**Shipped proof of the seam:** `wood.cabinet` and `wood.trim` get three variants (walnut, oak,
light ash), exposed as three swatches in the UI. Ash also runs its grain at a coarser repeat, so
the swap changes grain and not only tint. Nothing else is user-editable.

## 4. Appearance and textures

### Where appearance lives

**The registry owns appearance; the `.glb`s carry geometry and the baked AO only.** Maps are
resolved at runtime from `TextureSpec`, not packed into Blender materials. Three reasons:

1. The registry becomes the single owner of appearance, which is the seam this design is built
   around.
2. A finish *variant* can carry its own map, so the shipped wood swap changes grain as well as
   tint. Colour-only variants cannot.
3. The rectified crops are authored outside Blender. Routing them through Blender means importing
   images purely to re-export them, and turns every texture tweak into a Blender plus optimise
   plus ten-file cycle.

Decals are the exception and stay in Blender, because framed art, appliance fascias and screens
are per-object, not per-role.

### Maps carry luminance only

The registry keeps hue. THREE multiplies map by colour, so a map carrying its own hue tints
twice — the camel bolster crop has a mean of (125, 82, 46), and multiplied by the registry's
`0xb08052` it rendered brick red. The rectifier flattens each map to luminance around a fixed
mean. A decal opts out with `"colour": true` in the manifest.

### Runtime

`src/textures.ts` resolves a `TextureSpec` to a `THREE.Texture`, cached by URL.

`applyFinishes` takes an optional third argument, a resolver function. It defaults to returning
null, which keeps `finishes.test.ts` running under vitest's node environment, where there is no
WebGL context.

Maps ship as **WebP, not KTX2**. KTX2 wins on GPU memory, but it needs the `ktx` binary, which is
not installed on the build machine, and the binding constraint here is transferred bytes, where
WebP is equal or better. `THREE.TextureLoader` needs no plumbing. Revisit if GPU memory becomes
the limit on mobile.

### Authoring

`tools/rectify_textures.mjs` reads the `model/textures.json` manifest — source image, four corner
points, output size, target role — and emits a perspective-corrected, flat-field-corrected,
mirror-tiled WebP per entry. Flat-field correction matters: a photograph of a lit cabinet door
carries a brightness gradient, and tiling that gradient produces visible hotspots. `sharp` does
the decode, blur and encode; the homography is forty lines on top of its raw pixel buffers.

Eight maps cover nine roles: walnut (shared by `wood.cabinet` and `wood.trim` — the reference
shows one veneer on both the cabinets and the ceiling band), herringbone, stone, leather-grey,
leather-camel, leather-cream, grp-ribbed, damask.

### Texel density is the precondition

Tiling maps need consistent texel density on UV1, or wood grain runs at different scales on
adjacent cabinet doors and the whole approach looks wrong. **UVMap runs at exactly 1.0 UV unit
per metre**, held there by `normalise_uv_density()` in `tools/model_interior.py` and asserted by
`check_blend.py`. Every `repeat` in the registry is authored against that, so changing it silently
rescales every texture.

## 5. Asset pipeline (Blender → glTF)

One `.blend`, one collection per module. Modules export independently so a single zone can be
re-exported without disturbing the rest:

`shell` · `cab` · `alcove_bed` · `dinette` · `sofa_slideout` · `galley` · `washroom` · `lockers` ·
`softgoods` · `exterior`

### Contracts between Blender and the runtime

Enforced by `tools/export_modules.py` on the way out and `src/binding.ts` on the way in:

1. Node names match `Placement.id`. The loader binds by name and throws a `BindingError` listing
   every mismatch at once, so a rename in Blender fails loudly instead of silently dropping
   furniture.
2. Material names are roles, prefixed: `role.wood.cabinet`, `role.upholstery.seat`. The
   runtime strips the prefix and Blender's `.001` suffix and looks the rest up in the registry.
3. Metres in Blender, scene unit scale 1.0, matching the runtime, so no import fudge factor
   exists to get wrong.
4. AO baked per object into UV2, and UVMap normalised to 1.0 UV/m.

### Enclosures are not placements

`shell` and `exterior` wrap the cabin by design, so they are excluded from the overlap,
containment, grey-box and camera checks via `ENCLOSURES` in `check.ts`. Anything that encloses
belongs in one of them — the sliding partition and the entry door are shell architecture for this
reason. A built-in appliance cannot be a placement either, because it shares the volume of the
cabinetry it sits in; appliances and graphics are detail meshes.

### Furniture measures from its own ends

`tools/model_furniture.py` builders receive a centre and a size. A hard-coded offset like
`y - .39` is correct only at the length it was tuned at, and three passes have now paid for that
mistake. Every builder derives its geometry from its placement's own faces, and which flank a
module hugs is a data question, not a code one.

### Baking

**Ambient occlusion only, per object, into UV2 → a single `aoMap`.** No full lightmap. This is
the decision that keeps furniture movable: AO travels with the object, so an object that moves
keeps its own contact shading and only loses the (much subtler) bounce from its old neighbours.

### Export and optimisation

- Export via a `bpy` script, one `.glb` per module, to keep it repeatable and diffable.
- Optimise with `gltf-transform`: Draco for geometry. Scene flattening, named-node joining, GPU
  instancing and palette generation are all disabled — they erase node identity and can combine
  material roles, which breaks both contracts above.
- The build asserts the budget from §10. Over budget fails.

## 6. Runtime architecture

Vanilla Three.js, no framework. One responsibility per file. The load order in `main.ts` is the
whole story: check → scene → load → bind → finish → light → UI.

| File | Responsibility | Depends on |
|---|---|---|
| `data/units.ts` | `Mm`, confidence tags, the single mm→m conversion | nothing |
| `data/vehicle.ts` | Envelope, volumes, placements, hotspots | `units` |
| `data/finishes.ts` | Role registry, variants, texture specs | nothing |
| `check.ts` | The dimensional assertions | `data/vehicle` |
| `greybox.ts` | Placements as coloured boxes; the no-models fallback | `data/vehicle` |
| `loader.ts` | Draco setup, load modules, rebase asset URLs onto the Pages base | `data/vehicle` |
| `binding.ts` | Bind loaded nodes to placements by name, strictly | `data/vehicle` |
| `finishes.ts` | Build materials from the registry, apply by role, swap on demand | `data/finishes` |
| `textures.ts` | `TextureSpec` → `THREE.Texture`, cached by URL | `data/finishes` |
| `batching.ts` | Merge primitives by role, preserving movable roots | — |
| `lighting.ts` | Cove `RectAreaLight`s, probe capture, hatch shadow caster | `data/vehicle` |
| `look.ts` | Yaw and pitch about a fixed eye | — |
| `camera.ts` | Hotspot tweens; orbit clamps for the one orbit stop | `data/vehicle` |
| `calibrate.ts` | The `?calibrate` white-balance measurement | `scene` |
| `scene.ts` | Renderer, tone mapping, ground, sky, frame loop, both controllers | the above |
| `labels.ts` | The plan stop's `CSS2DRenderer` overlay; text derived from `PLACEMENTS` | `data/vehicle` |
| `ui.ts` | Zone buttons, finish swatches, the labels toggle | `camera`, `finishes` |

The two `data/` files depend on nothing, which is what makes them safe to edit, safe for a future
customisation UI to write to, and cheap to test — vitest runs with `environment: 'node'`.

`labels.ts` draws a DOM layer over the canvas rather than sprites. Sprites would cost draw calls
at a stop already carrying the exterior body, go blurry when zoomed, and need billboarding;
`CSS2DRenderer` draws nothing on the GPU. It renders unconditionally, because it hides the DOM node
of every child of an invisible object — gating the call on visibility leaves the last frame's
labels frozen on screen when the toggle goes off.

Dev-only query flags: `?verify` exposes `window.__rv` and writes draw calls, triangles and fps to
`canvas.dataset`; `?calibrate` runs §7's saturation measurement.

## 7. Lighting and white balance

The hard part. The reference imagery is lit almost entirely by indirect light: continuous warm
LED cove strips along both ceiling edges, strips under the lockers, a plinth strip under the
furniture, recessed downlights, and a roof hatch. Real-time rendering is worst at exactly this,
and the no-lightmap decision means it can't be cheated.

The recipe, in order of how much it contributes:

1. **Interior environment probe.** Render the cabin once to a cubemap with the LED strips
   emissive, and use the result as the scene environment map. One offline-ish pass buys most of
   the bounce light a lightmap would have provided, and unlike a lightmap it doesn't pin the
   furniture in place. `refreshProbe()` runs after a finish swap, because a swap changes the
   room's albedo.
2. Daylight behind the glazing, so windows read as bright openings rather than grey holes, plus a
   hemisphere sky for the exterior stop.
3. A small number of `RectAreaLight`s for the hero coves, on top of the probe. Keep the count low.
   They are not cheap and they cast no shadows.
4. Emissive meshes for every strip, so the strips themselves glow in-frame.
5. One shadow-casting light through the roof hatch, for directional contact shadows.
6. ACES Filmic tone mapping, sRGB output, physically-correct lights, exposure tuned against the
   reference shots.

**Post is asked for and not shipped.** GTAO and mild bloom on the strips, nothing heavier. Bloom
is what makes an LED strip read as a light source rather than a white stripe. No pass has added a
post chain; recorded as an open fidelity gap in §14.

### The warm cast

Every neutral in the scene drifts warm, and the cause is the image as a whole rather than the
palette. `environmentIntensity` amplifies a probe that is a cubemap of a walnut-lined room lit by
warm LEDs, and ACES saturates the warm end. The floor's registry value is already a cool neutral
grey and still rendered warm, which rules out a palette error.

**The cove tint is the lever.** Lowering `environmentIntensity` makes it *worse*, because the
probe also carries the cool daylight arriving through the glazing and the roof hatch, so weakening
it concentrates the coves' orange. Cooling the `RectAreaLight` tint from `0xffd9a0` to `0xffeed8`
was the whole fix.

`?calibrate` samples fixed screen-space patches over surfaces that are neutral in the reference —
floor, seat main panel, washroom shell — and reports each patch's saturation. The target is under
0.08; the photographs themselves measure 0.015 to 0.034.

**This is sequenced first.** Remodelling or retexturing against a mis-balanced image bakes the
cast into every judgement that follows.

### The probe trap

`installLighting` captures its probe from *inside* the cabin, and the windows read as openings
because a bright background composites through 24 %-opaque glazing. Wrap that cabin in an opaque
body and the light stops arriving. So the exterior group is hidden for the duration of the
capture. Visibility toggling rather than render layers is deliberate: `CubeCamera` holds six child
cameras, and setting layers on the parent does not propagate to all of them.

Recorded prominently because it would otherwise surface as an unexplained darkening the moment the
exterior lands, with nothing in the diff to point at.

## 8. Navigation

`OrbitControls` rotates the camera around a target at 1.2 to 3.0 m. The interior is 2.36 m wide,
so releasing the azimuth limit sweeps the camera through both walls. Free look needs the camera to
rotate **in place**, which is a different control, not a loosened clamp.

`src/look.ts` provides yaw and pitch from pointer drag about a fixed eye point. Yaw is unlimited,
pitch is clamped, and the camera position never changes. Roughly forty lines.

The six interior stops are `look`. The exterior stop is `orbit`, where orbiting genuinely is the
right verb: outside, there is room to swing around the subject. `applyHotspotLimits` serves
`orbit` stops only. `tweenTo` interpolates eye and target as before — in look mode the target is
the eye plus forward — and hands the camera to the correct controller on arrival.

`SceneBundle` carries both controllers; `render()` updates whichever is enabled.

### The plan stop

An eighth stop, `id: 'plan'`, which is the floorplan the manufacturer never published, shown
rather than drawn. It orbits, and it sections the vehicle with a global clip plane at
`PLAN_CUT_MM` — 1400 mm, read off the two lounge locker runs' undersides rather than written as a
literal, so moving a locker run moves the cut. One plane there takes the ceiling, both cove
fascias and every locker run, and leaves both mattresses whole.

A clip plane rather than hiding the roof, because `batching.ts` has merged the roof panels, the
locker carcasses and the walls into one `panel.wall` mesh before the first frame; there is no
roof object left to hide by name. Clipping is per-fragment and does not care how geometry was
grouped. `arrive()` sets the plane on arrival and clears it on departure, and `scene.ts` sets
`localClippingEnabled` once.

Two consequences the code has to carry:

- `Hotspot.id` is `StopId = ZoneId | 'plan'`. A camera stop is not a zone: `ZoneId` feeds
  `ZONE_VOLUME`, `Placement.zone` and the containment check, and the plan stop owns no furniture.
- `refreshProbe` saves, clears and restores `renderer.clippingPlanes` around its capture, for the
  same reason it hides the exterior body. See §7's probe trap.

The arrival pose sits **on** the 0.05 polar floor rather than straight overhead. Directly above the
target the view direction is parallel to the camera's up vector, so which way the plan reads is
decided by whatever pose the tween came from; leaning 0.42 m aft pins it nose-up, the way §2 of the
spatial brief draws every floor plan. The target is the body's centre at `Z = 1050`, not the
habitation box's, or the cab and the alcove fall off the top of the frame.

Labels over the plan come from `PLAN_LABELS`, and each one reads its dimensions and its confidence
tag off the placement it names, so a label cannot claim a size the geometry does not have. Things
that are not placements — the two aisle widths, the boarding door — carry an explicit anchor and
detail string instead. A toggle beside the finish swatches shows and hides them, and it is present
only at this stop.

## 9. Exterior

An `exterior` collection built by `tools/model_exterior.py`: cab with bonnet, grille and mirrors,
FRP over-cab moulding, body sides, deployed slide-out box, wheels and skirts, plus the fittings the
walkaround stops at — roof air conditioner, front-loader washer door, awning cassette and strip,
storage bay, control panel, rear light clusters, alloy spokes, mudflaps and grab rails. Roles:
`body.paint`, `body.graphic`, `tyre`, `wheel`, and the shared `metal.dark`, `metal.chrome`,
`metal.brushed`, `glass`, `led.cove` and `graphic.screen`. The sculpting pass added no new role,
which is why it cost no draw calls: batching is global per role.

### Livery, apertures and the taper

The flank livery is hand-drawn artwork in `model/side-livery.svg`, rasterised by
`tools/render_livery.mjs`, not a rectified photograph — see §1's non-goals. It carries a wordmark,
so it cannot tile: the decal planes get an explicit box UV from `box_uv()` spanning their own
3.4 × 0.70 m at 1.0 UV/m, and the registry divides that back to one copy with
`repeat: [1/3.4, 1/0.70]`. Two pipeline details are load-bearing:

- `KEEPS_OWN_UV` in `model_interior.py` exempts these planes from **both** the `<module>_details`
  join and the re-unwrap in `main()`. The join runs first, so exempting only the unwrap would miss.
- `box_uv` writes `1 - v`, because the glTF exporter flips every V on the way out. Without that,
  a UV of 0 to `span` exports as `1 - span` to 1 and the registry's repeat turns the offset into a
  roll.

One texture cannot give both flanks legible lettering **and** the same fore-aft composition; they
are mirror images. Lettering wins, so `box_uv` takes a `flip` and the artwork lands chevrons-aft on
the kerb flank, matching the reference photograph.

Window apertures stay **open** — four `metal.dark` strips scribed around a hole, never a filled
rectangle, because anything filling one sits between the interior glazing and the sky and renders
that glazing black from indoors. The one exception is the over-cab forward window, where the
surface behind is `build_shell`'s opaque `alcove_front` panel rather than glazing, so a single
filled panel is safe and is what bridges the taper's slope.

The over-cab taper is **carved out of** `body_alcove`'s own front face, not added in front of it.
An added mass would sit forward of the nose plane and make the vehicle 6318 mm long, and
`check_models.mjs` would not catch it: that assertion measures the eight named bodies, and a detail
mesh is not one. The restraint has to be deliberate, exactly as it already is for the spare wheel.

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

This makes the published envelope verifiable geometry for the first time: §11 asserts the modelled
body measures 5998 × 2450 × 3200 mm. The envelope check excludes `slideout_box` — the published
2450 mm is the *retracted* width, and a deployed slide-out legitimately exceeds it by 580 mm.

The scene gains a ground plane and a gradient sky, owned by `scene.ts`. That also gives the
glazing something to reflect.

## 10. Budget

| Axis | Ceiling | Note |
|---|---|---|
| Triangles | 350,000 | Asserted by `check_budget.mjs` against the raw exports |
| Bytes | 25 MB | Optimised `.glb`s plus `public/textures/` |
| Draw calls | ≤ 40 interior, ≤ 60 exterior | Measured in the browser, not asserted |

The draw-call criterion was a flat 40 before the exterior existed. Decals and a tenth module
exceed that, so decals are atlased into one mesh per zone and the exterior stop gets its own
ceiling. Draw calls stay browser-measured recorded evidence rather than an automated gate;
`check_budget.mjs` reads `dist/raw`, which only exists after a local export, and this spec does
not pretend otherwise.

Latest measurement: 73,404 triangles, 9.48 MB, 30 draw calls at the worst interior stop, 40 at the
exterior. Full tables in the [implementation record](#implementation-record).

## 11. Verification

Each item fails if the thing it guards breaks. Visual comparison against the reference shots stays
a by-eye judgement: a pixel diff against another renderer's output would mean nothing.

| Check | Kind | Asserts |
|---|---|---|
| Dimensional integrity | vitest + startup | No two placements overlap, each sits inside its own zone volume, aisle ≥ 400 mm, both published bed sizes exact |
| Lounge occupancy | vitest | Three `dinette_chair_*`, and lounge plus cab equals the published five |
| Booth arrangement | vitest | One seat forward of the table, two abreast aft of it, table reachable from both sides |
| Partition | vitest | Spans the full habitation width, floor to ceiling, aft of the lounge and forward of the service room |
| Stop sides | vitest | Lounge stops forward of the partition, service stops aft of it |
| Neutral roles | vitest | `floor`, `upholstery.seat`, `washroom.shell` registry colours stay under 0.05 saturation |
| Rendered neutrals | browser, `?calibrate` | The same three surfaces sample under 0.08 saturation in a real frame |
| Look mode | vitest | Rotating in look mode never changes `camera.position` |
| Hotspot safety | vitest | Every `look` eye sits inside its volume and outside every placement box; the `orbit` ring clears the exterior body at every point |
| Orbit azimuth | vitest | A whole turn is written as no limit, not as `centre ± PI` |
| Texel density | `check_blend.py` | UV1 density across objects sharing a role varies within tolerance |
| Apertures | `check_blend.py` | Rays pass through the real window and hatch openings, the alcove entrance is unobstructed, and a ray aft along the lounge centreline reaches the rear door through the partition doorway |
| Rear glazing | `check_blend.py` | `role.glass` exists in the rear wall |
| Placement bounds | `check_models.mjs` | Every node lands on its placement's world bounds, raw and optimised, to 1 mm |
| Exterior envelope | `check_models.mjs` | The modelled body measures 5998 × 2450 × 3200 mm to the millimetre, excluding the deployed slide-out box |
| Budget | `check_budget.mjs` | 350k triangles, 25 MB |
| Draw calls | browser | ≤ 40 interior, ≤ 60 exterior |
| Finish seam | browser | The wood swap changes grain and tint on exactly `wood.cabinet` and `wood.trim` |
| Performance | browser | 60 fps at 1080p desktop; **the phone number has never been measured on hardware** |

## 12. Phasing and gates

Task-level detail lives in the two plans. What matters here is the ordering, which is
load-bearing in three places:

1. **Grey-box before Blender.** Proportions are near-free to fix as boxes and expensive to fix
   after modelling. Nothing was modelled until the grey-box matched the reference shots.
2. **Calibration before remodelling and retexturing.** Judgements made against a mis-balanced
   image bake the cast in.
3. **Texel density before map authoring.** A re-unwrap invalidates the packed AO atlas, so
   measuring first avoids remodelling twice.

Everything else followed the natural dependency order: data → shell → furniture → finishes →
lighting → cameras and UI, then textures → navigation → model corrections → exterior →
verification.

## 13. Risks

1. **No floorplan exists.** The biggest risk throughout. Mitigated by the confidence tags, by
   using the published bed sizes as photo calibration, and by the grey-box gate. It has fired
   three times since, each time as a layout correction rather than a dimensional one.
2. **The reference imagery is probably CG, not photography.** The plants, the fruit and the light
   in several shots do not look photographed. So the target is matching *another renderer's
   output*, which is easier than matching reality but means there is no ground truth to appeal to.
   Compounded by §4: rectifying a render gives another renderer's lighting, not a measured
   material. Acceptable for the stated goal, and not acceptable if the goal were physical accuracy.
3. **The washroom is a moulded GRP shell.** Compound curves, no flat panels. Hardest thing in the
   vehicle to model, least visible, accepted as the weakest zone.
4. **Interior standing height is the shakiest number** (~2000 mm, estimated). It scales the whole
   room. The grey-box gate existed largely to catch this.
5. **`RectAreaLight` cost** could break the mobile frame budget. Fallback: drop to the probe alone
   on mobile and accept flatter cove light.
6. **Baked lighting in the texture crops.** The source photographs are lit. Flat-field correction
   in the rectifier is what stands between a usable tile and a tile with a hotspot in it.
7. **Provenance.** The maps derive from the manufacturer's imagery, and this is a public portfolio
   piece. The registry seam means any map can be swapped for a clean-provenance equivalent
   without touching geometry or code. Decided knowingly; the exit stays open.
8. **Draw-call ceiling.** Decal atlasing is what keeps the interior under 40. If atlasing stops
   holding, decals are the first thing cut.

## 14. Open questions and known gaps

Closed:

- **Which side is the slide-out on?** Kerb (`+X`). The walkthrough video settles it; the first two
  passes had it off side.
- **Which side is the galley on, and which the washroom?** Galley off flank, washroom in the rear
  kerb corner. Settled by the walkthrough video, after two wrong readings of the stills.
- **Where is the entry door?** One door, 后上门, in the rear wall, offset 100 mm off the
  centreline to clear the washroom pod.
- **Is the tall dark-gloss column the 148 L fridge?** Assumed yes.
- **How does the slide-out deploy?** The bed infills inboard; the aisle does not widen.

Open:

1. Whether the alcove bed slides, and how far. Modelled extended.
2. Wheel and tyre size, estimated from the Daily 4.5 t. Affects ride height in the exterior view
   only, nothing dimensional inside.
3. ~~The exterior side graphic is legible but not sharp in the hero shot.~~ Redrawn by eye from
   the walkthrough's kerb-flank frame as the full teal/black/orange livery with its `DACHIRV 大驰`
   wordmark, on both flanks. Colours sampled from the frame and white-balanced against the body
   panels; still `estimated`.
4. The rear-wall door has no photograph behind it. Both walkaround stills show only a kerb-corner
   door, which the washroom pod has since displaced. It is modelled because the layout brief is
   explicit about a rear entry sequence. Removing it is a two-line change to `build_shell`.

Known gaps, carried deliberately:

- **The mid-range phone frame rate has never been measured on hardware.** Desktop headroom is
  large, but risk 5 concerns a phone's fill rate, which no desktop measurement predicts.
- **No bloom and no GTAO.** §7 asks for both. The cove strips still read as bright geometry rather
  than light sources.
- **The windscreen is not raked.** §1's massed-exterior non-goal is otherwise reversed, but this
  one part of it is blocked by the cab interior rather than by the envelope: `build_cab`'s seats
  reach `Z = -1925`, 23 mm inside the nose plane, and the flat front face is the only thing hiding
  them. Raking it pulls the face to -1705 at seat height and the seats burst through the
  windscreen. Clearing them needs a shear of 28 mm, which is no visible rake. Unblocking it means
  moving the cab furniture aft first.
- **Window apertures read as white panels in black frames, not as dark glazing.** The frames are
  scribed onto a solid body, so what fills them is body paint. Closing this needs a dark pane in
  the aperture carrying a role `EXTERIOR_ROLES` can hide, so it does not black the windows out
  from inside: one new role, one draw call.
- **The livery is legible only on the off flank.** The exterior stop looks at the kerb flank, where
  the deployed slide-out box covers the decal over exactly the span the wordmark occupies.
- **Interior geometry shows through the cab/habitation step**, the 125 mm each side where the
  2200 mm cab meets the 2450 mm body. Predates the sculpting pass.
- **The white-balance patches in `calibrate.ts` were mirrored with the furniture** during the rear
  service room correction rather than re-verified against a marked screenshot. Two of the three
  sample the lounge, and the lounge is the half of the cabin that swapped sides.

---

# Implementation record

Dated passes in order. Each records what was measured, what changed, and — for the three layout
corrections — the reading it replaced. Sections 1 to 14 above state only the final answer.

## Phase 1 gate findings (2026-09-05)

Grey-box built from `PLACEMENTS` and reviewed against the reference imagery. Renders saved to
[../research/gate-02-plan.png](../research/gate-02-plan.png) (plan, ceiling and overheads hidden)
and [../research/gate-03-eye-level.png](../research/gate-03-eye-level.png) (aisle at 1.55 m eye
height looking forward, kerb wall cut away).

### Fixed during the gate

1. **The corridor pinched to 220 mm.** The washroom was 1000 mm wide with its inboard edge at
   `X −150`, while the lounge aisle ran `−450 → +70`. Each *slice* passed the ≥ 400 mm test, but
   the two ranges barely overlapped, so the continuously walkable corridor was only 220 mm. The
   per-slice check cannot see this; the plan view showed it immediately. The washroom went to
   700 mm wide with its inboard edge at `−450`, aligned with the sofa.
2. **`habLength` was 4048 mm** (5998 − 1950) while every shell box used 4050, so rear furniture
   flush to the back wall failed containment by 2 mm. `cabDepth` became 1948 mm, an adjustment
   well inside its `estimated` tolerance, and the two agree exactly.
3. **Galley stopped 50 mm short of the rear wall.** Extended to meet it.

### Checked and accepted

- Standing height 2000 mm reads correctly at eye level against the seated figures in the photos.
- Alcove bed underside at 1150 mm clears the cab seat tops (1100 mm) and leaves 650 mm of
  sleeping headroom, which is normal for the class.
- The slide-out protrudes visibly past the wall, and the bed lands at the published 1280 × 1900.
- Zone proportions along the length match the 前/中/后 division the 境-family sources describe.

### The slide-out direction, decided

Two readings, and no source settled it: (a) the bed infills inboard, the base stays put, the aisle
stays as it is; or (b) the mechanism carries the wall *and* the sofa outboard, and the bed fills
the gap left behind, widening the aisle to ~1100 mm — which is the usual selling point of a
slide-out and fits "+27 % space" better.

**Resolved: (a).** The data already modelled it, so nothing changed. The consequence to keep in
mind: the slide-out buys sleeping width, not floor space.

## Modelling correction (2026-09-05)

The detailed alcove view exposed an error that was hard to read in the grey-box: full-width
lockers at Z −300 to 0 mm blocked the sleeping-area entrance. Their estimated fore-aft origin
became −1400 mm, placing them at the head end visible in the reference. The 2200 × 1400 mm bed,
locker size, confidence tags and the habitation aisle are unchanged.

## Acceptance pass (2026-09-05)

Closed the two steps the modelling handover left open: lighting tuned against the references, and
hotspot cameras against the success criteria. Renders in [../research/tuned/](../research/tuned/),
captured at 1920 × 941 CSS pixels, device pixel ratio 2.

### Lighting values settled

| Knob | Was | Now | Why |
|---|---|---|---|
| `toneMappingExposure` | 1.0 | 1.05 | The room was under-exposed; past ~1.2 the cream panels clip |
| `scene.environmentIntensity` | 1.1 | 2.5 | The probe was too weak to lift the floor and the lower walls |
| Cove `intensity` | 12 | 26 | The coves barely registered against the probe fill |
| `led.cove` `emissiveIntensity` | 6 | 14 | So the strips read as light sources, not white stripes |

Two changes beyond those four knobs:

- **`scene.background` became daylight, not near-black.** The glazing is 24 % opaque, so the panes
  were compositing over a dark world and reading as grey holes. A flat daylight colour buys the
  "bright opening" read for one line.
- **`aoMapIntensity` is held at 0.4.** The bake shares one 2048 px atlas across 29 objects, so the
  ceiling and the long walls get few texels each and read as blotches at full strength. At 0.4 the
  contact shading survives and the blotching does not. The real fix is a second atlas page for the
  shell, not a runtime constant.

### Cameras

All six hotspots were re-placed against the modelled furniture; the grey-box values sat too close,
and two sat inside geometry that did not exist when they were chosen — the cab camera in the
alcove mattress, the washroom camera in the storage band. `camera.test.ts` now fails if any
hotspot position lands inside a placement box.

`tweenTo` released the azimuth and distance limits for the flight but not the polar ones, so the
previous zone's polar floor dragged the arrival off its pose — the slide-out shot landed 0.3 m low
after a visit to the alcove. Fixed, and covered by a test.

### Results

| Axis | Result |
|---|---|
| Visual | Lounge, alcove and galley hold up side by side against the references |
| Dimensional | 84 tests, `tsc` clean |
| Performance | 120 fps (vsync-capped) at 1080p desktop, 32 draws, 60k triangles |
| Performance, phone | **Not measured** — no device |
| Budget | 64,232 triangles, 10.1 MB, 13–32 draws per zone |
| Seam | Walnut `#5a3a24` → oak `#a97f4f` on both wood roles, every other role byte-identical |

As a partial substitute for the phone number, the scene ran at a 412 × 915 mobile viewport with
4× and 20× CPU throttling and held 120 fps at both, which says the frame loop is not CPU-bound. It
says nothing about a phone GPU's fill rate, which is what risk 5 predicts would break first.

## Photo-reference, free look and exterior (2026-09-06)

Three pieces of work, originally specified in `design_rv-photoref-360-exterior.md` and
implemented per [plan_rv-photoref-360-exterior.md](plan_rv-photoref-360-exterior.md): correct the
model against the manufacturer's photography and drive the surfaces from photo-derived textures;
replace the constrained per-hotspot orbit with a full turn of free look at each stop; model the
outside of the vehicle and add a stop that orbits it.

Renders in [../research/final/](../research/final/), calibration evidence in
[../research/calibrated/](../research/calibrated/), texel-density measurement in
[../research/texel-density.md](../research/texel-density.md).

### New evidence

The product page is a 37-slice vertical marketing poster with no text specs; all 37 slices were
retrieved this time, against 6 previously.

| Source | Adds |
|---|---|
| [dachirv.cn/sys-pd/60.html](https://www.dachirv.cn/sys-pd/60.html) | On-image dimension callouts, galley/washroom/alcove photography, exterior hero shot, external storage hatches |
| [news.sohu.com/a/1024282184_99893844](https://news.sohu.com/a/1024282184_99893844) | Equipment list, entry sequence, wet/dry sliding door |
| [sina.cn/news/detail/5298543585923480.html](https://www.sina.cn/news/detail/5298543585923480.html) | 2026 model year framing, approximate price |

Confirmed: both bed sizes are stated on the manufacturer's own graphics, so both `published` tags
stand; 3300 mm wheelbase, Iveco F1C 3.0T, ZF 8AT, 4.5 t, 5 seats.

Contradicted and resolved: Sohu and Sina both give the slide-out bed as 1.35 × 2.0 m. The
manufacturer's poster states 1280 × 1900 mm on the image. The primary source wins; the secondary
figures are recorded so the discrepancy is not rediscovered later.

Present in the photographs and absent from the model at the time: entry door with pleated
flyscreen, 5 kg washer-dryer, microwave/steam oven, systems touch panel, wall-mounted TV, roller
blinds, framed art and a family photo wall, external storage hatches.

### The warm cast, measured

Sampling matched surfaces in `docs/research/tuned/lounge.png` against the reference photograph:

| Surface | Photo | Render | Registry |
|---|---|---|---|
| Seat main panel | `#808182`, saturation 0.015 | — | `#e8e1d5`, saturation 0.08 |
| Seat accent | `#3d2f26`, saturation 0.38 | `#a66127`, saturation 0.76 | `#b08052`, saturation 0.53 |
| Floor vinyl | `#8f9094`, saturation 0.034 | `#8c847a`, saturation 0.13 | `#7c8288`, saturation 0.09 |

So what read as "the chairs are orange" was one white-balance bug plus one genuine palette error:
the seat leather is a neutral grey in the photographs, not cream. The first pass's palette table
and the research note both called it cream leather. That was wrong.

### What the photography showed, and where each fix landed

| # | Photograph shows | Fix |
|---|---|---|
| 1 | Seat leather neutral grey, accents camel | `data/finishes.ts` |
| 2 | Neutrals neutral | Calibration |
| 3 | Ceiling walnut centre band, stepped cove, dark hatch surround | Blender `shell` |
| 4 | Locker doors cream in a walnut frame, LED strip beneath | Blender `lockers` |
| 5 | Table with walnut edge band on a chrome pedestal | Blender `dinette` |
| 6 | Sofa keeps a back cushion deployed; walnut drawer plinth | Blender `sofa_slideout` |
| 7 | Square stainless bowl at the aisle end, window over the counter, sink and hob swapped | Blender `galley` |
| 8 | Corner vanity, mirror cabinet, ribbed GRP, damask curtain, grab rails, recessed niches | Blender `washroom` |
| 9 | Iveco dash, steering wheel, engine tunnel between the seats | Blender `cab` |
| 10 | Entry door and flyscreen, washer, oven, systems panel, TV, blinds, wall art | Blender, new detail meshes |

Row 3 was the highest-value geometry change: the ceiling fills roughly a third of every wide shot
and was flat cream against a photograph that is banded walnut. Rows 7 and 8 were re-done from
scratch by the rear service room correction below, which moved both modules across the cabin.
Row 10 is where the placement-versus-detail-mesh problem surfaced; see below.

### Results

| Check | Kind | Result |
|---|---|---|
| Neutral roles | vitest | **Pass.** `floor` 0.034, `upholstery.seat` 0.005, `washroom.shell` 0.008, against a threshold of 0.05 |
| Rendered neutrals | browser, `?calibrate` | **Pass.** Floor 0.039, chair panel 0.037, washroom wall 0.051, against 0.08 |
| Texel density | `check_blend.py` | **Pass, after a fix.** See below |
| Exterior envelope | `check_models.mjs` | **Pass.** 2.450 × 5.998 × 3.200 m, to the millimetre |
| Exterior bounds | `check_models.mjs` | **Pass.** All nine exterior nodes land on their placement world bounds |
| Look mode | vitest | **Pass.** Rotation never changes `camera.position`, verified in the browser at all six stops |
| Hotspot safety | vitest | **Pass.** The `orbit` ring clears the body at 6.0 m against a 1.225 m half-width |
| Budget | `check_budget.mjs` | **Pass.** 71,980 triangles; 9.69 MB of `.glb` plus 0.15 MB of textures |
| Draw calls | browser | **Pass.** 36 worst interior against 40; 45 exterior against 60 |
| Finish seam | browser | **Pass.** Of 23 roles, the wood swap changes exactly `wood.cabinet` and `wood.trim`, and ash changes grain scale (2.6) as well as tint |

Frame rate at all seven stops: 83 to 97 fps interior, 120 (vsync-capped) exterior, measured over
120 frames into a 3840 × 1882 buffer — four times the pixel count of 1080p.

### Risk 1 fired, and the fallback was needed

`role.floor` measured a texel-density spread of 4.30 against a threshold of 4, so the gate ahead
of map authoring failed as designed. The cause was between objects, not within them:
`smart_project` normalises each object into the 0..1 square, so the joined `shell_details`
catch-all sat at 0.056 UV/m beside a standalone floor at 0.200.

`normalise_uv_density()` rescales each unwrap to a fixed 1.0 UV/m. It rescales rather than
re-unwraps, so UV2 and the packed AO atlas stayed valid and no re-bake was required — cheaper than
the full re-unwrap the risk anticipated. Worst spread across the model fell from 8.57 to 1.40.

### Three corrections to the design as written

1. **Maps carry luminance only; the registry keeps hue.** The design had the registry own colour
   *and* the map. THREE multiplies the two, so a map carrying its own hue tints twice: the camel
   bolster crop has a mean of (125, 82, 46), and multiplied by `0xb08052` it rendered brick red.
2. **Eight maps, not nine.** `wood.trim` shares `walnut.webp`: the reference shows one veneer on
   both the cabinets and the ceiling band, so a second crop of the same material adds only a
   second way to be wrong.
3. **The cove tint is the white-balance lever**, not `environmentIntensity`. Lowering it from 2.5
   to 1.2 made the floor patch *worse*, 0.155 to 0.245, because the probe carries the cool
   daylight arriving through the glazing and the roof hatch, so weakening it concentrates the
   coves' orange. Cooling the tint from `0xffd9a0` to `0xffeed8` was the whole fix; exposure
   stayed at 1.05.

### The new equipment could not be placements

The design added `entry_door`, `washer`, `oven` and `systems_panel` as placements. All four
overlap existing furniture, and not by a coordinate error: a built-in appliance shares the volume
of the cabinetry it is built into, which is what the overlap check exists to forbid, and the wall
the reference hangs the door on is covered end to end by the wardrobe and the galley run. The door
became shell architecture; the appliances and graphics became detail meshes.

The wall TV was dropped: no unobstructed wall remains for it. The wardrobe went from 400 mm deep
to 250 mm, which also clears floor in front of the door.

### One defect found in the pipeline itself

`vite build` and `pnpm budget` were mutually destructive. The Blender export writes its
uncompressed `.glb` files to `dist/raw`, Vite builds into `dist`, and Vite empties its output
directory by default — so a build deleted the exports, and the next budget check reported
0 triangles against a 350,000 ceiling. A check that passes because its input vanished is worse
than no check. `emptyOutDir: false` in `vite.config.ts` fixes it.

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

Rows 1 and 3 were both over-readings of a photograph. The occupancy figure settles the seat count
arithmetically. The door had been argued from the galley photograph showing it "immediately beside
the galley run" — which is equally true of a door in the rear corner beside a galley that
terminates there.

Row 1's row-of-three and row 3's second door were themselves corrected by the two passes below.

### Checked against the brief and deliberately kept

- **Slide-out bed stays 1280 × 1900.** The brief gives 2000 × 1350, which traces to the 境280
  predecessor; the manufacturer's own poster beats it, as it beat Sohu and Sina.
- **Table stays a chrome pedestal.** The brief calls it wall-mounted or folding. The photography
  shows a pedestal, and a photograph beats a text description.
- **Washroom stays 700 × 1400.** The brief's class is 800–950 × 900–1100, the same floor area to
  within a few per cent, and the 700 mm width was the phase 1 fix for a corridor that pinched to
  220 mm. (Superseded below: the pod is now 900 × 1000 in the rear kerb corner.)
- **Zone id stays `dinette`.** It is the wrong word for a three-seat lounge, but renaming it
  reaches into `ZoneId`, the grey-box palette, the collection names and nine `.glb` filenames to
  buy nothing. The hotspot has read "Lounge" since the first pass.

### Two defects the rework exposed

Both latent, and both the same mistake: geometry measured in absolute offsets from a placement's
centre rather than from its own ends.

- `build_galley` put the sink at `y − .39` and the cabinet pulls at a fixed 340 mm. At the
  shortened 750 mm run the sink hung past the front of the cabinet and the pulls overhung both
  ends by 45 mm, which `check_models.mjs` caught as "geometry exceeds placement box".
- `entry_door` built the leaf as one 35 mm slab with the 6 mm pane buried inside it, so the door
  read as a blank panel from indoors. The leaf became a frame around the aperture. The exterior
  door is a four-strip reveal with nothing across the opening, for the same reason: the body is
  one solid mass, so anything filling that rectangle turns the interior glazing black.

### Re-measured

76,036 triangles, 9.52 MB, 32 draws worst interior, 40 exterior, 116–120 fps at 1600 × 900,
113 tests and `tsc` clean. Placement bounds, the exterior envelope, texel density and the AO
wiring all still passed.

## Lounge seating correction (2026-09-06)

三个卡座对面摆，前一后二，中间是可收纳的餐桌. The lounge is a 卡座 booth. The pass above modelled it as a row.

| # | Was | Now |
|---|---|---|
| 1 | Three seats in one row along the kerb wall, all facing forward | One forward seat facing aft, two abreast facing forward |
| 2 | Table alongside the row, inboard of it | Table between the facing seats, 80 mm knee gap each side |
| 3 | `dinette_chair_fwd` / `_mid` / `_aft` | `dinette_chair_fwd` / `_aft_off` / `_aft_kerb` |

Seat count is unchanged, so the 5-seat occupancy argument that fixed it at three still stands.
That pass had the count right and the arrangement wrong.

The table is 可收纳, and is modelled deployed only, on the same grounds as the slide-out. That
supersedes the "table stays a chrome pedestal" note above in part: the pedestal shape stands, the
fixed-in-place reading does not.

Consequences:

- Aisle 520 → 560 mm. The pinch moves from the table's inboard edge to the seat pair's.
- Table 550 × 700 → 900 × 600 mm, to seat three around a booth.
- The rear-entry ray is unaffected. The booth clears the centreline.

Re-measured: 76,036 triangles, 9.57 MB, 116 tests, `tsc` clean.

## Rear service room correction (2026-09-06)

Driven by two frames of the manufacturer's own walkthrough video, which contradict the plan on
things the still photography had been read as supporting.

### Fixed

| # | Was | Now | Evidence |
|---|---|---|---|
| 1 | Galley a 750 mm run along the kerb flank, forward of the boarding door | A 1200 mm run along the OFF flank, continuing the line the fridge starts | The galley frame puts the counter on the vehicle's left with the washroom door opposite it |
| 2 | Washroom a 700 × 1400 pod along the off flank | A 900 × 1000 corner pod in the REAR KERB corner | Same frame: the door the presenter opens is in the rear corner on the right, not partway along a flank |
| 3 | Booth on the kerb flank, slide-out and its bed on the off flank | Swapped: booth off, slide-out kerb | The lounge frame puts the sofa bed and the seat pair on the opposite flanks to the model |
| 4 | Two boarding doors, one in the rear wall and one at the kerb rear corner | One, in the rear wall, offset 100 mm off the centreline | Follows from 2 — the pod takes the kerb rear corner. 后上门 stands; the kerb-corner door does not |

The galley window moves with the run to the off flank, over the counter. The kerb flank keeps one
window, lighting the aisle between the wardrobe and the pod.

### A wrong turn worth recording

An intermediate pass read "the kitchen is at the back" as "against the rear wall" and built the
galley as a run across it. That layout is dimensionally sound and passes every check, and it is
still wrong: a counter on the rear wall leaves the washroom nowhere to go but a flank, and puts
the pod between every viewpoint and the counter's far half. The frame shows a flank run and a
corner pod. 后置厨卫 places the kitchen and bathroom in the rear *zone*, not on the rear *wall*.

### Two modules had to be rebuilt rather than moved

Both for the reason the last pass recorded and had still not finished paying off: geometry
measured in absolute metres rather than from its placement's own faces.

- `build_galley` had the carcass back at `x + w/2` and the doors at `x - w/2`, correct only on the
  kerb flank. It is now written in terms of `back`/`front` across the run and `y0`/`y1` along it,
  so which flank it sits on is a data question.
- `build_washroom` carried thirteen positions written out as absolute metres: the vanity at
  `y 2.86`, the curtain rail from `3.18` to `3.96`, the grab handle at `3.96`. It now derives
  `side` from which half of the cabin the pod sits in, and measures everything from the pod's
  outer wall or its inboard opening. The vanity and the shower curtain are sized as fractions of
  the pod rather than fixed, so a shorter pod does not put the basin through the toilet or curtain
  the whole opening off.

### One defect found in the runtime

`applyHotspotLimits` wrote a whole turn of azimuth as `centre ± PI`. Those two bounds are the same
angle, and OrbitControls decides whether that counts as `min < max` on float error alone. The old
exterior stop happened to land on the safe side; mirroring it to the off flank landed on the
other, and the camera clamped to that single heading and teleported to the far corner of the
vehicle. A whole turn is now written as no limit at all, which is what OrbitControls wants, and
`camera.test.ts` asserts it.

### Stops re-placed

- **Galley.** To the aisle just aft of the partition, at the forward end of the run, looking down
  its length.
- **Washroom.** To the open corner diagonally forward and inboard of the pod, the only angle that
  sees into both of its open faces.
- **Lounge** and **Slide-out bed** mirror with the furniture.
- **Exterior.** To the off three-quarter, because the flat flank is the off one now.

### Re-measured

| Axis | Ceiling | Result |
|---|---|---|
| Triangles | 350,000 | 73,404 |
| Bytes | 25 MB | 9.48 MB |
| Draw calls, worst interior | 40 | 30 |
| Draw calls, exterior | 60 | 40 |
| Frame rate | 60 fps at 1080p | 118–120, vsync-capped, at 1600 × 900 |
| vitest + `tsc` | — | 117 tests, clean |
| Aisle | 400 mm | 560 mm, unchanged |

Placement bounds, the exterior envelope, the AO wiring and texel density all still pass. The
rear-entry ray is unchanged in intent and passes again, now that the rear door is back.

## Walkthrough-video correction (2026-09-07)

Driven by the manufacturer's own 18-minute walkthrough
(douyin.com/video/7627690532785694434), sampled at 119 frames plus 48 targeted high-resolution
stills. Planned in [plan_correct-against-walkthrough-video.md](plan_correct-against-walkthrough-video.md).
Frames kept in [../research/walkthrough/](../research/walkthrough/), renders re-captured into
[../research/final/](../research/final/).

### Handedness: the two halves are handed opposite ways

The plan called for mirroring the whole cabin, on this chain: the pod and the galley face each
other, the galley continues the line the fridge starts, and the fridge stands beside a booth seat
— so moving the pod moves everything. **The middle link is false for this vehicle**, and the
mirror was implemented, pushed, and then corrected.

What the frames show. From the lounge looking aft through the partition (8:32–8:56, hi-res) the
sofa bench is on the left and the booth's pair of seats on the right; looking aft, left is kerb.
Through the same doorway the galley's pegboard and counter are on the left and the mirrored
washroom door on the right. The 3:50 frame through the open rear door, where left and right
reverse, agrees on the service room.

| | Off flank (−X) | Kerb flank (+X) |
|---|---|---|
| Lounge | 卡座 booth | slide-out, sofa bed |
| Storage | — | wardrobe |
| Service room | fridge, washroom pod | galley run |

So the galley sits behind the *wardrobe*, opposite the fridge, not after it. This is also why the
exterior kerb-window crop (which shows a galley overhead above its own counter) and the lounge
frame had looked irreconcilable for two passes: both readings were correct.

`src/check.test.ts` now pins both halves separately, with the evidence cited. That guard is the
cheapest thing in this pass and it is what stops a fifth flip.

### The fridge is service-room furniture

Owner correction during the pass: the 148 L column stands aft of the sliding door, hard against
the washroom pod, not in the lounge storage band. It moved to Z 2550–3050 on the off flank and
widened to 500 mm so it meets the pod exactly. Consequences: the off flank has no wall left aft
of the partition, so the second off-flank window moved forward of it, to Z 1975–2525.

### Palette

| # | Was | Now | Evidence |
|---|---|---|---|
| 1 | `panel.locker` bone gloss — cream doors in a walnut frame | Gloss walnut, three variants, joined to `WOOD_ROLES` | The video's locker fronts are lacquered timber with specular highlights over visible grain |
| 2 | Seat cushion and whole backrest surround in camel | Grey throughout, camel reduced to a band at the backrest base plus a badge | The seats are light grey top to bottom; the render read as orange furniture |
| 3 | No fascia above the locker runs | Charcoal fascia, one per run | It is what separates the gloss fronts from the cream ceiling in every wide shot |

The wood swap now restyles three roles rather than two. A locker run left walnut beside oak
cabinets would have been a worse lie than the one this fixes; `ui.test.ts` asserts all three
timber roles carry the same variant ids, so a swap cannot half-apply.

**No walnut wall band.** The video's cabin is walnut-dominant, but in the lounge that walnut is
the locker fronts and the fascia: the side walls are window from 0.90 to 1.40 and locker run
above, so no wall is left showing. A band added at 1.42–1.90 rendered inside the locker carcasses.

### Fittings

- **Galley.** Black composite bowl and black gooseneck tap replace the stainless bowl and chrome
  tap. The interior washer is gone — last year's bay now carries electrical gear behind a
  cabinet door with a systems panel and a vent. Black pegboard accessory wall with brushed
  slats, on the only clear stretch of backsplash forward of the window. The oven's full-height
  lit fascia became a dark glass door with a control strip: at full size the emissive read as a
  glowing blue rectangle where the video shows black glass.
- **Washroom.** Hinged walnut door with chrome lever and full-length mirror, standing open flat
  against the pod's inboard face and hinged at the *aft* end — two constraints fix that, the
  hotspot sightline crossing the plane at Y 3.32 and the rear-entry ray at the centreline.
  Ceiling vent fan flanked by two downlights, retractable clothesline, and a roller-blind window
  cut through both the pod moulding and the vehicle's off wall, sitting between two ribs.
- **Lounge and alcove.** Roof-hatch projector, table drawer, plinth LED strips under every seat
  and the sofa, alcove reading lights and end screen. The framed plaque and the exterior-camera
  monitor went on the partition's lounge face rather than the side walls the video hangs them
  on, because those walls are window and locker run here — a deliberate relocation.
- **Exterior.** Awning cassette and its LED along the kerb roof edge, seven window apertures
  scribed as reveals, lower storage bay, round-porthole washer hatch, external control panel,
  and on the rear face a keypad, chrome grab handle, vent grille and a flat-mounted spare.
  Everything is `exterior_details`, so the 1 mm envelope assertion is untouched.

Three defects the exterior work exposed, all the same shape — geometry hidden inside a solid mass:

1. `body_door_rear` was recessed a millimetre *inside* the rear face and had never rendered.
2. The kerb-flank hatches and the slide-out window reveal sat behind the deployed slide-out box,
   which stands 580 mm outboard from Y 0.15 to 2.05. They moved aft of it; the kerb livery decal
   was dropped, because what the box does not hide is seen at a grazing angle where a 4 mm plane
   reads as moiré.
3. `slideout_box` was 1300 mm tall against a `slideout_shell` of 2000 mm, so the kerb
   three-quarter looked straight through the gap into the cabin. Matched to 2000, `derived`.

The exterior stop moved to the **kerb** three-quarter. That flank carries the awning, the
hatches, the control panel and the galley window, and it is the walkaround the video films. It
also carries the deployed slide-out box, which is why an earlier pass pointed the stop at the
flat off flank instead; the vehicle is modelled deployed, so the box is part of the subject.

### Post: bloom shipped, GTAO measured and cut

Section 7 has asked for both since the first pass. Bloom is the load-bearing one and it ships.

**GTAO was cut on measurement.** It re-renders the whole scene twice, for depth and normals:

| At 1920 × 1080 | Lounge | Washroom | Exterior |
|---|---|---|---|
| Bloom only | 120 fps | 120 fps | 120 fps |
| Bloom + GTAO | **40.4 fps** | **39.2 fps** | 84 fps |

Against a success criterion of 60 fps at 1080p, that is a hard fail, and interior draw calls went
45 → 79. The AO bake already supplies contact shading, so GTAO was buying a second-order effect
for two-thirds of the frame budget. Do not re-add it without re-measuring.

**The bloom threshold is in linear HDR, not in the tone-mapped output.** RenderPass writes a float
target and OutputPass applies ACES at the end, so the textbook 0.92 caught the cream panels and
the daylight behind the glazing and fogged the whole cabin. The `led.cove` emissive runs at 14 and
the panels sit nearer 1 to 3, so 5.0 divides them.

`renderer.info` is reset per `renderer.render` call, and the composer calls it once per pass — so
the `?verify` draw-call readout showed 1 until `info.autoReset` was turned off and the reset moved
to once per frame. The number now covers the scene plus the post chain.

### White balance, honestly measured

The patches in `calibrate.ts` had been *mirrored* with the furniture during an earlier pass rather
than re-verified, which the spec already recorded as a known gap. They are now derived by
raycasting the live scene and keeping only coordinates whose whole neighbourhood returns the
intended role **and** a constant surface normal. The normal matters more than it looks: an 8 px
square straddling a bevel underside read 0.144 where the flat panel 20 px away read 0.082.

| Patch | Result |
|---|---|
| Aisle floor | 0.055 |
| Chair panel | 0.063 |
| Washroom wall | 0.063 |

All three under the 0.08 ceiling. Mid-pass, with honest patches and the old palette, the chair
panel sat at 0.082–0.086 and failed; the walnut-dominant palette and the post chain closed it.

### Results

| Axis | Ceiling | Result |
|---|---|---|
| Triangles | 350,000 | 94,436 |
| Bytes | 25 MB | 10.0 MB |
| Draw calls, worst interior | 40 | **45** — 30 scene plus a fixed 15 for the post chain |
| Draw calls, exterior | 60 | 57 |
| Frame rate | 60 fps at 1080p | 120, vsync-capped, at both 1920 × 1080 and 3200 × 1800 |
| vitest + `tsc` | — | 122 tests, clean |
| Aisle | 400 mm | 560 mm lounge, 800 mm service |
| Apertures | — | 7 of 7 reach `role.glass`, rear-entry ray clear to Y 4.048 |

The interior draw-call ceiling is exceeded, and the number is reported rather than explained away.
The 40 was set before any post chain existed and counts scene geometry, which is still 30. Bloom
adds a fixed ~15 regardless of stop. The performance criterion the ceiling exists to protect is
met with a wide margin, so the ceiling is the stale proxy; a future pass should either re-baseline
it as "scene ≤ 40, post chain excluded" or drop it in favour of the frame-rate measurement.

### Still open

- The kerb three-quarter shows a narrow sliver of interior at the slide-out box's aft edge,
  where the exterior box's rear face and the interior `slide_rear` panel sit 15 mm apart.
- The cab's engine tunnel is `metal.dark` and reads as a black slab down the centreline of every
  forward-looking lounge shot. Correct geometry, plausible material, wrong result.
- Length 5995 vs 5998 mm, recorded and not acted on: 5998 cascades into `habLength` and the 1 mm
  envelope assertion.
- The mid-range phone frame rate has still never been measured on hardware.

## Plan view and sculpted exterior (2026-09-07)

Both phases of [plan_plan-view-and-exterior.md](plan_plan-view-and-exterior.md) built. The child
spec [design_rv-plan-view-and-exterior.md](design_rv-plan-view-and-exterior.md) keeps the full
measurements in its §7a and §7b; this entry is what changed and what the build refused.

### Added

- **An eighth camera stop, `plan`.** Sections the vehicle with a global clip plane at 1400 mm,
  derived from the locker placements rather than written as a literal. §8 has the shape of it.
- **A label overlay.** `labels.ts`, a `CSS2DRenderer` layer whose text comes from `PLACEMENTS`, so
  no label can claim a dimension the geometry does not have. Toggled from the UI at that stop only.
- **`StopId`.** `Hotspot.id` was `ZoneId`, and two camera tests discriminated on
  `id !== 'exterior'` with a cast to mean "interior". Both now discriminate on `view.kind`, which
  is what they meant.
- **The flank livery**, hand-drawn, one uncut copy per panel, on both flanks.
- **Black window frames**, the over-cab taper and its forward window, the cab's bonnet, grille and
  mirrors, and the fittings the walkaround stops at.

### Measured

| Axis | Ceiling | Result |
|---|---|---|
| Triangles | 350,000 | 101,028 |
| Bytes | 25 MB | 10.16 MB |
| Draw calls, worst interior | 40 | **45** — 30 scene plus a fixed 15 for the post chain, unchanged |
| Draw calls, exterior and plan | 60 | 57 at both |
| Frame rate | 60 fps at 1080p | 120, vsync-capped, at every one of the eight stops |
| Envelope | 5998 × 2450 × 3200 mm | exact, no violations |
| vitest + `tsc` | — | 138 tests, clean |
| Neutral balance | 0.08 | 0.052 / **0.084** / 0.074 |

The sculpting pass added no new role, so it cost no draw calls at all; the exterior stop sits where
it started. Interior stops each gained about 9,000 triangles, because the window frames changed
from `body.paint` to `metal.dark` and `metal.dark` is not in `EXTERIOR_ROLES`, so they are no
longer hidden indoors. The chair-panel saturation of 0.084 is over its ceiling and is inherited: it
read 0.083 before this pass began.

### The probe trap fired twice

Once as predicted: a clip plane left set during `refreshProbe`'s capture would show the probe a
roofless cabin open to sky. Fixed by saving, clearing and restoring `clippingPlanes` around the
capture, and proved by measurement — a finish swap at the plan stop returns the same three hex
values, to the byte, as the identical swap at the lounge where no plane is set.

Once unpredicted, and worse. `roof_ac` was placed at `Y = 1300`, where its 980 mm shroud covers the
700 mm roof hatch completely; the hatch is the interior's only daylight source, and the shroud's
vent is `metal.dark`, so it capped that daylight inside the probe capture as well as outside. The
`?calibrate` patches went to 0.105 / 0.089 / 0.078, two of three failing, before it moved aft to
`Y = 3100`. Anything opaque added to the roof band needs checking against the hatch, and anything
outside the cabin that is not an `EXTERIOR_ROLE` is inside the probe.

### What the build refused

- **The windscreen rake.** Blocked by the cab furniture, not the envelope. §14 has it.
- **`alcove_taper` as a separate mass.** It would have sat 320 mm in front of the nose plane and
  made the vehicle 6318 mm long, past a check that measures only the eight named bodies. Carved out
  of `body_alcove`'s own face instead.
- **A four-strip reveal on the raked face.** The face moves 80 mm in Y across a 400 mm window
  against a 16 mm strip, so the frame rendered as three sides. One filled panel instead, safe only
  there because the surface behind it is opaque.

### Still open

Everything in the previous entry's list, plus §14's four new gaps: the unraked windscreen, the
white apertures, the off-flank-only livery, and the pre-existing cab/habitation step.
