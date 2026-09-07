# Spec: plan view and the sculpted exterior

- Date: 2026-09-07
- Status: designed, not implemented
- Parent: [design_rv-interior-3d.md](design_rv-interior-3d.md). This is a child spec in the same
  shape as `design_rv-photoref-360-exterior.md` was, and should be absorbed into the parent's
  numbered sections once it is built.
- Evidence base: the manufacturer's 18-minute walkthrough (douyin.com/video/7627690532785694434),
  sampled at 119 frames plus 48 high-resolution stills; the kept frames in
  [../research/walkthrough/](../research/walkthrough/)
- Skills in play: `threejs-webgl` (runtime), `blender-web-pipeline` (assets),
  `huashu-mac-use` (Blender viewport screenshots)

## 1. What this adds

Two things, independent of each other except in the budget.

**A plan stop.** An eighth camera stop that looks down on the cabin with the roof and the overhead
lockers cut away, with a toggleable overlay of zone names and published dimensions drawn over it.
The parent spec's §2 opens by saying the manufacturer publishes no floorplan and that the whole
layout is a reconstruction. This is that reconstruction, shown.

**A sculpted exterior.** The parent spec's §1 lists "the exterior is massed rather than sculpted"
as a non-goal, and §14 carries it as a deliberate gap. This spec reverses it. Comparing
[../research/final/exterior.png](../research/final/exterior.png) against
[../research/walkthrough/exterior-kerb-flank-0m59s.jpg](../research/walkthrough/exterior-kerb-flank-0m59s.jpg)
is the argument: the render is white boxes with scribed lines, and the vehicle is a liveried
C-type with black-framed glazing, a shaped Iveco cab and a wall of fittings.

### Goals

1. A viewer can read the whole floorplan in one frame, at correct scale, without a floorplan
   drawing existing.
2. Every dimension shown in the overlay comes from the geometry it labels, so it cannot drift.
3. The exterior reads as the same vehicle as the walkaround footage, at a glance.
4. Neither addition costs the frame rate the parent spec's success criteria protect.

### Non-goals

- **No orthographic camera.** The plan stop uses the existing perspective camera from high up. A
  second camera type would fork `scene.ts`, `camera.ts` and every resize path to buy a flatter
  drawing.
- **No rectified photo texture for the body livery.** See §4.
- No section cuts other than the one horizontal plane; no exploded view; no animated roof lift.
- The parent spec's other non-goals hold, in particular the slide-out staying deployed-only.

### Success criteria

| Axis | Criterion |
|---|---|
| Plan legibility | At the plan stop the ceiling, both cove runs and both locker runs are absent, and the alcove mattress renders whole |
| Label integrity | Every dimensioned label reads its numbers and its confidence tag from the placement it names |
| Exterior fidelity | The kerb three-quarter and the 0m59s walkaround frame read as the same vehicle, side by side |
| Envelope | Still 5998 × 2450 × 3200 mm to the millimetre; every addition is a detail mesh |
| Probe | A finish swap at the plan stop leaves the three `?calibrate` saturations under 0.08 |
| Budget | ≤ 350k triangles, ≤ 25 MB, ≤ 60 draw calls at the plan and exterior stops |
| Frame rate | 60 fps at 1080p, measured at both new-or-changed stops |

## 2. The plan stop

### The cut is derived, not chosen

A horizontal clip at **Y = 1400 mm**, and that number comes off the furniture rather than off the
eye. Both lounge locker runs have their underside at 1400. The alcove head lockers start at 1500
and the alcove mattress tops out at 1350 — so one plane at 1400 takes the ceiling, both cove
fascias and every locker run with it, and leaves the bed whole.

Read it off `PLACEMENTS` rather than writing 1.40 in the source:

```ts
const underside = (id: string) => PLACEMENTS.find((p) => p.id === id)!.origin[1].v;

export const PLAN_CUT_MM = Math.min(underside('lockers_off'), underside('lockers_kerb'));
```

Move a locker run and the cut follows it. A test asserts the cut sits below every locker's
underside and above every mattress's top surface, so a future furniture move that breaks the
relationship fails the build instead of shipping a sliced bed.

### Why a clip plane, and not hiding the roof

Because there is nothing left to hide. [batching.ts](../../src/batching.ts) merges the whole
vehicle into one mesh per role before the first frame, so by render time the roof panels, the
locker carcasses and the galley plinth are all inside `batch.panel.wall` and `batch.wood.cabinet`
along with surfaces that must stay. Selecting by role — the trick `main.ts` uses to hide the
exterior body — does not separate them, because `panel.wall` is the roof *and* the walls.

