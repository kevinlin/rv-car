# Photo-referenced correction, 360 look and exterior view — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

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

**Spec:** [design_rv-photoref-360-exterior.md](design_rv-photoref-360-exterior.md)
**Parent spec:** [design_rv-interior-3d.md](design_rv-interior-3d.md)
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

1. **Runtime textures ship as WebP, not KTX2.** Spec §4 said KTX2. `tools/optimize.sh` already
   skips KTX2 compression when the `ktx` binary is absent, and the parent plan records that
   KTX-Software was only ever extracted to a temporary directory, never installed. WebP needs no
   binary and loads through `THREE.TextureLoader` with no plumbing. KTX2 wins on GPU memory; the
   binding constraint here is transferred bytes, where WebP is equal or better. Revisit if GPU
   memory becomes the limit on mobile.
2. **`sharp` is added as a devDependency.** The rectifier needs image decode, blur and WebP
   encode. Node has none of these built in, and neither ImageMagick nor Pillow is present on the
   build machine. `sharp` is the mature choice; the homography itself is forty lines on top of
   its raw pixel buffers.
3. **The neutral-saturation threshold is 0.05, not the spec's 0.10.** §9 set 0.10 so the existing
   registry values would pass. Since Task 1 changes those values anyway, the threshold is set from
   the photographs instead: they measure 0.015 to 0.034. At 0.05 the test fails today on both
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

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/data/finishes.ts` | Adds `TextureSpec`, map fields, 4 new roles, corrected neutrals | 1, 5, 14, 16 |
| `src/data/finishes.test.ts` | **New.** Neutral-saturation guard over the registry | 1 |
| `src/calibrate.ts` | **New.** Screen-patch sampling and saturation reporting | 2 |
| `tools/check_blend.py` | Gains UV1 texel-density measurement | 3 |
| `tools/rectify_textures.mjs` | **New.** Homography + flat-field + WebP, manifest-driven | 4 |
| `tools/rectify_textures.test.mjs` | **New.** Homography maths, `node:test` | 4 |
| `model/textures.json` | **New.** Texture manifest: source, corners, output, role | 4, 6 |
| `src/textures.ts` | **New.** `TextureSpec` → `THREE.Texture`, cached | 5 |
| `src/finishes.ts` | `applyFinishes` gains a texture resolver | 5 |
| `src/data/vehicle.ts` | `Hotspot` union, `exterior` zone and placements | 7, 15 |
| `src/camera.ts` | `applyHotspotLimits` narrows to the orbit branch | 7 |
| `src/look.ts` | **New.** Yaw/pitch about a fixed eye point | 8 |
| `src/look.test.ts` | **New.** Pure orientation maths, eye never moves | 8 |
| `src/scene.ts` | Carries both controllers; ground plane and sky | 8, 17 |
| `src/main.ts` | Wires resolver, look mode, calibration, exterior | 2, 5, 8, 17 |
| `src/check.ts` | Excludes `exterior` alongside `shell` | 15 |
| `tools/model_exterior.py` | **New.** The tenth Blender collection | 16 |
| `tools/model_interior.py` | Ceiling band, galley, washroom, cab corrections | 9, 11, 12, 13 |
| `tools/model_furniture.py` | Lockers, table, sofa, props | 10, 14 |
| `tools/export_modules.py` | `MODULES` gains `exterior` | 16 |
| `src/loader.ts` | `MODULE_NAMES` gains `exterior` | 16 |
| `tools/check_models.mjs` | Exterior bounds and envelope assertions | 16 |
| `src/lighting.ts` | Holds the exterior out of the probe capture | 17 |

---

## Phase A — Calibration

Sequenced first. Every later visual judgement is made against this image.

### Task 1: Correct the neutral surfaces

The reference photographs sample seat leather at `#808182` (saturation 0.015) and floor vinyl at
`#8f9094` (0.034). The registry says cream `#e8e1d5` (0.082) and `#7c8288` (0.088). The parent
spec's palette table calls the seat "cream leather"; the photographs show neutral grey.

**Files:**
- Create: `src/data/finishes.test.ts`
- Modify: `src/data/finishes.ts`

**Interfaces:**
- Consumes: `DEFAULT_REGISTRY`, `Role` from `src/data/finishes.ts`
- Produces: nothing new. `upholstery.seat` and `floor` colours change value only.

- [x] **Step 1: Write the failing test**

Create `src/data/finishes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_REGISTRY, type Role } from './finishes';

/** HSV saturation of a packed 0xRRGGBB colour. 0 is a perfect neutral. */
export const saturation = (hex: number): number => {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/**
 * Surfaces the reference photography shows as neutral. Measured off the brochure shots:
 * seat leather 0.015, floor vinyl 0.034, washroom shell effectively 0. The threshold sits
 * above all three and below the values these roles carried before this task.
 */
const NEUTRAL_ROLES: Role[] = ['floor', 'upholstery.seat', 'washroom.shell'];
const MAX_NEUTRAL_SATURATION = 0.05;

describe('neutral roles', () => {
  it('keeps every variant of every neutral role under the threshold', () => {
    for (const role of NEUTRAL_ROLES) {
      for (const v of DEFAULT_REGISTRY[role].variants) {
        expect(saturation(v.params.color), `${role}/${v.id}`).toBeLessThan(
          MAX_NEUTRAL_SATURATION,
        );
      }
    }
  });

  it('leaves deliberately warm roles alone', () => {
    // panel.wall is a warm cream in the photographs and must NOT be neutralised.
    expect(saturation(DEFAULT_REGISTRY['panel.wall'].variants[0]!.params.color))
      .toBeGreaterThan(MAX_NEUTRAL_SATURATION);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/data/finishes.test.ts`
Expected: FAIL on `floor/grey-vinyl` (0.088) and `upholstery.seat/cream` (0.082).

- [x] **Step 3: Correct the two colours**

In `src/data/finishes.ts`, replace the `upholstery.seat` and `floor` entries:

```ts
  // Photographs sample #808182 in shadow; the albedo is lighter than the pixel.
  'upholstery.seat':   one('grey', 'Grey leather', { color: 0xc9cac9, roughness: 0.7, metalness: 0 }),
```

```ts
  // Sampled from the reference aisle shot at #8f9094 — a cool neutral, not the warm grey
  // the first palette pass estimated by eye.
  'floor':             one('grey-vinyl', 'Grey vinyl', { color: 0x8f9094, roughness: 0.75, metalness: 0 }),
```

- [x] **Step 4: Run the tests and make sure they pass**

Run: `pnpm check`
Expected: PASS, TypeScript clean. The existing `finishes.test.ts` seam test still passes because
it asserts which roles change on a wood swap, not their values.

- [x] **Step 5: Update the palette tables that now disagree**

In `docs/specs/design_rv-interior-3d.md` §3, change the `upholstery.seat` row from
"Cream leather / `#E8E1D5`" to "Grey leather / `#C9CAC9`" and the `floor` row's hex to `#8F9094`.
In `docs/research/2026-09-04-dachi-wujijing-500-reference.md`, change the "Seat upholstery" row's
description from "Cream leather main panels" to "Grey leather main panels" and its first hex to
`#C9CAC9`. Add one line under that table: "Corrected 2026-09-05 from pixel samples; the original
values were estimated by eye."

- [x] **Step 6: Commit**

```bash
git add src/data/finishes.ts src/data/finishes.test.ts \
        docs/specs/design_rv-interior-3d.md docs/research/2026-09-04-dachi-wujijing-500-reference.md
git commit -m "fix: correct seat and floor to the neutral values the photographs show"
```

### Task 2: Calibration mode

The registry floor colour was already a cool neutral before Task 1 and still rendered warm
(`#8c847a`, saturation 0.13). The cast is in the image, not the palette: `environmentIntensity`
is 2.5 against a probe of a walnut-lined room lit by warm LEDs, and ACES saturates the warm end.

**Files:**
- Create: `src/calibrate.ts`
- Modify: `src/main.ts`, `src/lighting.ts:71`, `src/scene.ts:17`
- Test: `src/calibrate.test.ts`

**Interfaces:**
- Consumes: `SceneBundle` from `src/scene.ts`, `HOTSPOTS` from `src/data/vehicle.ts`,
  `tweenTo` from `src/camera.ts`
- Produces: `saturation(r, g, b): number`, `samplePatch(renderer, u, v, size): [number, number, number]`,
  `PATCHES: readonly Patch[]`, `runCalibration(bundle): Promise<CalibrationRow[]>`

- [x] **Step 1: Write the failing test for the pure part**

Create `src/calibrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { saturation, PATCHES } from './calibrate';

describe('saturation', () => {
  it('reports zero for a perfect neutral', () => {
    expect(saturation(128, 128, 128)).toBe(0);
  });
  it('reports the measured cast of the pre-calibration render', () => {
    // #8c847a, the floor as it rendered before this task.
    expect(saturation(0x8c, 0x84, 0x7a)).toBeCloseTo(0.129, 3);
  });
  it('reports the photographic reference as near-neutral', () => {
    expect(saturation(0x8f, 0x90, 0x94)).toBeLessThan(0.05);
  });
});

describe('PATCHES', () => {
  it('samples every neutral surface named in the spec', () => {
    expect(PATCHES.map((p) => p.role).sort())
      .toEqual(['floor', 'upholstery.seat', 'washroom.shell']);
  });
  it('places every patch inside the viewport', () => {
    for (const p of PATCHES) {
      expect(p.u).toBeGreaterThan(0);
      expect(p.u).toBeLessThan(1);
      expect(p.v).toBeGreaterThan(0);
      expect(p.v).toBeLessThan(1);
    }
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/calibrate.test.ts`
Expected: FAIL with "Failed to resolve import ./calibrate".

- [x] **Step 3: Write `src/calibrate.ts`**

