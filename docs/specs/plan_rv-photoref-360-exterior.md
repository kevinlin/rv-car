# Photo-referenced correction, 360 look and exterior view — Implementation Plan

**Goal:** Correct the shipped interior against the manufacturer's photography, drive its surfaces
from photo-derived textures, replace the per-hotspot orbit clamp with free look in place, and
model the outside of the vehicle.

**Architecture:** Appearance moves out of Blender and into the finish registry: `.glb`s carry
geometry and baked AO, `data/finishes.ts` carries colour plus texture descriptions, and
`src/textures.ts` resolves those descriptions at runtime. Navigation gains a second controller —
`look.ts` rotates the camera about a fixed eye, which orbit cannot do inside a 2.36 m cabin — and
`Hotspot` becomes a discriminated union so interior stops carry pitch limits and the exterior stop
carries orbit limits. The exterior is a tenth Blender module whose every dimension derives from
`ENVELOPE`, which makes the published envelope verifiable geometry for the first time.

**Tech Stack:** TypeScript, Vite, Vitest, Three.js r185 (vanilla), Blender 5.2.1 LTS with `bpy`,
`@gltf-transform/cli` 4.5.0, `sharp` (new devDependency, build tooling only).

**Spec:** [design_rv-interior-3d.md](design_rv-interior-3d.md). This work was designed in a
child spec, `design_rv-photoref-360-exterior.md`, which has since been folded into the single
design spec — section numbers below refer to the merged document.
**Parent plan:** [plan_rv-interior-3d.md](plan_rv-interior-3d.md)

## Global Constraints

Inherited from the parent plan and still binding:

- **Units.** Data is authored in millimetres. 1 Three.js unit = 1 metre. Conversion happens once,
  in `toM()`. No other file divides by 1000.
- **Coordinate frame (runtime).** Origin at habitation floor level, on the vehicle centreline, at
  the cab bulkhead. `+X` kerb side, `+Y` up, `+Z` rearward. The vehicle is left-hand drive.
- **Coordinate frame (Blender).** `X` lateral (`+X` kerb), `Y` rearward, `Z` up, metres. The
  export applies a reflected parent to reach glTF's `-Z` rearward. Do not change this.
- **Placement origin is the minimum corner** (min X, min Y, min Z).
- **Confidence tags are mandatory.** Every `Mm` carries `'published' | 'derived' | 'estimated'`.
- **Published dimensions are immutable:** overall 5998 x 2450 x 3200 mm, wheelbase 3300 mm,
  alcove bed 2200 x 1400 mm, slide-out bed 1280 x 1900 mm. A task that changes one is wrong.
- **Slide-out is modelled deployed only.** No retract animation.
- **Material naming contract:** every Blender material is `role.<role-id>`.
- **Node naming contract:** every exported glTF node in `PLACEMENTS` uses the placement `id`
  verbatim.
- **Blender path:** `/Applications/Blender.app/Contents/MacOS/Blender`.
- **Package manager is pnpm.** Not npm, not yarn.
- **Commit after every task.** Conventional-commit prefixes.
- **Asset budget:** ≤ 350,000 triangles, ≤ 25 MB transferred.
- **Draw calls:** ≤ 40 at any interior hotspot, ≤ 60 at the exterior stop (raised by this spec
  from a flat 40).

## Four corrections this plan makes to the spec

Found while turning the design into concrete numbers. Recorded rather than silently applied.

1. **Runtime textures ship as WebP, not KTX2.** The spec said KTX2; §4 now records the WebP
   outcome. `tools/optimize.sh` already skips KTX2 compression when the `ktx` binary is absent,
   and the parent plan records that
   KTX-Software was only ever extracted to a temporary directory, never installed. WebP needs no
   binary and loads through `THREE.TextureLoader` with no plumbing. KTX2 wins on GPU memory; the
   binding constraint here is transferred bytes, where WebP is equal or better. Revisit if GPU
   memory becomes the limit on mobile.
