# 无极境500 Interior 3D — Implementation Plan

**Goal:** Render the interior of a 大驰 无极境500 C-type motorhome in the browser, close enough to the manufacturer's imagery to stand as a portfolio piece, with layout and finishes held in data so customisation is cheap to add later.

**Architecture:** All geometry truth lives in `src/data/vehicle.ts` as millimetre values tagged with confidence. A grey-box scene built from that data validates proportions before any modelling happens. Blender then produces one `.glb` per module, bound to the data by node name; materials are named by role and resolved at runtime through a registry, which is the seam future customisation writes to. Lighting is real-time — an interior environment probe captured from emissive LED strips does the work a lightmap would, without pinning furniture in place.

**Tech Stack:** TypeScript, Vite, Vitest, Three.js (vanilla, no framework), Blender 5.2.1 LTS with `bpy` export scripting, `@gltf-transform/cli` for Draco + KTX2 optimisation.

**Spec:** [design_rv-interior-3d.md](design_rv-interior-3d.md)
**Evidence:** [../research/2026-09-04-dachi-wujijing-500-reference.md](../research/2026-09-04-dachi-wujijing-500-reference.md)

## Status — 2026-09-05

**76 of 76 steps complete** on branch `feat/interior-3d`. 84 unit tests pass, TypeScript and
production build pass, and the generated assets pass saved-Blender and raw/optimised glTF checks.
One success criterion is unmet: the mid-range-phone frame rate was never measured on hardware.

| Tasks | State |
|---|---|
| 1–11 | Complete. Existing data model, grey-box gate, pipeline and runtime infrastructure. |
| 12–13 | **Complete.** Modelled shell and all eight furniture collections, packed UV2 AO, Draco/KTX2 exports, browser loading and per-collection commits. |
| 14–15 | **Complete.** Lighting tuned against the references, six hotspot cameras re-placed against real furniture, success criteria recorded. |

Results are in the spec's [Verification section](design_rv-interior-3d.md#verification-2026-09-05).
Still not claimed: photoreal reference parity, or any frame rate measured on a phone.

---

## Global Constraints

- **Units.** Data is authored in millimetres. 1 Three.js unit = 1 metre. Conversion happens once, in `toM()`. No other file divides by 1000.
- **Coordinate frame.** Origin at habitation floor level, on the vehicle centreline, at the cab bulkhead. `+X` kerb side, `+Y` up, `+Z` rearward. The vehicle is left-hand drive.
- **Placement origin is the minimum corner** of the axis-aligned bounding box (min X, min Y, min Z). Every placement in the data obeys this.
- **Confidence tags are mandatory.** Every `Mm` value carries `'published' | 'derived' | 'estimated'`. No untagged dimensions.
- **Published dimensions are immutable:** overall 5998 × 2450 × 3200 mm, wheelbase 3300 mm, alcove bed 2200 × 1400 mm, slide-out bed 1280 × 1900 mm. A task that changes one of these is wrong.
- **Slide-out is modelled deployed only.** No retract animation.
- **Asset budget:** ≤ 350,000 triangles total, ≤ 25 MB transferred, ≤ 40 draw calls.
- **Performance:** 60 fps at 1080p desktop, ≥ 30 fps mid-range phone.
- **Blender path:** `/Applications/Blender.app/Contents/MacOS/Blender` (5.2.1 LTS).
- **Material naming contract:** every Blender material is named `role.<role-id>`, e.g. `role.wood.cabinet`. The runtime strips the `role.` prefix and looks the rest up in the registry.
- **Node naming contract:** every exported glTF node that appears in `PLACEMENTS` uses the placement's `id` verbatim.
- **Commit after every task.** Conventional-commit prefixes (`feat:`, `test:`, `chore:`, `docs:`).

## Three corrections this plan makes to the spec

Found while turning the design into concrete numbers. All three are improvements, and the spec's affected values were tagged `derived` or `estimated`, so nothing published moves.

