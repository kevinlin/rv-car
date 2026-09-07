# Plan view and sculpted exterior — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

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

`Hotspot.id` is typed `ZoneId`, which also feeds `ZONE_VOLUME` and `Placement.zone`. A camera stop
is not a zone. Two tests currently discriminate on `id !== 'exterior'` with a cast, meaning "is
this an interior stop"; a camera 8 m above the roof is neither, and would fail both.

**Files:**
- Modify: `src/data/vehicle.ts:3-5` (add `StopId`), `src/data/vehicle.ts:178` (`Hotspot.id`)
- Test: `src/camera.test.ts:79`, `src/camera.test.ts:83`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type StopId = ZoneId | 'plan'`, and `Hotspot.id: StopId`.

- [ ] **Step 1: Rewrite the two straining invariants to discriminate on view kind**

In `src/camera.test.ts`, replace the body of `'gives every interior stop free look'`:

```ts
  it('gives every interior stop free look', () => {
    // No stop inside the cabin may clamp azimuth: orbiting a 2.36 m cabin at 1.2 m radius
    // drives the camera through the walls. Discriminating on view.kind rather than on
    // id !== 'exterior' is what lets a second outside-the-cabin stop exist.
    const inside = HOTSPOTS.filter((h) => h.view.kind === 'look');
    expect(inside.length).toBeGreaterThanOrEqual(6);
    expect(inside.every((h) => h.view.kind === 'look')).toBe(true);
  });
```

and the body of `'places every interior camera inside the vehicle, roughly at eye height'`:

```ts
  it('places every interior camera inside the vehicle, roughly at eye height', () => {
    for (const h of HOTSPOTS) {
      if (h.view.kind !== 'look') continue; // outside stops stand where they must
      const [x, y, z] = h.camera.position;
      expect(Math.abs(x!)).toBeLessThan(2.0);
      expect(y!).toBeGreaterThan(0.3);
      expect(y!).toBeLessThan(2.0);
      expect(z!).toBeGreaterThan(-2.0);
      expect(z!).toBeLessThan(4.2);
    }
  });
```

- [ ] **Step 2: Run the tests and confirm they still pass**

Run: `pnpm exec vitest run src/camera.test.ts`
Expected: PASS. Nothing has changed behaviourally yet — this is the refactor that makes Task 3
possible, and it must be green before and after.

- [ ] **Step 3: Add `StopId` and retype `Hotspot.id`**

In `src/data/vehicle.ts`, after the `ZoneId` declaration:

```ts
/**
 * A camera stop is not a zone. ZoneId means "a zone furniture belongs to" — it feeds
 * ZONE_VOLUME, Placement.zone and the containment check — and the plan stop owns no furniture.
 */
