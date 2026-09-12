# Spec: PBR surface maps for the finish registry

- Date: 2026-09-12
- Status: drafted
- Parent: [design_rv-interior-3d.md](design_rv-interior-3d.md). Child spec in the same shape as
  `design_rv-plan-view-and-exterior.md`, to be absorbed into the parent's §4 once built.
- Evidence base: the brochure set from `docs/research/reference/` (restored from `0abe397`), the
  搜狐汽车 review set (sohu.com/a/1024282184_99893844), and the walkthrough stills in
  [../research/walkthrough/](../research/walkthrough/). Resolution ceiling established in §2.
- Skills in play: `threejs-webgl` (runtime), `blender-web-pipeline` (verification only)

## 1. What this adds

The materials are already physically based. Every one is a `MeshStandardMaterial` on the
metallic/roughness workflow. What is missing is map *channels*. Today each textured role carries
one greyscale albedo-modulation map and a constant `roughness` and `metalness`. Nothing in the
project uses a normal map or a roughness map, so every surface is geometrically perfect and
uniformly glossy, and the render reads as moulded plastic.

Compare [../../public/renders/galley.webp](../../public/renders/galley.webp) against
[../research/walkthrough/rear-worktop-sink-6m20s.jpg](../research/walkthrough/rear-worktop-sink-6m20s.jpg):
the modelled walnut is a smear with no pore, the worktop is flat white where the photograph has
mineral speckle, and the floor's herringbone is invisible at its shipped repeat.

This spec adds derived normal and roughness maps for 15 roles, and the pipeline that produces
them, without touching geometry.

### Goals

1. At the stops the tour actually visits, interior surfaces catch light the way their material
   class does: wood grain figure, leather pebble clustering, vinyl seams, GRP ribs.
2. Every map traces to a photograph of this vehicle, the same discipline `model/textures.json`
   already holds for albedo.
3. No geometry, no re-export, no re-bake. The committed `.glb`s do not move.
4. Draw calls unchanged at all eight stops.

### Non-goals

- **No scanned or library texture sets.** Considered and rejected: a PolyHaven walnut is real
  measured relief but it is not this vehicle's. The registry's existing discipline makes a borrowed scan
  defensible, since the map is a luminance stand-in and the registry carries identity. It was
  still declined in favour of provenance.
- **No change to albedo's contract.** §4 of the parent holds: maps carry luminance only, the
  registry keeps hue. A scanned or colour albedo would tint twice and would end the three-variant
  wood swap, which is the parent spec's shipped proof of its own seam.
- **No metalness maps.** Every role in scope is constant 0 or constant 1.
- **No AO maps.** The `aoMap` slot is occupied by the baked UV2 atlas. A tiling AO cannot coexist
  with it, which also rules out the conventional ORM channel pack.
- **No materials authored in Blender.** See §6.
- **No KTX2.** The parent's reasoning is unchanged: no `ktx` binary on the build machine, and the
  binding constraint is transferred bytes, not GPU memory. §8 risk 5 revisits this if the phone
  measurement ever happens.

### Success criteria

| Axis | Criterion |
|---|---|
| Relief | Wood grain figure, leather pebble clustering, vinyl seam and GRP rib are visible at their stop's framing |
| Provenance | Every emitted map derives from a manifest entry naming a source photograph |
| Control | `worktop` emits no normal map and renders flat — speckle is mineral colour, not relief |
| Geometry | `public/models/*.glb` byte-identical before and after |
| Draw calls | Identical at all eight stops |
| Livery | `check_livery.mjs` green before and after |
| Neutrals | The three `?calibrate` saturations do not worsen against their recorded values |
| Budget | ≤ 350k triangles, ≤ 25 MB including `public/textures/` |
| Frame rate | No regression at 1080p across all eight stops |

## 2. The resolution ceiling, established once

Approach was "source the best imagery first, then build once". That reconnaissance is complete and
its result is mostly negative. Recorded here so nobody runs it again.