2. **`sharp` is added as a devDependency.** The rectifier needs image decode, blur and WebP
   encode. Node has none of these built in, and neither ImageMagick nor Pillow is present on the
   build machine. `sharp` is the mature choice; the homography itself is forty lines on top of
   its raw pixel buffers.
3. **The neutral-saturation threshold is 0.05, not the spec's 0.10.** The spec set 0.10 so the
   existing registry values would pass. Since Task 1 changes those values anyway, the threshold is
   set from the photographs instead: they measure 0.015 to 0.034. At 0.05 the test fails on both
   `floor` (0.088) and `upholstery.seat` (0.082), which is what makes it a real test.
4. **The exterior envelope check excludes `slideout_box`.** The published 2450 mm width is the
   retracted width. A deployed slide-out legitimately exceeds it by 580 mm, so including it would
   make the envelope assertion fail on correct geometry.

## Reference imagery

The product page is a 37-slice poster. `docs/research/reference/` currently holds 6 slices. Task 4
commits only the slices the texture manifest actually cites, keeping repo growth to a few MB
rather than the full 14 MB. Re-fetch any others from the URL list in
`docs/research/reference/source-page-dachirv-60.json`.

---

## Critical Files

| File | Responsibility |
|---|---|
| `src/data/finishes.ts` | `TextureSpec`, map fields, corrected neutrals, graphic and exterior roles |
| `src/calibrate.ts` | Screen-patch sampling and saturation reporting (`?calibrate`) |
| `tools/check_blend.py` | UV1 texel-density measurement and assertion |
| `tools/rectify_textures.mjs` | Homography + flat-field + mirror-tile, manifest-driven |
| `model/textures.json` | Texture manifest: source, corners, output, role |
| `src/textures.ts` | `TextureSpec` → `THREE.Texture`, cached by URL |
| `src/finishes.ts` | `applyFinishes` gained optional texture resolver |
| `src/data/vehicle.ts` | `Hotspot` discriminated union, exterior zone and placements |
| `src/camera.ts` | `applyHotspotLimits` narrowed to the orbit branch |
| `src/look.ts` | Yaw/pitch about a fixed eye point |
| `src/scene.ts` | Both controllers; ground plane and sky |
| `src/check.ts` | Excludes `exterior` alongside `shell` |
| `tools/model_exterior.py` | The tenth Blender collection |
| `tools/model_interior.py` | Ceiling band, galley, washroom, cab corrections |
| `tools/model_furniture.py` | Lockers, table, sofa, props |
| `tools/export_modules.py` | `MODULES` gained `exterior` |
| `src/loader.ts` | `MODULE_NAMES` gained `exterior` |
| `tools/check_models.mjs` | Exterior bounds and envelope assertions |
| `src/lighting.ts` | Probe trap: holds the exterior out of the cubemap capture |

---

## Phase A — Calibration

### Task 1: Correct the neutral surfaces

Corrected seat leather from cream `#E8E1D5` (saturation 0.082) to grey `#C9CAC9` (0.005) and
floor vinyl hex to `#8F9094`, matching the reference pixel samples. Added a saturation guard in
`src/data/finishes.test.ts` that asserts every neutral role stays under 0.05 — the threshold set
from the photographs, not from the pre-existing values.

### Task 2: Calibration mode

Created `src/calibrate.ts` with a `?calibrate` query mode that samples fixed screen patches over
surfaces neutral in the reference (floor, seat, washroom shell) and reports each patch's
saturation. Tuned the cove tint from `0xffd9a0` to `0xffeed8` — that was the whole white-balance
fix; lowering `environmentIntensity` made it worse because the probe carries cool daylight, so
weakening it concentrated the coves' orange.

---

## Phase B — Textures

### Task 3: Measure UV1 texel density

Added a texel-density measurement to `tools/check_blend.py` and an assertion that spread stays
within tolerance across all textured roles. The texel-density risk fired: `role.floor` measured
4.30 spread.
`normalise_uv_density()` rescaled each unwrap to a fixed 1.0 UV/m, dropping worst spread from
8.57 to 1.40 without invalidating UV2 or the AO atlas.