```ts
import * as THREE from 'three';
import type { Role } from './data/finishes';
import type { ZoneId } from './data/vehicle';
import { HOTSPOTS } from './data/vehicle';
import { tweenTo } from './camera';
import type { SceneBundle } from './scene';

/** HSV saturation of an 8-bit RGB triple. */
export const saturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

export interface Patch {
  readonly label: string;
  readonly role: Role;
  readonly hotspot: ZoneId;
  /** Normalised viewport coordinates, origin top-left. */
  readonly u: number;
  readonly v: number;
}

/**
 * Starting positions, to be verified against a marked screenshot in step 5. Each must land on
 * bare material — no prop, no highlight, no cove strip.
 */
export const PATCHES: readonly Patch[] = [
  { label: 'aisle floor',   role: 'floor',            hotspot: 'dinette',  u: 0.46, v: 0.86 },
  { label: 'chair panel',   role: 'upholstery.seat',  hotspot: 'dinette',  u: 0.72, v: 0.62 },
  { label: 'washroom wall', role: 'washroom.shell',   hotspot: 'washroom', u: 0.30, v: 0.40 },
];

/** Mean colour of a square of the drawing buffer. Call immediately after a render. */
export const samplePatch = (
  renderer: THREE.WebGLRenderer,
  u: number,
  v: number,
  size = 8,
): [number, number, number] => {
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  // readPixels' origin is bottom-left; Patch coordinates are top-left.
  const x = Math.round(u * w - size / 2);
  const y = Math.round((1 - v) * h - size / 2);
  const buf = new Uint8Array(size * size * 4);
  gl.readPixels(x, y, size, size, gl.RGBA, gl.UNSIGNED_BYTE, buf);

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < size * size; i++) {
    r += buf[i * 4]!; g += buf[i * 4 + 1]!; b += buf[i * 4 + 2]!;
  }
  const n = size * size;
  return [r / n, g / n, b / n];
};

export interface CalibrationRow {
  readonly label: string;
  readonly hex: string;
  readonly saturation: number;
  readonly pass: boolean;
}

export const MAX_RENDERED_SATURATION = 0.08;

/** Visits each patch's hotspot, samples it, and returns one row per patch. */
export const runCalibration = async (bundle: SceneBundle): Promise<CalibrationRow[]> => {
  const rows: CalibrationRow[] = [];

  for (const patch of PATCHES) {
    const hotspot = HOTSPOTS.find((h) => h.id === patch.hotspot);
    if (!hotspot) continue;
    await tweenTo(bundle, hotspot, 0);
    bundle.render();
    const [r, g, b] = samplePatch(bundle.renderer, patch.u, patch.v);
    const sat = saturation(r, g, b);
    const hx = (v: number) => Math.round(v).toString(16).padStart(2, '0');
    rows.push({
      label: patch.label,
      hex: `#${hx(r)}${hx(g)}${hx(b)}`,
      saturation: Number(sat.toFixed(3)),
      pass: sat < MAX_RENDERED_SATURATION,
    });
  }

  return rows;
};
```

- [x] **Step 4: Run the tests and make sure they pass**

Run: `pnpm exec vitest run src/calibrate.test.ts`
Expected: PASS.

- [x] **Step 5: Wire `?calibrate` into `main.ts`**

Append to `src/main.ts`, after the `?verify` block:

```ts
if (import.meta.env.DEV && new URLSearchParams(location.search).has('calibrate')) {
  const { runCalibration } = await import('./calibrate');
  bundle.renderer.setAnimationLoop(null);
  const rows = await runCalibration(bundle);
  console.table(rows);
  canvas.dataset.calibration = JSON.stringify(rows);
  bundle.renderer.setAnimationLoop(bundle.render);
}
```

Run `pnpm dev`, open `http://localhost:5173/?calibrate`, and read the table. Before tuning it
should show the floor patch failing. If a patch reports an obviously wrong surface, adjust its
`u`/`v` in `PATCHES` and reload — that is what the coordinates are for.

- [x] **Step 6: Tune until every patch passes**

Three knobs, in this order. Change one, reload `?calibrate`, read the table.

1. `src/lighting.ts:71` — `scene.environmentIntensity = 2.5`. This is the main contributor; the
   probe it scales is a cubemap of a warm room.
2. `src/lighting.ts:12` — `const WARM = 0xffd9a0`. Cooling the cove tint cools every bounce.
3. `src/scene.ts:17` — `renderer.toneMappingExposure = 1.05`. The parent spec records that past
   about 1.2 the cream panels clip, so treat 1.2 as a ceiling.

Target: every row under 0.08 saturation, and the room still reads as warm LED light rather than
office fluorescent. If neutrality and warmth genuinely conflict, keep the coves warm and cool the
`environmentIntensity` instead — the strips are meant to look warm, the floor is not.

- [x] **Step 7: Capture evidence**

Save a fresh set of renders to `docs/research/calibrated/` at the same six hotspots as
`docs/research/tuned/`, so the before and after can be compared side by side.

- [x] **Step 8: Commit**

```bash
git add src/calibrate.ts src/calibrate.test.ts src/main.ts src/lighting.ts src/scene.ts \
        docs/research/calibrated
git commit -m "fix: neutralise the render's warm cast and add a calibration mode"
```

---

## Phase B — Textures

### Task 3: Measure UV1 texel density

Spec risk 1, checked before any map is authored. Tiling maps need consistent texel density on
UV1. If adjacent cabinet doors carry different density, wood grain runs at different scales and
the whole approach looks wrong. Measuring first means finding that out for the price of one
script rather than after authoring nine maps.

**Files:**
- Modify: `tools/check_blend.py`

**Interfaces:**
- Consumes: the saved `model/rv.blend`
- Produces: `texel_density(obj)` returning a list of √(UV area / world area) per polygon, and a
  printed `TEXEL_DENSITY` line per role

- [x] **Step 1: Add the measurement, printing only**

Insert into `tools/check_blend.py`, before the final `print('SAVED_MODEL_CHECK_PASS')`:

```python
def texel_density(obj):
    """UV units per metre, per polygon. sqrt of the UV-area to world-area ratio."""
    mesh = obj.data
    layer = mesh.uv_layers['UVMap'].data
    scale = obj.matrix_world.to_scale()
    out = []
    for poly in mesh.polygons:
        world = poly.area * scale.x * scale.y
        if world < 1e-9:
            continue
        loops = [layer[i].uv for i in poly.loop_indices]
        cross = 0.0
        for i in range(len(loops)):
            p, q = loops[i], loops[(i + 1) % len(loops)]
            cross += p.x * q.y - q.x * p.y
        uv_area = abs(cross) / 2
        if uv_area < 1e-12:
            continue
        out.append((uv_area / world) ** .5)
    return out


by_role = {}
for obj in scene.objects:
    if obj.type != 'MESH':
        continue
    densities = texel_density(obj)
    for slot in obj.data.materials:
        if slot:
            by_role.setdefault(slot.name, []).extend(densities)

for role, values in sorted(by_role.items()):
    values.sort()
    lo = values[int(len(values) * .05)]
    hi = values[int(len(values) * .95)]
    print('TEXEL_DENSITY', role, 'n=%d' % len(values),
          'p5=%.2f p95=%.2f spread=%.2f' % (lo, hi, hi / lo))
```

- [x] **Step 2: Run it and record the numbers**

Run: `pnpm exec npm run check:blend 2>&1 | grep TEXEL_DENSITY`
Expected: one line per role. Write the output into
`docs/research/texel-density.md` verbatim, with the date.

- [x] **Step 3: Decide, from the measurement, whether a re-unwrap is needed**

Read the `spread` column for the nine roles that will receive maps: `wood.cabinet`, `wood.trim`,
`floor`, `worktop`, `upholstery.seat`, `upholstery.bolster`, `upholstery.sofa`,
`washroom.shell`, `textile.curtain`.

- Spread ≤ 4 on all nine: proceed to Task 4 unchanged.
- Spread > 4 on any of them: **stop and report.** A re-unwrap at fixed texel density is a new
  task ahead of Task 4, and it invalidates the packed AO atlas in UV2, so
  `pnpm exec npm run bake` must be re-run after it. Do not start authoring maps first.

- [x] **Step 4: Assert the measured tolerance**

Add, after the printing loop, using the number step 2 actually produced (replace `4.0` with the
measured worst case rounded up to one decimal place):

```python
TEXTURED_ROLES = ['role.wood.cabinet', 'role.wood.trim', 'role.floor', 'role.worktop',
                  'role.upholstery.seat', 'role.upholstery.bolster', 'role.upholstery.sofa',
                  'role.washroom.shell', 'role.textile.curtain']
for role in TEXTURED_ROLES:
    values = sorted(by_role.get(role, []))
    assert values, role
    spread = values[int(len(values) * .95)] / values[int(len(values) * .05)]
    assert spread <= 4.0, (role, 'texel density spread %.2f; tiling maps will scale unevenly' % spread)
```

- [x] **Step 5: Run it and make sure it passes**

Run: `pnpm exec npm run check:blend`
Expected: `SAVED_MODEL_CHECK_PASS`.

- [ ] **Step 6: Commit**

```bash
git add tools/check_blend.py docs/research/texel-density.md
git commit -m "test: measure and assert UV1 texel density across textured roles"
```

### Task 4: The rectifier

Turns a perspective view of a flat surface in a photograph into a tileable, evenly-lit map.

**Files:**
- Create: `tools/rectify_textures.mjs`, `tools/rectify_textures.test.mjs`, `model/textures.json`
- Modify: `package.json`
- Commit: the source slices `model/textures.json` cites, into `docs/research/reference/`

**Interfaces:**
- Consumes: `sharp`
- Produces: `solveHomography(src, dst): number[9]`, `applyHomography(h, x, y): [number, number]`,
  and a CLI `pnpm exec npm run textures`

- [ ] **Step 1: Add the dependency**

```bash
pnpm add -D sharp
```

- [ ] **Step 2: Write the failing test**

Create `tools/rectify_textures.test.mjs`, following the `node:test` pattern already used by
`tools/check_models.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveHomography, applyHomography } from './rectify_textures.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

test('maps the four source corners onto the four destination corners', () => {
  const src = [[120, 80], [900, 140], [880, 700], [100, 640]];
  const dst = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const h = solveHomography(src, dst);
  for (let i = 0; i < 4; i++) {
    const [u, v] = applyHomography(h, src[i][0], src[i][1]);
    close(u, dst[i][0]);
    close(v, dst[i][1]);
  }
});

test('is the identity for a unit square onto itself', () => {
  const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const [u, v] = applyHomography(solveHomography(unit, unit), 0.25, 0.75);
  close(u, 0.25);
  close(v, 0.75);
});

test('is invertible: the inverse maps destination corners back to source', () => {
  const src = [[120, 80], [900, 140], [880, 700], [100, 640]];
  const dst = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const inverse = solveHomography(dst, src);
  for (let i = 0; i < 4; i++) {
    const [x, y] = applyHomography(inverse, dst[i][0], dst[i][1]);
    close(x, src[i][0], 1e-4);
    close(y, src[i][1], 1e-4);
  }
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `node --test tools/rectify_textures.test.mjs`
Expected: FAIL, cannot find module `./rectify_textures.mjs`.

- [ ] **Step 4: Write `tools/rectify_textures.mjs`**

```js
#!/usr/bin/env node
/**
 * Turn a perspective view of a flat surface in a photograph into a tileable, evenly-lit map.
 *
 * Three stages, in order:
 *   1. Homography — undo the perspective, so a rectangle in the world is a rectangle in the map.
 *   2. Flat-field — divide out the low-frequency illumination. A photograph of a lit cabinet
 *      door carries a brightness gradient; tiling that gradient makes a visible hotspot grid.
 *   3. Mirror-tile — reflect into a 2x2 so opposite edges match exactly. Cruder than seam
 *      blending and it cannot fail, which for a wood grain at tiling scale is the better trade.
 *
 * Driven by model/textures.json. Run: pnpm exec npm run textures
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Solve the 8 unknowns of a 3x3 homography (h8 fixed at 1) from four point correspondences,
 * by Gaussian elimination with partial pivoting on the 8x8 system.
 */
export const solveHomography = (src, dst) => {
  const a = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('degenerate corner set');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      if (f === 0) continue;
      for (let c = col; c < 8; c++) a[r][c] -= f * a[col][c];
      b[r] -= f * b[col];
    }
  }

  const h = b.map((v, i) => v / a[i][i]);
  h.push(1);
  return h;
};

export const applyHomography = (h, x, y) => {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
};