| Source | Native | Finding |
|---|---|---|
| `S1` brochure, 37 images on the faisco CDN | 1080 wide | **Byte-identical to the blobs in `0abe397`.** `galley-wardrobe-dinette.jpg` is 583,404 bytes in both places. The CDN URLs carry no `!WxH` resize suffix, so 1080 is native. No better version exists |
| 搜狐汽车 review, 13 interior photos on `itc.cn` | 1080 × 810 | The best interior set — wider and brighter than any video frame. Served at `q_70`; `q_90` returns the same pixels with ~11 % more bytes |
| Douyin walkthrough | stills kept at ≤ 1280 × 720 | The only route to more real pixels on a single subject. A fresh 1080p frame is 1920 × 1080 |

Three consequences:

1080 is the ceiling. Every crop in `model/textures.json` is a ~100 × 100 px window upscaled 5× to
a 512 map, which is the limiter on this whole pass and the reason no amount of further crawling
helps. Nothing to be done about it.

**The `q_90` re-fetch matters more than 11 % sounds.** JPEG artefacts sit on 8 × 8 block
boundaries. A Sobel derivative turns a block boundary into a ridge, so the derivation converts
compression into geometry. Stage 3 of §3 exists to suppress it.

**A fidelity correction fell out of the crawl.** The review states the flooring is
高耐磨防水**复合地板革**, high-wear waterproof composite vinyl sheet. The model renders the
floor as herringbone *parquet*. Corrected in phase 5.

### Texel arithmetic, and what it forbids

Source pixels per real millimetre, at the scale each map is tiled:

| Map set | Source window | Real width it covers | Tile size at shipped `repeat` | Effective |
|---|---|---|---|---|
| `walnut` | 98 px | ~136 mm | 500 mm | 0.72 px/mm at source, stretched 3.7× |
| `leather-*` | ~90 px | ~110 mm | 250–333 mm | ~0.8 px/mm, stretched ~2.5× |
| `herringbone` | 100 px | ~250 mm | 250 mm | ~0.4 px/mm, roughly true scale |
| `body.paint` | 1080 px across ~6 m | 6000 mm | — | 0.18 px/mm |

Wood pore is ~0.3 mm, leather pebble ~1 mm, orange peel ~0.5 mm. None of these is resolved by
any available photograph. What is resolved is the next scale up: wood grain figure
(10–50 mm), leather pebble clustering, vinyl seams, GRP ribs. Those are what the derivation can
honestly deliver, and they are enough. Relief at figure scale is what the current render lacks.

Exterior microstructure is not deliverable at 0.18 px/mm. See §5.

### `repeat` is not currently derived

The table above also shows `walnut` tiling 3.7× larger than the surface it was photographed from.
That is a pre-existing fidelity defect, unrelated to PBR, and cheap to close here: the manifest
gains a `worldMm` field recording the real-world width each crop covers, and the registry's
`repeat` becomes `1000 / worldMm` rather than a number chosen by eye. A test asserts the two agree.

## 3. The derivation pipeline

`tools/rectify_textures.mjs` runs homography → flat-field → mirror-tile. It becomes:

```
1. homography      unchanged
2. flat-field      unchanged
3. de-artefact     NEW. Edge-preserving lowpass tuned to suppress 8x8 ringing
                   while keeping grain. Gates every stage below it.
4. albedo          unchanged — luminance around MODULATION_MEAN (230)
5. normal          NEW. Sobel on the de-artefacted luminance, per-entry
                   `strength`. `strength: 0` emits nothing.
6. roughness       NEW. Windowed inverse luminance, per-entry [min, max].
                   Omitted emits nothing.
7. mirror-tile     unchanged, applied to all three together
```

**Stage 3 decides whether this pass works.** The flattest, most compressed crops are `stone`
and `leather-cream`, whose block structure most exceeds their real signal. Without suppression
they emit a grid.

Stage 7 must run on all three together. A normal map mirrored independently of its albedo puts
relief where the grain is not.

`worktop` is the control rather than an exception. Its speckle is mineral colour, not height. It gets
`strength: 0` and must emit no normal map. If a later tuning pass makes it emit one, stage 3 is
undertuned and every other map is carrying artefacts too.

### Manifest additions

Per entry, all optional:

