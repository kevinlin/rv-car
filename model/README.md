# Blender source

`rv.blend` is the single source for all interior geometry.

## Rules

- Scene units: **metres**, unit scale 1.0.
- One top-level collection per module, named exactly as `MODULES` in `tools/export_modules.py`.
- Object names must equal the `id` of the matching entry in `src/data/vehicle.ts`.
  `src/binding.ts` throws at load time if a name in the data has no matching node.
- Material names must be `role.<role-id>`, matching a `Role` in `src/data/finishes.ts`.
- Bake **ambient occlusion only**, per object, into UV map 2. No full lightmaps: they would
  pin the furniture in place and kill the customisation seam.
- Same coordinate frame as the runtime: origin at habitation floor, centreline, cab bulkhead.
  `+X` kerb side, `+Y` up, `+Z` rearward.

## Export

    npm run export && npm run optimize && npm run budget