A global clip plane is per-fragment and does not care how geometry is grouped:

```ts
const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), PLAN_CUT_MM / 1000);
renderer.clippingPlanes = active ? [plane] : [];
```

Set on arrival at the plan stop, cleared on departure. Walls read as hollow cut edges, which is
what a dollhouse looks like.

### It reuses the orbit view

`view: { kind: 'orbit', azimuth: [-PI, PI], polar: [0.05, 55°], distance: [5, 12] }`, targeted at
the cabin's centre. No third view kind. The polar floor is 0.05 rather than 0 because
`OrbitControls` degenerates at the pole; the ceiling of 55° lets the viewer tip toward a
three-quarter dollhouse without dropping to eye level, where the cut edges start to read as
broken geometry rather than as a section.

The exterior body **stays visible** and is clipped along with everything else. Its lower half —
shell sides, skirt, wheels — surrounds the furniture and is what makes the frame read as a vehicle
rather than as furniture floating on a grey plane. `main.ts`'s `goTo` currently shows the body
only for `kind === 'orbit'`, which already covers this stop.

### The stop is not a zone

`Hotspot.id` is typed `ZoneId` today, and `ZoneId` means "a zone furniture belongs to" — it feeds
`ZONE_VOLUME`, `Placement.zone` and the containment check. A camera stop is not one of those. So:

```ts
export type StopId = ZoneId | 'plan';
```

and `Hotspot.id: StopId`. Adding `'plan'` to `ZoneId` instead would force it into `ZONE_VOLUME`'s
`Record` or into the same exclusion set as `shell` and `exterior`, which would be a third meaning
for that set.

