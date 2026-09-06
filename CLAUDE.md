# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Three.js walkthrough of a 大驰 无极境500 C-type motorhome — six interior stops with free look,
plus an exterior stop that orbits the body. Portfolio piece, not a product.

Specs, in order: [docs/specs/design_rv-interior-3d.md](docs/specs/design_rv-interior-3d.md) and its
[plan](docs/specs/plan_rv-interior-3d.md) build the interior;
[docs/specs/design_rv-photoref-360-exterior.md](docs/specs/design_rv-photoref-360-exterior.md) and
its [plan](docs/specs/plan_rv-photoref-360-exterior.md) correct it against the manufacturer's
photography, add photo-derived textures, replace orbit with free look, and add the exterior.

Read the design spec before making architectural changes: it records decisions (no lightmaps,
slide-out deployed only, AO-only bakes) that the code depends on and that should not be
relitigated silently.

## Commands

Package manager is **pnpm** (pinned in `packageManager`). Do not use npm or yarn.

```
pnpm dev                          # vite dev server on :5173
pnpm test                         # vitest run (all src/**/*.test.ts)
pnpm exec vitest run src/camera.test.ts   # a single test file
pnpm check                        # tests + tsc --noEmit; the gate before any commit
pnpm build                        # vite build
```

Asset pipeline (needs Blender at `/Applications/Blender.app`, and `model/rv.blend`, which is not
yet in the repo):

```
pnpm export      # Blender headless -> dist/raw/<module>.glb
pnpm optimize    # gltf-transform: Draco -> public/models/
pnpm budget      # fails over 350k triangles or 25 MB
pnpm exec npm run model -- <collection>   # rebuild one Blender collection
pnpm exec npm run bake                    # AO into the packed UV2 atlas, ~10 s
pnpm exec npm run check:blend             # geometry checks against the saved .blend
pnpm exec npm run check:models            # placement bounds, roles, exterior envelope
pnpm exec npm run textures                # rectify photographs into public/textures/*.webp
```

`dist/` is gitignored. `public/models/` is **committed**, along with `public/textures/` and
`model/rv.blend`. The `.glb`s do regenerate from the `.blend`, but only on a machine with
Blender, and the GitHub Pages runner has none — so an un-tracked `public/models/` deploys the
grey-box fallback instead of the vehicle. Re-run `pnpm export && pnpm optimize` and commit the
result whenever geometry changes.

## Deployment

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs `pnpm check` then `pnpm build`
on every push to `main` and publishes `dist/` to GitHub Pages. `pnpm budget` and
`pnpm check:models` are deliberately not in CI: they read `dist/raw`, which only exists after a
local `pnpm export`.

`vite.config.ts` sets `base: './'` so the bundle works from the Pages project subpath, and
`assetUrl()` in [src/loader.ts](src/loader.ts) rebases the registry's absolute `/models/…` and
`/textures/…` paths onto it. Both are load-bearing: without them every asset 404s on Pages and
the app quietly falls back to the grey-box.

Dev-only query flags: `?verify` exposes `window.__rv` and writes draw calls, triangles and fps to
`canvas.dataset`; `?calibrate` samples fixed screen patches over neutral surfaces and reports
their saturation.

## Architecture

Vanilla Three.js, no framework, one responsibility per file. The load order in
[src/main.ts](src/main.ts) is the whole story: check → scene → load → bind → finish → light → UI.

**The data layer depends on nothing.** [src/data/vehicle.ts](src/data/vehicle.ts) and
[src/data/finishes.ts](src/data/finishes.ts) import no Three.js. That is deliberate: it keeps
layout and materials editable without touching render code, and makes them cheap to test in a
node environment (vitest runs with `environment: 'node'`).

- `data/units.ts`: every dimension is an `Mm` carrying a `Confidence` tag (`published` /
  `derived` / `estimated`), because the manufacturer publishes no floorplan and most numbers are
  read off photographs. `toM` is the only mm→scene-unit conversion in the codebase.
- `data/vehicle.ts`: `ENVELOPE`, `VOLUMES`, `PLACEMENTS` (axis-aligned boxes in mm), `HOTSPOTS`.
- `check.ts`: the dimensional assertions: no furniture overlaps, everything inside its volume,
  aisle ≥ 400 mm, both published bed sizes exact. Runs at startup and in tests.
