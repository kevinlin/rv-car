# 无极境500 Interior 3D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the interior of a 大驰 无极境500 C-type motorhome in the browser, close enough to the manufacturer's imagery to stand as a portfolio piece, with layout and finishes held in data so customisation is cheap to add later.

**Architecture:** All geometry truth lives in `src/data/vehicle.ts` as millimetre values tagged with confidence. A grey-box scene built from that data validates proportions before any modelling happens. Blender then produces one `.glb` per module, bound to the data by node name; materials are named by role and resolved at runtime through a registry, which is the seam future customisation writes to. Lighting is real-time — an interior environment probe captured from emissive LED strips does the work a lightmap would, without pinning furniture in place.

**Tech Stack:** TypeScript, Vite, Vitest, Three.js (vanilla, no framework), Blender 5.2.1 LTS with `bpy` export scripting, `@gltf-transform/cli` for Draco + KTX2 optimisation.

**Spec:** [design_rv-interior-3d.md](design_rv-interior-3d.md)
**Evidence:** [../research/2026-09-04-dachi-wujijing-500-reference.md](../research/2026-09-04-dachi-wujijing-500-reference.md)

## Status — 2026-09-05

**67 of 76 steps complete** on branch `feat/interior-3d`. 77 tests passing, `tsc --noEmit` clean,
pipeline verified end to end.

| Tasks | State |
|---|---|
| 1–11 | Complete. Data model, dimensional checks, grey-box gate, export script, budget checker, node binding, finish registry, camera hotspots. |
| 12–13 | **Blocked on modelling.** `model/rv.blend` exists as a generated block-out and the whole pipeline runs against it, but no geometry has been sculpted. See [the Blender guide](guide_rv-blender-modelling.md). |
| 14–15 | Code complete; the two tuning steps need real geometry to tune against. |