```jsonc
{
  "out": "walnut",
  "worldMm": 136,                              // real width the crop covers
  "normal":    { "strength": 1.2 },            // omit or 0 to emit none
  "roughness": { "min": 0.35, "max": 0.60 }    // omit to emit none
}
```

Outputs land beside the albedo, as `<out>_n.webp` and `<out>_r.webp`.

### Map sets and the roles they serve

13 map sets cover 15 roles. Eight entries exist and gain channels; five are new.

| Map set | Roles | Status | Normal | Roughness |
|---|---|---|---|---|
| `walnut` | `wood.cabinet`, `wood.trim`, `panel.locker` | exists | grain figure | satin vs lacquer split by the roles' own constants |
| `herringbone` | `floor` | exists, re-sourced in phase 5 | seams | yes |
| `stone` | `worktop` | exists | **none — the control** | yes |
| `leather-grey` | `upholstery.seat` | exists | pebbling | yes |
| `leather-camel` | `upholstery.bolster` | exists | pebbling | yes |
| `leather-cream` | `upholstery.sofa` | exists | pebbling | yes |
| `grp-ribbed` | `washroom.shell` | exists | ribs | yes |
| `damask` | `textile.curtain` | exists | weave | yes |
| `panel-bone` | `panel.wall` | **new** | soft-touch texture | yes |
| `metal-brushed` | `metal.brushed` | **new** | brushed streak | yes |
| `body-paint` | `body.paint` | **new** | see §5 | yes |
| `tyre-tread` | `tyre` | **new** | see §5 | — |
| `wheel-face` | `wheel` | **new** | see §5 | yes |

`photo-wall` and `systems-panel` are decals (`colour: true`, `tile: false`) and gain nothing.
`glass.tint` is excluded: a flat pane is flat, and a map on it buys an artefact, not a material.
`body.graphic` is excluded for the reason in §5.

## 4. Runtime

Four edits. The plumbing is already there: `TextureSpec` carries `srgb`, `MaterialParams` carries
`normalMap` and `normalScale`, `applyFinishes` wires both, and `batchByRole` already handles
tangents. None of it has ever been exercised.

1. `MaterialParams` gains `roughnessMap?: TextureSpec`. `TextureSpec` needs nothing.

2. `applyFinishes` gains a `roughnessMap` branch, and the data maps assign-or-null:

```ts
material.normalMap    = p.normalMap    ? resolve(p.normalMap)    : null;
material.roughnessMap = p.roughnessMap ? resolve(p.roughnessMap) : null;
```

The existing `if (p.map)` guard exists so `.glb`-authored albedo survives until every role is
migrated. No `.glb` authors a normal or roughness map, because `strip_surface_maps()` unwires
them, so the same guard here would only strand a stale map across a variant swap.

3. `batchByRole` takes an optional registry, matching `applyFinishes`' shape, and derives
`needsTangents` from it:

```ts
const needsTangents = registry[role].variants.some((v) => v.params.normalMap);
```

