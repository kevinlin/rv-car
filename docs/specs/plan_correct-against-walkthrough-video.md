# Plan: mirror the cabin, then correct it against the manufacturer's walkthrough video

## Context

The walkthrough was built from stills plus a text brief and has been corrected four times, each
pass moving furniture across the cabin because handedness could not be settled from stills.

New evidence: the manufacturer's own 18-minute walkthrough video
(douyin.com/video/7627690532785694434, 新款房车发布：大驰境500，后上门后置厨卫车型做到极致),
sampled at 119 frames plus targeted high-resolution stills.

Two outcomes:

1. **Handedness is wrong, but only in the service room.** The washroom pod belongs in the rear
   **off** corner, not the rear kerb corner, and the galley opposite it on the kerb flank. The
   lounge was already right: booth off, slide-out kerb. This was written as a whole-cabin mirror
   and implemented as one before verification caught it; see *Dissent* below for what the frames
   actually show and why the propagation argument failed.
2. **Everything above the layout is wrong too** — palette, fittings, lighting and the exterior.

The mirror lands first. Props placed against the old handedness would be modelled twice, which is
the failure mode the spec's own phasing section warns about.

## Supporting evidence for the mirror

Not proof, but it resolves something that did not previously add up. The exterior profile with the
nose at frame right is the vehicle's **right** side — the kerb flank — and it carries the awning,
the external washing machine, the storage hatches, the control panel and one large window.
Cropping that window at native resolution and upscaling (frames at 1:17, 1:35, 2:20) shows a
walnut overhead cabinet run with three LED strip bars and a counter with downlights below it,
seen at some depth.

That reads as the galley overhead directly above its own counter, which only works if **the galley
is on the kerb flank**. Under the shipped layout the galley is off, and that window would have to
be looking clear across the cabin — which never sat right.

## What the video settles regardless of handedness

| Item | Video |
|---|---|
| Boarding door | rear wall, 后上门, "美式门", keypad + chrome grab handle + vent grille, spare wheel alongside |
| Booth arrangement | 前一后二, table between, drawer in the table |
| Fridge | tall dark-gloss column beside the partition, immediately beside a booth seat |
| Overall height | "3米2" = 3200 mm ✓ matches `ENVELOPE` |
| Overall length | "5995" — model uses 5998 (`published`, pinned to the 6 m C1 limit) |
| Cabin palette | walnut-dominant: gloss walnut locker fronts with LED strips beneath, walnut upper walls |
| Galley | black composite sink, black gooseneck pull-down tap, extractor hood, black pegboard wall, oven column, small window over the counter |
| Interior washer | **gone** — last year's 3 kg washer bay now holds electrical gear; the 5 kg washer is external |
| Washroom | one-piece GRP, hinged walnut door with chrome lever and full-length mirror, corner basin, ceiling vent fan flanked by downlights, retractable clothesline, roller-blind window |
| Lounge | roof-hatch projector, small wall monitor for the exterior cameras, plinth LED strips, under-seat drawers, framed calligraphy plaque |
| Alcove | head-wall cabinets, side windows with curtains, small screen at one end, sculpted GRP shell with cove reveals |
| Slide-out | never deployed on the showroom car — consistent with the model, not contradicted |
| Fresh water | 270 L |

Leave 5998 alone: it cascades into `habLength` 4050 and the 1 mm envelope assertion in
`check_models.mjs`. Record the 3 mm.

## Dissent, recorded — and upheld

One observation I could not reconcile with the mirror. In the high-resolution lounge frames at
8:32–9:00 the presenter stands **upright with headroom** in a full-height walnut-framed doorway,
which makes it the partition rather than the cab opening (the modelled alcove underside is
1150 mm). Reading the camera as facing aft through the partition puts the sofa on the kerb flank
and the booth on the off flank — the shipped layout, not the mirrored one.