This also fixes two tests that are already straining. [camera.test.ts:79](../../src/camera.test.ts#L79)
and [camera.test.ts:83](../../src/camera.test.ts#L83) both discriminate on `id !== 'exterior'`,
with a cast, to mean "is this an interior stop". A camera 8 m above the roof is neither interior
nor the exterior stop, and would fail both. Both switch to `view.kind === 'look'`, which is what
they meant from the start.

### The probe trap, again

[lighting.ts:73](../../src/lighting.ts#L73) re-renders the entire scene from a point inside the
cabin on every finish swap, to recapture the environment probe. With a clip plane set on the
renderer, that capture sees a roofless cabin open to a bright sky, and every interior material's
bounce light changes — a finish swap performed at the plan stop would silently relight the whole
interior for the rest of the session.

`refreshProbe` must save, clear and restore `renderer.clippingPlanes` around the capture. This is
the same shape as the exterior-visibility save/restore three lines below it in the same function,
and the parent spec's §7 already names the general trap.

## 3. The label overlay

### Labels derive from placements

A label carries text and the id of the thing it names. Its position is that placement's centre;
its dimension string and confidence tag are generated from that placement's `size`:

```ts
export const PLAN_LABELS: readonly PlanLabel[] = [
  { placement: 'alcove_bed', text: 'Alcove bed' },       // renders "2200 × 1400 published"
  { placement: 'slideout_bed', text: 'Slide-out bed' },  // renders "1280 × 1900 published"
  ...
  { at: [d(0), d(900), d(1000)], text: 'Aisle', detail: '560 mm' },
];
```

A label cannot claim a dimension the geometry does not have. Section 2 of the parent spec applies
that discipline to every number in `vehicle.ts`. This extends it to the one place those numbers
become copy a viewer reads: ten labels or so, covering the two beds, the booth, the wardrobe, the
fridge, the galley run, the washroom pod, the partition, the rear door and the two aisle widths.

A test asserts every `placement` id in `PLAN_LABELS` resolves in `PLACEMENTS`. It runs in node,
because `vehicle.ts` imports no Three.js.

### `CSS2DRenderer`, not sprites and not hand projection

`three/addons/renderers/CSS2DRenderer.js` is already available and does exactly this: a DOM layer
over the canvas, a `CSS2DObject` per label, transforms and depth ordering handled. Roughly ten
lines of setup plus three per label.

The alternatives are worse for this. Sprites or canvas-textured planes cost draw calls at a stop
already carrying the exterior body, go blurry when zoomed, and need billboarding. Hand-rolled
`vector.project()` is about the same amount of code as wiring the renderer, and then owns resize
and ordering itself.

Labels are `visible = false` except at the plan stop with the toggle on. The toggle is a button in
[ui.ts](../../src/ui.ts) beside the zone buttons, shown only at that stop.

## 4. The exterior, sculpted

Everything below still derives from `ENVELOPE` and the exterior placements. Every addition is a
detail mesh rather than a named body, so `check_models.mjs`'s 1 mm envelope assertion is untouched
— the same rule the awning, the hatches and the rear fittings already follow.

### What the video shows that the model does not

| | Video | Model today |
|---|---|---|
| Livery | Teal, orange and black swoosh across both flanks with a `DACHIRV 大驰` wordmark | A tiling stripe band, off flank only |
| Glazing | Large radiused apertures in wide black frames, dark tinted | Four white 12 mm strips scribed on white paint |
| Cab | Raked windscreen, bonnet, grille, mirrors on arms, wheel arches | A box |
| Over-cab | Tapered FRP moulding with a forward window | A box |
| Washer | A front-loading machine door set into the kerb flank | A 210 mm porthole |
| Roof | Air conditioner, awning cassette | Awning cassette only |
| Rear | Light clusters | Keypad, handle, vent, flat spare |
| Wheels | Spoked alloys | A cylinder with a smaller cylinder on its face |

### Livery: hand-authored artwork, not a rectified frame

The repo has a rectifier (`pnpm textures`, driven by `model/textures.json`) and every interior
texture came out of it. It is the wrong tool here. The presenter stands in front of the flank in
every frame that shows enough of it, the showroom's ceiling lights reflect off the paint, and the
usable stretches are foreshortened. Rectifying that bakes a person's shadow and a showroom into
the vehicle's paint.

So the swoosh is drawn by eye from [h0140](../research/walkthrough/) and the 2m38s frame, exported
to `public/textures/side-livery.webp`, and registered against the existing `body.graphic` role. No
new geometry, no new role, and it extends to the kerb flank, which carries no decal at all today.

**This collides with the UV density assertion, and the collision is the interesting part.**
[check_blend.py:128](../../tools/check_blend.py#L128) asserts a median of 0.5 to 2.0 UV units per
metre for every role, because `normalise_uv_density()` holds `UVMap` at exactly 1.0 UV/m and every
`repeat` in the registry is authored against that. The current decal survives it by tiling and
carrying no lettering. A wordmark cannot tile: it must map exactly one copy across a 3.4 m panel,
which at 1.0 UV/m means a UV span of 3.4, not 1.

The resolution is to keep the density and divide it back in the registry:

- Give the decal planes an explicit box UV running `0 → 3.4` by `0 → 0.70`, so density is exactly
  1.0 UV/m and the island origin is 0 rather than wherever `smart_project` left it.
- Set `repeat: [1/3.4, 1/0.70]` on the `body.graphic` map, which lands one copy on the panel.

**Setting that UV inside `model_exterior.py` is not enough.** `main()` in `model_interior.py`
re-unwraps every mesh in the collection after the builder returns, running `smart_project` and
then `normalise_uv_density` unconditionally, so a UV written by the builder is discarded before
the file is saved. The dispatch loop needs an exemption set, and the decal planes go in it. That is a
pipeline change, not an exterior change, and it is the first task of the exterior phase.

If the island origin still cannot be pinned, the fallback is an `offset` field on `TextureSpec` —
three lines, across `finishes.ts`, `textures.ts` and the registry entry. Prefer the explicit UV.

### Glazing: black frames, no new glass

`_door_reveal` currently scribes four thin `body.paint` strips and deliberately leaves the
aperture open, because a filled rectangle sits between the interior glazing and the sky and
renders that glazing black from indoors — its own comment says so, and the parent spec records the
defect that taught it.

The fix keeps the hole. The four strips widen and change to `metal.dark`, which is what the video
shows: the frames are black and heavy, and the dark tint the eye reads is the *interior* pane
already modelled, seen through the opening. Adding a second `glass` pane in the aperture would
double the tint and re-create the defect.

### Cab and FRP moulding

`model_exterior.py` builds from `box` and `cylinder` only, which is why the cab is a box. Two
additions to the shared helper vocabulary in `model_interior.py`:

- `wedge` — a box with one face sheared, enough for the windscreen rake and the tapered nose of
  the over-cab moulding.
- an arch cut for the wheel openings.

Then grille, bonnet, mirrors on arms, and the moulding's forward window. Nothing here introduces a
measured number: the rake and the taper are proportions of the existing `body_cab` and
`body_alcove` placements.

**The sculpt may not move any envelope extreme.** `check_models.mjs` measures width, length and
height across eight named bodies (`body_cab`, `body_alcove`, `body_habitation`, `skirt` and the
four wheels) and asserts 2450 × 5998 × 3200 mm to a millimetre. Four surfaces carry those
extremes and have to survive untouched: the cab's nose plane at `Z = -1948` (length minimum), the
rear face at `Z = 4050` (length maximum), the habitation and alcove flanks at `X = ±1225` (width),
and the alcove roof at `Y = 2150` (height).

Everything the sculpt wants to cut is somewhere else. A raked windscreen removes the cab box's
upper front, and the length minimum is the bonnet at the bottom of that face. Wheel arches cut
upward from the underside, and the width extreme is the flank above them. So the sculpt is legal,
but `pnpm exec npm run check:models` is the gate on every commit that touches those bodies, not
just the last one.

### Fittings

Roof air conditioner, a modelled washing-machine door replacing the porthole, the awning cassette
detailed, rear light clusters, alloy spokes, mudflaps, chrome grab rails. These are the things the
walkaround stops at, in the order it stops at them.

### Role discipline is the budget

The exterior stop measured 57 draw calls of a ceiling of 60. Batching is global and per role, so
**geometry added in an existing role costs zero draw calls and each new role costs one.** The
whole pass above fits inside `body.paint`, `body.graphic`, `metal.dark`, `metal.chrome`, `glass`,
`tyre`, `wheel`, `led.cove` and `graphic.screen`, all of which exist. Budget: at most two new
roles, and each one has to be argued for.

## 5. Blender's role in this pass

Authoring stays in Python. `tools/model_exterior.py` is the source of the geometry, `pnpm export`
runs Blender headless, and every shape still falls out of `ENVELOPE`.

Blender's GUI is used for **verification only**: open `model/rv.blend`, screenshot the viewport
with `mac shot`, and judge the shapes a script writes blind — the windscreen rake, the FRP taper,
the wheel-arch profile. Screenshots land in `docs/research/`. Nothing is hand-edited in the
`.blend`, because a hand-edited curve stops deriving from the envelope and stops being reviewable
in a diff.

## 6. Budget

Headroom before this pass, from the parent spec's last measurement:

| Axis | Ceiling | Before | Note |
|---|---|---|---|
| Triangles | 350,000 | 94,436 | Ample. A sculpted cab is thousands, not hundreds of thousands |
| Bytes | 25 MB | 10.0 MB | One livery texture at 512–1024 px is tens of kilobytes |
| Draw calls, exterior | 60 | 57 | **The binding constraint.** See §4's role discipline |
| Draw calls, plan | 60 | — | New. Interior geometry plus the clipped body; the CSS2D layer draws none |

The parent spec already records that the interior ceiling of 40 is a stale proxy — bloom adds a
fixed 15 that the number was set before. This pass does not re-baseline it; it inherits the
exterior's 60 for the plan stop because that stop draws the body too.

## 7. Verification

- `pnpm check` green — vitest plus `tsc --noEmit`.
- New tests: `PLAN_LABELS` ids resolve in `PLACEMENTS`; `PLAN_CUT_MM` sits below every locker
  underside and above every mattress top; the two camera invariants rewritten to discriminate on
  `view.kind`.
- `pnpm exec npm run check:blend` — the UV density assertion is the one at risk, per §4.
- `pnpm exec npm run check:models` — the 1 mm envelope assertion must be unchanged.
- `?calibrate` at the plan stop, before and after a finish swap, to prove the probe fix.
- `?verify` draw calls and fps at the plan and exterior stops, at 1920 × 1080.
- Renders re-captured into `docs/research/final/`, plus a new `plan.png`, and the kerb
  three-quarter set beside the 0m59s walkaround frame.

## 7a. Phase A results — 2026-09-07

Measured at 1920 x 1080, `?verify`, Chrome, Apple silicon.

| Stop | Draw calls | Triangles | fps |
|---|---|---|---|
| Lounge | 45 | 74,890 | 106.3 |
| Alcove bed | 36 | 68,210 | 109.2 |
| Slide-out bed | 40 | 70,946 | 108.0 |
| Galley | 31 | 67,074 | 112.4 |
| Washroom | 29 | 64,442 | 106.4 |
| Cab | 30 | 60,966 | 114.9 |
| Exterior | 57 | 94,366 | 120.0 |
| **Floorplan** | **57** | **94,366** | **120.0** |

The plan stop costs exactly what the exterior stop costs, because it draws the same set: the
whole interior plus the clipped body. 57 of a ceiling of 60. The CSS2D layer adds none, as §3
predicted. Draw calls are identical with the overlay on and off.

The lounge still reads 45 against the stale interior ceiling of 40, unchanged by this pass and
for the reason the parent spec's record already gives: bloom adds a fixed 15 the number predates.

### The probe fix, measured

`?calibrate` at the lounge, before any swap: 0.052 / 0.083 / 0.069. The chair panel already sits
above 0.08 and did so before this pass; it is not something the clip plane moved.

Swapping the wood finish **at the plan stop**, with the section plane set, then measuring at the
lounge: 0.065 / 0.073 / 0.062, all three passing.

The control, the identical swap performed at the lounge where no plane is set, returns
`#a29b97 / #e8e1d7 / #e0dad2`, the same three hex values to the byte. A clip plane leaking into
the capture would have changed them. §8's risk 2 is closed.

### Two decisions the render forced

**The camera leans off the pole.** The pose in §2 put the camera straight above its target, where
the view direction is parallel to the camera's up vector and `lookAt` resolves the roll from
whatever pose the tween came from: arriving from the galley put the nose at the bottom of the
frame, arriving from the lounge put it at the top. The arrival pose now sits on the 0.05 polar
floor, 0.42 m aft of the target, which pins it nose-up, the way §2 of the spatial brief draws
every floor plan.

**The target is the body's centre, not the habitation box's.** At the specified target of Z 2000
the cab and the alcove fell off the top of the frame. The vehicle runs Z -1948 to 4050, so its
centre is 1050, and 8.4 m of standoff is what a 50 deg vertical field needs to hold all 6 m with
margin.

### What is still wrong

Two label pairs overlap at the default zoom — `卡座 booth` against the forward `Aisle`, and
`Fridge 148 L` against `Sliding partition`. Both remain legible and both clear as soon as the
viewer orbits or zooms. Anchors are placement centres by design, so the fix is either a collision
solver or hand-placed anchors, and the second would give up the guarantee that a label cannot
drift from the geometry it names. Left as is.

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | The livery breaks `check:blend`'s UV density assertion | §4's explicit box UV plus a computed `repeat`; `offset` on `TextureSpec` as fallback |
| 2 | A finish swap at the plan stop relights the interior through the open roof | Save, clear and restore `clippingPlanes` inside `refreshProbe`; the `?calibrate` check in §7 proves it |
| 3 | The fittings pass introduces new roles and blows the 60 draw-call ceiling | At most two new roles, each argued for; measure at the exterior stop after every batch of additions |
| 4 | The clip plane also clips shadow rendering, so the roof stops shadowing the floor | Wanted, not a defect — a dollhouse lit through a missing roof is the intended read. Confirm by eye |
| 5 | 55° polar is the wrong ceiling for the plan stop | Cheap to retune once there is something to look at. Named here so it is a decision, not a drift |
| 6 | A sculpted cab moves an envelope extreme and breaks the 1 mm assertion | §4 names the four surfaces that carry the extremes; `check:models` runs on every commit touching a named body, not only at the end |
| 7 | A builder-written UV is silently discarded by the dispatch loop's re-unwrap | The exemption set is the exterior phase's first task and is verified by `check:blend` before any artwork exists |

## 9. Open questions

1. Whether 55° of polar freedom is enough at the plan stop, or whether it wants to tilt further
   toward eye level. §8's risk 5.
2. Whether black frames alone close the glazing gap, or the reveals also need deepening so the
   apertures read as recessed rather than painted on.
3. Whether the plan stop should be the app's landing view. It is the most legible single frame the
   project can produce, and `main.ts` currently lands on `dinette`. Not decided here.
4. Whether the label overlay needs a Chinese variant. Every label naming a fitting the video names
   in Chinese (卡座, 后上门) already carries it; the rest are English.

Carried forward from the parent spec, untouched by this pass: the mid-range phone frame rate has
still never been measured on hardware, and the engine tunnel still reads as a black slab down the
centreline of forward-looking lounge shots.
