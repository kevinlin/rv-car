# Blender source

`rv.blend` contains the modelled shell and eight furniture collections. All 25 placement nodes
retain their data-defined centres and bounds. The scene includes packed object AO and grayscale
wood, floor and textile maps. Runtime finish colours tint the maps.

## Reproduce or edit

Edit the saved `.blend` directly, or replace a single collection from its modelling script:

```sh
npm run model -- dinette
```

This replaces only that collection. Supported names, in modelling order: `shell`, `dinette`,
`sofa_slideout`, `alcove_bed`, `lockers`, `cab`, `galley`, `softgoods`, `washroom`.
The scripts read `placements.json`, generated from `src/data/vehicle.ts` by `npm run dump`.
Do not hand-edit the placement JSON. Regenerating a collection requires rebaking the atlas.

```sh
npm run bake
npm run export
npm run optimize
npm run check:models
npm run budget
npm run check
npm run dev
```

`npm run starter` is the original block-out generator. It refuses to replace the model unless
`FORCE=1` is provided. **A forced starter run discards the detailed model.**

## Contracts

- Metres, scale length 1.0, nine module collections, 17 canonical `role.*` materials.
- Blender authoring axes: +X kerb side, +Y rear, +Z up. `export_modules.py` adds a temporary
  Y-reflection parent before glTF's Y-up rotation. This is necessary to produce runtime +Z rear.
- Placement IDs are retained through export and optimisation. Their origins are centres in
  Blender, derived from the minimum-corner placement data. Free details belong to their module.
- AO is baked with only the current object visible, into separate regions of a shared 2048px
  atlas on `UV2`. `UVMap` is the surface-texture set. There is no lightmap.
- Role batching in the runtime retains all placement nodes and the five movable furniture roots.
  Static objects share material draws; chair and table geometry remains independently movable.

## KTX2

Install the macOS tools from the [official KTX-Software releases](https://github.com/KhronosGroup/KTX-Software/releases).
The guide's original `brew install ktx` command is unavailable in the current Homebrew catalogue.
Put `ktx` on `PATH` before `npm run optimize`; otherwise the command retains PNG textures.
This run used KTX-Software 4.4.2 arm64, extracted from the official package into a temporary
folder, without installing system-wide files. Geometry uses Draco via glTF Transform 4.5.0.

`public/models` and `dist/raw` are generated and ignored by Git. The packed `.blend` is enough
to export them. Restart Vite after adding new module files if it still serves its HTML fallback.

## Verification

`npm run check:models` writes `verification.json`: raw and optimised world bounds, exact bed
footprints, role names, UV2/occlusion texture wiring, triangle/byte counts and batching feasibility.
`ao-bake.json` records the actual isolated AO bake. The development-only `?verify=1` viewer
exposes module count, placement binding count, draw calls and sampled FPS as canvas data attributes.
See the implementation plan for browser evidence and the separate lighting/performance follow-ups.