- `greybox.ts`: renders `PLACEMENTS` as coloured boxes. The fallback when no `.glb` exists.
- `loader.ts` / `binding.ts`: missing modules are *reported*, present modules are *bound
  strictly*. A rename in Blender throws a `BindingError` listing every mismatch at once.
- `finishes.ts`: maps `role.<role-id>` material names to registry variants. Strips Blender's
  `.001` suffix.
- `lighting.ts`: cove `RectAreaLight`s + a cubemap environment probe standing in for a lightmap.
  A finish swap changes room albedo, so `refreshProbe()` must be called after one. The probe is
  captured from inside the cabin, so the exterior body is hidden for the capture — otherwise it
  replaces the daylight arriving through the glazing with bounce off warm bodywork.
- `textures.ts`: resolves a `TextureSpec` from the registry to a `THREE.Texture`, cached by URL.
  Appearance lives in the registry now, not in Blender: the `.glb`s carry geometry and the baked
  AO only.
- `look.ts`: yaw and pitch about a fixed eye. `OrbitControls` cannot do this — it swings the
  camera at a radius, and a full turn inside a 2.36 m cabin goes through a wall. Every interior
  hotspot is a `look` stop; the exterior one is the only `orbit` stop.
- `calibrate.ts`: the `?calibrate` white-balance measurement.

### Coordinate frame

Origin at habitation floor, centreline, cab bulkhead. `+X` kerb side, `+Y` up, `+Z` rearward.
Metres at runtime, millimetres in the data. Blender uses the same frame, in metres.

### Blender ↔ runtime contracts

Enforced by [tools/export_modules.py](tools/export_modules.py) on the way out and
[src/binding.ts](src/binding.ts) on the way in:

1. Object names equal `Placement.id` in `data/vehicle.ts`.
2. Material names are `role.<role-id>`, matching a `Role` in `data/finishes.ts`.
3. Scene unit scale is 1.0 (metres).
4. AO baked per object into UV2. No full lightmaps — they would pin the furniture in place.

## Current state

Both specs are implemented. Ten Blender collections export to ten `.glb`s; the grey-box in
`greybox.ts` is now only the fallback for a checkout with no `public/models/`, and it skips the
`exterior` zone because that body would hide everything it encloses.

A third pass (2026-09-06) corrected the plan against
[docs/research/spatial-brief_大驰无极境500MAX.md](docs/research/spatial-brief_大驰无极境500MAX.md)
and the manufacturer's walkaround stills: three lounge seats rather than four, a full-width
sliding partition at Z 2500 dividing the lounge from the rear service room, two boarding doors
(rear wall on the centreline, kerb wall at the rear corner), and a galley run shortened to
750 mm to clear the side door. The correction section at the end of the photo-reference spec is
the record; the parent spec's zone table is superseded for those rows.

A fourth pass rearranged those three seats into the 卡座 booth the vehicle actually has: one
forward seat facing aft, two abreast facing forward, stowable table between them. The lounge
seating correction at the end of the same spec is the record.

Measured: 76,036 triangles of 350,000, 9.5 MB transferred of 25 MB, 32 draw calls at the worst
interior stop against a ceiling of 40, and 40 at the exterior against 60. Results tables in the
photo-reference spec.

Three conventions worth knowing before editing geometry:

- **UVMap runs at exactly 1.0 UV unit per metre**, held there by `normalise_uv_density()` in
  `tools/model_interior.py` and asserted by `check_blend.py`. Every `repeat` in the finish
  registry is authored against that, so a change to it silently rescales every texture.
- **`shell` and `exterior` are enclosures**, excluded from the overlap, containment, grey-box and
  camera checks via `ENCLOSURES` in `check.ts`. Anything that wraps the cabin belongs in one of
  them; a built-in appliance cannot be a placement, because it shares the volume of the
  cabinetry it sits in.
- **Furniture geometry measures from its placement's own ends, never from fixed offsets.**
  `tools/model_furniture.py` builders receive a centre and a size; a hard-coded `y - .39` is
  correct only at the length it was tuned at. Shortening the galley run exposed four of these
  at once, and `check_models.mjs` caught them as "geometry exceeds placement box".

## Conventions

- Tests sit next to the code (`src/foo.ts` + `src/foo.test.ts`), vitest globals, no framework
  beyond that. Pure functions are exported specifically so they can be tested without a canvas.
- `noUncheckedIndexedAccess` is on. Index access needs a `!` or a guard.
- Commits are `type: imperative summary`, one logical change each.