The nine open steps: Task 12 steps 1–2, Task 13 steps 1–5, Task 14 step 5 (lighting tuning) and
Task 15 step 5 (success-criteria sweep). Task 13's five steps repeat once per collection, so the
count understates the work: eight collections still need sculpting.

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

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `.gitignore` (modify)
- Test: `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `pnpm test` and `pnpm dev`. Every later task depends on both.

- [x] **Step 1: Write the failing test**

Create `src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('toolchain', () => {
  it('can construct a Three.js vector', () => {
    const v = new THREE.Vector3(1, 2, 3);
    expect(v.length()).toBeCloseTo(Math.sqrt(14));
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run`
Expected: FAIL — no `package.json`, vitest not installed.

- [x] **Step 3: Create the toolchain**

```bash
pnpm init
pnpm add three
pnpm add -D vite vitest typescript @types/three @types/node
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"],
    "outDir": "dist"
  },
  "include": ["src", "tools"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  build: { target: 'es2022' },
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>无极境500 — Interior</title>
    <style>
      html, body { margin: 0; height: 100%; background: #111; overflow: hidden; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `src/main.ts`:

```ts
console.log('无极境500 interior — boot');
```

Add to `package.json` `"scripts"`:

```json
{
  "dev": "vite",
  "build": "vite build",
  "test": "vitest run",
  "check": "vitest run && tsc --noEmit"
}
```

Append to `.gitignore`:

```
node_modules/
dist/
public/models/
model/*.blend1
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS, 1 test.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + typescript + vitest + three"
```

---

## Task 2: Units and confidence tags

**Files:**
- Create: `src/data/units.ts`
- Test: `src/data/units.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Confidence = 'published' | 'derived' | 'estimated'`
  - `interface Mm { v: number; c: Confidence; note?: string }`
  - `mm(v: number, c: Confidence, note?: string): Mm`
  - `toM(d: Mm): number`
  - `toMTriple(t: readonly [Mm, Mm, Mm]): [number, number, number]`

- [x] **Step 1: Write the failing test**

Create `src/data/units.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mm, toM, toMTriple, type Mm } from './units';

describe('units', () => {
  it('carries a confidence tag', () => {
    const d: Mm = mm(2200, 'published', 'alcove bed length');
    expect(d.v).toBe(2200);
    expect(d.c).toBe('published');
    expect(d.note).toBe('alcove bed length');
  });

  it('converts millimetres to metres', () => {
    expect(toM(mm(2200, 'published'))).toBeCloseTo(2.2);
    expect(toM(mm(0, 'derived'))).toBe(0);
    expect(toM(mm(-1180, 'derived'))).toBeCloseTo(-1.18);
  });

  it('converts a triple in one call', () => {
    const t = toMTriple([mm(1000, 'derived'), mm(2000, 'derived'), mm(-500, 'derived')]);
    expect(t).toEqual([1, 2, -0.5]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/data/units.test.ts`
Expected: FAIL — cannot resolve `./units`.

- [x] **Step 3: Write minimal implementation**

Create `src/data/units.ts`:

```ts
/** How much we actually know about a dimension. See the spec's §2. */
export type Confidence =
  | 'published'  // stated by the manufacturer or a named review
  | 'derived'    // arithmetic on published values
  | 'estimated'; // read off photographs

export interface Mm {
  readonly v: number;
  readonly c: Confidence;
  readonly note?: string;
}

export const mm = (v: number, c: Confidence, note?: string): Mm => ({ v, c, note });

/** The only place in the codebase that converts millimetres to scene units. */
export const toM = (d: Mm): number => d.v / 1000;

export const toMTriple = (t: readonly [Mm, Mm, Mm]): [number, number, number] => [
  toM(t[0]), toM(t[1]), toM(t[2]),
];
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/data/units.test.ts`
Expected: PASS, 3 tests.

- [x] **Step 5: Commit**

```bash
git add src/data/units.ts src/data/units.test.ts
git commit -m "feat: add millimetre units with confidence tags"
```

---

## Task 3: Vehicle envelope, volumes and zones

**Files:**
- Create: `src/data/vehicle.ts`
- Test: `src/data/vehicle.test.ts`

**Interfaces:**
- Consumes: `mm`, `Mm`, `Confidence` from `./units`
- Produces:
  - `type ZoneId = 'shell' | 'cab' | 'alcove' | 'dinette' | 'sofa' | 'storage' | 'galley' | 'washroom'`
  - `type VolumeId = 'habitation' | 'slideout' | 'alcove' | 'cab'`
  - `interface Box { min: [number, number, number]; max: [number, number, number] }` — millimetres, plain numbers
  - `const ENVELOPE: Record<string, Mm>`
  - `const VOLUMES: Record<VolumeId, Box>`
  - `const ZONE_VOLUME: Record<Exclude<ZoneId, 'shell'>, VolumeId>`

- [x] **Step 1: Write the failing test**

Create `src/data/vehicle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ENVELOPE, VOLUMES, ZONE_VOLUME } from './vehicle';

describe('envelope', () => {
  it('holds the published vehicle dimensions exactly', () => {
    expect(ENVELOPE.overallLength.v).toBe(5998);
    expect(ENVELOPE.overallWidth.v).toBe(2450);
    expect(ENVELOPE.overallHeight.v).toBe(3200);
    expect(ENVELOPE.wheelbase.v).toBe(3300);
  });

  it('tags every published dimension as published', () => {
    for (const key of ['overallLength', 'overallWidth', 'overallHeight', 'wheelbase']) {
      expect(ENVELOPE[key]!.c).toBe('published');
    }
  });

  it('derives the rear axle position from the wheelbase', () => {
    expect(ENVELOPE.rearAxleFromNose.v).toBe(
      ENVELOPE.frontAxleFromNose.v + ENVELOPE.wheelbase.v,
    );
    expect(ENVELOPE.rearAxleFromNose.c).toBe('derived');
  });

  it('derives habitation length from overall length minus cab depth', () => {
    expect(ENVELOPE.habLength.v).toBe(
      ENVELOPE.overallLength.v - ENVELOPE.cabDepth.v,
    );
  });

  it('derives habitation width from overall width minus two wall thicknesses', () => {
    expect(ENVELOPE.habWidth.v).toBe(
      ENVELOPE.overallWidth.v - 2 * ENVELOPE.wallThickness.v,
    );
  });
});

describe('volumes', () => {
  it('centres the habitation volume on the vehicle centreline', () => {
    const { min, max } = VOLUMES.habitation;
    expect(min[0]).toBe(-max[0]);
    expect(max[0] - min[0]).toBe(ENVELOPE.habWidth.v);
  });

  it('starts the habitation volume at the bulkhead and floor', () => {
    expect(VOLUMES.habitation.min[1]).toBe(0);
    expect(VOLUMES.habitation.min[2]).toBe(0);
  });

  it('extends the slide-out volume outboard of the habitation box', () => {
    expect(VOLUMES.slideout.min[0]).toBeLessThan(VOLUMES.habitation.min[0]);
  });

  it('places the alcove volume forward of the bulkhead and above the floor', () => {
    expect(VOLUMES.alcove.min[2]).toBeLessThan(0);
    expect(VOLUMES.alcove.min[1]).toBeGreaterThan(0);
  });

  it('gives every non-shell zone a volume', () => {
    const zones = ['cab', 'alcove', 'dinette', 'sofa', 'storage', 'galley', 'washroom'] as const;
    for (const z of zones) {
      expect(VOLUMES[ZONE_VOLUME[z]]).toBeDefined();
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/data/vehicle.test.ts`
Expected: FAIL — cannot resolve `./vehicle`.

- [x] **Step 3: Write minimal implementation**

Create `src/data/vehicle.ts`:

```ts
import { mm, type Mm } from './units';

export type ZoneId =
  | 'shell' | 'cab' | 'alcove' | 'dinette' | 'sofa' | 'storage' | 'galley' | 'washroom';

export type VolumeId = 'habitation' | 'slideout' | 'alcove' | 'cab';

/** Axis-aligned box in millimetres, in the frame defined by the plan's Global Constraints. */
export interface Box {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

const overallLength = mm(5998, 'published', 'C1 blue-plate limit is 6 m');
const overallWidth = mm(2450, 'published');
const overallHeight = mm(3200, 'published');
const wheelbase = mm(3300, 'published');
const frontAxleFromNose = mm(1050, 'estimated', 'Iveco Daily single cab');
const cabDepth = mm(1950, 'estimated', 'nose to bulkhead');
const wallThickness = mm(45, 'estimated', 'XPS sandwich wall');

export const ENVELOPE: Record<string, Mm> = {
  overallLength,
  overallWidth,
  overallHeight,
  wheelbase,
  frontAxleFromNose,
  cabDepth,
  wallThickness,
  rearAxleFromNose: mm(frontAxleFromNose.v + wheelbase.v, 'derived'),
  habLength: mm(overallLength.v - cabDepth.v, 'derived'),
  habWidth: mm(overallWidth.v - 2 * wallThickness.v, 'derived'),
  habHeight: mm(2000, 'estimated', 'SHAKIEST NUMBER IN THE MODEL — the phase 1 gate exists to catch this'),
  floorAboveGround: mm(1050, 'estimated', 'chassis frame plus double floor'),
  slideTravel: mm(580, 'derived', '1280 bed width minus ~700 sofa base'),
};

const HAB_HALF_W = ENVELOPE.habWidth!.v / 2;   // 1180
const HAB_L = ENVELOPE.habLength!.v;           // 4048
const HAB_H = ENVELOPE.habHeight!.v;           // 2000
const SLIDE = ENVELOPE.slideTravel!.v;         // 580

export const VOLUMES: Record<VolumeId, Box> = {
  habitation: { min: [-HAB_HALF_W, 0, 0], max: [HAB_HALF_W, HAB_H, HAB_L] },
  // Spans from the deployed slide wall all the way to the kerb wall: the slide-out bed
  // crosses the nominal habitation boundary, so a narrower volume would reject it.
  slideout: { min: [-HAB_HALF_W - SLIDE, 0, 150], max: [HAB_HALF_W, HAB_H, 2050] },
  alcove: { min: [-HAB_HALF_W, 1100, -1500], max: [HAB_HALF_W, HAB_H + 50, 100] },
  cab: { min: [-HAB_HALF_W, 0, -1950], max: [HAB_HALF_W, 1400, 100] },
};

export const ZONE_VOLUME: Record<Exclude<ZoneId, 'shell'>, VolumeId> = {
  cab: 'cab',
  alcove: 'alcove',
  dinette: 'habitation',
  sofa: 'slideout',
  storage: 'habitation',
  galley: 'habitation',
  washroom: 'habitation',
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/data/vehicle.test.ts`
Expected: PASS, 9 tests.

- [x] **Step 5: Commit**

```bash
git add src/data/vehicle.ts src/data/vehicle.test.ts
git commit -m "feat: add vehicle envelope, volumes and zone mapping"
```

---

## Task 4: Placement data

**Files:**
- Modify: `src/data/vehicle.ts`
- Test: `src/data/placements.test.ts`

**Interfaces:**
- Consumes: `Mm`, `mm`, `ZoneId` from Task 3
- Produces:
  - `interface Placement { id: string; zone: ZoneId; origin: [Mm, Mm, Mm]; size: [Mm, Mm, Mm]; movable: boolean }`
  - `const PLACEMENTS: readonly Placement[]`
  - `aabb(p: Placement): { min: [number, number, number]; max: [number, number, number] }`

Origin is the **minimum corner**. Sizes are positive extents along `+X`, `+Y`, `+Z`.

- [x] **Step 1: Write the failing test**

Create `src/data/placements.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PLACEMENTS, aabb, type Placement } from './vehicle';

const byId = (id: string): Placement => {
  const p = PLACEMENTS.find((x) => x.id === id);
  if (!p) throw new Error(`no placement "${id}"`);
  return p;
};

describe('placements', () => {
  it('has unique ids', () => {
    const ids = PLACEMENTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only positive sizes', () => {
    for (const p of PLACEMENTS) {
      for (const s of p.size) expect(s.v).toBeGreaterThan(0);
    }
  });

  it('honours the published alcove bed size exactly', () => {
    const bed = byId('alcove_bed');
    expect(bed.size[0].v).toBe(2200); // across the vehicle
    expect(bed.size[2].v).toBe(1400); // fore-aft
    expect(bed.size[0].c).toBe('published');
    expect(bed.size[2].c).toBe('published');
  });

  it('honours the published slide-out bed size exactly', () => {
    const bed = byId('slideout_bed');
    expect(bed.size[0].v).toBe(1280); // outboard
    expect(bed.size[2].v).toBe(1900); // fore-aft
    expect(bed.size[0].c).toBe('published');
    expect(bed.size[2].c).toBe('published');
  });

  it('computes an axis-aligned box from origin plus size', () => {
    const box = aabb(byId('alcove_bed'));
    expect(box.min[0]).toBe(-1100);
    expect(box.max[0]).toBe(1100);
    expect(box.max[2] - box.min[2]).toBe(1400);
  });

  it('marks the dinette chairs and table movable, and nothing structural', () => {
    expect(byId('dinette_chair_fwd_in').movable).toBe(true);
    expect(byId('dinette_table').movable).toBe(true);
    expect(byId('washroom_pod').movable).toBe(false);
    expect(byId('floor').movable).toBe(false);
  });

  it('has at least one placement in every zone', () => {
    const zones = ['shell', 'cab', 'alcove', 'dinette', 'sofa', 'storage', 'galley', 'washroom'];
    for (const z of zones) {
      expect(PLACEMENTS.some((p) => p.zone === z)).toBe(true);
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/data/placements.test.ts`
Expected: FAIL — `PLACEMENTS` and `aabb` are not exported.

- [x] **Step 3: Write minimal implementation**

Append to `src/data/vehicle.ts`:

```ts
export interface Placement {
  readonly id: string;
  readonly zone: ZoneId;
  /** Minimum corner, millimetres. */
  readonly origin: readonly [Mm, Mm, Mm];
  /** Positive extents along +X, +Y, +Z, millimetres. */
  readonly size: readonly [Mm, Mm, Mm];
  readonly movable: boolean;
}

const e = (v: number) => mm(v, 'estimated');
const d = (v: number) => mm(v, 'derived');
const pub = (v: number) => mm(v, 'published');

const W = 30; // wall / panel thickness for shell boxes

export const PLACEMENTS: readonly Placement[] = [
  // --- shell (the enclosure; excluded from overlap and containment checks) ---
  { id: 'floor',    zone: 'shell', origin: [d(-1180), d(-W), d(0)],    size: [d(2360), d(W), d(4050)], movable: false },
  { id: 'ceiling',  zone: 'shell', origin: [d(-1180), d(2000), d(0)],  size: [d(2360), d(W), d(4050)], movable: false },
  { id: 'wall_off', zone: 'shell', origin: [d(-1180), d(0), d(0)],     size: [d(W), d(2000), d(4050)], movable: false },
  { id: 'wall_kerb',zone: 'shell', origin: [d(1150), d(0), d(0)],      size: [d(W), d(2000), d(4050)], movable: false },
  { id: 'bulkhead', zone: 'shell', origin: [d(-1180), d(0), d(-W)],    size: [d(2360), d(2000), d(W)], movable: false },
  { id: 'wall_rear',zone: 'shell', origin: [d(-1180), d(0), d(4050)],  size: [d(2360), d(2000), d(W)], movable: false },
  { id: 'slideout_shell', zone: 'shell', origin: [d(-1760), d(0), d(150)], size: [d(580), d(2000), d(1900)], movable: false },

  // --- cab ---
  { id: 'cab_seat_off',  zone: 'cab', origin: [e(-900), e(0), e(-1600)], size: [e(550), e(1100), e(550)], movable: false },
  { id: 'cab_seat_kerb', zone: 'cab', origin: [e(350), e(0), e(-1600)],  size: [e(550), e(1100), e(550)], movable: false },

  // --- alcove: transverse bed, 2200 across x 1400 fore-aft (published) ---
  { id: 'alcove_bed',     zone: 'alcove', origin: [d(-1100), e(1150), e(-1400)], size: [pub(2200), e(200), pub(1400)], movable: false },
  { id: 'alcove_lockers', zone: 'alcove', origin: [e(-1100), e(1500), e(-300)],  size: [e(2200), e(400), e(300)],      movable: false },

  // --- dinette: four captain chairs face to face around a pedestal table ---
  { id: 'dinette_chair_fwd_in',  zone: 'dinette', origin: [e(70), e(0), e(100)],  size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_fwd_out', zone: 'dinette', origin: [e(630), e(0), e(100)], size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_aft_in',  zone: 'dinette', origin: [e(70), e(0), e(1360)], size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_chair_aft_out', zone: 'dinette', origin: [e(630), e(0), e(1360)],size: [e(520), e(1150), e(520)], movable: true },
  { id: 'dinette_table',         zone: 'dinette', origin: [e(120), e(0), e(640)], size: [e(980), e(720), e(700)],  movable: true },
  { id: 'lockers_kerb',          zone: 'dinette', origin: [e(700), e(1400), e(100)], size: [e(450), e(450), e(1900)], movable: false },

  // --- side slide-out: bench base plus the 1280 x 1900 bed (published) ---
  { id: 'slideout_base', zone: 'sofa', origin: [d(-1730), e(0), e(150)],   size: [d(1280), e(400), d(1900)], movable: false },
  { id: 'slideout_bed',  zone: 'sofa', origin: [d(-1730), e(400), e(150)], size: [pub(1280), e(200), pub(1900)], movable: false },
  { id: 'lockers_off',   zone: 'sofa', origin: [e(-1730), e(1400), e(150)],size: [e(450), e(450), e(1900)], movable: false },

  // --- storage band between lounge and wet zone ---
  { id: 'fridge',   zone: 'storage', origin: [e(-1150), e(0), e(2100)], size: [e(600), e(1800), e(400)], movable: false },
  { id: 'wardrobe', zone: 'storage', origin: [e(600), e(0), e(2100)],   size: [e(550), e(1900), e(400)], movable: false },

  // --- rear wet zone. Which side is which is open question 5 in the spec. ---
  { id: 'galley_run',      zone: 'galley', origin: [e(550), e(0), e(2550)],    size: [e(600), e(900), e(1450)], movable: false },
  { id: 'galley_overhead', zone: 'galley', origin: [e(550), e(1350), e(2550)], size: [e(600), e(450), e(1450)], movable: false },
  { id: 'washroom_pod',    zone: 'washroom', origin: [e(-1150), e(0), e(2550)],size: [e(1000), e(1950), e(1100)], movable: false },
];

export const aabb = (p: Placement) => ({
  min: [p.origin[0].v, p.origin[1].v, p.origin[2].v] as [number, number, number],
  max: [
    p.origin[0].v + p.size[0].v,
    p.origin[1].v + p.size[1].v,
    p.origin[2].v + p.size[2].v,
  ] as [number, number, number],
});
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/data/placements.test.ts`
Expected: PASS, 7 tests.

- [x] **Step 5: Commit**

```bash
git add src/data/vehicle.ts src/data/placements.test.ts
git commit -m "feat: add interior placement data for all zones"
```

---

## Task 5: Dimensional checks

**Files:**
- Create: `src/check.ts`
- Test: `src/check.test.ts`

**Interfaces:**
- Consumes: `PLACEMENTS`, `VOLUMES`, `ZONE_VOLUME`, `aabb`, `Placement`, `Box` from `./data/vehicle`
- Produces:
  - `interface Violation { rule: string; detail: string }`
  - `boxesOverlap(a: Box, b: Box): boolean`
  - `boxContains(outer: Box, inner: Box): boolean`
  - `minAisleWidth(ps: readonly Placement[]): number`
  - `checkAll(ps?: readonly Placement[]): Violation[]`
  - `MIN_AISLE_MM = 400`

Touching faces are **not** an overlap — the test is strict (`<`, not `<=`).

- [x] **Step 1: Write the failing test**

Create `src/check.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { boxesOverlap, boxContains, minAisleWidth, checkAll, MIN_AISLE_MM } from './check';
import { PLACEMENTS } from './data/vehicle';

const box = (
  min: [number, number, number],
  max: [number, number, number],
) => ({ min, max });

describe('boxesOverlap', () => {
  it('detects overlap in all three axes', () => {
    expect(boxesOverlap(box([0, 0, 0], [10, 10, 10]), box([5, 5, 5], [15, 15, 15]))).toBe(true);
  });

  it('treats touching faces as not overlapping', () => {
    expect(boxesOverlap(box([0, 0, 0], [10, 10, 10]), box([10, 0, 0], [20, 10, 10]))).toBe(false);
  });

  it('returns false when separated on a single axis', () => {
    // Overhead locker directly above a chair: same X and Z, different Y.
    expect(boxesOverlap(box([0, 0, 0], [10, 5, 10]), box([0, 8, 0], [10, 12, 10]))).toBe(false);
  });
});

describe('boxContains', () => {
  it('accepts an inner box fully inside', () => {
    expect(boxContains(box([0, 0, 0], [10, 10, 10]), box([1, 1, 1], [9, 9, 9]))).toBe(true);
  });

  it('accepts an inner box flush with the outer face', () => {
    expect(boxContains(box([0, 0, 0], [10, 10, 10]), box([0, 0, 0], [10, 10, 10]))).toBe(true);
  });

  it('rejects an inner box poking out', () => {
    expect(boxContains(box([0, 0, 0], [10, 10, 10]), box([1, 1, 1], [11, 9, 9]))).toBe(false);
  });
});

describe('minAisleWidth', () => {
  it('measures the narrowest gap between off-side and kerb-side furniture', () => {
    expect(minAisleWidth(PLACEMENTS)).toBeGreaterThanOrEqual(MIN_AISLE_MM);
  });

  it('reports 520 mm for the deployed layout', () => {
    // Slide-out bed inboard edge at -450, dinette chairs inboard edge at +70.
    expect(minAisleWidth(PLACEMENTS)).toBe(520);
  });
});

describe('checkAll', () => {
  it('passes on the shipped placement data', () => {
    expect(checkAll()).toEqual([]);
  });

  it('reports an overlap when two pieces are pushed into each other', () => {
    const broken = PLACEMENTS.map((p) =>
      p.id === 'dinette_table'
        ? { ...p, origin: [p.origin[0], p.origin[1], { v: 100, c: 'estimated' as const }] as const }
        : p,
    );
    const violations = checkAll(broken);
    expect(violations.some((v) => v.rule === 'overlap')).toBe(true);
  });

  it('reports containment failure when a piece leaves its volume', () => {
    const broken = PLACEMENTS.map((p) =>
      p.id === 'washroom_pod'
        ? { ...p, origin: [{ v: -3000, c: 'estimated' as const }, p.origin[1], p.origin[2]] as const }
        : p,
    );
    const violations = checkAll(broken);
    expect(violations.some((v) => v.rule === 'containment')).toBe(true);
  });

  it('reports an aisle violation when the bed is widened into the walkway', () => {
    const broken = PLACEMENTS.map((p) =>
      p.id === 'slideout_bed'
        ? { ...p, size: [{ v: 1800, c: 'estimated' as const }, p.size[1], p.size[2]] as const }
        : p,
    );
    const violations = checkAll(broken);
    expect(violations.some((v) => v.rule === 'aisle')).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/check.test.ts`
Expected: FAIL — cannot resolve `./check`.

- [x] **Step 3: Write minimal implementation**

Create `src/check.ts`:

```ts
import { PLACEMENTS, VOLUMES, ZONE_VOLUME, aabb, type Box, type Placement } from './data/vehicle';

export const MIN_AISLE_MM = 400;

export interface Violation {
  readonly rule: 'overlap' | 'containment' | 'aisle' | 'published';
  readonly detail: string;
}

/** Strict: boxes that merely touch do not overlap. */
export const boxesOverlap = (a: Box, b: Box): boolean =>
  a.min[0] < b.max[0] && b.min[0] < a.max[0] &&
  a.min[1] < b.max[1] && b.min[1] < a.max[1] &&
  a.min[2] < b.max[2] && b.min[2] < a.max[2];

export const boxContains = (outer: Box, inner: Box): boolean =>
  inner.min[0] >= outer.min[0] && inner.max[0] <= outer.max[0] &&
  inner.min[1] >= outer.min[1] && inner.max[1] <= outer.max[1] &&
  inner.min[2] >= outer.min[2] && inner.max[2] <= outer.max[2];

const furniture = (ps: readonly Placement[]) => ps.filter((p) => p.zone !== 'shell');

/**
 * Narrowest gap along X between anything on the off side and anything on the kerb side,
 * sampled every 50 mm through the habitation length. Sampling beats analytic interval
 * merging here: it is four lines, and 50 mm is well under any real clearance we care about.
 */
export const minAisleWidth = (ps: readonly Placement[]): number => {
  const boxes = furniture(ps).map(aabb);
  let narrowest = Infinity;
  for (let z = 0; z <= 4050; z += 50) {
    let offMax = -Infinity;
    let kerbMin = Infinity;
    for (const b of boxes) {
      if (z < b.min[2] || z > b.max[2]) continue;
      if (b.max[0] <= 0) offMax = Math.max(offMax, b.max[0]);
      else if (b.min[0] >= 0) kerbMin = Math.min(kerbMin, b.min[0]);
    }
    if (offMax === -Infinity || kerbMin === Infinity) continue;
    narrowest = Math.min(narrowest, kerbMin - offMax);
  }
  return narrowest === Infinity ? Infinity : narrowest;
};

export const checkAll = (ps: readonly Placement[] = PLACEMENTS): Violation[] => {
  const out: Violation[] = [];
  const items = furniture(ps);

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (boxesOverlap(aabb(a), aabb(b))) {
        out.push({ rule: 'overlap', detail: `${a.id} overlaps ${b.id}` });
      }
    }
  }

  for (const p of items) {
    const volume = VOLUMES[ZONE_VOLUME[p.zone as Exclude<typeof p.zone, 'shell'>]];
    if (!boxContains(volume, aabb(p))) {
      out.push({ rule: 'containment', detail: `${p.id} leaves its ${ZONE_VOLUME[p.zone as Exclude<typeof p.zone, 'shell'>]} volume` });
    }
  }

  const aisle = minAisleWidth(ps);
  if (aisle < MIN_AISLE_MM) {
    out.push({ rule: 'aisle', detail: `aisle is ${aisle} mm, minimum is ${MIN_AISLE_MM} mm` });
  }

  const beds: Array<[string, number, number]> = [
    ['alcove_bed', 2200, 1400],
    ['slideout_bed', 1280, 1900],
  ];
  for (const [id, x, z] of beds) {
    const p = ps.find((q) => q.id === id);
    if (!p) { out.push({ rule: 'published', detail: `missing ${id}` }); continue; }
    if (p.size[0].v !== x || p.size[2].v !== z) {
      out.push({ rule: 'published', detail: `${id} must stay ${x} x ${z} mm` });
    }
  }

  return out;
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/check.test.ts`
Expected: PASS, 11 tests. If `minAisleWidth` does not return exactly 520, the placement data in Task 4 has drifted — fix the data, not the test.

- [x] **Step 5: Commit**

```bash
git add src/check.ts src/check.test.ts
git commit -m "feat: add dimensional checks for overlap, containment and aisle width"
```

---

## Task 6: Grey-box scene — the phase 1 gate

**Files:**
- Create: `src/greybox.ts`, `src/scene.ts`
- Modify: `src/main.ts`
- Test: `src/greybox.test.ts`

**Interfaces:**
- Consumes: `PLACEMENTS`, `toMTriple` from data; `checkAll` from `./check`
- Produces:
  - `buildGreybox(ps?: readonly Placement[]): THREE.Group` — one `THREE.Mesh` per placement, named with the placement id, positioned at the box centre
  - `createScene(canvas: HTMLCanvasElement): { scene, camera, renderer, controls, render }` from `scene.ts`

- [x] **Step 1: Write the failing test**

Create `src/greybox.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildGreybox } from './greybox';
import { PLACEMENTS } from './data/vehicle';

describe('buildGreybox', () => {
  it('creates one mesh per placement, named by id', () => {
    const g = buildGreybox();
    expect(g.children.length).toBe(PLACEMENTS.length);
    expect(g.getObjectByName('alcove_bed')).toBeInstanceOf(THREE.Mesh);
    expect(g.getObjectByName('washroom_pod')).toBeInstanceOf(THREE.Mesh);
  });

  it('positions each mesh at the centre of its box, in metres', () => {
    const bed = buildGreybox().getObjectByName('alcove_bed')!;
    // origin x -1100 mm, size 2200 mm -> centre 0 m
    expect(bed.position.x).toBeCloseTo(0);
    // origin z -1400 mm, size 1400 mm -> centre -700 mm -> -0.7 m
    expect(bed.position.z).toBeCloseTo(-0.7);
  });

  it('scales each mesh to the placement size, in metres', () => {
    const bed = buildGreybox().getObjectByName('alcove_bed') as THREE.Mesh;
    bed.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(bed).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(2.2);
    expect(size.z).toBeCloseTo(1.4);
  });

  it('renders shell pieces translucent so the interior stays visible', () => {
    const floor = buildGreybox().getObjectByName('floor') as THREE.Mesh;
    const mat = floor.material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/greybox.test.ts`
Expected: FAIL — cannot resolve `./greybox`.

- [x] **Step 3: Write minimal implementation**

Create `src/greybox.ts`:

```ts
import * as THREE from 'three';
import { PLACEMENTS, type Placement, type ZoneId } from './data/vehicle';

const ZONE_COLOUR: Record<ZoneId, number> = {
  shell: 0x8899aa,
  cab: 0x666666,
  alcove: 0xd6a15a,
  dinette: 0x6fa8dc,
  sofa: 0x93c47d,
  storage: 0xb4a7d6,
  galley: 0xe06666,
  washroom: 0xf0f0f0,
};

const UNIT = new THREE.BoxGeometry(1, 1, 1);

export const buildGreybox = (ps: readonly Placement[] = PLACEMENTS): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'greybox';

  for (const p of ps) {
    const isShell = p.zone === 'shell';
    const material = new THREE.MeshStandardMaterial({
      color: ZONE_COLOUR[p.zone],
      transparent: isShell,
      opacity: isShell ? 0.12 : 1,
      roughness: 0.9,
      metalness: 0,
      side: isShell ? THREE.BackSide : THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(UNIT, material);
    mesh.name = p.id;
    mesh.scale.set(p.size[0].v / 1000, p.size[1].v / 1000, p.size[2].v / 1000);
    mesh.position.set(
      (p.origin[0].v + p.size[0].v / 2) / 1000,
      (p.origin[1].v + p.size[1].v / 2) / 1000,
      (p.origin[2].v + p.size[2].v / 2) / 1000,
    );
    group.add(mesh);
  }

  return group;
};
```

Create `src/scene.ts`:

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  render: () => void;
}

export const createScene = (canvas: HTMLCanvasElement): SceneBundle => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.position.set(2.6, 1.9, 4.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 1.6);
  controls.enableDamping = true;

  // Placeholder lighting for the grey-box only. Task 13 replaces this entirely.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 5, 2);
  scene.add(key);

  const render = () => {
    controls.update();
    renderer.render(scene, camera);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls, render };
};
```

Replace `src/main.ts`:

```ts
import { createScene } from './scene';
import { buildGreybox } from './greybox';
import { checkAll } from './check';

const violations = checkAll();
if (violations.length) {
  console.error('Dimensional violations:', violations);
} else {
  console.log('Dimensional checks pass.');
}

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const { scene, renderer, render } = createScene(canvas);
scene.add(buildGreybox());
renderer.setAnimationLoop(render);
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/greybox.test.ts && pnpm check`
Expected: PASS, 4 tests, and `tsc --noEmit` clean.

- [x] **Step 5: Look at it — this is the gate**

Run: `pnpm dev`, open `http://localhost:5173`.

Compare against `docs/research/reference/interior-lounge-and-overcab.jpg` and `dinette-and-slideout-bed.jpg`. Check specifically:

1. Does the standing height read as ~2.0 m against the seated figures' scale in the photos? **This is the shakiest number in the model.**
2. Is the aisle plausibly the width shown in the photos relative to the chairs?
3. Does the alcove bed mass sit at a believable height above the cab seats?
4. Do the rear galley and washroom masses divide the rear third the way the photos show?

Record what you found in a new `## Phase 1 gate findings` section at the end of the spec, adjust the `estimated` values in `PLACEMENTS` and `ENVELOPE` until the grey-box matches, and re-run `pnpm test` after every adjustment.

**No Blender work starts until this gate is recorded as passed.**

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add grey-box scene and record phase 1 dimensional gate findings"
```

---

## Task 7: Blender export script

**Files:**
- Create: `tools/export_modules.py`, `model/README.md`
- Modify: `package.json` (add `export` script)

**Interfaces:**
- Consumes: nothing at runtime. Reads `model/rv.blend`.
- Produces: `dist/raw/<module>.glb` for each collection in `MODULES`. Later tasks load the optimised copies from `public/models/`.

Blender is at `/Applications/Blender.app/Contents/MacOS/Blender` (5.2.1 LTS).

- [x] **Step 1: Write the export script**

Create `tools/export_modules.py`:

```python
"""Export one .glb per module collection from model/rv.blend.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/rv.blend -P tools/export_modules.py

Conventions this script relies on, all enforced by the checks below:
  - One top-level collection per module, named exactly as in MODULES.
  - Object names match the `id` of the matching entry in src/data/vehicle.ts.
  - Material names are `role.<role-id>`.
  - Scene unit scale is metres.
"""
import os
import sys
import bpy

MODULES = [
    "shell",
    "cab",
    "alcove_bed",
    "dinette",
    "sofa_slideout",
    "galley",
    "washroom",
    "lockers",
    "softgoods",
]

OUT_DIR = os.path.join(os.getcwd(), "dist", "raw")


def fail(message):
    print(f"EXPORT ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def check_conventions():
    if abs(bpy.context.scene.unit_settings.scale_length - 1.0) > 1e-6:
        fail("scene unit scale must be 1.0 (metres)")

    bad = [m.name for m in bpy.data.materials if not m.name.startswith("role.")]
    if bad:
        fail(f"materials must be named role.<role-id>; found {bad}")

    missing = [name for name in MODULES if name not in bpy.data.collections]
    if missing:
        fail(f"missing collections: {missing}")


def export_collection(name):
    for obj in bpy.context.scene.objects:
        obj.hide_set(False)
        obj.select_set(False)

    collection = bpy.data.collections[name]
    objects = [o for o in collection.all_objects if o.type in {"MESH", "EMPTY"}]
    if not objects:
        print(f"  skip {name}: no mesh objects")
        return

    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    path = os.path.join(OUT_DIR, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,          # apply modifiers
        export_yup=True,            # glTF is Y-up, matching our frame
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=False,  # gltf-transform does this later
    )
    print(f"  wrote {path}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    check_conventions()
    for name in MODULES:
        export_collection(name)
    print("Export complete.")


main()
```

Create `model/README.md`:

```markdown
# Blender source

`rv.blend` is the single source for all interior geometry.

## Rules

- Scene units: **metres**, unit scale 1.0.
- One top-level collection per module, named exactly as `MODULES` in `tools/export_modules.py`.
- Object names must equal the `id` of the matching entry in `src/data/vehicle.ts`.
  `tools/check_budget.mjs` fails the build if a name in the data has no matching node.
- Material names must be `role.<role-id>`, matching a `Role` in `src/data/finishes.ts`.
- Bake **ambient occlusion only**, per object, into UV map 2. No full lightmaps: they would
  pin the furniture in place and kill the customisation seam.
- Same coordinate frame as the runtime: origin at habitation floor, centreline, cab bulkhead.
  `+X` kerb side, `+Y` up, `+Z` rearward.

## Export

    pnpm export
```

Add to `package.json` `"scripts"`:

```json
{
  "export": "/Applications/Blender.app/Contents/MacOS/Blender -b model/rv.blend -P tools/export_modules.py",
  "optimize": "pnpm dlx @gltf-transform/cli optimize dist/raw --output public/models --texture-compress ktx2 --compress draco",
  "budget": "node tools/check_budget.mjs"
}
```

- [x] **Step 2: Verify the script rejects a bad file**

Create a throwaway `.blend` with a material named `wood` (not `role.wood.cabinet`) and run the export against it.

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b /tmp/bad.blend -P tools/export_modules.py`
Expected: exit code 1, stderr contains `materials must be named role.<role-id>`.

- [x] **Step 3: Commit**

```bash
git add tools/export_modules.py model/README.md package.json
git commit -m "feat: add Blender headless module export with convention checks"
```

---

## Task 8: Budget checker

**Files:**
- Create: `tools/check_budget.mjs`
- Test: `src/budget.test.ts`

**Interfaces:**
- Consumes: `dist/raw/*.glb` (uncompressed, for triangle counts), `public/models/*.glb` (optimised, for bytes)
- Produces: `countTriangles(glbPath): Promise<number>`, `checkBudget(): Promise<{ triangles, bytes, violations }>`

Triangle counts are read from the **raw** exports because Draco compression does not change triangle count and reading compressed meshes would need the Draco decoder. Byte counts are read from the **optimised** output. This avoids a decoder dependency entirely.

- [x] **Step 1: Write the failing test**

Create `src/budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MAX_TRIANGLES, MAX_BYTES, summarise } from '../tools/check_budget.mjs';

describe('budget thresholds', () => {
  it('matches the spec', () => {
    expect(MAX_TRIANGLES).toBe(350_000);
    expect(MAX_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('summarise', () => {
  it('reports no violations when under budget', () => {
    const r = summarise(100_000, 5 * 1024 * 1024);
    expect(r.violations).toEqual([]);
  });

  it('reports a violation when over the triangle budget', () => {
    const r = summarise(400_000, 1024);
    expect(r.violations.some((v) => v.includes('triangle'))).toBe(true);
  });

  it('reports a violation when over the byte budget', () => {
    const r = summarise(1000, 30 * 1024 * 1024);
    expect(r.violations.some((v) => v.includes('bytes'))).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/budget.test.ts`
Expected: FAIL — cannot resolve `../tools/check_budget.mjs`.

- [x] **Step 3: Write minimal implementation**

```bash
pnpm add -D @gltf-transform/core
```

Create `tools/check_budget.mjs`:

```js
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';

export const MAX_TRIANGLES = 350_000;
export const MAX_BYTES = 25 * 1024 * 1024;

const RAW_DIR = 'dist/raw';
const OUT_DIR = 'public/models';

export const summarise = (triangles, bytes) => {
  const violations = [];
  if (triangles > MAX_TRIANGLES) {
    violations.push(`over triangle budget: ${triangles} > ${MAX_TRIANGLES}`);
  }
  if (bytes > MAX_BYTES) {
    violations.push(`over bytes budget: ${bytes} > ${MAX_BYTES}`);
  }
  return { triangles, bytes, violations };
};

export const countTriangles = async (path) => {
  const doc = await new NodeIO().read(path);
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      const count = indices ? indices.getCount() : position ? position.getCount() : 0;
      total += Math.floor(count / 3);
    }
  }
  return total;
};

const glbsIn = async (dir) => {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.glb')).map((f) => join(dir, f));
  } catch {
    return [];
  }
};

export const checkBudget = async () => {
  let triangles = 0;
  for (const f of await glbsIn(RAW_DIR)) triangles += await countTriangles(f);

  let bytes = 0;
  for (const f of await glbsIn(OUT_DIR)) bytes += (await stat(f)).size;

  return summarise(triangles, bytes);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await checkBudget();
  console.log(`triangles: ${r.triangles} / ${MAX_TRIANGLES}`);
  console.log(`bytes:     ${r.bytes} / ${MAX_BYTES}`);
  if (r.violations.length) {
    for (const v of r.violations) console.error(`BUDGET: ${v}`);
    process.exit(1);
  }
  console.log('Budget OK.');
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/budget.test.ts`
Expected: PASS, 4 tests.

- [x] **Step 5: Commit**

```bash
git add tools/check_budget.mjs src/budget.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add triangle and byte budget checker"
```

---

## Task 9: Node binding

**Files:**
- Create: `src/binding.ts`
- Test: `src/binding.test.ts`

**Interfaces:**
- Consumes: `PLACEMENTS`, `Placement` from `./data/vehicle`
- Produces:
  - `class BindingError extends Error`
  - `bindPlacements(root: THREE.Object3D, ps?: readonly Placement[]): Map<string, THREE.Object3D>`

Binding is tested against a hand-built `Object3D` tree, not a real `.glb`. The loading and the binding are separate concerns, and only the binding has logic worth testing.

- [x] **Step 1: Write the failing test**

Create `src/binding.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { bindPlacements, BindingError } from './binding';
import { PLACEMENTS } from './data/vehicle';

const treeWith = (names: string[]): THREE.Object3D => {
  const root = new THREE.Group();
  for (const n of names) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    o.name = n;
    root.add(o);
  }
  return root;
};

describe('bindPlacements', () => {
  it('returns a node for every placement it is given', () => {
    const subset = PLACEMENTS.filter((p) => p.zone === 'dinette');
    const map = bindPlacements(treeWith(subset.map((p) => p.id)), subset);
    expect(map.size).toBe(subset.length);
    expect(map.get('dinette_table')).toBeInstanceOf(THREE.Mesh);
  });

  it('finds nodes nested at any depth', () => {
    const root = new THREE.Group();
    const mid = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    leaf.name = 'dinette_table';
    mid.add(leaf);
    root.add(mid);
    const subset = PLACEMENTS.filter((p) => p.id === 'dinette_table');
    expect(bindPlacements(root, subset).get('dinette_table')).toBe(leaf);
  });

  it('throws naming the missing node, so a Blender rename fails loudly', () => {
    const subset = PLACEMENTS.filter((p) => p.zone === 'dinette');
    const incomplete = treeWith(subset.slice(1).map((p) => p.id));
    expect(() => bindPlacements(incomplete, subset)).toThrow(BindingError);
    expect(() => bindPlacements(incomplete, subset)).toThrow(/dinette_chair_fwd_in/);
  });

  it('lists every missing node in one error, not just the first', () => {
    const subset = PLACEMENTS.filter((p) => p.zone === 'dinette');
    try {
      bindPlacements(treeWith([]), subset);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('dinette_table');
      expect((err as Error).message).toContain('dinette_chair_aft_out');
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/binding.test.ts`
Expected: FAIL — cannot resolve `./binding`.

- [x] **Step 3: Write minimal implementation**

Create `src/binding.ts`:

```ts
import type * as THREE from 'three';
import { PLACEMENTS, type Placement } from './data/vehicle';

export class BindingError extends Error {
  constructor(missing: readonly string[]) {
    super(
      `glTF is missing ${missing.length} node(s) named in the placement data: ${missing.join(', ')}. ` +
        'Object names in model/rv.blend must equal the placement id in src/data/vehicle.ts.',
    );
    this.name = 'BindingError';
  }
}

/**
 * Resolve every placement id to a node in the loaded tree.
 * Throws listing all missing ids at once — a Blender rename should be one fix, not a game of
 * whack-a-mole through repeated failures.
 */
export const bindPlacements = (
  root: THREE.Object3D,
  ps: readonly Placement[] = PLACEMENTS,
): Map<string, THREE.Object3D> => {
  const found = new Map<string, THREE.Object3D>();
  const missing: string[] = [];

  for (const p of ps) {
    const node = root.getObjectByName(p.id);
    if (node) found.set(p.id, node);
    else missing.push(p.id);
  }

  if (missing.length) throw new BindingError(missing);
  return found;
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/binding.test.ts`
Expected: PASS, 4 tests.

- [x] **Step 5: Commit**

```bash
git add src/binding.ts src/binding.test.ts
git commit -m "feat: bind glTF nodes to placement data, failing loudly on rename"
```

---

## Task 10: Finish registry

**Files:**
- Create: `src/data/finishes.ts`, `src/finishes.ts`
- Test: `src/finishes.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `type Role` (17 members, listed below)
  - `interface Variant { id: string; label: string; params: MaterialParams }`
  - `interface MaterialParams { color: number; roughness: number; metalness: number; emissive?: number; emissiveIntensity?: number }`
  - `type Registry = Record<Role, { active: string; variants: Variant[] }>`
  - `const DEFAULT_REGISTRY: Registry`
  - `roleOf(materialName: string): Role | null`
  - `applyFinishes(root: THREE.Object3D, registry?: Registry): number` — returns the number of meshes restyled

- [x] **Step 1: Write the failing test**

Create `src/finishes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_REGISTRY, type Role } from './data/finishes';
import { roleOf, applyFinishes } from './finishes';

const meshWithMaterial = (materialName: string): THREE.Mesh => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ name: materialName, color: 0x000000 }),
  );
  m.name = `mesh_${materialName}`;
  return m;
};