export type StopId = ZoneId | 'plan';
```

and change `Hotspot`:

```ts
export interface Hotspot {
  readonly id: StopId;
```

- [ ] **Step 4: Run the full gate**

Run: `pnpm check`
Expected: PASS, 122 tests. `ui.ts` passes `h.id` to `opts.onHotspot`, so `UiOptions.onHotspot`
must widen to `(id: StopId) => void` and `main.ts`'s `HOTSPOTS.find((x) => x.id === id)` still
compiles. If `tsc` complains anywhere else, widen at the call site rather than narrowing here.

- [ ] **Step 5: Commit**

```bash
git add src/data/vehicle.ts src/camera.test.ts src/ui.ts
git commit -m "refactor: separate camera stop identity from zone identity"
```

## Task 2: Derive the cut height from the locker placements

**Files:**
- Modify: `src/data/vehicle.ts` (add `PLAN_CUT_MM` after `PLACEMENTS`)
- Test: `src/data/placements.test.ts`

**Interfaces:**
- Consumes: `PLACEMENTS` from Task 0 state (already exists).
- Produces: `export const PLAN_CUT_MM: number` — millimetres, currently 1400.

- [ ] **Step 1: Write the failing test**

Append to `src/data/placements.test.ts`:

```ts
describe('PLAN_CUT_MM', () => {
  const find = (id: string) => PLACEMENTS.find((p) => p.id === id)!;

  it('sits at or below every locker run, so the plan view loses all of them', () => {
    for (const id of ['lockers_off', 'lockers_kerb', 'alcove_lockers']) {
      expect(PLAN_CUT_MM).toBeLessThanOrEqual(find(id).origin[1].v);
    }
  });

  it('sits above every mattress, so no bed renders sliced', () => {
    for (const id of ['alcove_bed', 'slideout_bed']) {
      const p = find(id);
      expect(PLAN_CUT_MM).toBeGreaterThanOrEqual(p.origin[1].v + p.size[1].v);
    }
  });

  it('is 1400 mm today, which is the lounge lockers underside', () => {
    expect(PLAN_CUT_MM).toBe(1400);
  });
});
```

Add `PLAN_CUT_MM` to that file's import from `./vehicle`.

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm exec vitest run src/data/placements.test.ts`
Expected: FAIL — `PLAN_CUT_MM` is not exported from `./vehicle`.

- [ ] **Step 3: Implement it**

In `src/data/vehicle.ts`, immediately after the `PLACEMENTS` array:

```ts
/**
 * The horizontal section height for the plan stop, in millimetres.
 *
 * Derived, not chosen. Both lounge locker runs have their underside at 1400 and the alcove
 * mattress tops out at 1350, so one plane at 1400 takes the ceiling, both cove fascias and
 * every locker run with it while leaving the beds whole. Move a locker run and the cut
 * follows it; placements.test.ts fails if the relationship breaks.
 */
const underside = (id: string) => PLACEMENTS.find((p) => p.id === id)!.origin[1].v;

export const PLAN_CUT_MM = Math.min(underside('lockers_off'), underside('lockers_kerb'));
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm exec vitest run src/data/placements.test.ts`
Expected: PASS, including the `toBe(1400)` case.

- [ ] **Step 5: Commit**

```bash
git add src/data/vehicle.ts src/data/placements.test.ts
git commit -m "feat: derive the plan-view cut height from the locker placements"
```

## Task 3: Stop the environment probe seeing through the cut

Do this **before** the clip plane exists. `refreshProbe` re-renders the whole scene from a point
inside the cabin on every finish swap; with a clip plane set on the renderer it would capture a
roofless cabin open to a bright sky and permanently relight the interior. Fixing it first means
the clip plane can never ship in a broken state.

**Files:**
- Modify: `src/lighting.ts:73-87`
- Test: `src/lighting.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change. `refreshProbe(): void` behaves identically with clipping off.

- [ ] **Step 1: Write the failing test**

`src/lighting.test.ts` already imports `{ describe, it, expect }` from vitest and
`{ coveLightSpecs }` from `./lighting`. **Extend those two lines** rather than adding new ones —
add `installLighting` to the existing `./lighting` import, and add `import * as THREE from
'three';` above it. Then append:

```ts
describe('refreshProbe and clipping planes', () => {
  it('captures the probe with clipping off, and restores the caller planes', () => {
    // The probe camera sits inside the cabin. A clip plane set for the plan stop would let it
    // see sky through the missing roof, and every interior material's bounce light would
    // change for the rest of the session.
    const scene = new THREE.Scene();
    const vehicle = new THREE.Group();
    scene.add(vehicle);

    const planes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.4)];
    const seen: THREE.Plane[][] = [];
    const renderer = {
      clippingPlanes: planes,
      shadowMap: { autoUpdate: true, needsUpdate: false },
      // CubeCamera.update calls renderer.render six times; record what was set each time.
      render: () => { seen.push([...(renderer.clippingPlanes as THREE.Plane[])]); },
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      xr: { enabled: false },
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
    } as unknown as THREE.WebGLRenderer;

    const { refreshProbe } = installLighting(scene, renderer, vehicle, []);
    refreshProbe();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((p) => p.length === 0)).toBe(true);
    expect(renderer.clippingPlanes).toBe(planes);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm exec vitest run src/lighting.test.ts`
Expected: FAIL — the recorded planes still contain the clip plane, because nothing clears it.

- [ ] **Step 3: Implement the save, clear and restore**

In `src/lighting.ts`, inside `refreshProbe`, wrapping the capture. Put it directly alongside the
existing exterior-visibility save/restore, which solves the same shape of problem:

```ts
  const refreshProbe = () => {
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    const wasVisible = exterior.map((o) => o.visible);
    for (const o of exterior) o.visible = false;
    // The plan stop sections the vehicle at PLAN_CUT_MM. The probe camera stands inside the
    // cabin, so capturing with that plane set replaces the ceiling with sky and relights every
    // interior material. Same trap as the exterior body two lines up, same fix.
    const clipping = renderer.clippingPlanes;
    renderer.clippingPlanes = [];
    scene.environment = null;
    probeCamera.update(renderer, scene);
    renderer.clippingPlanes = clipping;
    exterior.forEach((o, i) => { o.visible = wasVisible[i]!; });
    scene.environment = cubeTarget.texture;
    scene.environmentIntensity = 2.5;
  };
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm exec vitest run src/lighting.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lighting.ts src/lighting.test.ts
git commit -m "fix: capture the environment probe with clipping disabled"
```

## Task 4: The plan hotspot and its clip plane

**Files:**
- Modify: `src/data/vehicle.ts` (`HOTSPOTS`), `src/camera.ts` (`arrive`), `src/scene.ts`
  (`localClippingEnabled`)
- Test: `src/camera.test.ts`

**Interfaces:**
- Consumes: `PLAN_CUT_MM` (Task 2), `StopId` (Task 1).
- Produces: a hotspot with `id: 'plan'`, `view.kind === 'orbit'`; `arrive()` now sets and clears
  `bundle.renderer.clippingPlanes`.

- [ ] **Step 1: Write the failing tests**

`src/camera.test.ts:2` currently imports `{ HOTSPOTS, PLACEMENTS, aabb }` from
`./data/vehicle`. Widen it to `{ HOTSPOTS, PLACEMENTS, PLAN_CUT_MM, aabb, type Hotspot }` — the
blocks below need both the constant and the type. Then append:

```ts
describe('the plan stop', () => {
  const plan = () => HOTSPOTS.find((h) => h.id === 'plan')!;

  it('exists and orbits', () => {
    expect(plan().view.kind).toBe('orbit');
  });

  it('stands above the roof, looking down the cabin', () => {
    const [x, y, z] = plan().camera.position;
    expect(y!).toBeGreaterThan(2.15);            // clear of the roof line
    expect(Math.abs(x!)).toBeLessThan(1.0);      // near the centreline
    expect(z!).toBeGreaterThan(0);
    expect(z!).toBeLessThan(4.05);               // within the habitation length
  });

  it('never tips below a steep three-quarter, where cut edges read as broken geometry', () => {
    const view = plan().view as Extract<Hotspot['view'], { kind: 'orbit' }>;
    expect(view.polar[0]).toBeGreaterThan(0);    // 0 exactly degenerates OrbitControls
    expect(view.polar[1]).toBeLessThanOrEqual(55 * (Math.PI / 180));
  });
});

describe('arrive sets the section plane', () => {
  it('clips at PLAN_CUT_MM at the plan stop and nowhere else', async () => {
    const b = bundle();                          // the existing stub factory in this file
    await tweenTo(b, HOTSPOTS.find((h) => h.id === 'plan')!, 0);
    expect(b.renderer.clippingPlanes).toHaveLength(1);
    expect(b.renderer.clippingPlanes[0]!.constant).toBeCloseTo(PLAN_CUT_MM / 1000, 6);
    expect(b.renderer.clippingPlanes[0]!.normal.y).toBe(-1);

    await tweenTo(b, HOTSPOTS.find((h) => h.id === 'galley')!, 0);
    expect(b.renderer.clippingPlanes).toHaveLength(0);
  });
});
```

The existing stub factory at `src/camera.test.ts:139` builds a `SceneBundle` with only a camera,
controls and look. Extend it to carry a renderer stub:

```ts
    const renderer = { clippingPlanes: [] as THREE.Plane[] };
    return { camera, controls, look, renderer } as unknown as SceneBundle;
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `pnpm exec vitest run src/camera.test.ts`
Expected: FAIL — no hotspot with id `'plan'`, so `plan()` returns undefined and the `!` throws.

- [ ] **Step 3: Add the hotspot**

Append to `HOTSPOTS` in `src/data/vehicle.ts`, after the exterior stop:

```ts
  {
    // The floorplan the manufacturer never published, shown rather than drawn. Above the roof
    // line at 2.15, on the centreline, targeted at the middle of the habitation box so the
    // whole 4.05 m of it fits the frame. Polar floor is 0.05 rather than 0 because
    // OrbitControls degenerates at the pole; the 55 deg ceiling lets the viewer tip toward a
    // three-quarter dollhouse without dropping to eye level, where the sectioned walls stop
    // reading as a cut and start reading as broken geometry.
    id: 'plan',
    label: 'Floorplan',
    camera: { position: [0.0, 7.4, 2.0], target: [0.0, 0.4, 2.0] },
    view: {
      kind: 'orbit',
      azimuth: [-Math.PI, Math.PI],
      polar: [0.05, 55 * D],
      distance: [5.0, 12.0],
    },
  },
```

- [ ] **Step 4: Set the plane on arrival**

In `src/camera.ts`, import `PLAN_CUT_MM` and rewrite `arrive`:

```ts
/**
 * The section plane for the plan stop. Normal points down, so everything above the constant is
 * clipped. Batching merges the whole vehicle into one mesh per role before the first frame, so
 * there is no ceiling or locker object left to hide by name — clipping is per-fragment and does
 * not care how the geometry was grouped.
 */
const SECTION = new THREE.Plane(new THREE.Vector3(0, -1, 0), PLAN_CUT_MM / 1000);

/** Hand the camera to whichever controller this hotspot's view calls for. */
const arrive = (bundle: SceneBundle, h: Hotspot): void => {
  const { camera, controls, look, renderer } = bundle;
  renderer.clippingPlanes = h.id === 'plan' ? [SECTION] : [];
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

- [ ] **Step 5: Enable clipping on the renderer**

In `src/scene.ts`, after `renderer.shadowMap.type = THREE.PCFShadowMap;`:

```ts
  // Global clipping planes are off by default and are what the plan stop sections the vehicle
  // with. Nothing else in the app sets a plane, so this is inert until that stop is visited.
  renderer.localClippingEnabled = true;
```

- [ ] **Step 6: Run the tests and the gate**

Run: `pnpm exec vitest run src/camera.test.ts && pnpm check`
Expected: PASS. `ui.ts` builds a button per hotspot, so a "Floorplan" button appears with no
further change.

- [ ] **Step 7: Verify in the browser**

Run: `pnpm dev`, open `http://localhost:5173/?verify`, click **Floorplan**.
Expected: the cabin seen from above with no ceiling, no cove fascias and no locker runs; both
mattresses whole; the white body shell, skirt and wheels surrounding the furniture. Read
`canvas.dataset.drawCalls` from devtools and confirm it is at or under 60.

Then click **Lounge** and confirm the ceiling is back.

- [ ] **Step 8: Commit**

```bash
git add src/data/vehicle.ts src/camera.ts src/scene.ts src/camera.test.ts
git commit -m "feat: add the plan stop, sectioned at the locker underside"
```

## Task 5: The label data

**Files:**
- Modify: `src/data/vehicle.ts` (add `PlanLabel`, `PLAN_LABELS`, `labelText`)
- Test: `src/data/placements.test.ts`

**Interfaces:**
- Consumes: `PLACEMENTS`, `Mm`.
- Produces:
  ```ts
  export interface PlanLabel {
    readonly text: string;
    readonly placement?: string;   // anchor and dimensions come from this placement
    readonly at?: readonly [Mm, Mm, Mm];  // explicit anchor, for things that are not placements
    readonly detail?: string;      // explicit detail line, for the same
  }
  export const PLAN_LABELS: readonly PlanLabel[];
  export const labelAnchorM: (l: PlanLabel) => [number, number, number];
  export const labelDetail: (l: PlanLabel) => string;
  ```

- [ ] **Step 1: Write the failing test**

Append to `src/data/placements.test.ts`:

```ts
describe('PLAN_LABELS', () => {
  it('names only placements that exist', () => {
    const ids = new Set(PLACEMENTS.map((p) => p.id));
    for (const l of PLAN_LABELS) {
      if (l.placement) expect(ids.has(l.placement)).toBe(true);
    }
  });

  it('gives every label exactly one anchor', () => {
    for (const l of PLAN_LABELS) {
      expect(Boolean(l.placement) !== Boolean(l.at)).toBe(true);
    }
  });

  it('reads dimensions off the geometry, carrying its confidence tag', () => {
    const bed = PLAN_LABELS.find((l) => l.placement === 'alcove_bed')!;
    // 2200 x 1400 is published, and is the number the parent spec calibrated the whole
    // reconstruction against. A label that could drift from it would be worse than no label.
    expect(labelDetail(bed)).toBe('2200 × 1400 published');
  });

  it('anchors at the placement centre, in metres', () => {
    const bed = PLAN_LABELS.find((l) => l.placement === 'alcove_bed')!;
    const [x, y, z] = labelAnchorM(bed);
    expect(x).toBeCloseTo(0, 6);        // -1100 + 2200/2
    expect(y).toBeCloseTo(1.25, 6);     // 1150 + 200/2
    expect(z).toBeCloseTo(-0.7, 6);     // -1400 + 1400/2
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm exec vitest run src/data/placements.test.ts`
Expected: FAIL — `PLAN_LABELS` is not exported.

- [ ] **Step 3: Implement it**

First widen the import at `src/data/vehicle.ts:1`, which currently pulls only `mm` and `Mm`:

```ts
import { mm, toM, toMTriple, type Confidence, type Mm } from './units';
```

Then, after `PLAN_CUT_MM`:

```ts
/**
 * A label for the plan stop. Its dimensions are read off the placement it names, so a label
 * cannot claim a size the geometry does not have — the same discipline §2 of the design spec
 * applies to every number in this file, extended to the one place those numbers become copy a
 * viewer reads. Anything that is not a placement (an aisle width, a doorway) carries its own
 * anchor and detail string instead.
 */
export interface PlanLabel {
  readonly text: string;
  readonly placement?: string;
  readonly at?: readonly [Mm, Mm, Mm];
  readonly detail?: string;
}

const byId = (id: string) => PLACEMENTS.find((p) => p.id === id)!;

/** Label anchor in scene units: the placement's centre, or the explicit point. */
export const labelAnchorM = (l: PlanLabel): [number, number, number] => {
  if (l.at) return toMTriple(l.at);
  const p = byId(l.placement!);
  return [0, 1, 2].map((i) => toM(p.origin[i]!) + toM(p.size[i]!) / 2) as [number, number, number];
};

/** "2200 × 1400 published" — the two largest plan dimensions, plus the weaker confidence tag. */
export const labelDetail = (l: PlanLabel): string => {
  if (l.detail) return l.detail;
  const p = byId(l.placement!);
  const plan = [p.size[0]!, p.size[2]!].sort((a, b) => b.v - a.v);
  const rank: Record<Confidence, number> = { published: 0, derived: 1, estimated: 2 };
  const weakest = [p.size[0]!, p.size[2]!].reduce((a, b) => (rank[b.c] > rank[a.c] ? b : a));
  return `${plan[0]!.v} × ${plan[1]!.v} ${weakest.c}`;
};

export const PLAN_LABELS: readonly PlanLabel[] = [
  { text: 'Alcove bed',    placement: 'alcove_bed' },
  { text: 'Slide-out bed', placement: 'slideout_bed' },
  { text: '卡座 booth',     placement: 'dinette_table' },
  { text: 'Wardrobe',      placement: 'wardrobe' },
  { text: 'Fridge 148 L',  placement: 'fridge' },
  { text: 'Galley',        placement: 'galley_run' },
  { text: 'Washroom',      placement: 'washroom_pod' },
  { text: 'Sliding partition', placement: 'partition' },
  // Not placements: an aisle is the gap between two of them, and the door is an opening cut
  // into wall_rear rather than a piece of furniture.
  { text: 'Aisle', at: [d(0), d(900), d(1000)], detail: '560 mm derived' },
  { text: 'Aisle', at: [d(0), d(900), d(3300)], detail: '800 mm derived' },
  { text: '后上门',  at: [d(100), d(900), d(4050)], detail: 'rear boarding door' },
];
```

`Mm` and the `d` helper are already in scope. `toM`, `toMTriple` and `Confidence` are what the
widened import above adds.

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm exec vitest run src/data/placements.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 5: Commit**

```bash
git add src/data/vehicle.ts src/data/placements.test.ts
git commit -m "feat: derive plan-view labels from the placements they name"
```

## Task 6: The label overlay

**Files:**
- Create: `src/labels.ts`, `src/labels.test.ts`
- Modify: `src/scene.ts` (mount the CSS2D layer), `src/main.ts` (build labels, wire the toggle),
  `src/ui.ts` (the toggle button)

**Interfaces:**
- Consumes: `PLAN_LABELS`, `labelAnchorM`, `labelDetail` (Task 5); `SceneBundle` (`scene.ts`).
- Produces:
  ```ts
  export interface LabelLayer {
    setVisible(on: boolean): void;
    render(scene: THREE.Scene, camera: THREE.Camera): void;
    setSize(w: number, h: number): void;
  }
  /** The group goes into the scene once; it owns the CSS2DObjects and starts hidden. */
  export const buildLabels: (labels: readonly PlanLabel[]) => THREE.Group;
  export const createLabelLayer: (parent: HTMLElement, group: THREE.Group) => LabelLayer;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/labels.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildLabels } from './labels';
import { PLAN_LABELS, labelAnchorM } from './data/vehicle';

describe('buildLabels', () => {
  it('creates one object per label, positioned at its anchor', () => {
    const g = buildLabels(PLAN_LABELS);
    expect(g.children).toHaveLength(PLAN_LABELS.length);
    const first = g.children[0]!;
    expect(first.position.toArray()).toEqual(labelAnchorM(PLAN_LABELS[0]!));
  });

  it('renders the label text and its derived detail line', () => {
    const g = buildLabels(PLAN_LABELS);
    const el = (g.children[0]! as unknown as { element: HTMLElement }).element;
    expect(el.textContent).toContain('Alcove bed');
    expect(el.textContent).toContain('2200 × 1400 published');
  });

  it('starts hidden, because the plan stop is not the landing view', () => {
    expect(buildLabels(PLAN_LABELS).visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm exec vitest run src/labels.test.ts`
Expected: FAIL — cannot resolve `./labels`.

- [ ] **Step 3: Implement it**

Create `src/labels.ts`:

```ts
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { labelAnchorM, labelDetail, type PlanLabel } from './data/vehicle';

/**
 * Labels for the plan stop, as a DOM layer over the canvas rather than as sprites.
 *
 * Sprites would cost draw calls at a stop that already carries the exterior body, go blurry
 * when zoomed, and need billboarding. CSS2DRenderer draws nothing on the GPU and keeps the
 * text crisp at every distance.
 */
export const buildLabels = (labels: readonly PlanLabel[]): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'plan-labels';
  group.visible = false;

  for (const l of labels) {
    const el = document.createElement('div');
    el.className = 'plan-label';
    const name = document.createElement('strong');
    name.textContent = l.text;
    const detail = document.createElement('span');
    detail.textContent = labelDetail(l);
    el.append(name, detail);

    const object = new CSS2DObject(el);
    object.position.set(...labelAnchorM(l));
    group.add(object);
  }
  return group;
};

export interface LabelLayer {
  setVisible(on: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setSize(w: number, h: number): void;
}

/** The DOM layer the labels live in. Transparent, and never eats a pointer event. */
export const createLabelLayer = (parent: HTMLElement, group: THREE.Group): LabelLayer => {
  const renderer = new CSS2DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  Object.assign(renderer.domElement.style, {
    position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
  });
  parent.appendChild(renderer.domElement);

  return {
    setVisible: (on) => { group.visible = on; },
    render: (scene, camera) => { if (group.visible) renderer.render(scene, camera); },
    setSize: (w, h) => renderer.setSize(w, h),
  };
};
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm exec vitest run src/labels.test.ts`
Expected: PASS, all three cases.

- [ ] **Step 5: Wire it into the scene and the UI**

In `src/main.ts`, after `bundle.scene.add(vehicle)`:

```ts
const labelGroup = buildLabels(PLAN_LABELS);
bundle.scene.add(labelGroup);
const labels = createLabelLayer(document.body, labelGroup);
let labelsWanted = true;
```

Extend `goTo` so the layer follows the stop, and only the plan stop can show it:

```ts
const goTo = (h: (typeof HOTSPOTS)[number], ms?: number) => {
  showExterior(h.view.kind === 'orbit');
  labels.setVisible(h.id === 'plan' && labelsWanted);
  document.body.dataset.stop = h.id;   // the toggle button hides itself off this
  return tweenTo(bundle, h, ms);
};
```

Add the render call. `bundle.render` is the animation loop, so extend it where the loop is set:

```ts
bundle.renderer.setAnimationLoop(() => {
  bundle.render();
  labels.render(bundle.scene, bundle.camera);
});
```

Apply the same wrapping inside the `?verify` branch's loop, which replaces the animation loop.

In `src/ui.ts`, add a labels toggle beside the finish swatches:

```ts
  const toggle = document.createElement('button');
  toggle.dataset.labels = 'toggle';
  toggle.textContent = 'Labels';
  toggle.setAttribute('aria-pressed', 'true');
  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(on));
    opts.onLabels(on);
  });
```

with `onLabels: (on: boolean) => void` added to `UiOptions`, `toggle` appended to `root`, and in
`main.ts`:

```ts
    onLabels: (on) => { labelsWanted = on; labels.setVisible(on); },
```

CSS for `.plan-label` and for hiding the toggle away from the plan stop goes in the page's
existing stylesheet, keyed off `body[data-stop="plan"]`.

- [ ] **Step 6: Run the gate and verify in the browser**

Run: `pnpm check`
Expected: PASS. `ui.test.ts` constructs `buildUi` with a fixed options object, so add an
`onLabels: vi.fn()` to it.

Run: `pnpm dev`, click **Floorplan**.
Expected: labels over each zone with their dimension lines; the Labels button toggles them; the
button is not present at any other stop; draw calls unchanged from Task 4 (CSS2D draws none).

- [ ] **Step 7: Commit**

```bash
git add src/labels.ts src/labels.test.ts src/main.ts src/scene.ts src/ui.ts src/ui.test.ts
git commit -m "feat: label the plan view from the placements it draws"
```

## Task 7: Measure and record phase A

**Files:**
- Create: `docs/research/final/plan.png`
- Modify: `docs/specs/design_rv-plan-view-and-exterior.md` (results)

- [ ] **Step 1: Measure**

Run: `pnpm dev`, open `?verify` at 1920 × 1080, visit every stop.
Record from `canvas.dataset`: `drawCalls`, `triangles`, `fps` at the plan stop and at the worst
interior stop.

- [ ] **Step 2: Prove the probe fix by measurement, not by test**

Run: `?calibrate`, note the three saturations. Then at the plan stop swap the wood finish, return
to the lounge and re-run `?calibrate`.
Expected: all three still under 0.08, and materially unchanged from the first reading. If they
moved, Task 3's fix is not reaching this path.

- [ ] **Step 3: Capture the render and commit**

```bash
git add docs/research/final/plan.png docs/specs/design_rv-plan-view-and-exterior.md
git commit -m "specs: record the plan stop's measurements"
```

---

# Phase B — the sculpted exterior

Every task below ends with `pnpm export && pnpm optimize` and commits the regenerated `.glb`s.
Skipping that ships the grey-box to GitHub Pages, which has no Blender.

## Task 8: Let a builder own its own UV

`main()` in `model_interior.py` re-unwraps every mesh in the collection after the builder returns,
running `smart_project` and then `normalise_uv_density` unconditionally. A UV written by a builder
is discarded before the file is saved. The livery needs one that survives.

**Files:**
- Modify: `tools/model_interior.py` (the unwrap loop in `main()`, plus a `box_uv` helper)
- Test: `tools/check_blend.py` is the check; run it.

**Interfaces:**
- Consumes: nothing.
- Produces: `box_uv(obj, span)` — writes a planar UV over the object's largest face, spanning
  `span` UV units, origin at 0. And `KEEPS_OWN_UV`, a set of object-name prefixes the dispatch
  loop skips.

- [ ] **Step 1: Add the helper and the exemption**

In `tools/model_interior.py`, beside `normalise_uv_density`:

```python
# Objects that write their own UV and must not be re-unwrapped by main()'s loop. Currently only
# the livery decals: a wordmark cannot tile, so it needs one copy across a known span with a
# known origin, and smart_project gives neither.
KEEPS_OWN_UV = ('body_graphic',)


def box_uv(obj, span):
    """Planar UV across the object's dominant plane, from 0 to `span` UV units.

    check_blend.py asserts 0.5-2.0 UV/m per role, so `span` must equal the object's size in
    metres on the two axes it spans. The registry's `repeat` then divides it back to one copy.
    """
    mesh = obj.data
    layer = mesh.uv_layers['UVMap'] if mesh.uv_layers else mesh.uv_layers.new(name='UVMap')
    size = list(obj.dimensions)
    thin = size.index(min(size))
    u, v = [i for i in range(3) if i != thin]
    lo = [min(vert.co[i] for vert in mesh.vertices) for i in range(3)]
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop].vertex_index].co
            du = (co[u] - lo[u]) / size[u] * span[0] if size[u] else 0
            dv = (co[v] - lo[v]) / size[v] * span[1] if size[v] else 0
            layer.data[loop].uv = (du, dv)
```

In `main()`, guard the unwrap loop:

```python
    for obj in COLLECTION.objects:
        if obj.type != 'MESH':
            continue
        if obj.name.startswith(KEEPS_OWN_UV):
            continue
        bpy.ops.object.select_all(action='DESELECT')
```

- [ ] **Step 2: Rebuild the exterior and check the blend**

```bash
pnpm exec npm run model -- exterior
pnpm exec npm run check:blend
```

Expected: PASS. Nothing calls `box_uv` yet, so `body_graphic_off` still has whatever
`smart_project` gave it from the previous build — the exemption only stops it being *re*-written.
If `check:blend` fails on `body.graphic` density here, call `box_uv(obj, (3.4, 0.70))` from
`model_exterior.py` on that object now rather than in Task 9.

- [ ] **Step 3: Commit**

```bash
git add tools/model_interior.py
git commit -m "feat: let a builder own its own UV, exempt from the dispatch re-unwrap"
```

## Task 9: The livery

**Files:**
- Create: `public/textures/side-livery.webp`
- Modify: `tools/model_exterior.py` (both flanks, explicit UV), `src/data/finishes.ts`
  (`body.graphic`)
- Test: `src/data/finishes.test.ts`

**Interfaces:**
- Consumes: `box_uv` (Task 8).
- Produces: `body.graphic` maps `/textures/side-livery.webp` at `repeat: [1/3.4, 1/0.70]`.

- [ ] **Step 1: Draw the artwork**

Reference: `docs/research/walkthrough/exterior-kerb-flank-0m59s.jpg`, and the video frames showing
the flank close up. The livery is a teal, orange and black swoosh over white with a `DACHIRV 大驰`
wordmark. Draw it by eye at 2048 × 422 px (matching the 3.4 : 0.70 panel aspect), export webp at
quality 88 to `public/textures/side-livery.webp`.

**Not rectified from a frame.** The presenter stands in front of the flank in every shot that
shows enough of it, and the showroom's ceiling lights reflect off the paint; rectifying that bakes
a person's shadow and a showroom into the vehicle's paint. Do not add an entry to
`model/textures.json`.

- [ ] **Step 2: Give both flanks a decal plane with a known UV**

In `tools/model_exterior.py`, replace the single off-flank decal:

```python
    # Livery, both flanks. The kerb flank carries the deployed slide-out box from y 0.15 to
    # 2.05, so its decal sits aft of the box where the artwork is seen face-on rather than at
    # the grazing angle that made an earlier pass drop it.
    for name, x in (('body_graphic_off', -1.228), ('body_graphic_kerb', 1.228)):
        plane = a.box(name, (x, 2.0, .95), (.004, 3.4, .70), 'body.graphic', bevel=0)
        a.box_uv(plane, (3.4, .70))
```

- [ ] **Step 3: Point the registry at the artwork**

In `src/data/finishes.ts`, replace the `body.graphic` entry:

```ts
  // One copy across the flank, not a tile: the artwork carries a wordmark, and a wordmark
  // cannot be cut. box_uv gives the decal plane a UV spanning 3.4 x 0.70 at 1.0 UV/m, which is
  // what check_blend.py's density assertion requires, and this repeat divides it back to a
  // single copy. See the plan's Task 8 for why the builder's UV survives the dispatch loop.
  'body.graphic': one('livery', 'Livery', {
    color: 0xffffff, roughness: 0.4, metalness: 0, transparent: true,
    map: { url: '/textures/side-livery.webp', repeat: [1 / 3.4, 1 / 0.70] },
  }),
```

- [ ] **Step 4: Write the test**

Append to `src/data/finishes.test.ts`:

```ts
describe('the livery decal', () => {
  it('lands exactly one copy on the 3.4 x 0.70 m panel', () => {
    // The UV spans 3.4 x 0.70 because UVMap runs at 1.0 UV/m and check_blend.py asserts it.
    // A repeat of 1 would tile the wordmark four times across the flank.
    const map = DEFAULT_REGISTRY['body.graphic'].variants[0]!.params.map!;
    expect(map.repeat![0]! * 3.4).toBeCloseTo(1, 6);
    expect(map.repeat![1]! * 0.70).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 5: Rebuild, check and verify**

```bash
pnpm exec npm run model -- exterior
pnpm exec npm run check:blend
pnpm exec npm run bake
pnpm export && pnpm optimize
pnpm exec npm run check:models
pnpm check
```

Expected: all PASS. Then `pnpm dev`, go to **Exterior**, and confirm the swoosh reads once across
each flank with the wordmark legible and uncut.

- [ ] **Step 6: Commit**

```bash
git add public/textures/side-livery.webp tools/model_exterior.py src/data/finishes.ts \
        src/data/finishes.test.ts model/rv.blend public/models/
git commit -m "feat: give both flanks the video's livery, one copy per panel"
```

## Task 10: Black window frames

**Files:**
- Modify: `tools/model_exterior.py` (`_door_reveal`)

- [ ] **Step 1: Widen the reveal and darken it**

The apertures stay **open**. A filled rectangle sits between the interior glazing and the sky and
renders that glazing black from indoors — the function's own comment records the defect that
taught it, and a second `glass` pane would also double the tint. What the video shows is a heavy
black frame around an open hole, with the dark tint coming from the interior pane already
modelled.

In `tools/model_exterior.py`, change `_door_reveal`'s strip thickness and role:

```python
def _door_reveal(a, name, centre, width, height, axis, role='metal.dark', t=.055):
    """A frame scribed into the body: four strips, nothing across the opening.

    Open on purpose. The body is one solid mass, so anything filling this rectangle sits
    between the interior door's glazing and the sky and renders that glazing as a black panel
    from indoors. `axis` is the wall's normal, as in model_interior.entry_door.

    The video's window frames are wide and black, and the tint the eye reads is the interior
    pane seen through the hole. `role` stays overridable because the rear door's outline is a
    panel gap in the paint, not a window frame.
    """
    x, y, z = centre
    for across, up, wide, tall in ((0, (height-t)/2, width, t), (0, -(height-t)/2, width, t),
                                   (-(width-t)/2, 0, t, height), ((width-t)/2, 0, t, height)):
        c = (x, y+across, z+up) if axis == 'x' else (x+across, y, z+up)
        s = (.016, wide, tall) if axis == 'x' else (wide, .016, tall)
        a.box(name, c, s, role, bevel=.006)
```

and keep the rear door as paint:

```python
    _door_reveal(a, 'body_door_rear', (.10, 4.056, .925), .76, 1.89, 'y',
                 role='body.paint', t=.03)
```

- [ ] **Step 2: Rebuild and verify**

```bash
pnpm exec npm run model -- exterior && pnpm exec npm run check:blend
pnpm exec npm run bake && pnpm export && pnpm optimize
pnpm exec npm run check:models && pnpm check
```

Expected: all PASS, `metal.dark` already exists so draw calls are unchanged. In the browser, the
exterior's windows read as dark apertures in black frames; from inside, no window has gone black.
Check the lounge, galley and washroom stops for that specifically.

- [ ] **Step 3: Commit**

```bash
git add tools/model_exterior.py model/rv.blend public/models/
git commit -m "feat: frame the exterior apertures in black, leaving them open"
```

## Task 11: The wedge helper and the sculpted cab

**Files:**
- Modify: `tools/model_interior.py` (`wedge`), `tools/model_exterior.py` (cab)

**Interfaces:**
- Produces: `wedge(name, center, size, role, shear, axis, bevel=.01)` — a box with its top face
  displaced by `shear` metres along `axis`, giving a rake.

- [ ] **Step 1: Add the helper**

In `tools/model_interior.py`, after `box`:

```python
def wedge(name, center, size, role, shear, axis=1, bevel=.01):
    """A box whose top face is displaced along `axis`, giving a raked plane.

    Enough for a windscreen rake and for the tapered nose of the over-cab moulding, which are
    the two shapes model_exterior needs and cannot get from a cube. `shear` is metres of
    displacement at the top face, positive toward +axis.
    """
    obj = box(name, center, size, role, bevel=0)
    top = center[2] + size[2] / 2
    for vert in obj.data.vertices:
        if vert.co[2] > top - 1e-4:
            vert.co[axis] += shear
    if bevel:
        mod = obj.modifiers.new('Edge radius', 'BEVEL')
        mod.width = min(bevel, min(size) * .48)
        mod.segments = 3
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj
```

Note the vertex loop runs in local space after `box` applied its scale, so `center` and `size` are
the same values `box` received.

- [ ] **Step 2: Shape the cab, preserving the envelope extremes**

The nose plane at `Z = -1948` is the length minimum and **must survive**. Rake the upper front
only; keep the bonnet at full length. In `tools/model_exterior.py`, replace the flat loop over the
three body masses:

```python
    # body_habitation and body_alcove stay boxes: they carry three of the four envelope
    # extremes (rear face at y 4.05, flanks at x +-1.225, alcove roof at z 2.15).
    for name in ('body_alcove', 'body_habitation'):
        centre, size = a.placement(name)
        a.box(name, centre, size, 'body.paint', bevel=.06)

    # The cab carries the fourth: its nose plane at y -1.948 is the length minimum. So the
    # bonnet keeps the box's full length at the bottom and the rake is taken out of the top,
    # which sits under the alcove overhang and is not an extreme. check_models.mjs is the gate.
    (cx, cy, cz), (cw, cd, ch) = a.placement('body_cab')
    a.wedge('body_cab', (cx, cy, cz), (cw, cd, ch), 'body.paint', shear=.34, axis=1, bevel=.06)
    a.box('cab_bonnet', (cx, cy - cd / 2 + .30, cz - ch / 2 + .26), (cw - .06, .60, .34),
          'body.paint', bevel=.05)
    a.box('cab_grille', (cx, cy - cd / 2 + .012, cz - ch / 2 + .30), (cw * .62, .03, .22),
          'metal.dark', bevel=.02)
    for side in (-1, 1):
        a.box('cab_mirror_arm', (side * (cw / 2 + .07), cy - .18, cz + ch / 2 - .40),
              (.14, .04, .04), 'metal.dark', bevel=.012)
        a.box('cab_mirror', (side * (cw / 2 + .15), cy - .18, cz + ch / 2 - .40),
              (.05, .10, .24), 'metal.dark', bevel=.02)
```

- [ ] **Step 3: Rebuild and gate on the envelope specifically**

```bash
pnpm exec npm run model -- exterior
pnpm exec npm run check:blend
pnpm export && pnpm optimize
pnpm exec npm run check:models
```

Expected: `check:models` reports no violation and its `exteriorEnvelope` still reads
`width 2.450, length 5.998, height 3.200`. **If length moved, the rake ate the nose** — reduce
`shear` or move it further up the face. Do not adjust the placement to compensate.

- [ ] **Step 4: Look at it in Blender**

```bash
open -a Blender model/rv.blend
```

Then, per the huashu-mac-use skill: `mac windows Blender` to get the id, `mac see <id>` to frame
it, and `mac shot <id> docs/research/blender-cab-rake.png`. Judge the rake against
`docs/research/walkthrough/exterior-kerb-flank-0m59s.jpg` and the 0m32s front three-quarter frame.
Iterate on `shear` in the `.py` — never by hand in Blender, because a hand-edited curve stops
deriving from the envelope and stops being reviewable in a diff.

- [ ] **Step 5: Commit**

```bash
git add tools/model_interior.py tools/model_exterior.py model/rv.blend public/models/ \
        docs/research/blender-cab-rake.png
git commit -m "feat: rake the cab and add bonnet, grille and mirrors"
```

## Task 12: The over-cab moulding

**Files:**
- Modify: `tools/model_exterior.py`

- [ ] **Step 1: Taper the alcove and give it its forward window**

`body_alcove` carries the height extreme at `Y = 2150` and the width extremes at `X = ±1225`, so
it stays a box. The taper is an added mass in front of it, and the window is a reveal:

```python
    # The FRP moulding's forward taper. body_alcove itself stays a box because it carries the
    # roof height and both flank extremes; this is the shaped nose in front of its front face.
    (ax, ay, az), (aw, ad, ah) = a.placement('body_alcove')
    nose = ay - ad / 2
    a.wedge('alcove_taper', (ax, nose - .16, az - .04), (aw - .10, .32, ah - .08),
            'body.paint', shear=.22, axis=1, bevel=.08)
    _door_reveal(a, 'body_window_alcove_front', (ax, nose - .30, az + .04), 1.10, .40, 'y')
```

- [ ] **Step 2: Rebuild, gate and screenshot**

```bash
pnpm exec npm run model -- exterior && pnpm exec npm run check:blend
pnpm export && pnpm optimize && pnpm exec npm run check:models
```

Expected: envelope unchanged at `2.450 / 5.998 / 3.200`. Screenshot the Blender viewport as in
Task 11 and compare the overhang profile against the 0m32s frame.

- [ ] **Step 3: Commit**

```bash
git add tools/model_exterior.py model/rv.blend public/models/
git commit -m "feat: taper the over-cab moulding and cut its forward window"
```

## Task 13: Fittings

**Files:**
- Modify: `tools/model_exterior.py`

Every item below uses an existing role, so the whole task costs **zero** draw calls.

- [ ] **Step 1: Add them**

```python
    # Roof air conditioner, sitting in the 120 mm between the interior ceiling panel and the
    # roof line, so it does not touch the height extreme.
    a.box('roof_ac', (0, 1.30, 2.15 + .09), (.72, .98, .18), 'body.paint', bevel=.05)
    a.box('roof_ac_vent', (0, 1.30, 2.15 + .18), (.52, .74, .02), 'metal.dark', bevel=.008)

    # The washing machine, which the walkaround stops at and calls out by capacity. Replaces
    # the 210 mm porthole: the video's is a full front-loader door with a chrome ring.
    a.box('washer_surround', (kerb + .010, 2.58, -.20), (.02, .62, .62), 'metal.dark', bevel=.03)
    a.cylinder('washer_door', (kerb + .026, 2.58, -.20), .24, .04, 'metal.chrome',
               rotation=(0, 1.5708, 0))
    a.cylinder('washer_glass', (kerb + .046, 2.58, -.20), .18, .02, 'glass',
               rotation=(0, 1.5708, 0))

    # Rear light clusters, inboard of the spare and clear of the boarding door.
    for side in (-1, 1):
        a.box('rear_lamp', (side * .92, rear + .014, .58), (.16, .026, .46),
              'graphic.screen', bevel=.02)

    # Alloy spokes, cut as five slots across each wheel face.
    for name in ('wheel_front_off', 'wheel_front_kerb', 'wheel_rear_off', 'wheel_rear_kerb'):
        (wx, wy, wz), (width, _, height) = a.placement(name)
        outboard = -width * .34 if 'off' in name else width * .34
        for i in range(5):
            angle = i * math.tau / 5
            a.box('wheel_spoke', (wx + outboard, wy + math.cos(angle) * height * .21,
                                  wz + math.sin(angle) * height * .21),
                  (width * .10, height * .13, height * .13), 'wheel', bevel=.006)

    # Mudflaps behind each axle, and the chrome rail beside the boarding door.
    for side in (-1, 1):
        a.box('mudflap', (side * 1.10, 2.98, -.86), (.22, .014, .24), 'metal.dark', bevel=.006)
    a.box('rear_rail', (.52, rear + .040, 1.20), (.030, .07, .52), 'metal.chrome', bevel=.012)
```

`math` is already imported by `model_interior` and reachable as `a.math` if `model_exterior` does
not import it; add `import math` at the top of `model_exterior.py` rather than reaching through.

- [ ] **Step 2: Rebuild and gate on draw calls specifically**

```bash
pnpm exec npm run model -- exterior && pnpm exec npm run check:blend
pnpm exec npm run bake && pnpm export && pnpm optimize
pnpm exec npm run check:models && pnpm budget && pnpm check
```

Expected: all PASS. `check_models.mjs` reports `potentialRoleBatchedDrawCalls` unchanged, because
nothing above introduces a role. Envelope still `2.450 / 5.998 / 3.200` — `roof_ac` sits above
`body_alcove`'s roof but is a detail mesh, not one of the eight named bodies, so it does not enter
the assertion. Confirm that is true rather than assuming it.

- [ ] **Step 3: Commit**

```bash
git add tools/model_exterior.py model/rv.blend public/models/
git commit -m "feat: model the fittings the walkaround stops at"
```

## Task 14: Measure, compare and record

**Files:**
- Modify: `docs/research/final/exterior.png`, `docs/specs/design_rv-plan-view-and-exterior.md`,
  `docs/specs/design_rv-interior-3d.md`

- [ ] **Step 1: Re-capture every render**

Run `pnpm dev` at 1920 × 1080 and re-capture all eight stops into `docs/research/final/`.

- [ ] **Step 2: Measure against every ceiling**

Record `drawCalls`, `triangles` and `fps` at the plan stop and the exterior stop, plus the worst
interior stop. Run `pnpm budget` for the triangle and byte totals.

Ceilings: 350,000 triangles, 25 MB, 60 draw calls at the plan and exterior stops, 60 fps at 1080p.
**Report the numbers even if one exceeds its ceiling**, the way the parent spec's record reports
the interior draw-call overrun rather than explaining it away.

- [ ] **Step 3: Compare side by side**

Put the new `docs/research/final/exterior.png` beside
`docs/research/walkthrough/exterior-kerb-flank-0m59s.jpg` and judge the success criterion: do they
read as the same vehicle? Write down what still differs.

- [ ] **Step 4: Fold the child spec into the parent**

The child spec exists because sections 1 to 14 of the parent claim "as built". Now it is built:
move the plan stop into §8 (Navigation), the exterior changes into §9 (Exterior), the label layer
into §6 (Runtime architecture), and drop the child spec's forward-looking framing into a dated
implementation-record entry the way the previous four passes did. Reverse §1's "massed rather than
sculpted" non-goal there, and close §14's matching known gap.

- [ ] **Step 5: Commit**

```bash
git add docs/research/final/ docs/specs/
git commit -m "specs: record the plan view and exterior pass"
```

---

# Self-review notes

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
