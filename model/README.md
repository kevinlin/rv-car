# Blender source

`rv.blend` is the single source for all interior geometry. It is **generated** as a correctly
scaled block-out and then sculpted by hand — do not build it from scratch.

## Generate the starter (once)

    npm run starter

Reads `src/data/vehicle.ts`, writes `model/placements.json`, and builds `model/rv.blend` with
every object at the right size, in the right place, in the right collection, under the right
name, with a role material assigned. It refuses to overwrite an existing `rv.blend` unless you
set `FORCE=1`, so it cannot eat work in progress.

## Rules

- Scene units: **metres**, unit scale 1.0.
- One top-level collection per module, named exactly as `MODULES` in `tools/export_modules.py`.
- Object names must equal the `id` of the matching entry in `src/data/vehicle.ts`.
  `src/binding.ts` throws at load time if a name in the data has no matching node.
- Material names must be `role.<role-id>`, matching a `Role` in `src/data/finishes.ts`.
  All 17 already exist in the starter file — assign, don't create.
- Bake **ambient occlusion only**, per object, into UV map 2. No full lightmaps: they would
  pin the furniture in place and kill the customisation seam.
- Blender is +Z up, the runtime is +Y up. The exporter's `export_yup` handles it. Author in
  Blender's frame: the runtime's `+Z` (rearward) is Blender's `+Y`.
- `softgoods` holds curtains, cushions and bedding. It has no entries in `PLACEMENTS`, so name
  those objects freely.

## Build

    npm run export && npm run optimize && npm run budget

`npm run optimize` skips KTX2 texture compression unless the `ktx` binary is on PATH
(`brew install ktx`). That only matters once AO bakes exist.