/** Bilinear sample of a raw RGB buffer, clamped at the edges. */
const sample = (buf, w, h, x, y, out) => {
  const cx = Math.min(Math.max(x, 0), w - 1.001);
  const cy = Math.min(Math.max(y, 0), h - 1.001);
  const x0 = Math.floor(cx), y0 = Math.floor(cy);
  const fx = cx - x0, fy = cy - y0;
  for (let c = 0; c < 3; c++) {
    const i = (yy, xx) => buf[(yy * w + xx) * 3 + c];
    const top = i(y0, x0) * (1 - fx) + i(y0, x0 + 1) * fx;
    const bot = i(y0 + 1, x0) * (1 - fx) + i(y0 + 1, x0 + 1) * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
};

const rectify = async (entry) => {
  const srcPath = resolve(ROOT, entry.source);
  const image = sharp(srcPath).removeAlpha();
  const { width, height } = await image.metadata();
  const { data } = await image.raw().toBuffer({ resolveWithObject: true });

  // Half-size: mirror-tiling doubles it back to the requested output size.
  const half = Math.round(entry.size / 2);
  const inverse = solveHomography([[0, 0], [1, 0], [1, 1], [0, 1]], entry.corners);
  const flat = Buffer.alloc(half * half * 3);
  const px = [0, 0, 0];

  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const [sx, sy] = applyHomography(inverse, (x + 0.5) / half, (y + 0.5) / half);
      sample(data, width, height, sx, sy, px);
      const o = (y * half + x) * 3;
      flat[o] = px[0]; flat[o + 1] = px[1]; flat[o + 2] = px[2];
    }
  }

  const raw = { raw: { width: half, height: half, channels: 3 } };

  // Flat-field: heavy blur is the illumination estimate; divide it out, restore the mean.
  const blurRadius = entry.flatField ?? Math.round(half / 8);
  const illumination = await sharp(flat, raw).blur(blurRadius).raw().toBuffer();
  let mean = 0;
  for (let i = 0; i < illumination.length; i++) mean += illumination[i];
  mean /= illumination.length;

  const corrected = Buffer.alloc(flat.length);
  for (let i = 0; i < flat.length; i++) {
    const lit = illumination[i] || 1;
    corrected[i] = Math.min(255, Math.max(0, Math.round((flat[i] / lit) * mean)));
  }

  // Mirror-tile into 2x2 so opposite edges match exactly.
  const tile = sharp(corrected, raw);
  const [a, b, c, d] = await Promise.all([
    tile.clone().toBuffer(),
    tile.clone().flop().toBuffer(),
    tile.clone().flip().toBuffer(),
    tile.clone().flip().flop().toBuffer(),
  ]);

  const outPath = resolve(ROOT, 'public/textures', `${entry.out}.webp`);
  await mkdir(dirname(outPath), { recursive: true });
  await sharp({
    create: { width: entry.size, height: entry.size, channels: 3, background: '#000' },
  })
    .composite([
      { input: a, raw: raw.raw, left: 0, top: 0 },
      { input: b, raw: raw.raw, left: half, top: 0 },
      { input: c, raw: raw.raw, left: 0, top: half },
      { input: d, raw: raw.raw, left: half, top: half },
    ])
    .webp({ quality: entry.quality ?? 82 })
    .toFile(outPath);

  return outPath;
};