**Verification upheld the dissent, and the mirror was corrected to a hybrid.** The frames were
retrieved and read: the sofa is on the left and the booth on the right looking aft, so sofa kerb
and booth off; but through the same doorway the galley's pegboard and counter are on the left and
the mirrored washroom door on the right, so galley kerb and pod off. The 3:50 frame through the
open rear door, where the sense reverses, agrees on the service room.

So **the lounge and the service room are handed opposite ways**. The bad link in the reasoning
above is "the galley continues the line the fridge starts": it does not. The fridge sits with the
booth on the off flank and the galley sits behind the wardrobe on the kerb flank. That is why the
exterior kerb-window crop and the lounge frame had looked irreconcilable — both were right.

Evidence in `docs/research/walkthrough/`, renders in `docs/research/handedness/`, and the layout
is pinned by the handedness guard in `src/check.test.ts`.

---

## Task 1 (done) — Mirror the habitation interior (X → −X)

Data-only in `src/data/vehicle.ts`, plus the hard-coded halves of the Blender modules.

**What moves.** Every habitation furniture placement. For a box, mirrored origin is
`−(origin.x + size.x)`; sizes are unchanged.

**What does not move:** `cab_seat_off` / `cab_seat_kerb` (the vehicle is LHD — the driver stays
left), the four `wheel_*`, the exterior body masses, the skirt, and the symmetric shell panels
(`floor`, `ceiling`, `bulkhead`, `wall_rear`, `partition`, `wall_off`, `wall_kerb`).

**The `_off` / `_kerb` pairs exchange their rows rather than both flipping sign**, so every id keeps
the side its name claims and no Blender object is renamed:

- `dinette_chair_aft_off` ↔ `dinette_chair_aft_kerb`
- `lockers_off` ↔ `lockers_kerb` — note their `zone` travels with the coordinates, so `lockers_off`
  becomes zone `sofa` and `lockers_kerb` becomes zone `dinette`. `ZONE_VOLUME` maps `sofa` to the
  `slideout` volume, so this matters for containment.

Also mirror:
- `VOLUMES.slideout`: −1180…1760 → −1760…1180
- `slideout_shell` (shell): 1180…1760 → −1760…−1180
- `slideout_box` (exterior): 1225…1805 → −1805…−1225. Excluded from the envelope check, so the
  2450 mm width assertion is unaffected.
- All seven `HOTSPOTS`: negate X on both `position` and `target`. `alcove` and `cab` sit on the
  centreline and do not change. The `exterior` orbit stop moves to the **kerb** three-quarter,
  because the kerb flank is the flat one now.

**The aisle is preserved.** The 560 mm minimum currently sits at Z 1410–1930 between the inboard
booth chair at X −110 and `slideout_base` at X 450; mirrored that is +110 and −450, and
`check.ts`'s `kerbMin − offMax` gives 560 again. Worth confirming, not worth worrying about.

**Blender.** The last correction pass already paid for most of this: `build_washroom`
(`tools/model_furniture.py:263`) derives `side` from the sign of x, and `build_galley` (`:128`) is
written in terms of `back`/`front` and `y0`/`y1`. Both mirror as a data change. `_chair`,
`build_lockers` and `build_sofa_slideout` measure off their placements and follow.

Hand-mirror the parts that are still literal metres:
- `build_shell` (`tools/model_interior.py:222`) — windows, the slide-out aperture, coves,
  downlights, ceiling bands. Side-specific throughout.
- `build_softgoods` (`tools/model_furniture.py:234`) — curtains, cushions, decals, all absolute.
- `build_exterior` (`tools/model_exterior.py:28`) — `_door_reveal` and the flank graphics.

**Checks that carry hard-coded world points and will break:**
- `tools/check_blend.py:12-21` — bowl normals at galley sink `(-.85, 2.814, .746)`, washroom basin
  `(.85, 3.24, .72)`, toilet pan `(.48, 3.70, .34)`. Negate X on all three.
- `tools/check_blend.py:33-43` — six glazing ray casts, four of them side-specific (dinette window,
  slide-out window, service window, galley window).
