# Plan view and sculpted exterior — implementation plan

**Goal:** Add an eighth camera stop that looks down on the cabin with the roof clipped away and
zone labels drawn over it, and replace the massed exterior with a liveried, glazed, sculpted one.

**Architecture:** Two phases that share only the draw-call budget. Phase A is runtime TypeScript:
a global clip plane driven from the hotspot the camera arrives at, plus a `CSS2DRenderer` label
layer whose text derives from `PLACEMENTS`. Phase B is the Blender pipeline: an unwrap exemption,
livery artwork on the existing decal role, black window frames, and a sculpted cab, over-cab
moulding and fittings — all still derived from `ENVELOPE`.

**Tech Stack:** Vanilla Three.js 0.185, TypeScript 7, vitest 5 (`environment: 'node'`, jsdom per
file via pragma), Vite 8, Blender headless driven by Python, pnpm.

**Spec:** [design_rv-plan-view-and-exterior.md](design_rv-plan-view-and-exterior.md). Its parent
is [design_rv-interior-3d.md](design_rv-interior-3d.md); read §2's coordinate frame and §5's
Blender contracts before touching geometry.

## Global Constraints

- Package manager is **pnpm**. Never npm or yarn.
- `pnpm check` (vitest + `tsc --noEmit`) is the gate before every commit.
- `noUncheckedIndexedAccess` is on. Every index access needs a `!` or a guard.
- Coordinate frame: origin at habitation floor, centreline, cab bulkhead. `+X` kerb, `+Y` up,
  `+Z` rearward. Metres at runtime, millimetres in the data. `toM` is the only converter.
- Blender contracts: object names equal `Placement.id`; material names are `role.<role-id>`;
  scene unit scale 1.0; AO baked per object into UV2; no full lightmaps.
- `UVMap` runs at exactly **1.0 UV unit per metre**. Every `repeat` in the finish registry is
  authored against it.
- Envelope is **5998 × 2450 × 3200 mm**, asserted to 1 mm by `check_models.mjs` across
  `body_cab`, `body_alcove`, `body_habitation`, `skirt` and the four wheels. The four surfaces
  carrying the extremes are the cab nose at `Z = -1948`, the rear face at `Z = 4050`, the flanks
  at `X = ±1225`, and the alcove roof at `Y = 2150`.
- Draw-call ceilings: 40 at an interior stop (stale — scene geometry only; bloom adds a fixed 15),
  60 at the exterior and plan stops. Batching is global per role: **geometry in an existing role
  costs zero draw calls, each new role costs one.** Budget for this plan: at most two new roles.
- Triangles ≤ 350,000. Bytes ≤ 25 MB. Both currently at 94,436 and 10.0 MB.
- Commits are `type: imperative summary`, one logical change each.
- `public/models/` is committed. Any Blender change means `pnpm export && pnpm optimize` and
  committing the regenerated `.glb`s, or GitHub Pages deploys the grey-box.

---

# Phase A — the plan stop

## Task 1: Separate stop identity from zone identity

Introduced `StopId = ZoneId | 'plan'` and retyped `Hotspot.id` to it. Rewrote two camera tests
that discriminated on `id !== 'exterior'` to discriminate on `view.kind === 'look'` instead,
which is what lets a second non-interior stop exist without failing the invariants.

## Task 2: Derive the cut height from the locker placements

Added `PLAN_CUT_MM` (currently 1400 mm), derived as the minimum locker-run underside across
`lockers_off` and `lockers_kerb`. The plan-view section height follows the furniture rather than
being a magic constant; `placements.test.ts` pins the relationship and asserts both mattresses
sit below the cut.

## Task 3: Stop the environment probe seeing through the cut

Wrapped `refreshProbe()` in a save/clear/restore of `renderer.clippingPlanes`, preventing the
probe camera (inside the cabin) from seeing sky through the missing roof when a clip plane is
active. Same shape of fix as the existing exterior-visibility save/restore it sits beside.
Done before the clip plane existed so it could never ship in a broken state.

## Task 4: The plan hotspot and its clip plane

Added the `plan` hotspot: an orbit stop 7.4 m above the cabin, looking down at the habitation
midpoint. `arrive()` sets a downward-facing clip plane at `PLAN_CUT_MM / 1000` when entering the
plan stop and clears it when leaving. Polar limits cap the viewer at 55° — below that, cut edges
stop reading as a section and start reading as broken geometry. Enabled
`renderer.localClippingEnabled` in `src/scene.ts`.

## Task 5: The label data

Added `PlanLabel`, `PLAN_LABELS`, `labelAnchorM` and `labelDetail` to the data layer. Labels
anchor at their placement's centre in metres, and derive their dimension string (including the
weaker confidence tag) from the placement's sizes — no label can claim a size the geometry does
not have. Non-placement labels (aisles, the boarding door) carry explicit anchors and detail
strings.

## Task 6: The label overlay

Built `src/labels.ts`: a `CSS2DRenderer` DOM layer over the canvas. `buildLabels` creates one
`CSS2DObject` per label positioned at its anchor; `createLabelLayer` manages the renderer and
visibility. The layer starts hidden and activates at the plan stop. A toggle button appears only
at that stop, via `body[data-stop="plan"]` CSS. Zero GPU draw calls.

## Task 7: Measure and record phase A

Measured draw calls, triangles and fps at the plan stop and worst interior stop. Verified the
probe fix (Task 3) by running `?calibrate` before and after a finish swap at the plan stop —
saturation unchanged.