### Task 4: The rectifier

Built `tools/rectify_textures.mjs`, a manifest-driven pipeline that perspective-corrects a
quadrilateral crop from a source photograph, divides out its low-frequency illumination
(flat-field correction), and mirror-tiles the result into a seamless WebP map. Manifest lives in
`model/textures.json`.

### Task 5: Runtime texture resolution

Extended `MaterialParams` with `TextureSpec` fields (`map`, `normalMap`, `normalScale`,
`transparent`), created `src/textures.ts` to resolve specs to cached `THREE.Texture` instances,
and gave `applyFinishes` an optional resolver argument that defaults to a no-op so node-based
tests need no WebGL context.

### Task 6: Author the nine maps

Authored eight maps from the reference photographs (walnut, herringbone, stone, leather-grey,
leather-camel, leather-cream, grp-ribbed, damask) — `wood.trim` shares `walnut.webp` because the
reference shows one veneer on both cabinets and the ceiling band. Maps carry luminance only; the
registry keeps hue, because THREE multiplies the two and a coloured map tints twice. Retired the
Blender-side maps. Wood variants now change grain as well as tint.

---

## Phase C — Navigation

### Task 7: Make `Hotspot` a discriminated union

Replaced the flat `Hotspot` shape with a `view` discriminated union (`look` | `orbit`). All six
interior stops became `look` (rotate about a fixed eye); the exterior stop remained `orbit`.
`applyHotspotLimits` narrowed to the orbit branch only.

### Task 8: Look controls

Created `src/look.ts`: yaw and pitch about a fixed eye point via pointer drag, ~40 lines.
`SceneBundle` gained both controllers; `render()` updates whichever is enabled. `tweenTo` hands
the camera to the correct controller on arrival via an `arrive()` helper.

---

## Phase D — Model corrections

Each task was one Blender collection: regenerated, re-baked, re-exported and committed on its
own, matching the per-collection rhythm the parent plan established.

### Task 9: Ceiling band and cove — `shell`

Banded the ceiling in walnut with stepped LED coves on both flanks, matching the reference wide
shot where the ceiling fills roughly a third of the frame and reads as banded rather than flat
cream.

### Task 10: Lockers, table and sofa — `lockers`, `dinette`, `sofa_slideout`

Framed the locker doors in walnut with LED strips beneath, gave the table a walnut edge band on
a chrome pedestal, and added a back cushion to the sofa.

### Task 11: Galley layout — `galley`

Swapped the sink and hob along the galley run (sink at the aisle end, hob at the rear) and cut a
counter window into the kerb wall, matching the reference photograph.

### Task 12: Washroom — `washroom`

Rebuilt the washroom with a corner vanity, mirror cabinet, ribbed GRP wall panels, a damask
shower curtain on a rail, grab rails, and recessed niches replacing the projecting shelves.

### Task 13: Cab — `cab`

Added a dash binnacle, steering wheel rim and hub, and a black engine tunnel between the cab
seats — the elements that make the cab read as occupied rather than an empty white void.

### Task 14: Props and decals — `softgoods`

Added the entry door (as shell architecture, not a placement — built-in appliances share volume
with their cabinetry, which the overlap check forbids), appliances (washer, oven), systems panel,
and photo-wall decals. Added two graphic roles: `graphic.print` and `graphic.screen`.

---

## Phase E — Exterior

### Task 15: Exterior data and check widening

Added nine exterior placements derived from `ENVELOPE` (body cab, alcove, habitation, skirt,
slide-out box, four wheels). Widened `check.ts` to exclude `exterior` alongside `shell` from
overlap and containment tests, and excluded exterior placements from the grey-box.

### Task 16: The exterior collection