- `src/calibrate.ts` — the white-balance patches. The spec already records these as mirrored rather
  than re-verified after the last pass. **Re-derive them against a marked screenshot; do not mirror
  them a second time.**
- `src/camera.test.ts` — hotspot safety and the lounge/service stop-side assertions.

**Add one guard.** This is the fourth flip of the cabin. Add a single test in `check.test.ts` that
pins handedness to a named fact — `galley_run` sits wholly on the kerb flank (min X ≥ 0) and
`washroom_pod` wholly on the off flank (max X ≤ 0) — with a comment citing the video. A future pass
that flips it then fails loudly instead of silently. One assertion, and it is the cheapest thing
here that prevents a fifth pass.

## Task 2 (done) — Palette: the cabin is walnut-dominant

Confirmed decision: video wins over spec row 4 ("locker doors cream in a walnut frame"). Record it
as a correction, not a silent flip.

- `src/data/finishes.ts` — `panel.locker` from bone-gloss to gloss walnut: walnut colour plus
  `map: walnut.webp` at the `wood.cabinet` repeat (2×2). Registry-only, no rebuild, and it exercises
  the seam the project is built around.
- Keep `panel.wall` cream below and forward; in Blender re-role the **upper** lounge wall faces to
  `role.wood.cabinet`.
- Seats carry far too much camel. Video shows grey leather with a narrow camel base band and
  piping. Shrink the bolster meshes in `_chair` — the role split is right, the areas are not.

## Task 3 (done) — Galley

In `build_galley`:
- Replace the washer fascia with an electrical panel.
- Add the stainless extractor hood, black pegboard accessory wall, microwave/steam-oven column.
- Sink and tap go dark: black rectangular composite bowl, black gooseneck pull-down tap, both
  `role.metal.dark` (already at `finishes.ts:98`). The square stainless bowl and chrome tap are wrong.
- Update the `check_blend.py` sink coordinate in the same change (see Task 1).

## Task 4 (done) — Washroom

- Hinged walnut door with chrome lever and full-length mirror on the outer face, modelled swung
  open so the hotspot still sees in. Build it as a **detail mesh**, not a placement — a placement
  would overlap `washroom_pod`, exactly as the spec's "Row 10 could not be placements" records.
- Ceiling vent fan flanked by two downlights, retractable clothesline, roller-blind window, shower rail.

## Task 5 (done) — Lounge and alcove props

- Lounge: roof-hatch projector, small wall monitor above the sofa (`graphic.screen`), table drawer,
  plinth LED strips under seats and sofa (`led.cove`), under-seat drawers, framed plaque
  (`graphic.print`).
- The monitor partly reverses the spec's "wall TV is dropped" note: the real screen is small and
  sits between the window and the lockers, where there is room.
- Alcove: side windows with curtains, small screen at one end, reading lights, curved cove reveals
  in the shell. The render's alcove ceiling is flat where the video's is sculpted.

## Task 6 (done) — Exterior

`docs/research/final/exterior.png` is a plain white box. **Exterior flank detail does not mirror** —
the video fixes it to the kerb flank independently of the interior reading, and under the mirrored
layout that flank is the galley, which is what makes the window make sense.

In `build_exterior`: Dometic awning with its LED strip along the kerb roof edge; window apertures
(the awning-covered galley window, cab windows, alcove side windows); hatches (lower storage bay,
round-porthole washer hatch, external control panel); rear-face keypad, grab handle, vent grille and
spare-wheel carrier. Livery stays a stripe band — the UV reason is recorded and unchanged.

Two landmines:
- `check_models.mjs:124-137` asserts the envelope to 1 mm over **named placements only**. Keep the
  awning and hatches as `exterior_details` meshes and the check is unaffected.
- Any new exterior role must go into `EXTERIOR_ROLES` (`finishes.ts:143`), or the interior
  environment probe captures it and darkens the cabin — the trap section 9 already records.

## Task 7 (done) — Lighting and post

Spec section 7 asks for bloom and GTAO; no pass has shipped a post chain, and the video's whole look
is LED strips reading as light against dark walnut.