This is a defect fix, not only a feature. [main.ts:39](../../src/main.ts#L39) runs `batchByRole`
before [main.ts:55](../../src/main.ts#L55) runs `applyFinishes`, so `material.normalMap` is null
for every material at batch time. `needsTangents` is permanently false, the tangent branch is
unreachable in production, and the mirrored-geometry W flip at
[batching.ts:46](../../src/batching.ts#L46) never fires. `batching.test.ts:99` covers the branch
only by constructing a material with a `normalMap` by hand.

Reading the whole registry rather than the *active* variant is deliberate: a swap into a variant
that has a normal map would otherwise find the tangents already deleted.

4. Every normal and roughness spec carries `srgb: false`. A normal map decoded as sRGB lights
in the wrong direction and looks plausible enough to ship.

### The multiplier trap

In Three.js `material.roughness` **multiplies** `roughnessMap.g`; it does not replace it. A role at
`roughness: 0.35` with a map averaging 0.85 renders at 0.30, and all 15 shift the same way.

**Every role gaining a roughness map needs its constant re-derived as `target / mean(map)`.** The
target goes in the registry comment beside it. `check_textures.mjs` asserts the
relationship holds. The same arithmetic governs `metalness` and the B channel, which is the second
reason there are no metalness maps.

### Tangents, measured

`export_modules.py` sets `export_tangents=True` and `optimize.sh` passes `--prune-attributes
false`, so Draco preserves what Blender emitted. Coverage in the committed `.glb`s is partial:

| Module | Primitives | With `TANGENT` |
|---|---|---|
| `dinette` | 19 | 0 |
| `shell` | 22 | 13 |
| `exterior` | 19 | 7 |
| `washroom` | 9 | 2 |

`batchByRole`'s existing delete-all-or-compute-missing logic is already the correct handling for a
mixed bucket: it deletes every tangent when none is needed, and calls `computeTangents()` on the
ones lacking it when one is. No re-export is required. The cost is a one-off
`computeTangents()` at load for the modules that carry none, measured in phase 2.

## 5. The exterior, and what the evidence will not support

Scope is interior plus exterior. The texel arithmetic in §2 constrains what "exterior" can mean.

**`body.graphic` is excluded outright.** [plan_livery-hue.md](plan_livery-hue.md) pre-rotated the
livery orange to HSV 18.0 / 0.745 / 0.910 so that ACESFilmic at exterior `environmentIntensity`
0.20 lands it on hue 26.2, against the 26.5–30.2 three walkaround frames measure. Relief or gloss
variation on that plane moves the measured value directly, and the repair would land in the
artwork, reopening a decision the parent spec records as closed.

`body.paint` carries the real risk, because it is the surface adjacent to the decal and its specular
feeds the same frame. `tools/check_livery.mjs` becomes a required gate on every commit touching an
exterior role: green before, green after. If it moves, the map is wrong, not the artwork.

Orange peel cannot be photo-derived. At 0.18 px/mm the best exterior photograph resolves
nothing below ~50 mm. The same is true of tyre tread at 640 × 360 and of a wheel's cast texture.
Three honest options, and this spec does not pick one alone. See §9 open question 1:

- **(a) Roughness only.** `body.paint`, `tyre` and `wheel` get windowed roughness maps, which are a
  low-frequency signal a 1080-wide photograph does carry, and no normal maps. Consistent with
  photo-derivation. Smallest, and probably enough: what the walkaround footage shows is gloss
  falloff across panels, not visible peel.
- **(b) One procedural exception.** A low-amplitude generated orange peel on `body.paint` only,
  argued for explicitly as the one map in the project that is not photographic, and tagged
  `estimated` the way the data layer tags a derived dimension.
- **(c) Defer the exterior.** Ship phases 1–3, re-scope with interior results in hand.

**Recommendation: (a).** It keeps every map photographic, needs no new decision, and the exterior
gap the walkaround actually shows is gloss, not microstructure.

## 6. Blender's role

Verification only, as [design_rv-plan-view-and-exterior.md §5](design_rv-plan-view-and-exterior.md)
already establishes for geometry. Maps are resolved at runtime from the registry, so Blender never
loads them in the shipping path.

blender-mcp opens `model/rv.blend`, wires a candidate map onto one test material through
`execute_blender_code`, and `get_viewport_screenshot` judges relief strength against real UV
density before the map is committed. Nothing is saved to the `.blend`. This needs Blender
running with the BlenderMCP addon server started; it is not a headless path.

Authority stays with `pnpm capture`, which renders all eight stops as they actually ship, in the
renderer that actually ships them.

## 7. Verification

| Check | Kind | Asserts |
|---|---|---|
| Texture URLs resolve | vitest | Every `TextureSpec.url` in the registry is a file under `public/`. **Nothing checks this today** |
| Data maps are not sRGB | vitest | Every `normalMap` / `roughnessMap` spec has `srgb === false` |
| Maps stay in register | vitest | Within a variant, `normalMap.repeat` and `roughnessMap.repeat` equal `map.repeat` |
| `repeat` is derived | vitest | Each mapped role's `repeat` equals `1000 / worldMm` for its manifest entry |
| Tangents survive batching | vitest | A role with a `normalMap` in any variant keeps `tangent` through `batchByRole`, asserted in production order, batch before finishes |
| Roughness constants | `check_textures.mjs` | `roughness × mean(map.g)` is within tolerance of the recorded target, per role |
| De-artefact works | `rectify_textures.test.mjs` | Synthetic 8 × 8-blocked input drops below a block-energy threshold |
| Flat encodes flat | `rectify_textures.test.mjs` | A constant region emits (128, 128, 255) within tolerance |
| The control holds | `rectify_textures.test.mjs` | `strength: 0` emits no normal file |
| Livery unmoved | `check_livery.mjs` | Green before and after every exterior commit |
| Neutrals unmoved | browser `?calibrate` | Three saturations do not worsen. Albedo is unchanged, so movement means a roughness map caused it. The chair panel's inherited 0.084 is the baseline, not 0.08 |
| Draw calls | browser `?verify` | Identical at all eight stops. Any change means a role leaked |
| Frame rate | browser `?verify` | No regression at 1920 × 1080 |
| Budget | `pnpm budget` | Under 25 MB with `public/textures/` counted, per `check_budget.mjs:54` |
| Fidelity | `pnpm capture` | Side by side against the walkthrough stills |

Deliberately not run: `check_blend.py`, `check_models.mjs`, `pnpm export`, `pnpm bake`. Geometry
does not move, and the `.glb`s must come out byte-identical.

## 8. Phasing and risks

Sourcing is settled in §2, so there is no reconnaissance phase.

| # | Phase | Gate |
|---|---|---|
| 1 | Restore imagery, re-fetch sohu at `q_90`, add the three rectifier stages and their tests | The `worktop` control emits no normal map; block energy under threshold |
| 2 | The four runtime edits and the tangent regression test | `pnpm check` green; `.glb`s untouched |
| 3 | 12 interior roles authored, roughness constants re-derived | `pnpm capture`, `?calibrate`, `pnpm budget` |
| 4 | 3 exterior roles, per §9 open question 1 | `check_livery.mjs` green |
| 5 | Fidelity corrections, starting with the 地板革 floor and the derived `repeat` values | Side-by-side capture |

Phase 5 is separate on purpose: it is a claim about *what the material is*, not about how it
renders, and it should be reviewable on its own.

| # | Risk | Mitigation |
|---|---|---|
| 1 | JPEG artefacts become fake relief | Stage 3 gates everything below it; `worktop` at `strength: 0` is the detector |
| 2 | Roughness constants not re-derived, every surface shifts glossy | `check_textures.mjs` asserts constant against measured mean |
| 3 | `body.paint` specular moves the livery measurement | `check_livery.mjs` as a commit gate; `body.graphic` excluded |
| 4 | Enabling the tangent branch changes shading on the 22 primitives that already carry tangents | Regression test plus by-eye capture diff |
| 5 | GPU residency grows ~40 MB on the one platform never measured | Recorded, not pretended away. It compounds the parent spec's existing open gap rather than creating a new one |
| 6 | A normal derived from a ~0.7 px/mm window reads as noise, not material | The gate is the side-by-side capture and the response is a low `strength`, or `0` as `worktop` already plans |
| 7 | Deriving `repeat` from `worldMm` rescales textures that currently look acceptable | Phase 5, reviewable alone, with captures before and after |

## 9. Open questions

1. **Which exterior option** — §5's (a) roughness only, (b) one procedural exception for orange
   peel, or (c) defer. Recommended (a).
2. Whether the three leather crops should share one normal map. They are three photographs of what
   is probably one hide; sharing would cut bytes and guarantee they read as one material, at the
   cost of the per-crop provenance the manifest otherwise holds.
3. Whether `panel.wall`, which has no map at all today, wants a normal map or only the roughness
   variation. A soft-touch bone panel is nearly featureless, and the honest answer may be neither.
4. Whether the `q_90` re-fetch is worth re-cropping the eight existing albedo maps for, or whether
   it should apply only to the new entries. Re-cropping is arithmetic, since manifest corners are
   source-pixel coordinates, but it changes eight shipped textures.

Carried forward from the parent, untouched: the mid-range phone frame rate has still never been
measured on hardware, and §5 of this spec makes that gap materially larger.
