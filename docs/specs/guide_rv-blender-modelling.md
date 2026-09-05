# Blender modelling guide — Tasks 12 and 13

- Date: 2026-09-05
- Audience: whoever is modelling `model/rv.blend`
- Covers: [the plan](plan_rv-interior-3d.md) Tasks 12 and 13, implemented with repeatable Blender Python modelling
- Design: [design_rv-interior-3d.md](design_rv-interior-3d.md)

`model/rv.blend` now contains the modelled shell and all eight furniture collections, with
packed UV2 ambient occlusion and surface maps. The original block-out has been replaced.
See [model/README.md](../../model/README.md) for per-collection regeneration, rebaking and checks.
The workflow below remains the authoring guide for future edits.

## Step 0 — Open what's already there

```bash
cd /Users/keli/dev/rv-car
git checkout feat/interior-3d
open model/rv.blend
```

Expect 9 collections in the Outliner, 17 `role.*` materials, scene units in metres.

To reset to a fresh block-out (**this destroys your modelling**):

```bash
FORCE=1 npm run starter
```

Without `FORCE=1` the generator refuses to overwrite, so it cannot eat work in progress.

## Step 1 — The three rules that break the build

Everything else is taste. These are enforced by code:

1. **Never rename an object.** `dinette_table` stays `dinette_table`. `src/binding.ts` throws at
   load time if a name in `PLACEMENTS` has no matching node. Adding new objects is fine.
2. **Never create a material.** All 17 `role.*` materials exist in the file already, so assign rather
   than create. `tools/export_modules.py` exits 1 on any material not starting with `role.`, naming the
   offender.
3. **Never change scene units.** Metres, scale length 1.0. The export checks this too.

**Axes:** Blender is `+Z` up, the runtime is `+Y` up, and the exporter's `export_yup` rotates the frame.
Author in Blender's frame, where the runtime's `+Z` (rearward) is Blender's `+Y`. `+X` is the
kerb side in both. The export script also adds a temporary Y-reflection parent: Y-up rotation
alone maps Blender +Y to runtime -Z, so it is not sufficient.

**Dimensions:** `model/placements.json` carries every object's location and size in metres. It is
generated from `src/data/vehicle.ts` by `npm run dump`, so read it rather than editing it.

## Step 2 — The shell (Task 12)

Collection `shell`: `floor`, `ceiling`, `wall_off`, `wall_kerb`, `bulkhead`, `wall_rear`,
`slideout_shell`.

1. **Flip normals inward.** Edit Mode, `A`, then `Alt+N` → Flip. These are seen from inside.
2. **Cut the roof hatch** above the aisle at roughly `Y = 1.4 m`, about 500 × 700 mm.
3. **Cut the windows:** one over the sofa in `slideout_shell`, one at the dinette in
   `wall_kerb`, two in the alcove flanks. Panes get `role.glass`.
4. **Cut the cove recesses.** 60 mm deep, running the full habitation length along both ceiling
   edges. Inset a thin strip inside each and assign `role.led.cove`.
5. Walls and ceiling get `role.panel.wall`, the floor gets `role.floor`.

> Step 4 is the one that matters most. The environment probe fakes global illumination by
> capturing emissive geometry, so **no emissive cove strips means a black room**. This was hit
> during implementation, and it is why the grey-box carries its own flat lighting as a fallback.

Then:

```bash
npm run export && npm run optimize && npm run budget && npm run dev
```

## Step 3 — The furniture (Task 13)

One collection per sitting, easiest first. **Washroom last.** It is a moulded GRP shell with compound
curves, the hardest thing in the vehicle and the least visible, and the design already accepts
it as the weakest zone.

| Order | Collection | Objects | Reference image |
|---|---|---|---|
| 1 | `dinette` | `dinette_chair_fwd_in`, `dinette_chair_fwd_out`, `dinette_chair_aft_in`, `dinette_chair_aft_out`, `dinette_table` | `dinette-and-slideout-bed.jpg`, `galley-wardrobe-dinette.jpg` |
| 2 | `sofa_slideout` | `slideout_base`, `slideout_bed` | `bed-dimensions.jpg`, `dinette-and-slideout-bed.jpg` |
| 3 | `alcove_bed` | `alcove_bed`, `alcove_lockers` | `interior-lounge-and-overcab.jpg` |
| 4 | `lockers` | `lockers_kerb`, `lockers_off` | `interior-lounge-and-overcab.jpg` |
| 5 | `cab` | `cab_seat_off`, `cab_seat_kerb` | `interior-lounge-and-overcab.jpg` |
| 6 | `galley` | `galley_run`, `galley_overhead`, `fridge`, `wardrobe` | `galley-detail.jpg`, `galley-wardrobe-dinette.jpg` |
| 7 | `softgoods` | curtains, cushions, bedding (not in `PLACEMENTS`, so name freely) | all |
| 8 | `washroom` | `washroom_pod` | `underseat-drawers-washroom.jpg` |