const main = async () => {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'model/textures.json'), 'utf8'));
  const only = process.argv.slice(2);
  let total = 0;
  for (const entry of manifest.textures) {
    if (only.length && !only.includes(entry.out)) continue;
    const path = await rectify(entry);
    const { size } = await sharp(path).metadata().then(async (m) => ({
      size: (await readFile(path)).length, ...m,
    }));
    total += size;
    console.log(`  ${entry.out.padEnd(24)} ${entry.role.padEnd(22)} ${size} bytes`);
  }
  console.log(`Wrote ${total} bytes of texture.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `node --test tools/rectify_textures.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 6: Add the manifest and the script entry**

Create `model/textures.json` with one entry, to prove the pipeline end to end. Corner order is
top-left, top-right, bottom-right, bottom-left, in source pixels:

```json
{
  "textures": [
    {
      "out": "walnut",
      "role": "wood.cabinet",
      "source": "docs/research/reference/galley-detail.jpg",
      "corners": [[326, 452], [470, 448], [472, 578], [324, 580]],
      "size": 1024,
      "quality": 84
    }
  ]
}
```

Add to `package.json` scripts:

```json
    "textures": "node tools/rectify_textures.mjs",
```

- [ ] **Step 7: Run it and inspect the output**

Run: `pnpm exec npm run textures`
Open `public/textures/walnut.webp`. Check three things: the grain runs straight rather than
converging, there is no bright blob left from the original lighting, and the four quadrants meet
without a visible seam. Adjust `corners` and re-run until they do.

- [ ] **Step 8: Commit, including the source slice**

```bash
git add tools/rectify_textures.mjs tools/rectify_textures.test.mjs model/textures.json \
        package.json pnpm-lock.yaml public/textures/walnut.webp \
        docs/research/reference/galley-detail.jpg
git commit -m "feat: rectify photographs into tileable, flat-fielded texture maps"
```

### Task 5: Runtime texture resolution

Moves appearance ownership to the registry. `applyFinishes` only overrides a map when the
registry supplies one, so the four roles currently textured from Blender keep working until
Task 6 replaces them.

**Files:**
- Create: `src/textures.ts`
- Modify: `src/data/finishes.ts`, `src/finishes.ts`, `src/main.ts`
- Test: `src/finishes.test.ts`

**Interfaces:**
- Consumes: `TextureSpec`, `MaterialParams` from `src/data/finishes.ts`
- Produces: `type Resolve = (spec: TextureSpec) => THREE.Texture | null`,
  `createTextureResolver(): Resolve`, and `applyFinishes(root, registry, resolve?)`

- [ ] **Step 1: Write the failing test**

Append to `src/finishes.test.ts`:

```ts
describe('texture resolution', () => {
  it('assigns a resolved texture to the material map', () => {
    const mesh = meshWithMaterial('role.floor');
    const registry = structuredClone(DEFAULT_REGISTRY);
    registry['floor'].variants[0]!.params = {
      ...registry['floor'].variants[0]!.params,
      map: { url: '/textures/herringbone.webp', repeat: [4, 8] },
    };

    const texture = new THREE.Texture();
    applyFinishes(mesh, registry, () => texture);

    expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(texture);
  });

  it('leaves an existing map alone when the registry supplies none', () => {
    // The .glb-authored maps must survive until the registry replaces them role by role.
    const mesh = meshWithMaterial('role.floor');
    const existing = new THREE.Texture();
    (mesh.material as THREE.MeshStandardMaterial).map = existing;

    applyFinishes(mesh, DEFAULT_REGISTRY, () => new THREE.Texture());

    expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(existing);
  });

  it('defaults to no resolver, so node tests need no WebGL context', () => {
    const mesh = meshWithMaterial('role.floor');
    expect(() => applyFinishes(mesh, DEFAULT_REGISTRY)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/finishes.test.ts`
Expected: FAIL — `map` is not a valid `MaterialParams` field, and `applyFinishes` takes two
arguments.

- [ ] **Step 3: Extend the data shape**

In `src/data/finishes.ts`, above `MaterialParams`:

```ts
/**
 * A texture described, not loaded. This file imports nothing, so it cannot hold a
 * THREE.Texture — src/textures.ts turns one of these into one at runtime.
 */
export interface TextureSpec {
  readonly url: string;
  /** UV tiling. Defaults to [1, 1]. */
  readonly repeat?: readonly [number, number];
  /** Base colour is sRGB; normal and data maps are not. Defaults to true. */
  readonly srgb?: boolean;
}
```

and add to `MaterialParams`:

```ts
  readonly map?: TextureSpec;
  readonly normalMap?: TextureSpec;
  readonly normalScale?: number;
  readonly transparent?: boolean;
```

- [ ] **Step 4: Write `src/textures.ts`**

```ts
import * as THREE from 'three';
import type { TextureSpec } from './data/finishes';

export type Resolve = (spec: TextureSpec) => THREE.Texture | null;

/**
 * Caches by url plus the settings that would otherwise force a second GPU upload of the same
 * image. Two roles sharing a url and a repeat share one texture.
 */
export const createTextureResolver = (): Resolve => {
  const loader = new THREE.TextureLoader();
  const cache = new Map<string, THREE.Texture>();

  return (spec) => {
    const key = `${spec.url}|${spec.repeat?.join(',') ?? '1,1'}|${spec.srgb !== false}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const texture = loader.load(spec.url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (spec.repeat) texture.repeat.set(spec.repeat[0], spec.repeat[1]);
    texture.colorSpace = spec.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    cache.set(key, texture);
    return texture;
  };
};
```

- [ ] **Step 5: Teach `applyFinishes` to use it**

In `src/finishes.ts`, add the import and change the signature:

```ts
import type { Resolve } from './textures';
```

```ts
export const applyFinishes = (
  root: THREE.Object3D,
  registry: Registry = DEFAULT_REGISTRY,
  /** Defaults to a no-op so vitest's node environment needs no WebGL context. */
  resolve: Resolve = () => null,
): number => {
```

and inside the material loop, after `material.emissiveIntensity = ...`:

```ts
      // Only override when the registry supplies one: the .glb-authored maps must survive
      // until every role has been migrated.
      if (p.map) material.map = resolve(p.map);
      if (p.normalMap) {
        material.normalMap = resolve(p.normalMap);
        const s = p.normalScale ?? 1;
        material.normalScale.set(s, s);
      }
      material.transparent = p.transparent ?? false;
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `pnpm check`
Expected: PASS, TypeScript clean.

- [ ] **Step 7: Wire the real resolver into `main.ts`**

Add the import:

```ts
import { createTextureResolver } from './textures';
```

Create it once, above the first `applyFinishes` call, and pass it at both call sites — the
initial one and the one inside `onWood`:

```ts
const resolveTexture = createTextureResolver();
```

```ts
applyFinishes(vehicle, registry, resolveTexture);
```

- [ ] **Step 8: Commit**

```bash
git add src/textures.ts src/data/finishes.ts src/finishes.ts src/finishes.test.ts src/main.ts
git commit -m "feat: resolve textures from the finish registry at runtime"
```

### Task 6: Author the nine maps

**Files:**
- Modify: `model/textures.json`, `src/data/finishes.ts`, `tools/surface_textures.py`
- Add: `public/textures/*.webp`, the cited source slices

**Interfaces:**
- Consumes: `TextureSpec` (Task 5), the rectifier CLI (Task 4)
- Produces: nine `.webp` maps plus three wood-variant maps, referenced from `DEFAULT_REGISTRY`

- [ ] **Step 1: Extend the manifest to every textured role**

Add entries to `model/textures.json` for `wood.trim` (reuse the walnut source at a different
crop), `floor`, `worktop`, `upholstery.seat`, `upholstery.bolster`, `upholstery.sofa`,
`washroom.shell` and `textile.curtain`. Source slices, all under `docs/research/reference/`:

| `out` | Role | Source slice | What to crop |
|---|---|---|---|
| `walnut` | `wood.cabinet` | `galley-detail.jpg` | A flat base-cabinet door face |
| `walnut-trim` | `wood.trim` | `interior-lounge-and-overcab.jpg` | The ceiling band |
| `herringbone` | `floor` | `interior-lounge-and-overcab.jpg` | Aisle floor, mid-frame |
| `stone` | `worktop` | `galley-detail.jpg` | Bare worktop beside the sink |
| `leather-grey` | `upholstery.seat` | `dinette-and-slideout-bed.jpg` | A flat seat-back panel |
| `leather-camel` | `upholstery.bolster` | `dinette-and-slideout-bed.jpg` | A bolster side panel |
| `leather-cream` | `upholstery.sofa` | `interior-lounge-and-overcab.jpg` | A sofa cushion face |
| `grp-ribbed` | `washroom.shell` | `underseat-drawers-washroom.jpg` | A ribbed wall panel |
| `damask` | `textile.curtain` | `underseat-drawers-washroom.jpg` | The shower curtain |

- [ ] **Step 2: Generate and inspect each one**

Run one at a time: `pnpm exec npm run textures <out-name>`. Apply the step 7 check from Task 4 to
each — grain straight, no residual hotspot, quadrants meeting cleanly.

- [ ] **Step 3: Reference them from the registry**

For each role, add a `map` to its variant params. `repeat` is in UV units, so it depends on the
texel density measured in Task 3 — start from the values below and correct them in step 5:

```ts
  'floor': one('grey-vinyl', 'Grey vinyl', {
    color: 0x8f9094, roughness: 0.75, metalness: 0,
    map: { url: '/textures/herringbone.webp', repeat: [3, 6] },
  }),
```

Give the three wood variants their own grain, which is the point of moving maps to the registry:

```ts
  'wood.cabinet': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut', params: { color: 0x5a3a24, roughness: 0.45, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'oak', label: 'Oak', params: { color: 0xa97f4f, roughness: 0.55, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2, 2] } } },
      { id: 'ash', label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.6, metalness: 0,
        map: { url: '/textures/walnut.webp', repeat: [2.6, 2.6] } } },
    ],
  },
```

One grain image tinted three ways, at a coarser repeat for ash. Authoring three separate grain
photographs is the upgrade if the tint alone does not convince.

- [ ] **Step 4: Retire the Blender-side maps**

The four roles `surface_textures.py` textures are now driven from the registry. Delete the
`add_surface_maps()` call from the module build in `tools/model_interior.py`, leave the function
itself in place with a comment saying the runtime owns these now, then re-run
`pnpm exec npm run export && pnpm exec npm run optimize` so the `.glb`s stop carrying the images.

- [ ] **Step 5: Correct every `repeat` against the render**

Run `pnpm dev` and visit each hotspot. A tiling map is right when the grain, weave or joint
spacing matches the reference photograph at the same apparent distance. Adjust `repeat` and
reload. This is the step that consumes the time; budget for several passes.

- [ ] **Step 6: Confirm the wood swap now changes grain**

Click through walnut, oak and ash. The tint changes, and ash's grain reads coarser. Capture
screenshots to `docs/research/textured/`.

- [ ] **Step 7: Check the budget**

Run: `pnpm exec npm run budget && du -sh public/textures`
Expected: triangles and `.glb` bytes both fall, since the images left the `.glb`s. Record the
combined `.glb` plus texture total; the 25 MB ceiling covers both.

- [ ] **Step 8: Commit**

```bash
git add model/textures.json src/data/finishes.ts tools/model_interior.py public/textures \
        public/models docs/research/reference docs/research/textured
git commit -m "feat: drive every textured role from photo-derived maps"
```

---

## Phase C — Navigation

### Task 7: Make `Hotspot` a discriminated union

Free look and orbit need different limits. A single flat shape leaves two of the three limit
ranges meaningless at every interior stop.

**Files:**
- Modify: `src/data/vehicle.ts:127-187`, `src/camera.ts:14-27`, `src/camera.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `Hotspot` with `view: { kind: 'look'; pitch } | { kind: 'orbit'; azimuth; polar; distance }`,
  and `applyHotspotLimits(controls, view)` taking the orbit branch only

- [ ] **Step 1: Write the failing test**

Replace the `orders every limit range low-to-high` and `keeps polar angles inside the legal
0..PI range` cases in `src/camera.test.ts` with:

```ts
  it('orders every limit range low-to-high', () => {
    for (const h of HOTSPOTS) {
      if (h.view.kind === 'look') {
        expect(h.view.pitch[0]).toBeLessThan(h.view.pitch[1]);
      } else {
        expect(h.view.azimuth[0]).toBeLessThan(h.view.azimuth[1]);
        expect(h.view.polar[0]).toBeLessThan(h.view.polar[1]);
        expect(h.view.distance[0]).toBeLessThan(h.view.distance[1]);
      }
    }
  });

  it('keeps every angle in a legal range', () => {
    for (const h of HOTSPOTS) {
      if (h.view.kind === 'look') {
        // Pitch is signed from the horizon; straight up and straight down are the limits.
        expect(h.view.pitch[0]).toBeGreaterThanOrEqual(-Math.PI / 2);
        expect(h.view.pitch[1]).toBeLessThanOrEqual(Math.PI / 2);
      } else {
        expect(h.view.polar[0]).toBeGreaterThanOrEqual(0);
        expect(h.view.polar[1]).toBeLessThanOrEqual(Math.PI);
      }
    }
  });

  it('gives every interior stop free look', () => {
    // The whole point of this change: no interior stop may clamp azimuth, because orbiting
    // a 2.36 m cabin at 1.2 m radius drives the camera through the walls.
    const interior = HOTSPOTS.filter((h) => h.id !== 'exterior');
    expect(interior.every((h) => h.view.kind === 'look')).toBe(true);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/camera.test.ts`
Expected: FAIL — `view` does not exist on `Hotspot`.

- [ ] **Step 3: Change the type**

In `src/data/vehicle.ts`, replace the `Hotspot` interface:

```ts
export interface Hotspot {
  readonly id: ZoneId;
  readonly label: string;
  /** Metres, in the runtime frame. In look mode `target` sets the initial heading. */
  readonly camera: {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  /**
   * Look rotates the camera about a fixed eye; orbit swings it around a target. Interior stops
   * are always look: orbiting inside a 2.36 m cabin at any useful radius leaves the vehicle.
   */
  readonly view:
    | { readonly kind: 'look'; readonly pitch: readonly [number, number] }
    | {
        readonly kind: 'orbit';
        readonly azimuth: readonly [number, number];
        readonly polar: readonly [number, number];
        readonly distance: readonly [number, number];
      };
}
```

- [ ] **Step 4: Convert the six hotspots**

Replace each `orbit: { azimuth: [...], polar: [...], distance: [...] }` with a look view. The
polar ranges were 50–100° and 70–100° measured from straight up; as signed pitch from the horizon
that is +40° to −10° and +20° to −10°. Round outward to give the viewer room:

```ts
  { id: 'dinette',  label: 'Lounge',        camera: { position: [-0.2, 1.55, 2.6],  target: [0.1, 0.95, 0.3] },  view: { kind: 'look', pitch: [-35 * D, 35 * D] } },
  { id: 'alcove',   label: 'Alcove bed',    camera: { position: [0.0, 1.55, 1.9],   target: [0.0, 1.3, -0.9] },  view: { kind: 'look', pitch: [-35 * D, 35 * D] } },
  { id: 'sofa',     label: 'Slide-out bed', camera: { position: [0.35, 1.55, 2.02], target: [-1.0, 0.55, 0.9] }, view: { kind: 'look', pitch: [-45 * D, 30 * D] } },
  { id: 'galley',   label: 'Galley',        camera: { position: [-0.35, 1.6, 2.35], target: [0.85, 0.95, 3.4] }, view: { kind: 'look', pitch: [-40 * D, 30 * D] } },
  { id: 'washroom', label: 'Washroom',      camera: { position: [0.4, 1.6, 2.5],    target: [-0.85, 0.95, 3.5] },view: { kind: 'look', pitch: [-40 * D, 30 * D] } },
  { id: 'cab',      label: 'Cab',           camera: { position: [0.0, 1.05, -0.05], target: [0.0, 0.8, -1.75] }, view: { kind: 'look', pitch: [-30 * D, 30 * D] } },
```

- [ ] **Step 5: Narrow `applyHotspotLimits`**

In `src/camera.ts`, change it to take the orbit branch rather than the whole hotspot:

```ts
type OrbitView = Extract<Hotspot['view'], { kind: 'orbit' }>;

/** Constrain orbiting so the viewer cannot end up inside the vehicle or inside a wall. */
export const applyHotspotLimits = (
  controls: OrbitControls,
  camera: THREE.Camera,
  target: readonly [number, number, number],
  view: OrbitView,
): void => {
  const centreAzimuth = Math.atan2(
    camera.position.x - target[0]!,
    camera.position.z - target[2]!,
  );
  controls.minAzimuthAngle = centreAzimuth + view.azimuth[0]!;
  controls.maxAzimuthAngle = centreAzimuth + view.azimuth[1]!;
  controls.minPolarAngle = view.polar[0]!;
  controls.maxPolarAngle = view.polar[1]!;
  controls.minDistance = view.distance[0]!;
  controls.maxDistance = view.distance[1]!;
  controls.update();
};
```

and in `tweenTo`, replace both `applyHotspotLimits(controls, h)` calls with:

```ts
    if (h.view.kind === 'orbit') applyHotspotLimits(controls, camera, h.camera.target, h.view);
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `pnpm check`
Expected: PASS, TypeScript clean. `ui.test.ts` is unaffected — it reads `id` and `label` only.

- [ ] **Step 7: Commit**

```bash
git add src/data/vehicle.ts src/camera.ts src/camera.test.ts
git commit -m "refactor: split Hotspot into look and orbit views"
```

### Task 8: Look controls

**Files:**
- Create: `src/look.ts`, `src/look.test.ts`
- Modify: `src/scene.ts`, `src/camera.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `Hotspot` from `src/data/vehicle.ts`
- Produces: `headingOf(from, to): { yaw, pitch }`, `clampPitch(p, limits): number`,
  `createLook(camera, dom): LookControls` with `{ enabled, setPitch, aim, update, dispose }`;
  `SceneBundle` gains `look: LookControls`

- [ ] **Step 1: Write the failing test**

Create `src/look.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { headingOf, clampPitch } from './look';

describe('headingOf', () => {
  it('reads a due-rearward heading as zero yaw', () => {
    // The camera looks down -Z by default, so a target at -Z is yaw 0.
    const { yaw, pitch } = headingOf([0, 1.5, 0], [0, 1.5, -1]);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
  });

  it('reads a downward target as negative pitch', () => {
    const { pitch } = headingOf([0, 1.5, 0], [0, 0.5, -1]);
    expect(pitch).toBeLessThan(0);
  });

  it('reads a target to the kerb side as positive yaw', () => {
    const { yaw } = headingOf([0, 1.5, 0], [1, 1.5, 0]);
    expect(yaw).toBeCloseTo(Math.PI / 2);
  });
});

describe('clampPitch', () => {
  it('passes values inside the limits through', () => {
    expect(clampPitch(0.2, [-0.6, 0.6])).toBe(0.2);
  });
  it('clamps both ends', () => {
    expect(clampPitch(-9, [-0.6, 0.6])).toBe(-0.6);
    expect(clampPitch(9, [-0.6, 0.6])).toBe(0.6);
  });
});

describe('look never translates the camera', () => {
  it('leaves position untouched when the orientation changes', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(-0.2, 1.55, 2.6);
    const before = camera.position.clone();
    camera.quaternion.setFromEuler(new THREE.Euler(0.3, 1.2, 0, 'YXZ'));
    expect(camera.position.equals(before)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/look.test.ts`
Expected: FAIL, cannot resolve `./look`.

- [ ] **Step 3: Write `src/look.ts`**

```ts
import * as THREE from 'three';

/**
 * Yaw and pitch about a fixed eye point.
 *
 * OrbitControls cannot do this job. It swings the camera around a target at a radius, and the
 * habitation box is 2.36 m wide, so a full turn at any useful radius puts the camera through a
 * wall. Look mode leaves the eye where the hotspot put it and only turns the head.
 */

export interface Heading {
  readonly yaw: number;
  readonly pitch: number;
}

/** Yaw/pitch that points a default -Z camera at `to` from `from`. YXZ order. */
export const headingOf = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): Heading => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return {
    yaw: Math.atan2(dx, -dz),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
  };
};

export const clampPitch = (pitch: number, limits: readonly [number, number]): number =>
  pitch < limits[0] ? limits[0] : pitch > limits[1] ? limits[1] : pitch;

export interface LookControls {
  enabled: boolean;
  /** Point at a world position and adopt that as the new centre. */
  aim(from: readonly [number, number, number], to: readonly [number, number, number]): void;
  setPitch(limits: readonly [number, number]): void;
  update(): void;
  dispose(): void;
}

const SPEED = 0.0026; // radians per pixel of drag

export const createLook = (
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
): LookControls => {
  let yaw = 0;
  let pitch = 0;
  let pitchLimits: readonly [number, number] = [-Math.PI / 3, Math.PI / 3];
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let dirty = true;

  const controls: LookControls = {
    enabled: false,
    aim(from, to) {
      const h = headingOf(from, to);
      yaw = h.yaw;
      pitch = clampPitch(h.pitch, pitchLimits);
      dirty = true;
    },
    setPitch(limits) {
      pitchLimits = limits;
      pitch = clampPitch(pitch, pitchLimits);
      dirty = true;
    },
    update() {
      if (!dirty) return;
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      dirty = false;
    },
    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
    },
  };

  function onDown(e: PointerEvent) {
    if (!controls.enabled) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dom.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!dragging || !controls.enabled) return;
    // Drag left to look left: the world should follow the pointer.
    yaw -= (e.clientX - lastX) * SPEED;
    pitch = clampPitch(pitch + (e.clientY - lastY) * SPEED, pitchLimits);
    lastX = e.clientX;
    lastY = e.clientY;
    dirty = true;
  }

  function onUp(e: PointerEvent) {
    dragging = false;
    if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
  }

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);

  return controls;
};
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `pnpm exec vitest run src/look.test.ts`
Expected: PASS.

- [ ] **Step 5: Give `SceneBundle` both controllers**

In `src/scene.ts`, add the import and the field:

```ts
import { createLook, type LookControls } from './look';
```

```ts
export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  look: LookControls;
  render: () => void;
}
```

Create it after `controls`, and update `render` so exactly one controller drives the camera:

```ts
  const look = createLook(camera, renderer.domElement);

  const render = () => {
    if (look.enabled) look.update();
    else controls.update();
    renderer.render(scene, camera);
  };
```

and return `{ scene, camera, renderer, controls, look, render }`.

- [ ] **Step 6: Switch modes in `tweenTo`**

In `src/camera.ts`, both the zero-duration branch and the promise's completion branch end by
enabling one controller. Replace the zero-duration branch's tail:

```ts
  if (ms <= 0) {
    camera.position.set(...(h.camera.position as [number, number, number]));
    controls.target.set(...(h.camera.target as [number, number, number]));
    arrive(bundle, h);
    return Promise.resolve();
  }
```

and the completion branch's tail with `arrive(bundle, h);`, then add above `tweenTo`:

```ts
/** Hand the camera to whichever controller this hotspot's view calls for. */
const arrive = (bundle: SceneBundle, h: Hotspot): void => {
  const { camera, controls, look } = bundle;
  if (h.view.kind === 'look') {
    controls.enabled = false;
    look.enabled = true;
    look.setPitch(h.view.pitch);
    look.aim(h.camera.position, h.camera.target);
    look.update();
  } else {
    look.enabled = false;
    controls.enabled = true;
    applyHotspotLimits(controls, camera, h.camera.target, h.view);
  }
};
```

Also set `look.enabled = false` alongside `controls.enabled = false` at the top of `tweenTo`, so
neither controller fights the flight.

- [ ] **Step 7: Run the whole suite**

Run: `pnpm check`
Expected: PASS. `camera.test.ts`'s `bundle()` stub needs a `look` member; add one:

```ts
    const look = {
      enabled: false,
      aim: () => {}, setPitch: () => {}, update: () => {}, dispose: () => {},
    };
    return { camera, controls, look } as unknown as SceneBundle;
```

- [ ] **Step 8: Check it in the browser**

Run `pnpm dev`. At every zone button, drag a full turn. Confirm the camera never leaves its eye
point, the pitch stops before the viewer can look straight up or down, and moving between zones
still tweens.

- [ ] **Step 9: Commit**

```bash
git add src/look.ts src/look.test.ts src/scene.ts src/camera.ts src/camera.test.ts src/main.ts
git commit -m "feat: free look in place at every interior stop"
```

---

## Phase D — Model corrections

Each task here is one Blender collection, regenerated, re-baked, re-exported and committed on its
own, matching the per-collection rhythm the parent plan established.

**The cycle every task in this phase ends with:**

```bash
pnpm exec npm run model -- <collection>
pnpm exec npm run bake
pnpm exec npm run check:blend
pnpm exec npm run export && pnpm exec npm run optimize
pnpm exec npm run check:models && pnpm exec npm run budget
```

### Task 9: Ceiling band and cove — `shell`

Spec row 3, and the highest-value geometry change in the phase: the ceiling fills roughly a third
of every wide shot and is currently flat cream against a photograph that is banded walnut.

**Files:**
- Modify: `tools/model_interior.py` (`build_shell`)

**Interfaces:**
- Consumes: `box()`, `wall()`, `finish()`, `placement()` from `tools/model_interior.py`
- Produces: three new named meshes inside the `shell` collection: `ceiling_band`,
  `ceiling_cove_off`, `ceiling_cove_kerb`. No new placements — all three sit inside the existing
  `ceiling` placement box.

- [ ] **Step 1: Read the reference**

Open `docs/research/reference/interior-lounge-and-overcab.jpg`. The ceiling is a walnut centre
band running the full length, roughly the middle 1000 mm of the 2360 mm width, with cream to
either side, a stepped recess at each cream-to-wall junction carrying the LED strip, and a
dark-surround roof hatch punched through the band.

- [ ] **Step 2: Add the geometry**

In `build_shell()`, after the existing ceiling is created, append. Blender frame: X lateral,
Y rearward, Z up, metres.

```python
    # Walnut centre band. The reference ceiling is banded, not flat cream; this is the single
    # largest surface the eye reads in every wide shot.
    box('ceiling_band', (0, 2.025, 1.985), (1.0, 4.05, .03), 'wood.trim', bevel=.004)

    # Stepped cove recesses at both cream-to-wall junctions, each carrying its LED strip.
    for side, x in (('off', -.86), ('kerb', .86)):
        box(f'ceiling_cove_{side}', (x, 2.025, 1.955), (.10, 4.05, .07), 'panel.wall', bevel=.004)
        box(f'cove_strip_{side}_band', (x, 2.025, 1.925), (.04, 4.02, .012), 'led.cove', bevel=0)
```

- [ ] **Step 3: Regenerate and check**

Run the phase cycle above with `<collection>` = `shell`.
Expected: `SAVED_MODEL_CHECK_PASS`, `check:models` passes, budget holds.

- [ ] **Step 4: Compare against the reference**

Run `pnpm dev`, go to Lounge, look up. The band should read as a walnut spine with cream
shoulders and a glowing edge, matching `interior-lounge-and-overcab.jpg`. Save a screenshot to
`docs/research/corrected/ceiling.png`.

- [ ] **Step 5: Commit**

```bash
git add tools/model_interior.py model/rv.blend public/models/shell.glb dist/raw/shell.glb \
        model/ao-bake.json model/verification.json docs/research/corrected
git commit -m "feat: band the ceiling in walnut with stepped LED coves"
```

### Task 10: Lockers, table and sofa — `lockers`, `dinette`, `sofa_slideout`

Spec rows 4, 5 and 6. Three collections, one task: they share the walnut-frame treatment and are
each a small change.

**Files:**
- Modify: `tools/model_furniture.py` (`build_lockers`, `build_dinette`, `build_sofa_slideout`)

**Interfaces:**
- Consumes: `_chair()`, `box()`, `cylinder()`, `group()` from the existing modules
- Produces: no new placements. New child meshes: `locker_frame_off`, `locker_frame_kerb`,
  `dinette_table_edge`, `dinette_table_pedestal`, `slideout_back`.

- [ ] **Step 1: Frame the locker doors**

The photographs show cream gloss doors set into a walnut frame with an LED strip below, not the
plain cream boxes currently modelled. In `build_lockers`, wrap each locker run:

```python
    # Walnut surround, inset cream doors: the reference lockers read as framed, not as boxes.
    for side, x in (('off', -1.055), ('kerb', 1.055)):
        box(f'locker_frame_{side}', (x, 1.10, 1.625), (.19, 1.90, .45), 'wood.cabinet', bevel=.006)
        box(f'locker_strip_{side}', (x - .01, 1.10, 1.395), (.10, 1.86, .010), 'led.cove', bevel=0)
```

- [ ] **Step 2: Give the table its edge band and pedestal**

In `build_dinette`, replace the plain slab with a banded top on a chrome column:

```python
    box('dinette_table_edge', (.61, .99, .715), (.98, .70, .022), 'wood.trim', bevel=.008)
    cylinder('dinette_table_pedestal', (.61, .99, .36), .038, .72, 'metal.chrome')
```

- [ ] **Step 3: Give the sofa its back cushion**

The deployed slide-out is a bed, but the reference shows it keeping a back cushion against the
outboard wall. In `build_sofa_slideout`:

```python
    box('slideout_back', (-1.66, 1.10, .74), (.12, 1.86, .28), 'upholstery.sofa', bevel=.03)
```

- [ ] **Step 4: Regenerate all three**

```bash
for c in lockers dinette sofa_slideout; do pnpm exec npm run model -- $c; done
pnpm exec npm run bake && pnpm exec npm run check:blend
pnpm exec npm run export && pnpm exec npm run optimize
pnpm exec npm run check:models && pnpm exec npm run budget
```

- [ ] **Step 5: Confirm the dimensional checks still hold**

Run: `pnpm check`
Expected: PASS. `slideout_back` sits inside the `slideout` volume and must not push
`slideout_bed` off its published 1280 x 1900.

- [ ] **Step 6: Commit**

```bash
git add tools/model_furniture.py model/rv.blend public/models dist/raw \
        model/ao-bake.json model/verification.json
git commit -m "feat: frame the lockers, band the table, give the sofa its back"
```

### Task 11: Galley layout — `galley`

Spec row 7. The photograph puts the square stainless bowl at the aisle end with a window above
the counter; the model has an oval bowl and the sink and hob swapped.

**Files:**
- Modify: `tools/model_furniture.py` (`build_galley`), `tools/model_interior.py` (`window`)

**Interfaces:**
- Consumes: `bowl()`, `box()`, `tube()`, `window()`
- Produces: no new placements. `galley_sink` moves and becomes rectangular; a new
  `window_galley` aperture is added to `wall_kerb`.

- [ ] **Step 1: Swap sink and hob along the run**

`galley_run` spans Z 2550 to 4050 mm, kerb side. In `build_galley`, put the sink at the aisle
(low-Z) end and the hob at the rear:

```python
    # Reference: square stainless bowl nearest the aisle, induction hob at the rear, so the
    # cook faces the window rather than the rear wall.
    box('galley_sink', (.86, 2.86, .862), (.40, .40, .10), 'metal.brushed', bevel=.012)
    box('galley_hob',  (.86, 3.62, .906), (.52, .34, .012), 'metal.dark',   bevel=.004)
```

- [ ] **Step 2: Cut the counter window**

Add to the `wall_kerb` hole list in `build_shell()`, then regenerate `shell` too:

```python
    window('window_galley', 1.15, 1.28, 3.10, .62, .42)
```

- [ ] **Step 3: Regenerate both collections**

```bash
pnpm exec npm run model -- shell && pnpm exec npm run model -- galley
pnpm exec npm run bake && pnpm exec npm run check:blend
```

- [ ] **Step 4: Add the aperture ray to `check_blend.py`**

The existing aperture rays prove the glazing is actually cut. Add the new one to the list at
`tools/check_blend.py:24`:

```python
                          ((.9, 1.28, 3.10), (1, 0, 0)),
```

Run: `pnpm exec npm run check:blend`
Expected: an `APERTURE` line for the new origin reporting `role.glass`.

- [ ] **Step 5: Export and verify**

```bash
pnpm exec npm run export && pnpm exec npm run optimize
pnpm exec npm run check:models && pnpm exec npm run budget && pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add tools/model_furniture.py tools/model_interior.py tools/check_blend.py \
        model/rv.blend public/models dist/raw model/ao-bake.json model/verification.json
git commit -m "feat: rebuild the galley run to the reference layout"
```

### Task 12: Washroom — `washroom`

Spec row 8, and the weakest zone by the parent spec's own admission. The photograph shows a
corner vanity with a mirror cabinet above, ribbed GRP wall panels, a damask shower curtain on a
rail, grab rails and recessed niches. The model has a freestanding pedestal basin and shelves
that project rather than recess.

**Files:**
- Modify: `tools/model_furniture.py` (`build_washroom`)

**Interfaces:**
- Consumes: `bowl()`, `box()`, `tube()`, `cylinder()`
- Produces: no new placements. New meshes `washroom_vanity`, `washroom_mirror_cabinet`,
  `washroom_ribs`, `washroom_curtain`, `washroom_rail`, `washroom_grab`.

- [ ] **Step 1: Move the basin into a corner vanity**

The pod spans X −1150 to −450, Z 2650 to 4050. Put the vanity in the forward-outboard corner:

```python
    box('washroom_vanity', (-.90, 2.86, .40), (.46, .40, .80), 'washroom.shell', bevel=.03)
    bowl('washroom_basin', (-.90, 2.86, .82), (.19, .15), .10, 'washroom.shell')
    box('washroom_mirror_cabinet', (-.90, 2.70, 1.42), (.46, .12, .52), 'washroom.shell', bevel=.02)
```

- [ ] **Step 2: Replace the projecting shelves with recessed niches**

Delete the existing shelf boxes and cut niches into the outboard wall instead, so they read as
mouldings rather than brackets:

```python
    # Recessed, not projecting: the GRP pod is a single moulding, so shelves are formed into it.
    for i, z in enumerate((1.02, 1.30)):
        box(f'washroom_niche_{i}', (-1.10, 3.30, z), (.06, .44, .16), 'washroom.shell', bevel=.012)
```

- [ ] **Step 3: Add ribs, curtain, rail and grab handle**

```python
    box('washroom_ribs', (-1.13, 3.35, 1.00), (.012, .70, 1.60), 'washroom.shell', bevel=.002)
    tube('washroom_rail', [(-1.14, 3.70, 1.86), (-.46, 3.70, 1.86)], .010, 'metal.chrome')
    box('washroom_curtain', (-.80, 3.70, 1.05), (.68, .014, 1.55), 'textile.curtain', bevel=.004)
    tube('washroom_grab', [(-1.13, 3.30, 1.10), (-1.13, 3.62, 1.10)], .012, 'metal.chrome')
```

- [ ] **Step 4: Regenerate and check**

Run the phase cycle with `<collection>` = `washroom`. The existing bowl-normal assertions in
`check_blend.py` reference `washroom_pod` at two points; if the basin moved out from under either
sample point, update those coordinates rather than deleting the check.

- [ ] **Step 5: Compare against the reference**

Open `docs/research/reference/underseat-drawers-washroom.jpg` beside the Washroom hotspot. Save
to `docs/research/corrected/washroom.png`.

- [ ] **Step 6: Commit**

```bash
git add tools/model_furniture.py tools/check_blend.py model/rv.blend public/models dist/raw \
        model/ao-bake.json model/verification.json docs/research/corrected
git commit -m "feat: rebuild the washroom with a corner vanity, ribbed shell and curtain"
```

### Task 13: Cab — `cab`

Spec row 9, and one of the two candidates for cutting if the phase runs long. The parent spec's
non-goal said "seat shells and a blocked-in dash"; this widens it to a dash, wheel and engine
tunnel, which is what the photographs show between the seats.

**Files:**
- Modify: `tools/model_furniture.py` (`build_cab`)

**Interfaces:**
- Consumes: `box()`, `cylinder()`, `tube()`
- Produces: no new placements. New meshes `cab_tunnel`, `cab_dash_binnacle`, `cab_wheel_rim`,
  `cab_wheel_hub`.

- [ ] **Step 1: Add the engine tunnel**

The photographs show a black-clad tunnel rising between the two cab seats, which is why the cab
render currently reads as an empty white void:

```python
    box('cab_tunnel', (0, -1.30, .28), (.52, 1.20, .56), 'metal.dark', bevel=.04)
```

- [ ] **Step 2: Add the binnacle and wheel**

Left-hand drive, so the wheel is on the off side:

```python
    box('cab_dash_binnacle', (-.62, -1.78, .96), (.62, .26, .22), 'metal.dark', bevel=.03)
    cylinder('cab_wheel_rim', (-.62, -1.62, .88), .185, .028, 'metal.dark', rotation=(1.15, 0, 0))
    cylinder('cab_wheel_hub', (-.62, -1.62, .88), .062, .050, 'metal.dark', rotation=(1.15, 0, 0))
```

- [ ] **Step 3: Regenerate and check**

Run the phase cycle with `<collection>` = `cab`.

- [ ] **Step 4: Confirm the cab camera still stands in free space**

Run: `pnpm exec vitest run src/camera.test.ts`
Expected: PASS. The cab hotspot sits at `[0, 1.05, -0.05]`; `cab_tunnel` reaches Z 0.56 m in
Blender's frame. If the test now reports the cab camera inside a placement, move the hotspot
rather than shrinking the geometry.

- [ ] **Step 5: Commit**

```bash
git add tools/model_furniture.py model/rv.blend public/models dist/raw \
        model/ao-bake.json model/verification.json
git commit -m "feat: give the cab a dash, wheel and engine tunnel"
```

### Task 14: Props and decals — `softgoods`

Spec row 10. The entry door, the appliances, and the flat graphics that make the reference shots
read as a lived-in vehicle rather than a showroom shell.

**Files:**
- Modify: `tools/model_furniture.py` (`build_softgoods`), `src/data/vehicle.ts`,
  `src/data/finishes.ts`

**Interfaces:**
- Consumes: `box()`, `_pleat()`, `TextureSpec` from Task 5
- Produces: two new roles `graphic.print` and `graphic.screen`; four new placements
  `entry_door`, `washer`, `oven`, `systems_panel`

- [ ] **Step 1: Add the two graphic roles**

In `src/data/finishes.ts`, extend the `Role` union with `'graphic.print' | 'graphic.screen'` and
add the entries. Both are decal-flat, so both carry a map and `transparent`:

```ts
  'graphic.print':  one('photo-wall', 'Photo wall', {
    color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true,
    map: { url: '/textures/photo-wall.webp' },
  }),
  'graphic.screen': one('systems', 'Systems panel', {
    color: 0x101418, roughness: 0.2, metalness: 0,
    emissive: 0x3a6ea8, emissiveIntensity: 2.2,
    map: { url: '/textures/systems-panel.webp' },
  }),
```

- [ ] **Step 2: Add the four placements**

In `src/data/vehicle.ts`, in the `storage` and `galley` zones:

```ts
  // Kerb side, immediately forward of the galley run: the reference shows the entry door and
  // the galley sharing a side, which is what settles the handedness question.
  { id: 'entry_door',    zone: 'galley', origin: [e(1080), e(0), e(2350)],  size: [e(70), e(1850), e(650)], movable: false },
  { id: 'washer',        zone: 'galley', origin: [e(600), e(0), e(3550)],   size: [e(550), e(850), e(500)], movable: false },
  { id: 'oven',          zone: 'galley', origin: [e(600), e(1350), e(2600)],size: [e(500), e(400), e(450)], movable: false },
  { id: 'systems_panel', zone: 'galley', origin: [e(1100), e(1500), e(2700)],size: [e(30), e(180), e(260)], movable: false },
```

- [ ] **Step 3: Run the dimensional checks and fix any overlap**

Run: `pnpm check`
Expected: FAIL if any of the four overlaps `galley_run` or `galley_overhead`. `galley_run` spans
X 550–1150, Z 2550–4050; `galley_overhead` spans X 550–1150, Y 1350–1800, Z 2550–4050. Adjust the
new origins until `checkAll` is clean, and do not move `galley_run`.

- [ ] **Step 4: Model them**

In `build_softgoods`:

```python
    box('entry_door',    (1.115, 2.675, .925), (.07, .65, 1.85), 'panel.wall',     bevel=.01)
    box('washer',        (.875, 3.80, .425),   (.55, .50, .85),  'metal.brushed',  bevel=.02)
    box('oven',          (.850, 2.825, 1.55),  (.50, .45, .40),  'metal.dark',     bevel=.015)
    box('systems_panel', (1.115, 2.79, 1.63),  (.03, .26, .18),  'graphic.screen', bevel=.004)
```

- [ ] **Step 5: Add the decal planes**

Thin boxes carrying `graphic.print`, positioned from the photographs: the galley photo wall, the
alcove framed pictures, the washroom photo wall:

```python
    for name, x, y, z, w, h in (('decal_galley_wall', 1.13, 3.05, 1.45, .30, .34),
                                ('decal_alcove_off', -1.16, -.90, 1.68, .22, .28),
                                ('decal_alcove_kerb', 1.16, -.90, 1.68, .22, .28)):
        box(name, (x, y, z), (.006, w, h), 'graphic.print', bevel=0)
```

- [ ] **Step 6: Author the two decal maps**

Add `photo-wall` and `systems-panel` entries to `model/textures.json`, sourced from
`docs/research/reference/galley-detail.jpg`. These are flat and non-tiling, so set
`"flatField": 0` to skip illumination correction — the source is already close to frontal.

Run: `pnpm exec npm run textures photo-wall systems-panel`

- [ ] **Step 7: Regenerate, export and check**

Run the phase cycle with `<collection>` = `softgoods`. `check_blend.py:2` asserts
`len([m for m in bpy.data.materials if m.name.startswith('role.')]) == 17`; raise it to 19.

- [ ] **Step 8: Count the draw calls**

Run `pnpm dev`, open `?verify`, and read `canvas.dataset.drawCalls` at every interior hotspot.
Expected: ≤ 40. If any zone exceeds it, merge the decal planes for that zone into a single mesh
sharing one atlas before continuing.

- [ ] **Step 9: Commit**

```bash
git add tools/model_furniture.py tools/check_blend.py src/data/vehicle.ts src/data/finishes.ts \
        model/textures.json public/textures model/rv.blend public/models dist/raw \
        model/ao-bake.json model/verification.json
git commit -m "feat: add the entry door, appliances and photo decals"
```

---

## Phase E — Exterior

### Task 15: Exterior data and check widening

Data and tests only. No Blender, so the geometry it describes can be validated before any is
built.

**Files:**
- Modify: `src/data/vehicle.ts`, `src/check.ts:21`, `src/check.test.ts`,
  `src/data/placements.test.ts`

**Interfaces:**
- Consumes: `ENVELOPE`
- Produces: `ZoneId` gains `'exterior'`; nine exterior placements; `check.ts` excludes them
  alongside `shell`

- [ ] **Step 1: Write the failing test**

Append to `src/data/placements.test.ts`:

```ts
import { ENVELOPE, PLACEMENTS, aabb } from './vehicle';

describe('exterior', () => {
  const exterior = PLACEMENTS.filter((p) => p.zone === 'exterior');

  it('models the body, the slide-out box, four wheels and the skirt', () => {
    expect(exterior.map((p) => p.id).sort()).toEqual([
      'body_alcove', 'body_cab', 'body_habitation', 'skirt', 'slideout_box',
      'wheel_front_kerb', 'wheel_front_off', 'wheel_rear_kerb', 'wheel_rear_off',
    ]);
  });

  it('reproduces the published envelope exactly', () => {
    // The slide-out is deployed, and 2450 mm is the RETRACTED width, so it is excluded here.
    const body = exterior.filter((p) => p.id !== 'slideout_box').map(aabb);
    const min = (i: number) => Math.min(...body.map((b) => b.min[i]!));
    const max = (i: number) => Math.max(...body.map((b) => b.max[i]!));

    expect(max(0) - min(0)).toBe(ENVELOPE.overallWidth!.v);   // 2450
    expect(max(2) - min(2)).toBe(ENVELOPE.overallLength!.v);  // 5998
    // Height is measured from the ground, which sits floorAboveGround below the origin.
    expect(max(1) + ENVELOPE.floorAboveGround!.v).toBe(ENVELOPE.overallHeight!.v); // 3200
  });

  it('puts the wheels on the published axle lines', () => {
    const centre = (id: string) => {
      const b = aabb(PLACEMENTS.find((p) => p.id === id)!);
      return (b.min[2]! + b.max[2]!) / 2;
    };
    const front = -ENVELOPE.cabDepth!.v + ENVELOPE.frontAxleFromNose!.v;
    expect(centre('wheel_front_off')).toBe(front);
    expect(centre('wheel_rear_off')).toBe(front + ENVELOPE.wheelbase!.v);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/data/placements.test.ts`
Expected: FAIL — no placement has zone `exterior`.

- [ ] **Step 3: Add the zone and the placements**

In `src/data/vehicle.ts`, extend `ZoneId` with `| 'exterior'` and append:

```ts
  // --- exterior. Every value derives from ENVELOPE, so the published envelope becomes
  // verifiable geometry. Excluded from overlap and containment checks: the body encloses
  // everything by design, exactly as the shell does.
  // Cab body is narrower than the habitation box and its roof line is read off the hero shot,
  // so its X and Y origins are estimates. Everything traceable to ENVELOPE is derived.
  { id: 'body_cab',         zone: 'exterior', origin: [e(-1100), e(-400),  d(-1948)], size: [e(2200), d(1750), d(1948)], movable: false },
  { id: 'body_alcove',      zone: 'exterior', origin: [d(-1225), e(1350),  d(-1948)], size: [d(2450), d(800),  d(1948)], movable: false },
  { id: 'body_habitation',  zone: 'exterior', origin: [d(-1225), e(-400),  d(0)],     size: [d(2450), d(2550), d(4050)], movable: false },
  { id: 'skirt',            zone: 'exterior', origin: [d(-1225), e(-700),  d(0)],     size: [d(2450), d(300),  d(4050)], movable: false },
  { id: 'slideout_box',     zone: 'exterior', origin: [d(-1805), e(0),     e(150)],   size: [d(580),  e(1300), e(1900)], movable: false },
  { id: 'wheel_front_off',  zone: 'exterior', origin: [e(-988),  d(-1050), d(-1270)], size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_front_kerb', zone: 'exterior', origin: [e(763),   d(-1050), d(-1270)], size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_rear_off',   zone: 'exterior', origin: [e(-988),  d(-1050), d(2030)],  size: [e(225),  e(744),  e(744)],  movable: false },
  { id: 'wheel_rear_kerb',  zone: 'exterior', origin: [e(763),   d(-1050), d(2030)],  size: [e(225),  e(744),  e(744)],  movable: false },
```

Three new estimates, and no more: the 400 mm double floor below the habitation floor, the
1350 mm cab roof line, and a 372 mm wheel radius from a 225/75R16 on the Daily 4.5 t. Sizes
computed from those estimates are tagged `derived`, matching how `habLength` is already derived
from an estimated `cabDepth`. Nothing here touches a published dimension.

- [ ] **Step 4: Widen the check exclusion**

In `src/check.ts`, replace line 21 and the two casts below it:

```ts
/** Zones the integrity checks skip: both enclose the furniture rather than sit beside it. */
const ENCLOSURES = new Set<ZoneId>(['shell', 'exterior']);
type FurnitureZone = Exclude<ZoneId, 'shell' | 'exterior'>;

const furniture = (ps: readonly Placement[]) => ps.filter((p) => !ENCLOSURES.has(p.zone));

const volumeOf = (zone: ZoneId) => VOLUMES[ZONE_VOLUME[zone as FurnitureZone]];
```

and the containment message's cast:

```ts
        detail: `${p.id} leaves its ${ZONE_VOLUME[p.zone as FurnitureZone]} volume`,
```

In `src/data/vehicle.ts`, widen `ZONE_VOLUME`'s type to
`Record<Exclude<ZoneId, 'shell' | 'exterior'>, VolumeId>`.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `pnpm check`
Expected: PASS. The aisle check must be unchanged at 520 mm — the exterior placements straddle
the centreline and would return 0 if the exclusion were wrong. `check.test.ts` already asserts
the aisle width; confirm it still does.

- [ ] **Step 6: Confirm the grey-box still builds**

`src/greybox.ts` renders every placement as a box. Nine exterior boxes will now appear, hiding
the interior. Add the same exclusion there:

```ts
  for (const p of PLACEMENTS) {
    if (p.zone === 'exterior') continue; // the grey-box is an interior debug view
```

- [ ] **Step 7: Commit**

```bash
git add src/data/vehicle.ts src/check.ts src/greybox.ts src/data/placements.test.ts
git commit -m "feat: add exterior placements derived from the published envelope"
```

### Task 16: The exterior collection

**Files:**
- Create: `tools/model_exterior.py`
- Modify: `tools/model_interior.py` (dispatch), `tools/export_modules.py:16`,
  `tools/check_blend.py:2`, `src/loader.ts:9`, `tools/check_models.mjs`

**Interfaces:**
- Consumes: `box()`, `cylinder()`, `placement()`, `finish()` from `tools/model_interior.py`
- Produces: a tenth collection `exterior` containing all nine exterior nodes; four new roles
  `body.paint`, `body.graphic`, `tyre`, `wheel`

- [ ] **Step 1: Add the four roles**

In `src/data/finishes.ts`, extend `Role` and add:

```ts
  'body.paint':   one('white-grp', 'White GRP', { color: 0xf2f3f2, roughness: 0.35, metalness: 0 }),
  'body.graphic': one('side-decal', 'Side decal', {
    color: 0xffffff, roughness: 0.4, metalness: 0, transparent: true,
    map: { url: '/textures/side-graphic.webp' },
  }),
  'tyre':         one('rubber', 'Rubber', { color: 0x1a1a1c, roughness: 0.9, metalness: 0 }),
  'wheel':        one('alloy', 'Alloy', { color: 0xa8acb0, roughness: 0.3, metalness: 1 }),
```

Also add the matching materials to the Blender palette so `export_modules.py`'s naming check
passes, and raise `check_blend.py:2`'s material count from 19 to 23 and its collection count from
9 to 10.

- [ ] **Step 2: Write `tools/model_exterior.py`**

```python
"""The tenth collection: the outside of the vehicle.

Every dimension comes from the exterior placements in model/placements.json, which in turn
derive from ENVELOPE. Nothing here is measured independently, so the exterior cannot drift
away from the published envelope.

Blender frame: X lateral (+X kerb), Y rearward, Z up, metres.
"""
from model_interior import box, cylinder, placement, finish


def build_exterior(a):
    # Body masses. The FRP alcove moulding overhangs the cab to full width, which is the
    # shape that makes a C-type read as a C-type from outside.
    for name in ('body_cab', 'body_alcove', 'body_habitation'):
        p = placement(name)
        box(name, p['center'], p['size'], 'body.paint', bevel=.06)

    p = placement('skirt')
    box('skirt', p['center'], p['size'], 'metal.dark', bevel=.02)

    p = placement('slideout_box')
    box('slideout_box', p['center'], p['size'], 'body.paint', bevel=.04)

    # Wheels: a rubber cylinder with an alloy face, lying on its side (rotated about Y so the
    # axis runs across the vehicle).
    for name in ('wheel_front_off', 'wheel_front_kerb', 'wheel_rear_off', 'wheel_rear_kerb'):
        p = placement(name)
        cx, cy, cz = p['center']
        cylinder(name, (cx, cy, cz), .372, .225, 'tyre', rotation=(0, 1.5708, 0))
        inboard = -.06 if 'off' in name else .06
        cylinder(name + '_face', (cx + inboard, cy, cz), .225, .120, 'wheel',
                 rotation=(0, 1.5708, 0))

    # Side graphic as a decal plane just proud of the body, one per flank.
    for side, x in (('off', -1.226), ('kerb', 1.226)):
        box(f'body_graphic_{side}', (x, 2.0, .95), (.004, 3.4, .70), 'body.graphic', bevel=0)
```

- [ ] **Step 3: Register the collection**

In `tools/model_interior.py`'s `main()` dispatch, add `exterior` alongside the existing builders,
importing `build_exterior` from the new module. Add `'exterior'` to `MODULES` in
`tools/export_modules.py:16` and to `MODULE_NAMES` in `src/loader.ts:9`.

- [ ] **Step 4: Build, bake and export**

```bash
pnpm exec npm run model -- exterior
pnpm exec npm run bake && pnpm exec npm run check:blend
pnpm exec npm run export && pnpm exec npm run optimize
```

- [ ] **Step 5: Assert the envelope in `check_models.mjs`**

Add, alongside the existing world-bounds checks:

```js
// The published envelope, now verifiable geometry. slideout_box is excluded: 2450 mm is the
// retracted width, and this vehicle is modelled deployed.
const EXTERIOR = ['body_cab', 'body_alcove', 'body_habitation', 'skirt',
                  'wheel_front_off', 'wheel_front_kerb', 'wheel_rear_off', 'wheel_rear_kerb'];
const boxes = EXTERIOR.map((id) => worldBounds(id));
const span = (i) => Math.max(...boxes.map((b) => b.max[i])) - Math.min(...boxes.map((b) => b.min[i]));
assert.ok(Math.abs(span(0) - 2.450) < 0.001, `width ${span(0)}`);
assert.ok(Math.abs(span(2) - 5.998) < 0.001, `length ${span(2)}`);
const roof = Math.max(...boxes.map((b) => b.max[1]));
assert.ok(Math.abs(roof + 1.050 - 3.200) < 0.001, `height ${roof + 1.050}`);
```

Reuse whatever the file already calls its world-bounds helper; if it is inlined rather than
named, extract it first so both call sites share one implementation.

- [ ] **Step 6: Run every check**

```bash
pnpm exec npm run check:models && pnpm exec npm run budget && pnpm check
```
Expected: all pass. `bindPlacements` now binds 38 nodes rather than 25, and it only enforces the
contract once every module is present — so the exterior `.glb` and the exterior placements from
Task 15 must both be in place, which they are.

- [ ] **Step 7: Commit**

```bash
git add tools/model_exterior.py tools/model_interior.py tools/export_modules.py \
        tools/check_blend.py tools/check_models.mjs src/loader.ts src/data/finishes.ts \
        model/rv.blend model/textures.json public/textures public/models dist/raw \
        model/ao-bake.json model/verification.json
git commit -m "feat: model the exterior from the published envelope"
```

### Task 17: Ground, sky, the exterior stop, and the probe trap

**Files:**
- Modify: `src/scene.ts`, `src/lighting.ts`, `src/data/vehicle.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `installLighting(scene, renderer, vehicle)` from `src/lighting.ts`
- Produces: `installLighting(scene, renderer, vehicle, exterior?)`; a seventh hotspot
  `{ id: 'exterior', view: { kind: 'orbit', ... } }`

- [ ] **Step 1: Write the failing test**

Append to `src/camera.test.ts`:

```ts
describe('the exterior stop', () => {
  const exterior = HOTSPOTS.find((h) => h.id === 'exterior');

  it('exists and orbits', () => {
    expect(exterior?.view.kind).toBe('orbit');
  });

  it('stands outside the body at every point of its orbit', () => {
    // Nearest body face is 1.225 m from the centreline; the ring must clear it.
    if (exterior?.view.kind !== 'orbit') throw new Error('exterior must orbit');
    expect(exterior.view.distance[0]).toBeGreaterThan(1.225);
  });

  it('never looks up from below the ground plane', () => {
    if (exterior?.view.kind !== 'orbit') throw new Error('exterior must orbit');
    expect(exterior.view.polar[1]).toBeLessThanOrEqual(Math.PI / 2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/camera.test.ts`
Expected: FAIL — no hotspot has id `exterior`.

- [ ] **Step 3: Add the hotspot**

`ZoneId` already gained `'exterior'` in Task 15. Append to `HOTSPOTS`:

```ts
  {
    // Three-quarter front, kerb side, matching the brochure hero shot. Target sits at the
    // body's mid-height so the vehicle fills the frame without tipping.
    id: 'exterior',
    label: 'Exterior',
    camera: { position: [6.4, 1.6, -5.2], target: [0.0, 0.5, 1.0] },
    view: {
      kind: 'orbit',
      azimuth: [-Math.PI, Math.PI],
      polar: [55 * D, 88 * D],
      distance: [6.0, 14.0],
    },
  },
```

- [ ] **Step 4: Hold the exterior out of the probe capture**

`installLighting` renders a cubemap from inside the cabin. Wrap that cabin in an opaque body and
the daylight background stops reaching the windows, so the interior darkens for no visible
reason. In `src/lighting.ts`, change the signature and the refresh:

```ts
export const installLighting = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  vehicle: THREE.Object3D,
  /** Held out of the probe capture: an opaque body around the cabin would black it out. */
  exterior?: THREE.Object3D,
) => {
```

```ts
  const refreshProbe = () => {
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    const wasVisible = exterior?.visible ?? false;
    if (exterior) exterior.visible = false;
    scene.environment = null;
    probeCamera.update(renderer, scene);
    if (exterior) exterior.visible = wasVisible;
    scene.environment = cubeTarget.texture;
    scene.environmentIntensity = 2.5;
  };
```

Toggling visibility rather than juggling render layers is deliberate: `CubeCamera` holds six
child cameras, and setting layers on the parent does not propagate to all of them.

- [ ] **Step 5: Find the exterior group in `main.ts` and pass it**

The exterior arrives as one of the loaded modules, so it is a child of `vehicle`:

```ts
const exterior = vehicle.getObjectByName('exterior') ?? undefined;
```

```ts
  ({ refreshProbe } = installLighting(bundle.scene, bundle.renderer, vehicle, exterior));
```

If the exported group is not named `exterior`, read the actual name from
`console.log(vehicle.children.map((c) => c.name))` and use that; do not rename the collection.

- [ ] **Step 6: Add the ground and sky**

In `src/scene.ts`, after `scene.background`:

```ts
  // The world outside, so the exterior stop has something to stand on and the glazing has
  // something to reflect. The parent spec records both as known gaps.
  const sky = new THREE.HemisphereLight(0xdcecff, 0x6a6257, 0.6);
  scene.add(sky);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x6f7276, roughness: 0.95 }),
  );
  ground.position.y = -1.05; // floorAboveGround, in metres
  ground.receiveShadow = true;
  scene.add(ground);
```

- [ ] **Step 7: Run everything and check the interior did not darken**

```bash
pnpm check
pnpm dev
```
Open `?calibrate` and confirm every patch still passes at the Task 2 threshold. If the interior
darkened, the probe is still seeing the exterior — check that step 5 found the right group.

- [ ] **Step 8: Check the exterior stop by eye and by count**

Click Exterior. Drag a full circle. Compare against
`docs/research/reference/exterior-hero.jpg`. Read `?verify`'s `drawCalls` at the exterior stop.
Expected: ≤ 60. Save the render to `docs/research/corrected/exterior.png`.

- [ ] **Step 9: Commit**

```bash
git add src/scene.ts src/lighting.ts src/data/vehicle.ts src/camera.test.ts src/main.ts \
        docs/research/corrected
git commit -m "feat: add the exterior stop, ground, sky and probe exclusion"
```

---

## Phase F — Verification

### Task 18: Full verification pass and documentation

**Files:**
- Modify: `docs/specs/design_rv-photoref-360-exterior.md`, `docs/specs/plan_rv-photoref-360-exterior.md`,
  `CLAUDE.md`
- Create: `docs/research/final/`

**Interfaces:**
- Consumes: everything above
- Produces: the recorded results table

- [ ] **Step 1: Run every automated check**

```bash
pnpm check
pnpm exec npm run check:blend
pnpm exec npm run check:models
pnpm exec npm run budget
pnpm exec npm run build
node --test tools/rectify_textures.test.mjs
```
Expected: all pass. Record the triangle count, the byte total, and the test count.

- [ ] **Step 2: Record the browser-measured numbers**

With `pnpm dev` and `?verify`, at all seven hotspots, record `drawCalls`, `triangles` and `fps`.
Expected: ≤ 40 draws at the six interior stops, ≤ 60 at the exterior, 60 fps at 1080p.

- [ ] **Step 3: Re-run the calibration**

Open `?calibrate`. Every patch under 0.08 saturation. Paste the table into the spec.

- [ ] **Step 4: Confirm the finish seam still holds, and now changes grain**

Click walnut, oak, ash. Confirm only `wood.cabinet` and `wood.trim` materials change, and that
the grain map changes with the tint. This is the parent spec's shipped proof of the customisation
seam and it must not have regressed.

- [ ] **Step 5: Capture the final comparison set**

Save renders for all seven hotspots to `docs/research/final/`, and place each beside the
reference slice it matches in a short markdown page, `docs/research/final/README.md`.

- [ ] **Step 6: Write the results into the spec**

Add a "Results" section to `docs/specs/design_rv-photoref-360-exterior.md` in the shape the
parent spec uses: one row per §9 verification item, with the measured value and a plain pass or
fail. State explicitly which criteria are still unmet — the mid-range-phone frame rate has never
been measured on hardware and this work does not change that.

- [ ] **Step 7: Update `CLAUDE.md`**

Its "Current state" section says `public/models/` is empty and the app falls back to grey-box
geometry, which stopped being true before this work started. Correct it, add `src/look.ts`,
`src/textures.ts` and `src/calibrate.ts` to the architecture list, add the `textures` script to
the commands block, and note that appearance now lives in the registry rather than in Blender.

- [ ] **Step 8: Commit**

```bash
git add docs/specs docs/research/final CLAUDE.md
git commit -m "docs: record the verification results for the photo-reference pass"
```

---

## Self-Review

**Spec coverage.** Every section of the design maps to at least one task: §2 new evidence →
Tasks 1 and 14 (handedness confirmed by the entry door placement); §3 warm cast → Tasks 1 and 2;
§4 textures → Tasks 3, 4, 5, 6; §5 navigation → Tasks 7 and 8; §6 model corrections rows 1–10 →
Tasks 1, 2, 9, 10, 11, 12, 13, 14; §7 exterior → Tasks 15, 16, 17; §8 budget → Tasks 6, 14, 17,
18; §9 verification → the check steps in every task plus Task 18; §10 phasing → the phase
headings; §11 risks → risk 1 is Task 3's whole purpose, risk 2 is the rectifier's flat-field
stage, risk 5 is Task 14 step 8, risk 6 is Task 17 step 4; §12 open questions → the wheel radius
is tagged `estimated` in Task 15 and the side graphic in Task 16; §13 cut list → Tasks 12 and 13
are the two named, and they sit late in their phase for that reason.

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
is called out in Task 3 step 3 rather than left to be discovered.

**Deliberate gap.** Draw calls are measured in the browser, not asserted by `check_budget.mjs`.
The parent plan has the same gap for the same reason, and this plan does not close it. Task 14
step 8 and Task 18 step 2 make it a recorded observation at a fixed set of viewpoints.