describe('roleOf', () => {
  it('strips the role prefix', () => {
    expect(roleOf('role.wood.cabinet')).toBe('wood.cabinet');
    expect(roleOf('role.upholstery.seat')).toBe('upholstery.seat');
  });

  it('returns null for an unprefixed name', () => {
    expect(roleOf('Walnut.001')).toBeNull();
  });

  it('returns null for a prefixed name that is not a known role', () => {
    expect(roleOf('role.not.a.real.role')).toBeNull();
  });

  it('tolerates Blender duplicate suffixes', () => {
    expect(roleOf('role.wood.cabinet.001')).toBe('wood.cabinet');
  });
});

describe('DEFAULT_REGISTRY', () => {
  it('gives every role at least one variant', () => {
    for (const role of Object.keys(DEFAULT_REGISTRY) as Role[]) {
      expect(DEFAULT_REGISTRY[role].variants.length).toBeGreaterThan(0);
    }
  });

  it('points every active id at a real variant', () => {
    for (const role of Object.keys(DEFAULT_REGISTRY) as Role[]) {
      const { active, variants } = DEFAULT_REGISTRY[role];
      expect(variants.some((v) => v.id === active)).toBe(true);
    }
  });

  it('offers three wood variants as the shipped proof of the seam', () => {
    expect(DEFAULT_REGISTRY['wood.cabinet'].variants.map((v) => v.id))
      .toEqual(['walnut', 'oak', 'ash']);
  });
});