---

# Phase B — the sculpted exterior

Every task below ends with `pnpm export && pnpm optimize` and commits the regenerated `.glb`s.

## Task 8: Let a builder own its own UV

Added `KEEPS_OWN_UV` (a set of object-name prefixes) and `box_uv(obj, span)` to
`model_interior.py`. Objects whose names start with a listed prefix are exempt from the dispatch
loop's `smart_project` + `normalise_uv_density` re-unwrap, so a builder-written UV survives to
the `.glb`. `box_uv` writes a planar UV from 0 to `span` over the object's dominant plane. A
wordmark cannot tile, so it needs one copy across a known span with a known origin, and
`smart_project` gives neither.

## Task 9: The livery

Drew the livery artwork by eye at 2048 × 422 px (not rectified from a frame — showroom reflections
and the presenter's shadow would bake in). Gave both flanks a `body_graphic_*` decal plane with
`box_uv(3.4, 0.70)`, and pointed the `body.graphic` registry entry at
`/textures/side-livery.webp` with a repeat of `[1/3.4, 1/0.70]` that yields one copy per panel.
The UV density stays at 1.0 UV/m for `check_blend.py`; the repeat divides it back to a single
copy.

## Task 10: Black window frames

Widened window-frame reveals and defaulted their role to `metal.dark`. Apertures remain open: a
filled rectangle would sit between the interior glazing and the sky and render that glazing black
from indoors — the tint the eye reads is the interior pane seen through the open hole. The rear
door outline stays `body.paint` (a panel gap, not a window frame).

## Task 11: The wedge helper and the sculpted cab

Added `wedge(name, center, size, role, shear, axis, bevel)` to `model_interior.py` — a box
whose top face is displaced by `shear` metres, giving a raked plane. Reshaped `body_cab` with a
0.34 m windscreen rake, preserving the nose plane at Z = −1948 (the envelope's length minimum;
`check_models.mjs` is the gate). Added the bonnet, grille and side mirrors. The rake is taken
out of the top face, which sits under the alcove overhang and is not an envelope extreme.

## Task 12: The over-cab moulding

Added a tapered wedge in front of `body_alcove` for the FRP moulding's nose, and cut its forward
window as a reveal. `body_alcove` itself stays a box because it carries the roof height and both
flank extremes.

## Task 13: Fittings

Modelled the roof AC unit, front-loader washing machine door assembly, rear light clusters, alloy
wheel spokes, mudflaps and chrome grab rail. All items used existing roles, costing zero draw
calls. `check_models.mjs`'s envelope assertion is unaffected because fittings are detail meshes,
not the eight named body placements.

## Task 14: Measure, compare and record

Re-captured all eight stops, measured triangles/bytes/draw-calls/fps against every ceiling, and
compared the exterior render against the reference frames. Folded the child spec into the parent
design spec, reversing §1's "massed rather than sculpted" non-goal and closing §14's matching
known gap.

---

## Critical files

| Path | Role |
|---|---|
| `src/data/vehicle.ts` | `StopId`, `PLAN_CUT_MM`, `PLAN_LABELS`, plan hotspot |
| `src/labels.ts` | CSS2DRenderer label overlay |
| `src/camera.ts` | clip plane in `arrive()` |
| `src/scene.ts` | `localClippingEnabled`, label layer mount |
| `src/lighting.ts` | probe clipping save/restore |
| `src/data/finishes.ts` | `body.graphic` livery entry |
| `tools/model_interior.py` | `KEEPS_OWN_UV`, `box_uv`, `wedge` |
| `tools/model_exterior.py` | sculpted cab, moulding, fittings, frames, livery panels |

---

## Self-review notes

**Spec coverage.** §2 → Tasks 2, 3, 4. §3 → Tasks 5, 6. §4's livery → Tasks 8, 9; glazing →
Task 10; cab and moulding → Tasks 11, 12; fittings → Task 13; role discipline → asserted in
Task 13's gate. §5 (Blender for eyes only) → Task 11 Step 4, Task 12 Step 2. §6 → Tasks 7, 14.
§7 → every task's gate step. §8's risks 1, 2, 6 and 7 → Tasks 8, 3, 11 and 8 respectively; risk 3
→ Task 13 Step 2; risks 4 and 5 → Task 4 Step 7, by eye.

**Not covered, deliberately.** §9's four open questions stay open: they are decisions for after
there is something to look at, and none blocks a task.

**Sequencing that matters.** Task 3 precedes Task 4 so the clip plane cannot ship with a broken
probe. Task 8 precedes Task 9 so the UV exemption is proven by `check:blend` before any artwork
depends on it. Task 1 precedes everything in phase A because two existing tests fail the moment a
non-interior, non-exterior stop exists.

---

## Changelog

- 2026-09-07 — **Compacted post-implementation.** Removed step-by-step tasks, file-by-file diffs,
  code snippets, and verification commands now that the feature has shipped. Preserved Goal,
  Global Constraints, Critical Files summary, Self-review notes, and task-level design rationale.
  Original plan recoverable via git history.
- 2026-09-07 — **Corrected against the walkthrough video.**
  [plan_correct-against-walkthrough-video.md](plan_correct-against-walkthrough-video.md) mirrored
  the service room (galley kerb, washroom pod off), updated the palette to walnut-dominant, added
  interior fittings the video revealed, and shipped a post chain (bloom + GTAO). The lounge
  handedness this plan built was already correct; only the service room and finishes changed.