- `src/scene.ts`: `EffectComposer` with `RenderPass` → `GTAOPass` → `UnrealBloomPass` → `OutputPass`,
  all from `three/addons/postprocessing/`. Those four, nothing more.
- Re-tune exposure and `environmentIntensity` afterwards — the walnut palette lowers room albedo and
  shifts the probe.
- Re-run `?calibrate` with the re-derived patches from Task 1.

## Task 8 (done) — Record the evidence

- Save the best walkthrough stills into `docs/research/reference/`, matching the existing convention.
- Append an implementation-record section to `docs/specs/design_rv-interior-3d.md` — the photoref
  spec was folded into it at `0e4c1b6`, and the correction sections live under
  `# Implementation record` (line 631+, latest `## Rear service room correction` at 940). Follow that
  pattern: what changed, the evidence, what stays open. Supersede the "REAR KERB corner" row at
  line 950 and the open-question answer at line 600 explicitly.

## Files

| File | Change |
|---|---|
| `src/data/vehicle.ts` | mirror every habitation placement, `VOLUMES.slideout`, all hotspots |
| `src/check.test.ts` | handedness guard |
| `src/camera.test.ts` | hotspot safety and stop sides follow the mirror |
| `src/calibrate.ts` | re-derive patches against a marked screenshot |
| `src/data/finishes.ts` | `panel.locker` → walnut; new exterior roles into `EXTERIOR_ROLES` |
| `src/scene.ts`, `src/lighting.ts` | post chain, exposure/probe re-tune |
| `tools/model_interior.py` | `build_shell` mirror, upper-wall re-role, projector |
| `tools/model_furniture.py` | `build_softgoods` mirror; `build_galley`, `build_washroom`, `_chair`, `build_alcove_bed` |
| `tools/model_exterior.py` | door reveal + graphics mirror, awning, apertures, hatches, rear furniture |
| `tools/check_blend.py` | three bowl world points, four side-specific ray casts |
| `docs/specs/design_rv-interior-3d.md` | correction section |
| `docs/research/reference/` | walkthrough stills |

## Verification

Every collection is rebuilt, so this is a full pipeline run, not a targeted one. New meshes have no
`UV2` until the bake — skipping it fails `check_blend.py:66`.

```
pnpm exec npm run model -- <collection>   # all ten
pnpm exec npm run bake                    # AO into the packed UV2 atlas, ~10 s
pnpm exec npm run check:blend
pnpm export && pnpm optimize
pnpm exec npm run check:models            # placement bounds, roles, envelope, AO wiring
pnpm budget
pnpm check                                # vitest + tsc, the gate before commit
```

Browser:
- `?verify` at all seven stops: ≤ 40 draw calls interior, ≤ 60 exterior, ≥ 60 fps at 1080p. The post
  chain is the thing most likely to break this — measure before and after.
- `?calibrate`: floor, chair panel and washroom wall under 0.08 saturation.
- Wood swatch swap still touches only `wood.cabinet` and `wood.trim`.

Then **re-capture all seven renders**. `docs/research/final/` was captured at `8aa5b44` and predates
the last three layout corrections, so there is currently no render of the shipped model at all.

**The one comparison that matters:** put the re-captured lounge render beside the 8:32–9:00 frame
described under *Dissent*. Sofa on the off flank and booth on the kerb flank confirms the mirror; the
reverse means it needs backing out, which is a sign flip on the same rows.

Commit `public/models/` with the geometry — the Pages runner has no Blender, and an un-tracked
`public/models/` deploys the grey-box instead of the vehicle.

## Open

- **Length 5995 vs 5998 mm.** Recorded, not acted on.
- **Whether this unit has the side slide-out at all.** Never deployed, no box visible on the kerb
  flank, but the manufacturer's poster states the 1280 × 1900 slide-out bed. Modelled deployed,
  unchanged.
- **The sliding partition leaf** was never clearly in frame — only the walnut-framed portal. The
  full-width partition at Z 2500 stays on the brief's authority.