describe('applyFinishes', () => {
  it('restyles every mesh whose material carries a known role', () => {
    const root = new THREE.Group();
    root.add(meshWithMaterial('role.wood.cabinet'));
    root.add(meshWithMaterial('role.worktop'));
    expect(applyFinishes(root)).toBe(2);
  });

  it('applies the active variant colour', () => {
    const root = new THREE.Group();
    const mesh = meshWithMaterial('role.wood.cabinet');
    root.add(mesh);
    applyFinishes(root);
    const expected = DEFAULT_REGISTRY['wood.cabinet'].variants
      .find((v) => v.id === DEFAULT_REGISTRY['wood.cabinet'].active)!.params.color;
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(expected);
  });

  it('changes only wood surfaces when the wood variant changes', () => {
    const root = new THREE.Group();
    const wood = meshWithMaterial('role.wood.cabinet');
    const top = meshWithMaterial('role.worktop');
    root.add(wood, top);
    applyFinishes(root);
    const topBefore = (top.material as THREE.MeshStandardMaterial).color.getHex();

    const swapped = structuredClone(DEFAULT_REGISTRY);
    swapped['wood.cabinet'].active = 'oak';
    applyFinishes(root, swapped);

    const oak = swapped['wood.cabinet'].variants.find((v) => v.id === 'oak')!;
    expect((wood.material as THREE.MeshStandardMaterial).color.getHex()).toBe(oak.params.color);
    expect((top.material as THREE.MeshStandardMaterial).color.getHex()).toBe(topBefore);
  });

  it('leaves meshes with unrecognised materials untouched', () => {
    const root = new THREE.Group();
    const stray = meshWithMaterial('Material.042');
    root.add(stray);
    expect(applyFinishes(root)).toBe(0);
    expect((stray.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x000000);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/finishes.test.ts`
Expected: FAIL — cannot resolve `./data/finishes`.

- [x] **Step 3: Write minimal implementation**

Create `src/data/finishes.ts`:

```ts
export type Role =
  | 'wood.cabinet' | 'wood.trim' | 'panel.wall' | 'panel.locker'
  | 'upholstery.seat' | 'upholstery.bolster' | 'upholstery.sofa'
  | 'worktop' | 'floor' | 'washroom.shell' | 'washroom.duckboard'
  | 'metal.brushed' | 'metal.chrome' | 'metal.dark' | 'textile.curtain'
  | 'led.cove' | 'glass';

export interface MaterialParams {
  readonly color: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
}

export interface Variant {
  readonly id: string;
  readonly label: string;
  readonly params: MaterialParams;
}

export type Registry = Record<Role, { active: string; variants: Variant[] }>;

const one = (id: string, label: string, params: MaterialParams) => ({
  active: id,
  variants: [{ id, label, params }],
});

/** Colours are estimated from the reference imagery — see the research note's palette table. */
export const DEFAULT_REGISTRY: Registry = {
  'wood.cabinet': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.45, metalness: 0 } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.55, metalness: 0 } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.6,  metalness: 0 } },
    ],
  },
  'wood.trim': {
    active: 'walnut',
    variants: [
      { id: 'walnut', label: 'Walnut',    params: { color: 0x5a3a24, roughness: 0.35, metalness: 0 } },
      { id: 'oak',    label: 'Oak',       params: { color: 0xa97f4f, roughness: 0.45, metalness: 0 } },
      { id: 'ash',    label: 'Light ash', params: { color: 0xd8c3a0, roughness: 0.5,  metalness: 0 } },
    ],
  },
  'panel.wall':        one('bone', 'Bone', { color: 0xefe7da, roughness: 0.8, metalness: 0 }),
  'panel.locker':      one('bone-gloss', 'Bone gloss', { color: 0xefe7da, roughness: 0.25, metalness: 0 }),
  'upholstery.seat':   one('cream', 'Cream leather', { color: 0xe8e1d5, roughness: 0.7, metalness: 0 }),
  'upholstery.bolster':one('camel', 'Camel leather', { color: 0xb08052, roughness: 0.7, metalness: 0 }),
  'upholstery.sofa':   one('white-cream', 'White cream leather', { color: 0xf2ede4, roughness: 0.7, metalness: 0 }),
  'worktop':           one('grey-stone', 'Grey stone', { color: 0xc9c6be, roughness: 0.35, metalness: 0 }),
  'floor':             one('grey-vinyl', 'Grey vinyl', { color: 0x7c8288, roughness: 0.75, metalness: 0 }),
  'washroom.shell':    one('gloss-white', 'Gloss white GRP', { color: 0xf7f7f5, roughness: 0.15, metalness: 0 }),
  'washroom.duckboard':one('teak', 'Teak', { color: 0x9a6b3c, roughness: 0.6, metalness: 0 }),
  'metal.brushed':     one('aluminium', 'Brushed aluminium', { color: 0xb8bcc0, roughness: 0.35, metalness: 1 }),
  'metal.chrome':      one('chrome', 'Chrome', { color: 0xffffff, roughness: 0.05, metalness: 1 }),
  'metal.dark':        one('black', 'Matt black', { color: 0x1e1e1e, roughness: 0.4, metalness: 0.8 }),
  'textile.curtain':   one('sand', 'Sand', { color: 0xd9cfbe, roughness: 0.95, metalness: 0 }),
  'led.cove': {
    active: 'warm',
    variants: [
      { id: 'warm',    label: 'Warm white',    params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xffd9a0, emissiveIntensity: 6 } },
      { id: 'neutral', label: 'Neutral white', params: { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xfff3e0, emissiveIntensity: 6 } },
    ],
  },
  'glass':             one('clear', 'Clear', { color: 0xdfe6ea, roughness: 0.05, metalness: 0 }),
};