Reference images: [../research/reference/](../research/reference/).
Materials, colours and equipment detail: [the research note](../research/2026-09-04-dachi-wujijing-500-reference.md).

### Material roles

| Surface | Role |
|---|---|
| Seat main panels | `role.upholstery.seat` |
| Seat bolsters and piping | `role.upholstery.bolster` |
| Bench sofa cushions | `role.upholstery.sofa` |
| All cabinetry | `role.wood.cabinet` |
| Ceiling and edge trim | `role.wood.trim` |
| Locker doors | `role.panel.locker` |
| Worktops | `role.worktop` |
| Handles, rails, plinth trim | `role.metal.brushed` |
| Basin and shower taps | `role.metal.chrome` |
| Kitchen mixer | `role.metal.dark` |
| Washroom mouldings | `role.washroom.shell` |
| Shower duckboard | `role.washroom.duckboard` |
| Curtains and blinds | `role.textile.curtain` |

### Two sizes that must not move

The only published dimensions in the model. `npm test` fails if either changes:

| Object | Size | Note |
|---|---|---|
| `alcove_bed` | 2200 mm across × 1400 mm fore-aft | Transverse; sleepers lie across the vehicle |
| `slideout_bed` | 1280 mm outboard × 1900 mm fore-aft | Longitudinal |

The slide-out is modelled **deployed only**, and the resolved reading is that the bed infills
inboard while the sofa base stays put. So the aisle stays 520 mm deployed: the slide-out buys
sleeping width, not floor space.

### After each collection

```bash
npm run export && npm run optimize && npm run budget && npm test
```

If the budget fails, decimate the collection you just added rather than trimming an earlier one.
Budget is 350,000 triangles, 25 MB, 40 draw calls.

## Step 4 — Bake ambient occlusion

Per object, AO only, into UV map 2.

**Do not bake a full lightmap.** Baked bounce light pins furniture in place and kills the
customisation seam, which is the reason the architecture is shaped the way it is.

1. Render Properties → Cycles.
2. Add a second UV map per object named `UV2`, lightmap-pack it.
3. Bake Type → Ambient Occlusion, with `UV2` active.

## Step 5 — KTX2, only once textures exist

Install the macOS tools from the [official KTX-Software releases](https://github.com/KhronosGroup/KTX-Software/releases)
and put `ktx` on `PATH`. The original `brew install ktx` command is unavailable in the current catalogue.

`npm run optimize` skips KTX2 texture compression while the `ktx` binary is absent, so the
pipeline runs on a clean machine. It switches on by itself once the AO bakes give it something
to compress.

## Command reference

| Command | Does |
|---|---|
| `npm run starter` | Regenerate `model/rv.blend` from the data. Needs `FORCE=1` to overwrite. |
| `npm run dump` | Regenerate `model/placements.json` only |
| `npm run export` | Blender headless, one `.glb` per collection into `dist/raw/` |
| `npm run optimize` | Draco, plus KTX2 if available, into `public/models/` |
| `npm run budget` | Assert triangle and byte budgets |
| `npm test` | 77 unit tests, including the dimensional checks |
| `npm run check` | Tests plus `tsc --noEmit` |
| `npm run dev` | Serve at `localhost:5173` |

## What comes back to the implementer

Once the modules exist, two plan steps remain and neither needs Blender:

- **Task 14 step 5** — tune `toneMappingExposure`, `environmentIntensity`, cove intensity and
  `led.cove` emissive strength against the reference photography.
- **Task 15 step 5** — retune the six hotspot camera positions. They currently sit too close,
  having been placed against grey-box masses rather than real furniture. Then verify frame rate
  and run the visual comparison.

## Current state

Tasks 12 and 13 are modelled, exported and verified. The nine collections include actual
apertures, cove recesses and strips, upholstered seating, deployed sleeping surfaces, cabinets,
galley appliances, fabric, and an open moulded washroom. All 25 placement IDs and both published
bed footprints survive Draco/KTX2 optimisation.

AO is baked separately for 29 mesh objects into disjoint regions of one packed 2048px atlas.
`npm run check:blend` checks the saved Blender geometry; `npm run check:models` checks raw and
optimised exports. Runtime role batching retains movable roots and reduces steady frames to
35 draws with cached static shadows. See [the plan](plan_rv-interior-3d.md) for measured results,
visual evidence and the two remaining lighting/camera acceptance steps.

One estimated placement was corrected during visual inspection: alcove lockers now sit at the
head end (runtime Z -1400 to -1100 mm), leaving the bed entrance open. Published sizes are unchanged.
