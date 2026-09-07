# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Three.js walkthrough of a 大驰 无极境500 C-type motorhome — six interior stops with free look,
an exterior stop that orbits the body, and a plan stop that sections the cabin at 1400 mm and
labels it. Portfolio piece, not a product.

Two pages. [index.html](index.html) is a static overview: the reconstruction, a stop gallery, and
a side-by-side comparison against the 飞神达尔文 Z76 drawn from
[docs/research/comparison.md](docs/research/comparison.md). It carries no JavaScript at all, so
three.js loads only when someone opens the walkthrough. [tour.html](tour.html) is the 3D view —
what used to be `index.html` — and every gallery card links to it as `tour.html#<stop id>`, which
`main.ts` resolves against `HOTSPOTS`. Both pages are named in `rollupOptions.input`; Vite finds
only `index.html` on its own.

[docs/specs/design_rv-interior-3d.md](docs/specs/design_rv-interior-3d.md) is the single design
spec. Sections 1–14 state the design as built; the implementation record after them keeps the
dated passes in order, including the layout readings each one replaced. Three plans built it:
[plan_rv-interior-3d.md](docs/specs/plan_rv-interior-3d.md) for the interior,
[plan_rv-photoref-360-exterior.md](docs/specs/plan_rv-photoref-360-exterior.md) for the
photo-referenced correction, the textures, free look and the exterior, and
[plan_plan-view-and-exterior.md](docs/specs/plan_plan-view-and-exterior.md) for the plan stop and
the sculpted exterior. That last one has its own child spec,
[design_rv-plan-view-and-exterior.md](docs/specs/design_rv-plan-view-and-exterior.md), whose §7a
and §7b hold the measurements.

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
pnpm thumbs                               # overview-page imagery from docs/research/final
```

`pnpm thumbs` needs no Blender: it crops the burnt-in `.ui` bar off the committed final renders
and writes `public/renders/*.webp`. Re-run it after recapturing that comparison set.

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
  hotspot is a `look` stop; the exterior and plan stops are the two `orbit` stops.
- `labels.ts`: the plan stop's `CSS2DRenderer` overlay. Text and dimensions derive from
  `PLACEMENTS`, so a label cannot claim a size the geometry does not have. Draws nothing on the
  GPU, and renders unconditionally — it hides its own DOM nodes when the group is invisible.
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

Both plans are implemented. Ten Blender collections export to ten `.glb`s; the grey-box in
`greybox.ts` is now only the fallback for a checkout with no `public/models/`, and it skips the
`exterior` zone because that body would hide everything it encloses.

The layout took three corrections after the first build, and the spec's implementation record is
where each one is written down. Where it landed: a 卡座 booth on the **off** flank (one seat
forward facing aft, two abreast facing forward, stowable table between); the slide-out and its bed
**kerb**; and a full-width sliding partition at Z 2500.

Behind that partition the service room is arranged **across** the vehicle about its boarding
door, not as two runs down opposite flanks. It is a rear side door in the sense the brochure's 后上门
means it: in the **kerb flank** forward of the rear corner, not in the rear wall. The walkaround opens it
there, with the grab rail, keypad and vent on the 390 mm of flank left aft of it. Standing in
that door looking in, your left hand is aft: **left** is the worktop and basin, a run backing onto
the rear wall and crossing the centreline under the ventilation window; **right** is a tall shelf
carrying the 3-in-1 combi oven, against the kerb flank forward of the door; **ahead** is the
900 × 940 washroom pod, in the **rear-off corner**, opening inboard beside the worktop's off end.
The off flank between the partition and the pod is the 148 L fridge column, opened from the lounge
side of the partition doorway. Because that run crosses the centreline, `check.ts` stops sampling
the aisle at the door. Aft of it there is no corridor to protect, only a dead-end galley.

The pod and the fridge were the other way round until 2026-09-07: pod at the partition, fridge in
the corner. The spatial brief's ASCII plan always drew it correctly; a paragraph added underneath
that plan contradicted it, and the model followed the paragraph. Both are fixed, and
`src/check.test.ts` now pins the order along the off flank as well as the flank assignment.

The lounge and the service room are handed independently, which is what every wrong reading got
wrong by assuming one chain of inference ran the length of the vehicle. The exterior stop looks at
the **kerb** flank, the one the slide-out box and the door are on. Do not re-derive any of this
from the stills — four passes did, and all four were wrong; the walkthrough video settles the
lounge, `docs/research/spatial-brief_大驰无极境500MAX.md` and the stills catalogued in
[docs/research/walkthrough/README.md](docs/research/walkthrough/README.md) settle the service
room, and `src/check.test.ts` pins both.

Measured after the plan-view and exterior pass: 101,028 triangles of 350,000, 10.16 MB of 25 MB,
45 draw calls at the worst interior stop against a stale ceiling of 40 (30 of them scene geometry,
the rest a fixed post-chain cost the ceiling predates), and 57 at both the exterior and plan stops
against 60. 120 fps, vsync-capped, at all eight stops. Results tables in the spec's implementation
record.

Three conventions worth knowing before editing geometry:

- **UVMap runs at exactly 1.0 UV unit per metre**, held there by `normalise_uv_density()` in
  `tools/model_interior.py` and asserted by `check_blend.py`. Every `repeat` in the finish
  registry is authored against that, so a change to it silently rescales every texture.
- **`shell` and `exterior` are enclosures**, excluded from the overlap, containment, grey-box and
  camera checks via `ENCLOSURES` in `check.ts`. Anything that wraps the cabin belongs in one of
  them; a built-in appliance cannot be a placement, because it shares the volume of the
  cabinetry it sits in.
- **Anything opaque on the roof band must clear the roof hatch at Y 1050–1750**, and anything
  outside the cabin whose role is not in `EXTERIOR_ROLES` is inside the environment probe's
  capture. The roof air conditioner broke both at once: it covered the hatch, which is the
  interior's only daylight source, and its `metal.dark` vent carried that into the bounce light.
- **`box_uv()` in `tools/model_interior.py` writes `1 - v`** because the glTF exporter flips every
  V on the way out, and `KEEPS_OWN_UV` exempts its objects from the `<module>_details` join as
  well as from the re-unwrap. The join runs first, so exempting only the unwrap does nothing.
- **Furniture geometry measures from its placement's own ends, never from fixed offsets.**
  `tools/model_furniture.py` builders receive a centre and a size; a hard-coded `y - .39` is
  correct only at the length it was tuned at. Shortening the galley run exposed four of these
  at once, and `check_models.mjs` caught them as "geometry exceeds placement box". Moving the
  galley and the washroom pod across the cabin forced both modules to be rewritten for the same
  reason; both now derive which flank they hug from their placement and measure from its faces.

## Conventions

- Tests sit next to the code (`src/foo.ts` + `src/foo.test.ts`), vitest globals, no framework
  beyond that. Pure functions are exported specifically so they can be tested without a canvas.
- `noUncheckedIndexedAccess` is on. Index access needs a `!` or a guard.
- Commits are `type: imperative summary`, one logical change each.