export const ALL_ROLES = Object.keys(DEFAULT_REGISTRY) as Role[];
```

Create `src/finishes.ts`:

```ts
import * as THREE from 'three';
import { ALL_ROLES, DEFAULT_REGISTRY, type Registry, type Role } from './data/finishes';

const ROLE_SET = new Set<string>(ALL_ROLES);

/**
 * `role.wood.cabinet` -> `wood.cabinet`.
 * Blender appends `.001` to duplicated material names, so a trailing numeric suffix is stripped
 * before the lookup. Returns null for anything that is not a known role.
 */
export const roleOf = (materialName: string): Role | null => {
  if (!materialName.startsWith('role.')) return null;
  const body = materialName.slice('role.'.length).replace(/\.\d{3}$/, '');
  return ROLE_SET.has(body) ? (body as Role) : null;
};

/** Applies the active variant of each role to every matching mesh. Returns how many it restyled. */
export const applyFinishes = (
  root: THREE.Object3D,
  registry: Registry = DEFAULT_REGISTRY,
): number => {
  let restyled = 0;

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      const role = roleOf(material.name);
      if (!role) continue;

      const slot = registry[role];
      const variant = slot.variants.find((v) => v.id === slot.active);
      if (!variant) continue;

      const p = variant.params;
      material.color.setHex(p.color);
      material.roughness = p.roughness;
      material.metalness = p.metalness;
      material.emissive.setHex(p.emissive ?? 0x000000);
      material.emissiveIntensity = p.emissiveIntensity ?? 1;
      material.needsUpdate = true;
      restyled++;
    }
  });

  return restyled;
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/finishes.test.ts`
Expected: PASS, 11 tests.

- [x] **Step 5: Commit**

```bash
git add src/data/finishes.ts src/finishes.ts src/finishes.test.ts
git commit -m "feat: add role-keyed finish registry and runtime application"
```

---

## Task 11: Camera hotspots

**Files:**
- Modify: `src/data/vehicle.ts` (add `HOTSPOTS`)
- Create: `src/camera.ts`
- Test: `src/camera.test.ts`

**Interfaces:**
- Consumes: `ZoneId` from `./data/vehicle`
- Produces:
  - `interface Hotspot { id: ZoneId; label: string; camera: { position: [n,n,n]; target: [n,n,n] }; orbit: { azimuth: [n,n]; polar: [n,n]; distance: [n,n] } }` — **metres and radians**, already converted, because these are camera values rather than vehicle dimensions
  - `const HOTSPOTS: readonly Hotspot[]`
  - `clamp(v: number, lo: number, hi: number): number`
  - `easeInOutCubic(t: number): number`
  - `applyHotspotLimits(controls: OrbitControls, h: Hotspot): void`
  - `tweenTo(bundle: SceneBundle, h: Hotspot, ms?: number): Promise<void>`

- [x] **Step 1: Write the failing test**

Create `src/camera.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HOTSPOTS } from './data/vehicle';
import { clamp, easeInOutCubic } from './camera';