Created `tools/model_exterior.py` as the tenth Blender collection: body masses, wheels, skirt,
slide-out box, and side-graphic decal planes. Added four roles: `body.paint`, `body.graphic`,
`tyre`, `wheel`. Added an envelope assertion to `tools/check_models.mjs` that verifies the
modelled body measures 5998 × 2450 × 3200 mm.

### Task 17: Ground, sky, the exterior stop, and the probe trap

Added the seventh hotspot (orbit at 6–14 m), a ground plane, a hemisphere sky light, and the
probe trap: `installLighting` hides the exterior group before the cubemap capture so daylight
still reaches the interior through the glazing. Visibility toggling rather than render layers is
deliberate: `CubeCamera` holds six child cameras, and setting layers on the parent does not
propagate to all of them.

---

## Phase F — Verification

### Task 18: Full verification pass and documentation

Ran every automated check and recorded the browser-measured numbers into the design spec. Updated
`CLAUDE.md` to reflect the current state. See the design spec's
[Photo-reference, free look and exterior](design_rv-interior-3d.md#photo-reference-free-look-and-exterior-2026-09-06)
record entry for the full table.

---

## Self-Review

**Spec coverage.** Every part of the design maps to at least one task. Against the merged
spec's numbering: new evidence → Tasks 1 and 14; the warm cast (§7) → Tasks 1 and 2; textures
(§4) → Tasks 3, 4, 5, 6; navigation (§8) → Tasks 7 and 8; the ten model-correction rows →
Tasks 1, 2, 9, 10, 11, 12, 13, 14; exterior (§9) → Tasks 15, 16, 17; budget (§10) → Tasks 6, 14,
17, 18; verification (§11) → the check steps in every task plus Task 18; phasing (§12) → the
phase headings; risks (§13) → texel density is Task 3's whole purpose, baked lighting in the crops
is the rectifier's flat-field stage, the draw-call ceiling is Task 14, and the probe trap is
Task 17; open questions (§14) → the wheel radius is tagged `estimated` in Task 15 and the side
graphic in Task 16. The design's cut list named the washroom (Task 12) and the cab (Task 13);
both sit late in their phase for that reason, and neither was cut.

**Type consistency.** `TextureSpec`, `MaterialParams`, `Resolve`, `Registry`, `Role`, `Hotspot`,
`LookControls`, `Heading`, `Patch`, `CalibrationRow`, `Placement`, `Box`, `ZoneId`, `VolumeId`
are each defined once. `saturation` appears in both `src/data/finishes.test.ts` and
`src/calibrate.ts`; the test file's copy is local to the test and the runtime copy takes three
arguments rather than a packed hex, so they are deliberately separate rather than a duplicated
export. `applyFinishes(root, registry, resolve?)`, `applyHotspotLimits(controls, camera, target,
view)`, `createLook(camera, dom)`, `createTextureResolver()`, `solveHomography(src, dst)`,
`applyHomography(h, x, y)`, `installLighting(scene, renderer, vehicle, exterior?)` each keep one
signature throughout.

**Known ordering constraint.** Task 3 can veto Task 4. If the measured texel-density spread
exceeds 4, a re-unwrap task comes first and the AO atlas must be re-baked, because the unwrap
that feeds tiling maps and the packed atlas in UV2 are both properties of the same meshes. This
is called out in Task 3 rather than left to be discovered.

**Deliberate gap.** Draw calls are measured in the browser, not asserted by `check_budget.mjs`.
The parent plan has the same gap for the same reason, and this plan does not close it.

---

## Changelog

- 2026-09-06 — **Re-pointed at the merged design spec.** `design_rv-photoref-360-exterior.md`
  was folded into [design_rv-interior-3d.md](design_rv-interior-3d.md); this plan's spec links
  and section references now target the merged document.
- 2026-09-06 — **Compacted post-implementation.** Removed step-by-step tasks, file-by-file diffs,
  code snippets, and verification commands now that the feature has shipped. Preserved Goal,
  Global Constraints, Design Decisions (four corrections), Critical Files summary, task intents,
  Self-Review, and the phase structure. Original plan recoverable via git history.
