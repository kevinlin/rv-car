# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Three.js walkthrough of the interior of a 大驰 无极境500 C-type motorhome. Portfolio piece,
not a product. Design spec: [docs/specs/design_rv-interior-3d.md](docs/specs/design_rv-interior-3d.md).
Implementation plan and execution log: [docs/specs/plan_rv-interior-3d.md](docs/specs/plan_rv-interior-3d.md).

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
pnpm optimize    # gltf-transform: Draco + KTX2 -> public/models/
pnpm budget      # fails over 350k triangles or 25 MB
```

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
  A finish swap changes room albedo, so `refreshProbe()` must be called after one.

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

Phase 1–5 of the plan are done as a grey-box: `public/models/` is empty, so the app falls back to
box geometry and flat lighting. `model/rv.blend` does not exist yet. When modules start landing,
`binding.ts` only enforces the naming contract once *every* module is present.

## Conventions

- Tests sit next to the code (`src/foo.ts` + `src/foo.test.ts`), vitest globals, no framework
  beyond that. Pure functions are exported specifically so they can be tested without a canvas.
- `noUncheckedIndexedAccess` is on. Index access needs a `!` or a guard.
- Commits are `type: imperative summary`, one logical change each.