describe('clamp', () => {
  it('passes values inside the range through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps below and above', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('easeInOutCubic', () => {
  it('is pinned at both ends', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('passes through the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('is monotonic', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('HOTSPOTS', () => {
  it('covers every zone a viewer can visit', () => {
    const ids = HOTSPOTS.map((h) => h.id);
    for (const z of ['alcove', 'dinette', 'sofa', 'galley', 'washroom']) {
      expect(ids).toContain(z);
    }
  });

  it('has unique ids', () => {
    const ids = HOTSPOTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders every limit range low-to-high', () => {
    for (const h of HOTSPOTS) {
      expect(h.orbit.azimuth[0]).toBeLessThan(h.orbit.azimuth[1]);
      expect(h.orbit.polar[0]).toBeLessThan(h.orbit.polar[1]);
      expect(h.orbit.distance[0]).toBeLessThan(h.orbit.distance[1]);
    }
  });

  it('keeps polar angles inside the legal 0..PI range', () => {
    for (const h of HOTSPOTS) {
      expect(h.orbit.polar[0]).toBeGreaterThanOrEqual(0);
      expect(h.orbit.polar[1]).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('places every camera inside the vehicle, roughly at eye height', () => {
    for (const h of HOTSPOTS) {
      const [x, y, z] = h.camera.position;
      expect(Math.abs(x)).toBeLessThan(2.0);
      expect(y).toBeGreaterThan(0.3);
      expect(y).toBeLessThan(2.0);
      expect(z).toBeGreaterThan(-2.0);
      expect(z).toBeLessThan(4.2);
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/camera.test.ts`
Expected: FAIL — `HOTSPOTS` is not exported and `./camera` does not exist.

- [x] **Step 3: Write minimal implementation**

Append to `src/data/vehicle.ts`:

```ts
export interface Hotspot {
  readonly id: ZoneId;
  readonly label: string;
  /** Metres, in the runtime frame. */
  readonly camera: {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  /** Radians for angles, metres for distance. */
  readonly orbit: {
    readonly azimuth: readonly [number, number];
    readonly polar: readonly [number, number];
    readonly distance: readonly [number, number];
  };
}

const D = Math.PI / 180;

export const HOTSPOTS: readonly Hotspot[] = [
  {
    id: 'dinette',
    label: 'Lounge',
    camera: { position: [-0.2, 1.35, 2.9], target: [0.55, 0.85, 0.9] },
    orbit: { azimuth: [-70 * D, 70 * D], polar: [60 * D, 105 * D], distance: [1.2, 3.4] },
  },
  {
    id: 'alcove',
    label: 'Alcove bed',
    camera: { position: [0.0, 1.5, 1.5], target: [0.0, 1.35, -0.7] },
    orbit: { azimuth: [-45 * D, 45 * D], polar: [65 * D, 100 * D], distance: [1.0, 2.6] },
  },
  {
    id: 'sofa',
    label: 'Slide-out bed',
    camera: { position: [0.35, 1.3, 2.4], target: [-1.05, 0.6, 1.1] },
    orbit: { azimuth: [-120 * D, 20 * D], polar: [60 * D, 105 * D], distance: [1.0, 2.8] },
  },
  {
    id: 'galley',
    label: 'Galley',
    camera: { position: [0.1, 1.45, 2.2], target: [0.85, 1.0, 3.3] },
    orbit: { azimuth: [-30 * D, 90 * D], polar: [60 * D, 100 * D], distance: [0.9, 2.4] },
  },
  {
    id: 'washroom',
    label: 'Washroom',
    camera: { position: [-0.3, 1.45, 2.2], target: [-0.85, 1.0, 3.1] },
    orbit: { azimuth: [-90 * D, 30 * D], polar: [60 * D, 100 * D], distance: [0.8, 2.0] },
  },
  {
    id: 'cab',
    label: 'Cab',
    camera: { position: [0.0, 1.4, 0.9], target: [0.0, 1.0, -1.3] },
    orbit: { azimuth: [-50 * D, 50 * D], polar: [65 * D, 100 * D], distance: [1.0, 2.6] },
  },
];
```

Create `src/camera.ts`:

```ts
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Hotspot } from './data/vehicle';
import type { SceneBundle } from './scene';

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Constrain orbiting so the viewer cannot end up outside the vehicle or inside a wall. */
export const applyHotspotLimits = (controls: OrbitControls, h: Hotspot): void => {
  const centreAzimuth = Math.atan2(
    h.camera.position[0] - h.camera.target[0],
    h.camera.position[2] - h.camera.target[2],
  );
  controls.minAzimuthAngle = centreAzimuth + h.orbit.azimuth[0];
  controls.maxAzimuthAngle = centreAzimuth + h.orbit.azimuth[1];
  controls.minPolarAngle = h.orbit.polar[0];
  controls.maxPolarAngle = h.orbit.polar[1];
  controls.minDistance = h.orbit.distance[0];
  controls.maxDistance = h.orbit.distance[1];
  controls.update();
};

/** Fly the camera to a hotspot, then re-apply that hotspot's orbit limits. */
export const tweenTo = (bundle: SceneBundle, h: Hotspot, ms = 900): Promise<void> => {
  const { camera, controls } = bundle;

  // Limits must be released for the flight, or the tween fights the clamp.
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  controls.enabled = false;

  const fromPos = camera.position.clone();
  const fromTgt = controls.target.clone();
  const toPos = new THREE.Vector3(...h.camera.position);
  const toTgt = new THREE.Vector3(...h.camera.target);
  const start = performance.now();

  return new Promise((resolve) => {
    const step = () => {
      const t = clamp((performance.now() - start) / ms, 0, 1);
      const k = easeInOutCubic(t);
      camera.position.lerpVectors(fromPos, toPos, k);
      controls.target.lerpVectors(fromTgt, toTgt, k);
      controls.update();

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        controls.enabled = true;
        applyHotspotLimits(controls, h);
        resolve();
      }
    };
    step();
  });
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/camera.test.ts`
Expected: PASS, 9 tests.

- [x] **Step 5: Commit**

```bash
git add src/data/vehicle.ts src/camera.ts src/camera.test.ts
git commit -m "feat: add hotspot camera tweening with per-hotspot orbit limits"
```

---

> **Tasks 12 and 13 have a standalone guide:**
> [guide_rv-blender-modelling.md](guide_rv-blender-modelling.md).
> `model/rv.blend` is now generated from the placement data by `npm run starter`, so both tasks
> start from a correctly scaled block-out rather than an empty file. Follow the guide; the two
> tasks below record the original intent.

## Task 12: Model the shell in Blender

> **Partially complete.** Steps 3–5 are done: `src/loader.ts` exists, loads, and was verified in
> the browser. Step 1 (modelling) is outstanding — `model/rv.blend` holds a generated block-out,
> not a modelled shell. Step 2 is left open because, although it runs cleanly against the
> block-out, it has to be re-run against the real geometry to mean anything.

**Files:**
- Create: `model/rv.blend` (binary), `dist/raw/shell.glb` (generated), `public/models/shell.glb` (generated)
- Create: `src/loader.ts`
- Modify: `src/main.ts`
- Test: manual visual plus `pnpm budget`

**Interfaces:**
- Consumes: `bindPlacements`, `applyFinishes`, `PLACEMENTS`
- Produces: `loadModules(names: string[]): Promise<THREE.Group>`

- [ ] **Step 1: Build the shell in Blender**

Open Blender, set scene units to metres. Create a collection named `shell` containing objects named exactly: `floor`, `ceiling`, `wall_off`, `wall_kerb`, `bulkhead`, `wall_rear`, `slideout_shell`.

Match the grey-box dimensions from `PLACEMENTS` (use the values as validated at the Task 6 gate, not the originals if they moved). Model the interior faces only — normals point inward. Add:

- The roof hatch aperture above the aisle, at roughly `Z` 1.4 m.
- Window apertures: one over the sofa in the slide-out, one at the dinette on the kerb side, two in the alcove flanks.
- A cove recess along both ceiling edges, 60 mm deep, running the habitation length. This is where the LED strips live and it is what makes the lighting read correctly, so do not skip it.

Assign materials `role.panel.wall` to walls and ceiling, `role.floor` to the floor, `role.led.cove` to a thin strip inside each cove recess, `role.glass` to window panes.

Bake AO per object into UV map 2.

- [ ] **Step 2: Export, optimise, and check the budget**

```bash
mkdir -p dist/raw public/models
pnpm export
pnpm optimize
pnpm budget
```

Expected: `shell.glb` in both directories, `Budget OK.`

- [x] **Step 3: Write the loader**

Create `src/loader.ts`:

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const KTX2_PATH = 'https://cdn.jsdelivr.net/npm/three/examples/jsm/libs/basis/';

let loader: GLTFLoader | null = null;

const getLoader = (renderer: THREE.WebGLRenderer): GLTFLoader => {
  if (loader) return loader;

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  const ktx2 = new KTX2Loader().setTranscoderPath(KTX2_PATH).detectSupport(renderer);

  loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
  return loader;
};

/** Loads each module .glb from public/models and returns them under one group. */
export const loadModules = async (
  renderer: THREE.WebGLRenderer,
  names: readonly string[],
): Promise<THREE.Group> => {
  const gltfLoader = getLoader(renderer);
  const root = new THREE.Group();
  root.name = 'vehicle';

  const loaded = await Promise.all(
    names.map((n) => gltfLoader.loadAsync(`/models/${n}.glb`)),
  );

  for (const gltf of loaded) root.add(gltf.scene);
  return root;
};
```

Replace `src/main.ts`:

```ts
import { createScene } from './scene';
import { loadModules } from './loader';
import { applyFinishes } from './finishes';
import { checkAll } from './check';

const violations = checkAll();
if (violations.length) console.error('Dimensional violations:', violations);

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const bundle = createScene(canvas);
const vehicle = await loadModules(bundle.renderer, ['shell']);
applyFinishes(vehicle);
bundle.scene.add(vehicle);
bundle.renderer.setAnimationLoop(bundle.render);
```

- [x] **Step 4: Verify in the browser**

Run: `pnpm dev`
Expected: the shell loads, walls and floor take their registry colours, no console errors. `pnpm check` still clean.

- [x] **Step 5: Commit**

```bash
git add model/rv.blend src/loader.ts src/main.ts
git commit -m "feat: model and load the habitation shell"
```

---

## Task 13: Model the furniture modules

> **Outstanding.** The block-out generator has created every object at the correct size, place,
> name and material, and steps 2–5 have been exercised once against it, so the pipeline is known
> to work. None of the eight collections has been sculpted. Steps 1–5 repeat per collection.

**Files:**
- Modify: `model/rv.blend`, `src/main.ts`
- Test: `pnpm test`, `pnpm budget`, visual comparison

Do these **one collection at a time**, in this order. Each is its own commit. Washroom is last because it is the hardest and least visible.

Order: `dinette` → `sofa_slideout` → `alcove_bed` → `lockers` → `cab` → `galley` → `softgoods` → `washroom`

- [ ] **Step 1: Model one collection**

Create the collection in `model/rv.blend`. Object names must exactly match the `PLACEMENTS` ids in that zone. Reference the photographs in `docs/research/reference/` throughout:

| Collection | Objects | Reference image |
|---|---|---|
| `dinette` | `dinette_chair_fwd_in`, `dinette_chair_fwd_out`, `dinette_chair_aft_in`, `dinette_chair_aft_out`, `dinette_table` | `dinette-and-slideout-bed.jpg`, `galley-wardrobe-dinette.jpg` |
| `sofa_slideout` | `slideout_base`, `slideout_bed` | `dinette-and-slideout-bed.jpg`, `bed-dimensions.jpg` |
| `alcove_bed` | `alcove_bed`, `alcove_lockers` | `interior-lounge-and-overcab.jpg` |
| `lockers` | `lockers_kerb`, `lockers_off` | `interior-lounge-and-overcab.jpg` |
| `cab` | `cab_seat_off`, `cab_seat_kerb` | `interior-lounge-and-overcab.jpg` |
| `galley` | `galley_run`, `galley_overhead`, `fridge`, `wardrobe` | `galley-detail.jpg`, `galley-wardrobe-dinette.jpg` |
| `softgoods` | curtains, scatter cushions, bedding — **not in `PLACEMENTS`**, so name them freely | all |
| `washroom` | `washroom_pod` | `underseat-drawers-washroom.jpg` |

Material roles per collection: seats use `role.upholstery.seat` and `role.upholstery.bolster`; sofa uses `role.upholstery.sofa`; all cabinetry `role.wood.cabinet`; worktops `role.worktop`; handles and rails `role.metal.brushed`; taps `role.metal.chrome`; the kitchen mixer `role.metal.dark`; washroom mouldings `role.washroom.shell`; the shower duckboard `role.washroom.duckboard`; curtains `role.textile.curtain`.

Bake AO per object into UV map 2.

- [ ] **Step 2: Export and check**

```bash
pnpm export && pnpm optimize && pnpm budget && pnpm test
```

Expected: `Budget OK.`, all tests pass. If the budget fails, decimate the collection you just added rather than trimming an earlier one.

- [ ] **Step 3: Load it**

Add the module name to the array in `src/main.ts`:

```ts
const vehicle = await loadModules(bundle.renderer, [
  'shell', 'dinette', 'sofa_slideout', 'alcove_bed', 'lockers', 'cab', 'galley', 'softgoods', 'washroom',
]);
```

Add only the collections that exist so far. Binding is not yet wired into `main.ts` — Task 15 does that, once every module exists.

- [ ] **Step 4: Verify in the browser**

Run: `pnpm dev`
Expected: the new module appears in the right place at the right size, with registry colours applied.

- [ ] **Step 5: Commit, one per collection**

```bash
git add model/rv.blend src/main.ts
git commit -m "feat: model the <collection> module"
```

---

## Task 14: Lighting

**Files:**
- Create: `src/lighting.ts`
- Modify: `src/scene.ts`, `src/main.ts`
- Test: `src/lighting.test.ts`, plus visual comparison

**Interfaces:**
- Consumes: `THREE.WebGLRenderer`, `THREE.Scene`
- Produces:
  - `coveLightSpecs(): CoveSpec[]` — pure, testable
  - `installLighting(scene, renderer, vehicle): { refreshProbe: () => void }`

- [x] **Step 1: Write the failing test**

Create `src/lighting.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { coveLightSpecs } from './lighting';

describe('coveLightSpecs', () => {
  it('places one cove light run down each side of the cabin', () => {
    const specs = coveLightSpecs();
    expect(specs.filter((s) => s.position[0] < 0).length).toBeGreaterThan(0);
    expect(specs.filter((s) => s.position[0] > 0).length).toBeGreaterThan(0);
  });

  it('keeps the count low enough for the mobile budget', () => {
    // RectAreaLights are expensive and cast no shadows; the probe does the heavy lifting.
    expect(coveLightSpecs().length).toBeLessThanOrEqual(6);
  });

  it('mounts every cove light near the ceiling', () => {
    for (const s of coveLightSpecs()) {
      expect(s.position[1]).toBeGreaterThan(1.6);
    }
  });

  it('aims every cove light inward and downward', () => {
    for (const s of coveLightSpecs()) {
      expect(s.lookAt[1]).toBeLessThan(s.position[1]);
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lighting.test.ts`
Expected: FAIL — cannot resolve `./lighting`.

- [x] **Step 3: Write minimal implementation**

Create `src/lighting.ts`:

```ts
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export interface CoveSpec {
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly intensity: number;
}

const WARM = 0xffd9a0;

/**
 * Four RectAreaLights: one per ceiling cove, split fore and aft so the long cabin does not
 * fall off in the middle. Deliberately few — the environment probe supplies the bounce, and
 * RectAreaLights are the expensive part of this scene.
 */
export const coveLightSpecs = (): CoveSpec[] => [
  { position: [-1.05, 1.92, 0.9], lookAt: [-0.2, 0.9, 0.9], width: 1.8, height: 0.06, intensity: 12 },
  { position: [-1.05, 1.92, 2.9], lookAt: [-0.2, 0.9, 2.9], width: 1.8, height: 0.06, intensity: 12 },
  { position: [1.05, 1.92, 0.9],  lookAt: [0.2, 0.9, 0.9],  width: 1.8, height: 0.06, intensity: 12 },
  { position: [1.05, 1.92, 2.9],  lookAt: [0.2, 0.9, 2.9],  width: 1.8, height: 0.06, intensity: 12 },
];

export const installLighting = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  vehicle: THREE.Object3D,
) => {
  RectAreaLightUniformsLib.init();

  for (const spec of coveLightSpecs()) {
    const light = new THREE.RectAreaLight(WARM, spec.intensity, spec.width, spec.height);
    light.position.set(...spec.position);
    light.lookAt(new THREE.Vector3(...spec.lookAt));
    scene.add(light);
  }

  // Daylight through the roof hatch — the only shadow caster in the scene.
  const hatch = new THREE.DirectionalLight(0xdfe9ff, 2.5);
  hatch.position.set(0.3, 6, 1.2);
  hatch.target.position.set(0, 0, 1.4);
  hatch.castShadow = true;
  hatch.shadow.mapSize.set(1024, 1024);
  hatch.shadow.camera.near = 1;
  hatch.shadow.camera.far = 12;
  scene.add(hatch, hatch.target);

  /**
   * The trick that replaces a lightmap: render the cabin to a cubemap with the LED strips
   * emissive, and use the result as the scene environment. One pass buys most of the bounce
   * light, and unlike a bake it does not pin the furniture in place.
   */
  const cubeTarget = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const probeCamera = new THREE.CubeCamera(0.1, 20, cubeTarget);
  probeCamera.position.set(0, 1.2, 1.6);
  scene.add(probeCamera);

  const refreshProbe = () => {
    scene.environment = null;
    probeCamera.update(renderer, scene);
    scene.environment = cubeTarget.texture;
    scene.environmentIntensity = 1.1;
  };

  vehicle.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  refreshProbe();
  return { refreshProbe };
};
```

Modify `src/scene.ts`: delete the `HemisphereLight` and `DirectionalLight` placeholder block added in Task 6, and its comment.

Modify `src/main.ts` to call `installLighting(bundle.scene, bundle.renderer, vehicle)` after `applyFinishes(vehicle)`, keeping the returned `refreshProbe` for Task 15.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lighting.test.ts && pnpm check`
Expected: PASS, 4 tests, `tsc` clean.

- [ ] **Step 5: Tune against the references** — blocked: needs real geometry to tune against

Run `pnpm dev`. Compare to `docs/research/reference/interior-lounge-and-overcab.jpg`. Adjust, in this order, one at a time:

1. `renderer.toneMappingExposure` in `scene.ts` — overall brightness
2. `scene.environmentIntensity` in `lighting.ts` — how much bounce fill
3. `intensity` in `coveLightSpecs` — how strongly the coves read
4. `emissiveIntensity` on `led.cove` in `src/data/finishes.ts` — how bright the strips look in frame

- [x] **Step 6: Commit**

```bash
git add src/lighting.ts src/scene.ts src/main.ts src/lighting.test.ts src/data/finishes.ts
git commit -m "feat: add real-time interior lighting with an environment probe"
```

---

## Task 15: UI, wiring, and the shipped finish swap

**Files:**
- Create: `src/ui.ts`
- Modify: `src/main.ts`, `index.html`
- Test: `src/ui.test.ts`

**Interfaces:**
- Consumes: `HOTSPOTS`, `tweenTo`, `DEFAULT_REGISTRY`, `applyFinishes`
- Produces: `buildUi(opts): HTMLElement`, `WOOD_ROLES: Role[]`

- [x] **Step 1: Write the failing test**

Create `src/ui.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildUi, WOOD_ROLES } from './ui';
import { HOTSPOTS } from './data/vehicle';
import { DEFAULT_REGISTRY } from './data/finishes';

describe('WOOD_ROLES', () => {
  it('covers both wood roles, so a swap restyles cabinets and trim together', () => {
    expect(WOOD_ROLES).toEqual(['wood.cabinet', 'wood.trim']);
  });
});

describe('buildUi', () => {
  it('renders one button per hotspot', () => {
    const el = buildUi({ onHotspot: vi.fn(), onWood: vi.fn() });
    expect(el.querySelectorAll('[data-hotspot]').length).toBe(HOTSPOTS.length);
  });

  it('renders one swatch per wood variant', () => {
    const el = buildUi({ onHotspot: vi.fn(), onWood: vi.fn() });
    const expected = DEFAULT_REGISTRY['wood.cabinet'].variants.length;
    expect(el.querySelectorAll('[data-wood]').length).toBe(expected);
  });

  it('calls back with the hotspot id when a button is clicked', () => {
    const onHotspot = vi.fn();
    const el = buildUi({ onHotspot, onWood: vi.fn() });
    (el.querySelector('[data-hotspot="galley"]') as HTMLButtonElement).click();
    expect(onHotspot).toHaveBeenCalledWith('galley');
  });

  it('calls back with the variant id when a swatch is clicked', () => {
    const onWood = vi.fn();
    const el = buildUi({ onHotspot: vi.fn(), onWood });
    (el.querySelector('[data-wood="oak"]') as HTMLButtonElement).click();
    expect(onWood).toHaveBeenCalledWith('oak');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
pnpm add -D jsdom
pnpm exec vitest run src/ui.test.ts
```

Expected: FAIL — cannot resolve `./ui`.

- [x] **Step 3: Write minimal implementation**

Create `src/ui.ts`:

```ts
import { HOTSPOTS, type ZoneId } from './data/vehicle';
import { DEFAULT_REGISTRY, type Role } from './data/finishes';

/** Both wood roles swap together — cabinets and trim are the same timber in a real vehicle. */
export const WOOD_ROLES: Role[] = ['wood.cabinet', 'wood.trim'];

export interface UiOptions {
  onHotspot: (id: ZoneId) => void;
  onWood: (variantId: string) => void;
}

export const buildUi = (opts: UiOptions): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'ui';

  const zones = document.createElement('nav');
  zones.className = 'ui-zones';
  for (const h of HOTSPOTS) {
    const b = document.createElement('button');
    b.dataset.hotspot = h.id;
    b.textContent = h.label;
    b.addEventListener('click', () => opts.onHotspot(h.id));
    zones.appendChild(b);
  }

  const finishes = document.createElement('div');
  finishes.className = 'ui-finishes';
  for (const v of DEFAULT_REGISTRY['wood.cabinet'].variants) {
    const b = document.createElement('button');
    b.dataset.wood = v.id;
    b.title = v.label;
    b.style.background = `#${v.params.color.toString(16).padStart(6, '0')}`;
    b.addEventListener('click', () => opts.onWood(v.id));
    finishes.appendChild(b);
  }

  root.append(zones, finishes);
  return root;
};
```

Replace `src/main.ts`:

```ts
import { createScene } from './scene';
import { loadModules } from './loader';
import { applyFinishes } from './finishes';
import { installLighting } from './lighting';
import { bindPlacements } from './binding';
import { tweenTo } from './camera';
import { buildUi, WOOD_ROLES } from './ui';
import { checkAll } from './check';
import { HOTSPOTS } from './data/vehicle';
import { DEFAULT_REGISTRY } from './data/finishes';

const violations = checkAll();
if (violations.length) console.error('Dimensional violations:', violations);

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const bundle = createScene(canvas);
const vehicle = await loadModules(bundle.renderer, [
  'shell', 'dinette', 'sofa_slideout', 'alcove_bed',
  'lockers', 'cab', 'galley', 'softgoods', 'washroom',
]);

bindPlacements(vehicle); // throws loudly if a Blender rename broke the contract

const registry = structuredClone(DEFAULT_REGISTRY);
applyFinishes(vehicle, registry);
bundle.scene.add(vehicle);

const { refreshProbe } = installLighting(bundle.scene, bundle.renderer, vehicle);

document.body.appendChild(
  buildUi({
    onHotspot: (id) => {
      const h = HOTSPOTS.find((x) => x.id === id);
      if (h) void tweenTo(bundle, h);
    },
    onWood: (variantId) => {
      for (const role of WOOD_ROLES) registry[role].active = variantId;
      applyFinishes(vehicle, registry);
      refreshProbe(); // the room's albedo changed, so the bounce light must too
    },
  }),
);

void tweenTo(bundle, HOTSPOTS[0]!, 0);
bundle.renderer.setAnimationLoop(bundle.render);
```

Add to the `<style>` block in `index.html`:

```css
.ui { position: fixed; left: 16px; bottom: 16px; display: flex; gap: 24px;
      font: 13px system-ui, sans-serif; }
.ui-zones, .ui-finishes { display: flex; gap: 8px; }
.ui button { border: 0; border-radius: 6px; padding: 8px 12px; cursor: pointer;
             background: rgba(255,255,255,.85); color: #111; }
.ui-finishes button { width: 32px; height: 32px; padding: 0;
                      border: 2px solid rgba(255,255,255,.7); }
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run && pnpm check`
Expected: all tests pass across every file, `tsc` clean.

- [ ] **Step 5: Verify all success criteria** — blocked: needs real geometry

- Click each zone button — camera flies there and orbit stays inside the vehicle.
- Click each wood swatch — every wood surface changes, nothing else does.
- Compare three viewpoints against the reference images.
- Check frame rate at 1080p desktop and on a phone.
- Run `pnpm budget`.

Record the results in a `## Verification` section at the end of the spec.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add hotspot navigation UI and the wood finish swap"
```

---

## Self-Review

**Spec coverage.** Every section maps to at least one task: §1 goals → Tasks 6, 14, 15; §2 dimensional reconstruction → Tasks 2–6; §3 data model → Tasks 2, 3, 4, 10, 11; §4 asset pipeline → Tasks 7, 8, 12, 13; §5 runtime architecture → every file in the table has an owning task; §6 lighting → Task 14; §7 verification → Tasks 5, 8, 15; §8 phasing → task order; §9 risks → risk 1 and 4 are the Task 6 gate, risk 3 is Task 13's ordering, risk 5 is Task 14's light count test.

**Placeholder scan.** No TBD, TODO, or "similar to Task N". Every code step carries real code.

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