1. **Overlap checking is 3D AABB, not 2D footprint.** Spec §7 says "no footprint overlaps". A 2D footprint test fails on every overhead locker, because a locker legitimately sits above the furniture below it. The check compares full 3D boxes instead.
2. **Containment is per-volume, not against one box.** The alcove bed sits forward of and above the habitation box; the slide-out bed extends outboard of it. A single bounding box either rejects both or is so loose it catches nothing. Each zone maps to a named volume, and placements are checked against their own volume.
3. **Aisle width is 520 mm, not the spec's ~560 mm.** Spec §2's width budget (1100 + 700 + 560) describes the vehicle **retracted**. This build models it **deployed**, where the sofa becomes a 1280 mm bed and the geometry differs. 520 mm clears the ≥ 400 mm requirement. Recorded here rather than silently changed.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts` | Toolchain |
| `src/data/units.ts` | `Mm` type, confidence tags, mm→m conversion. Depends on nothing. |
| `src/data/vehicle.ts` | Envelope, volumes, zones, placements, hotspots. Depends only on `units`. |
| `src/data/finishes.ts` | Role list, variants, default registry. Depends on nothing. |
| `src/check.ts` | Dimensional assertions over the placement data. |
| `src/greybox.ts` | Builds box meshes from placements. Phase 1 deliverable, kept as a debug view. |
| `src/binding.ts` | Binds loaded glTF nodes to placements by name; throws on mismatch. |
| `src/loader.ts` | Draco/KTX2 setup, loads module `.glb`s, calls `binding`. |
| `src/finishes.ts` | Builds Three.js materials from the registry, applies by role, swaps. |
| `src/lighting.ts` | IBL, environment probe capture, cove lights, shadow caster. |
| `src/camera.ts` | Hotspot tweening and per-hotspot orbit clamps. |
| `src/scene.ts` | Renderer, tone mapping, post chain, frame loop. |
| `src/ui.ts` | Zone buttons and finish swatches. |
| `src/main.ts` | Wires the above together. |
| `tools/export_modules.py` | Blender headless export, one `.glb` per collection. |
| `tools/check_budget.mjs` | Triangle and byte budget assertions. |
| `model/rv.blend` | The single Blender source file. |

---

## Implementation Tasks

### Task 1: Project scaffold

Bootstrapped the Vite + TypeScript + Vitest + Three.js toolchain with a smoke test that constructs a `THREE.Vector3`. Established `pnpm test`, `pnpm dev`, `pnpm check`, and `.gitignore`.

### Task 2: Units and confidence tags

Created `src/data/units.ts` with the branded `Mm` type, `Confidence` tags (`published` / `derived` / `estimated`), and the single `toM()` mm→m conversion. Three unit tests confirm the interface contract.

### Task 3: Vehicle envelope, volumes and zones

Defined `ENVELOPE` (published + derived vehicle dimensions), four bounding `VOLUMES` (habitation, slide-out, alcove, cab), `ZoneId`, `VolumeId`, and `ZONE_VOLUME` mapping in `src/data/vehicle.ts`. Tests assert published values and derived arithmetic.

### Task 4: Placement data

Added 25 `Placement` records to `src/data/vehicle.ts` covering all eight zones, with the `aabb()` helper. Published bed sizes are asserted exact; every zone has at least one entry.

### Task 5: Dimensional checks

Built `src/check.ts` with `boxesOverlap`, `boxContains`, `minAisleWidth` (sampling every 50 mm), and `checkAll` — the four-rule integrity gate (overlap, containment, aisle ≥ 400 mm, published bed sizes). Runs at startup and in 11 tests.

### Task 6: Grey-box scene — the phase 1 gate

Rendered `PLACEMENTS` as coloured boxes via `src/greybox.ts`, wired into `src/scene.ts` and `src/main.ts`. Visually compared against reference photos and adjusted estimated dimensions until the proportions were correct. **No Blender work started until this gate was recorded as passed.**

### Task 7: Blender export script

Created `tools/export_modules.py` — headless export of one `.glb` per module collection, with convention checks (unit scale, `role.*` material names, collection completeness). Also `model/README.md` documenting the authoring rules. See [guide_rv-blender-modelling.md](guide_rv-blender-modelling.md).

### Task 8: Budget checker

Created `tools/check_budget.mjs` reading raw exports for triangle counts and optimised exports for byte counts. Thresholds: 350 k triangles, 25 MB. Triangle counts come from uncompressed raw exports (avoids Draco decoder dependency); byte counts from optimised output.

### Task 9: Node binding

Created `src/binding.ts` — resolves every `Placement.id` to a glTF node, throwing a `BindingError` listing *all* missing nodes at once so a Blender rename is one fix, not whack-a-mole.

### Task 10: Finish registry

Built the two-layer finish system: `src/data/finishes.ts` (pure data: 17 roles, variants with `MaterialParams`) and `src/finishes.ts` (runtime: `roleOf()` strips `role.` prefix and Blender `.001` suffix, `applyFinishes()` restyles every matching mesh). Three wood variants (walnut, oak, ash) ship as the proof of the customisation seam.

### Task 11: Camera hotspots

Added six `Hotspot` records to `src/data/vehicle.ts` (dinette, alcove, sofa, galley, washroom, cab) with per-hotspot orbit clamps. `src/camera.ts` provides `tweenTo()` with cubic easing and `applyHotspotLimits()`. Nine tests.

### Task 12: Model the shell in Blender

Modelled the habitation shell in `model/rv.blend` with window and hatch apertures, cove recesses and emissive LED strips. Created `src/loader.ts` for Draco/KTX2 module loading.

### Task 13: Model the furniture modules

Modelled eight furniture collections (dinette → sofa_slideout → alcove_bed → lockers → cab → galley → softgoods → washroom), one commit each. All nine modules load in the browser; binding succeeds for all 25 placement nodes. Final budget: **64,232 triangles / 10.1 MB**.

### Task 14: Lighting

Created `src/lighting.ts` with four `RectAreaLight` cove lights, a hatch directional with shadow mapping, and the cubemap environment probe that replaces a lightmap. `refreshProbe()` is called after any finish swap. Tuned exposure, environment intensity, cove intensity and LED emissive against the reference photos.

### Task 15: UI, wiring, and the shipped finish swap

Created `src/ui.ts` with zone navigation buttons and wood finish swatches. Wired the full pipeline in `src/main.ts`: check → scene → load → bind → finish → light → UI. The wood swap restyles `wood.cabinet` and `wood.trim` together and refreshes the probe.

---

## Self-Review

**Spec coverage.** Every section maps to at least one task: §1 goals → Tasks 6, 14, 15; §2 dimensional reconstruction → Tasks 2–6; §3 data model → Tasks 2, 3, 4, 10, 11; §4 asset pipeline → Tasks 7, 8, 12, 13; §5 runtime architecture → every file in the table has an owning task; §6 lighting → Task 14; §7 verification → Tasks 5, 8, 15; §8 phasing → task order; §9 risks → risk 1 and 4 are the Task 6 gate, risk 3 is Task 13's ordering, risk 5 is Task 14's light count test.

**Type consistency.** `Mm`, `Confidence`, `Placement`, `Box`, `ZoneId`, `VolumeId`, `Hotspot`, `Role`, `Registry`, `MaterialParams`, `Variant`, `SceneBundle`, `CoveSpec`, `Violation` are each defined once and used with the same shape throughout. `aabb()`, `toM()`, `toMTriple()`, `roleOf()`, `applyFinishes()`, `bindPlacements()`, `checkAll()`, `minAisleWidth()`, `tweenTo()`, `applyHotspotLimits()`, `coveLightSpecs()`, `installLighting()`, `loadModules()`, `buildGreybox()`, `buildUi()` keep one signature each.

**Known crossing:** `src/budget.test.ts` imports from `tools/check_budget.mjs`, so `vitest.config.ts`'s `include` covers `src/**/*.test.ts` while `tsconfig.json` includes both `src` and `tools`. Deliberate — it keeps every test under one directory.

---

## Execution log (2026-09-05, branch `feat/interior-3d`)

Tasks 1–11, 14 and 15 complete. Tasks 12–13 need Blender modelling and are the handover point.

### Deviations from the plan as written

1. **`minAisleWidth` silently skipped centreline-straddling boxes.** A box spanning `X = 0` landed
   in neither the off-side nor kerb-side bucket, so the one geometry that blocks the aisle
   outright was the one case the check ignored. It now returns 0. Caught by Task 5's own test.
2. **`tweenTo(h, 0)` blanked the frame.** The opening shot passes `ms = 0`, so the first frame
   computes `0 / 0`; `clamp` passed the NaN into `lerpVectors` and the camera position became
   NaN. Zero duration now snaps directly and `clamp` is NaN-safe. Only found by running the app.
3. **`loadModules` returns `{ root, loaded, missing }` instead of throwing.** Modules arrive one
   at a time as they are modelled, and the app has to stay runnable throughout. `bindPlacements`
   still enforces the naming contract, but only once every module is present.
4. **The grey-box keeps flat lighting.** It has no emissive LED strips and no window apertures,
   so the real rig renders a sealed box as near-black and the environment probe has nothing to
   bootstrap from. `main.ts` picks the rig by whether any module loaded.
5. **`allowJs: true`** in `tsconfig.json`, so `tsc` resolves `tools/check_budget.mjs`, which
   `src/budget.test.ts` imports. The plan flagged that crossing but did not handle it.
6. **`PCFSoftShadowMap` is removed in three r185.** Using `PCFShadowMap`.
7. **Task 12's loader was pulled forward** into Task 15, because `main.ts` cannot run without it.

### State

- 77 tests passing, `tsc --noEmit` clean, `pnpm check` green.
- `pnpm dev` serves the grey-box with working hotspot navigation and wood swatches.
- `pnpm budget` passes trivially — no models yet.
- Blender 5.2.1 LTS, Node 24.15, Python 3.13 all present; export script verified to reject a
  file that breaks the material naming contract.

---

## Modelling execution and verification (2026-09-05)

Scope: the Blender guide, Tasks 12 and 13. Used the existing approved grey-box branch and
canonical material roles. Model generation is repeatable per collection through
`npm run model -- <collection>`, followed by `npm run bake` and the export pipeline.

| Collection | Checkpoint commit | Modelled content |
|---|---|---|
| shell | `2b52543` | Hatch and window openings with glazing, passage to cab, deployed slide-out walls, cove recesses/LED strips, ceiling downlights. |
| dinette | `2b7ba5e` | Four facing upholstered swivel chairs, camel bolsters, headrests, arms, drawer bases and pedestal table. |
| sofa_slideout | `946a0f5` | Walnut drawer plinth and seamed deployed mattress cushions at the published bed size. |
| alcove_bed | `814261d` | Deck, rounded mattress, three cream-front lockers. Head-end placement corrected during final visual checks. |
| lockers | `a0f37c0` | Segmented cream doors, walnut cases and metal pulls on both lounge sides. |
| cab | `dd59a0a` | Seat shells, blocked dashboard, vents and steering-wheel outline. |
| galley | `b35159f` | Cabinetry, long pulls, hollow sink and open countertop, black mixer, induction hob, extractor, fridge and wardrobe. |
| softgoods | `d62a732` | Pleated curtains, scatter cushions, pillows and folded bedding. |
| washroom | `07e4cba` | Open curved GRP pod, oval basin, toilet, mirror, shower hardware, shelves and teak duckboard. |

### Verification

- `npm run check:blend`: passes against the saved binary. Checks all nine modelled collections,
  17 role materials, UV2/packed AO, upward basin-floor normals, rays through three real apertures
  and an unobstructed alcove entrance.
- `npm run check:models`: passes raw and optimised world-coordinate bounds for all 25 nodes,
  1 mm tolerance, both published bed footprints, known material roles, UV2 occlusion wiring,
  module completeness and asset budgets. [Machine-readable report](../../model/verification.json).
- `npm run budget`: **64,232 triangles; 10,134,056 bytes** across nine Draco/KTX2 modules.
- AO: 29 objects baked separately with other meshes hidden, into disjoint regions of a packed
  2048 × 2048 atlas. Range 0–1 with non-white pixels; no lightmap.
  [Bake record](../../model/ao-bake.json).
- Runtime: **35 steady-frame draws**, measured using `renderer.info.render.calls` at a
  1920 × 1080 viewport. The 72 exported primitive draws are batched by role, separately for
  movable roots. Static shadows are cached after capture. Initial capture and finish-change
  probe refreshes do extra work; this count describes steady frames.
- Browser loaded all nine modules and bound all 25 placement nodes. Six zone buttons were
  exercised and screenshots inspected. [Browser evidence](../research/modelled/).
  The final 1080p lounge sample recorded 120 fps and 35 draws; these are local in-app-browser observations, not
  measurements on a mid-range phone. Walnut, oak and ash were also exercised with no browser
  errors; screenshots retain the surface grain and show the wood tints changing.
- `npm run check`: **81 tests pass**, TypeScript clean. The exported-bounds regression test
  also passes. `npm run build -- --emptyOutDir false` passes, preserving raw export evidence.

### Corrections and implementation notes

1. Blender +Y rearward became glTF -Z under Y-up rotation alone. A temporary reflected parent
   corrects the export; the saved authoring frame still follows the guide.
2. Optimiser defaults erased node identity and could combine material roles. Disabled scene
   flattening, named-node joining, GPU instancing and palette generation; retained UV attributes.
3. Unused canonical materials had disappeared from the starter on reopen. Restored only those
   roles from its existing palette and retained them with fake users.
4. Baked UV-layer references must be reacquired after leaving Edit Mode in Blender 5.2. The
   original stale reference crashed Blender; the saved file was unaffected and the corrected bake completed.
5. Reversed bowl winding in the shared helper was corrected, the galley/washroom regenerated,
   and AO rebaked. Saved-binary normal checks pass.
6. Reference inspection showed the estimated alcove lockers blocking the bed entrance. Moved
   their fore-aft origin from -300 to -1400 mm in `vehicle.ts`, then regenerated the placement
   JSON and asset. Published dimensions and the 520 mm habitation aisle are unchanged.
7. Runtime batching preserves named anchors and independent chair/table roots, AO coordinates
   and wood roles. Mixed unused tangents are removed before joining. Regression tests cover
   reflected geometry, winding, AO UVs, retained roots and finish swapping.
8. KTX-Software 4.4.2 arm64 was extracted from the official package into a temporary tool
   directory. `brew install ktx` was unavailable; no system-wide installation was made.

### Remaining acceptance work

Tasks 14 and 15 remain open as the modelling guide specifies. The current lighting is darker
than the references, some camera crops are too close (especially Cab), and there is no physical
phone benchmark. The washroom is an open simplified reconstruction; its shelves are projecting
rather than fully recessed niches, and a dedicated shower curtain is not modelled. These are
recorded fidelity limits, not a claim of a reference-perfect interior.

[Source review and binary follow-up](../research/blender-modelling-review.md).

---

## Acceptance pass (2026-09-05)

Task 14 step 5 and Task 15 step 5, the two steps the modelling handover left open. Full results
and the numbers are in the spec's Verification section; what follows is what changed in code.

| File | Change |
|---|---|
| `src/scene.ts` | Exposure 1.0 → 1.05; background near-black → daylight, so the 24 %-opaque glazing reads as an opening |
| `src/lighting.ts` | `environmentIntensity` 1.1 → 2.5; cove intensity 12 → 26 |
| `src/data/finishes.ts` | `led.cove` emissive 6 → 14; `glass` given a faint emissive |
| `src/finishes.ts` | `aoMapIntensity` pinned to 0.4 — the shared 2048 px bake atlas blotches at full strength |
| `src/data/vehicle.ts` | All six hotspot cameras re-placed against the modelled furniture |
| `src/camera.ts` | `tweenTo` now releases the polar limits too, not just azimuth and distance |
| `src/main.ts` | `?verify` exposes the scene bundle on `window.__rv`, so a pose can be tried without an edit-reload cycle |

### Deviations

1. **Two knobs beyond the four the plan lists.** The background colour and `aoMapIntensity`.
   Both were fixing something the four knobs could not reach: windows compositing over a dark
   world, and AO blotching from a bake atlas that is too small for the shell surfaces.
2. **A real bug fell out of the camera work.** `tweenTo` released azimuth and distance limits for
   the flight but not polar, so a hotspot's polar floor followed the camera into the next zone
   and pulled the arrival off its pose. Found by comparing the requested pose to the landed one.
3. **The mid-range-phone criterion is not met, only bounded.** No device. Mobile viewport plus
   20× CPU throttling still held 120 fps, which rules out a CPU bottleneck and nothing else.

---

## Changelog

- 2026-09-05 — **Compacted post-implementation.** Removed step-by-step tasks, file-by-file diffs, code snippets, and verification commands now that the feature has shipped. Preserved Goal, Global Constraints, Design Decisions, File Structure, execution log, and follow-ups. Original plan recoverable via git history.
