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
   class does, wherever the photographs support it: wood grain figure, leather pebble clustering,
   vinyl seams, GRP ribs. Per role, and shipping no channel is an acceptable answer for a role
   whose evidence does not carry one.
2. Every map traces to a photograph of this vehicle, the same discipline `model/textures.json`
   already holds for albedo. Provenance establishes origin, not recovered physics, so §3 makes
   channel inclusion conditional on the rendered result rather than on the source alone.
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
| Relief | Per role, an explicit recorded verdict of keep / reduce / `strength: 0` against the named walkthrough still — not a count of roles shipped |
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
| 搜狐汽车 review, 13 interior photos on `itc.cn` | 1080 × 810 | The best interior set, wider and brighter than any video frame. Served at `q_70`; `q_90` returns ~11 % more bytes at the same dimensions, decoded-pixel difference measured: see below |
| Douyin walkthrough | stills kept at ≤ 1280 × 720 | The only route to more real pixels on a single subject. A fresh 1080p frame is 1920 × 1080 |

Three consequences:

1080 is the ceiling. Every crop in `model/textures.json` is a ~100 × 100 px window upscaled 5× to
a 512 map, which is the limiter on this whole pass and the reason no amount of further crawling
helps. Nothing to be done about it.

**Compression becomes geometry unless something stops it.** JPEG artefacts sit on 8 × 8 block
boundaries, and a Sobel derivative turns a block boundary into a ridge. Stage 3 of §3 exists to
suppress that. The `q_90` re-fetch was measured rather than assumed, because more bytes at the same dimensions
could have been a re-encode of identical pixels. Decoding both and comparing sample by sample:
**71.3 % of samples differ, mean delta 2.09, max delta 33.** It is a genuinely less-compressed
decode, and a max delta of 33 is the block-boundary magnitude a Sobel would emboss, so the
re-fetch is worth taking.

Its reach is narrow, though. `q_70` is a path segment on the `itc.cn` CDN that serves the sohu
set; the brochure images come from the faisco CDN, which has no quality parameter and no larger
original. **No manifest entry sources from sohu today**, so this changes nothing already shipped —
it applies to new entries that draw on the sohu set, and to any existing entry deliberately
re-sourced there. Moving an entry from a brochure image to a sohu photograph is a new crop, not a
coordinate rescale, because the corners address a different photograph.

**One material claim was confirmed rather than corrected.** The review states the flooring is
高耐磨防水**复合地板革**, high-wear waterproof composite vinyl sheet. The registry already carries
`floor` as `grey-vinyl` / "Grey vinyl", so the identification agrees with what ships. It does not
establish that the herringbone pattern is wrong: vinyl sheet is routinely printed with a
herringbone or plank pattern, and a printed pattern is exactly the case where the dark lines are
ink rather than grooves. Phase 5 checks the pattern and its pitch against the photograph, and the
normal-map consequence is the open one, because a printed seam must not be embossed.

### Texel arithmetic, and what it forbids

Source pixels per real millimetre, at the scale each map is tiled:

| Map set | Source window | Real width it covers | Tile size at shipped `repeat` | Effective |
|---|---|---|---|---|
| `walnut` | 98 px | ~136 mm crop → 272 mm tile | 500 mm | 0.72 px/mm at source, stretched 1.84× |
| `leather-*` | ~90 px | ~110 mm crop → 220 mm tile | 250–333 mm | ~0.8 px/mm, stretched ~1.1–1.5× |
| `herringbone` | 100 px | ~250 mm crop → 500 mm tile | 250 mm | ~0.4 px/mm, shipped at half true scale |
| `body.paint` | 1080 px across ~6 m | 6000 mm | — | 0.18 px/mm |

Wood pore is ~0.3 mm, leather pebble ~1 mm, orange peel ~0.5 mm. None of these is resolved by
any available photograph. What is resolved is the next scale up: wood grain figure
(10–50 mm), leather pebble clustering, vinyl seams, GRP ribs. Those are what the derivation can
honestly deliver, and they are enough. Relief at figure scale is what the current render lacks.

Exterior microstructure is not deliverable at 0.18 px/mm. See §5.

### `repeat` is not currently derived, and the obvious formula is wrong

The table above also shows `walnut` tiling 1.84× larger than the surface it was photographed from.
That is a pre-existing fidelity defect, unrelated to PBR, and cheap to close here: the manifest
gains a `worldMm` field and the registry's `repeat` is derived from it rather than chosen by eye.

**The factor of two is the whole difficulty.**
[rectify_textures.mjs:92-93](../../tools/rectify_textures.mjs#L92-L93) renders a tiling crop into
`outW / 2` and then mirrors it into a 2 × 2, so one complete texture spans **twice the crop
width**. Defining `worldMm` as the real-world width of the *crop*, the derivation is therefore

```
repeat = 1000 / (2 × worldMm)          // tiling entries
repeat = 1000 / worldMm                // "tile": false decals, which are not mirrored
```

`walnut` at `worldMm: 136` gives `1000 / 272 = 3.68`, against the 2 it ships today. Writing the
naive `1000 / worldMm` would give 7.35 and a passing test would then enforce a scale twice as
wrong as the one it replaced. Both axes are derived independently where a crop is not square.

Because this changes the rendered scale of every tiling map, it is phase 5 work and it runs
**before** `strength` tuning rather than after: relief tuned at one scale does not stay tuned when
the scale moves.

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
7. mirror-tile     VECTOR-AWARE. Pixels mirror as today; the normal map's
                   tangent-space components are negated per quadrant.
```

**Stage 3 decides whether this pass works, and its scale problem is not solved by filtering
alone.** At 0.72 source px/mm an 8 × 8 JPEG block spans about **11 mm**, which sits inside the
10–50 mm grain figure §2 says is the one thing worth recovering. Artefact scale and signal scale
overlap, so no edge-preserving filter separates them cleanly: it either keeps block edges or
erases real features. The homography compounds it, because source block boundaries are warped and
rescaled by stage 1 and are no longer an axis-aligned 8-pixel grid in the rectified output.

The consequence is a two-sided gate. Suppressing block energy is necessary and not sufficient,
because a filter that flattens the image to grey passes a block-energy test perfectly. Stage 3's
test therefore asserts both directions on the same representative input — a real compressed crop
carried through stages 1 and 2, not a synthetic grid — namely that block-boundary energy falls
below its threshold and that energy in the 10–50 mm band is retained above its own floor. A
change that wins on one and loses on the other fails.

**Stage 7 must be vector-aware, and this is a correctness bug rather than a refinement.** The
existing mirror at [rectify_textures.mjs:172-186](../../tools/rectify_textures.mjs#L172-L186) uses
sharp's `.flop()` and `.flip()`, which move pixels. A normal map stores vectors, so a horizontal
reflection must also negate the tangent-space X component and a vertical reflection must negate Y:

| Quadrant | Transform | Normal channels negated |
|---|---|---|
| top-left | none | none |
| top-right | `.flop()` | R |
| bottom-left | `.flip()` | G |
| bottom-right | `.flip().flop()` | R and G |

Mirroring pixels alone lights three quadrants out of four backwards, and it looks plausible enough
to ship. Roughness is scalar and mirrors unchanged; albedo is unchanged. All three still mirror
together, so relief stays registered with grain.

The Y convention is fixed and asserted: OpenGL-style (`+Y` up), matching `THREE.MeshStandardMaterial`.

`worktop` is a contract test rather than a detector. Its speckle is mineral colour, not height, so
it gets `strength: 0` and must emit no `_n.webp`. That proves the switch works. It proves nothing
about filter quality — the earlier draft claimed it would detect an undertuned stage 3, and it
cannot, because an output that is never written carries no evidence about the output that is.

### Normal maps are lossless WebP at 256, both by measurement

**Lossy WebP cannot carry a normal map.** libwebp's lossy mode is YUV 4:2:0, so it chroma-subsamples
exactly the R and G channels holding tangent-space X and Y. Measured on the emitted `walnut_n`:

| Encoding | Bytes | Max deviation | Mirror antisymmetry error |
|---|---|---|---|
| lossless | 503,738 | 0 | **0** |
| q95 | 138,754 | 97 | **118** |
| q92 | 117,416 | 93 | 118 |
| q80 | 71,514 | 103 | 109 |

An antisymmetry error of 118 out of 255 means the mirror seam the §3 negation exists to get right
is destroyed by the encoder afterwards. Lossless is not a preference here. PNG was measured too and
is worse than lossless WebP at both sizes (695,708 bytes at 512).

**The output size is 256, not 512.** `walnut`'s source window is 98 × 98 real pixels. Mirrored into
a 2 × 2, a 512 output gives each quadrant 256 px from that 98 px source — a 2.6× upsample, applied
to a *derivative*, which amplifies interpolation noise rather than revealing detail. At 256 each
quadrant is 128 px, near 1:1 with the source. Measured cost: 144,286 bytes against 503,738, a 71 %
saving for no real information. Albedo keeps its existing 512, because §2's luminance-only map is
not a derivative and the size already ships.

Projected: 10 normal maps at ~144 KB plus ~13 roughness maps at ~56 KB is about 2.2 MB, against
14 MB of headroom. At 512 lossless it would have been 5.7 MB, which fits but spends 40 % of the
remaining budget on upsampled noise.

**Data maps are verified after decoding, never as written.** The existing writer emits lossy WebP,
which can damage an otherwise correct normal field, so every assertion in §7 that concerns a
normal or roughness map reads the decoded emitted file.

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

**The channel column below is a candidate list, not a commitment.** Flat-fielding does not
separate pigment from relief from residual lighting, and inverse luminance has the same ambiguity
for gloss: single-image material recovery is under-determined, and filtering does not make it
determined. Photographic provenance establishes where a map came from, not that it recovered the
surface's physics. Every entry therefore ships only if the rendered result at its own stop earns
it, and `strength: 0` is an ordinary outcome rather than a failure. Roles are tagged `estimated`
in the registry comment the way the data layer tags a derived dimension.

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
migrated. No `.glb` authors a normal or roughness map, so the same guard here would only strand a
stale map across a variant swap. The evidence for that is the assets themselves rather than
`strip_surface_maps()`, which only removes named legacy albedo nodes: parsing the committed glTF
material blocks gives 0 `normalTexture` and 0 `metallicRoughnessTexture` across every module, with
only the `occlusionTexture` AO atlas and one image each. A test pins it, so a future Blender
change that starts emitting one is caught rather than silently overridden.

3. `batchByRole` takes an optional registry, matching `applyFinishes`' shape, and derives
`needsTangents` from it:

```ts
const needsTangents = registry[role].variants.some((v) => v.params.normalMap);
```

This is a defect fix as well as a feature, though a narrower one than it first looks. [main.ts:39](../../src/main.ts#L39) runs `batchByRole`
before [main.ts:55](../../src/main.ts#L55) runs `applyFinishes`, so `material.normalMap` is null
for every material at batch time. `needsTangents` is permanently false, the tangent branch is
unreachable in production, and the mirrored-geometry W flip at
[batching.ts:46](../../src/batching.ts#L46) never fires. `batching.test.ts:99` covers the branch
only by constructing a material with a `normalMap` by hand.

Two qualifications, so the claim is not stronger than the evidence. Normal mapping would not
*fail* today: r185 builds a derivative-based tangent frame when vertex tangents are absent, so the
current deletion costs quality and kills the W flip rather than breaking the render — it is not an
argument for re-export. And `computeTangents()` is not MikkTSpace, so mixing computed with
Blender-authored tangents across one role's bucket needs seam and handedness coverage rather than
an attribute-exists assertion.

Reading the whole registry has a cost worth naming: a dormant variant carrying a normal map
imposes tangent generation on every mesh in that role at load, before anyone selects it. That is
the intended trade, since the alternative strands a swap, but it means `computeTangents()` runs
against UVs that have never been exercised for it. The same variant set must drive batching and
finish application, or the two disagree about what is needed.

Reading the whole registry rather than the *active* variant is deliberate: a swap into a variant
that has a normal map would otherwise find the tangents already deleted.

4. Every normal and roughness spec carries `srgb: false`. A normal map decoded as sRGB lights
in the wrong direction and looks plausible enough to ship.

### The multiplier trap

In Three.js `material.roughness` **multiplies** `roughnessMap.g`; it does not replace it, confirmed
in r185's `roughnessmap_fragment.glsl.js`. A role at `roughness: 0.35` with a map averaging 0.85
renders at 0.30, and all 15 shift the same way. Every role gaining a roughness map therefore needs
its constant re-derived. The same arithmetic governs `metalness` and the B channel, which is the
second reason there are no metalness maps.

That correction is a **parameter check, not a guarantee of preserved appearance.** `target /
mean(map.g)` holds the unweighted mean of the product at the target *before* the rest of the
shader runs, and r185 then applies a roughness floor, adds geometry roughness derived from
normal-map variance, and clamps the result at 1. Adding a normal map moves effective roughness on
its own. Four things have to be pinned or `check_textures.mjs` asserts nothing useful:

- `[min, max]` in the manifest are the emitted map's own decoded range, written directly with **no
  mean normalisation.** An earlier draft of this section said the map is normalised so its decoded
  mean is 1.0; that is unsatisfiable. Decoded samples lie in `[0, 1]`, so a mean of 1.0 forces every
  sample to 1.0, and the only map meeting it is a constant one — which carries no variation and is
  the one thing a roughness map exists to provide.
- **The multiplier has to stay, because maps are shared across roles with different gloss.**
  `walnut` serves `wood.cabinet` at 0.45, `wood.trim` at 0.35 and `panel.locker` at 0.12. Baking a
  target into the map would need three copies of the same grain. So the map stays target-agnostic
  and the registry constant carries the target.
- A consequence worth stating rather than discovering: a role whose target roughness approaches 1.0
  **cannot** carry a multiplicative map whose mean is below that target, because the required
  constant exceeds 1. `textile.curtain` at 0.95 is the live case. That is the "failure, not a clamp"
  rule below doing its job, and the answer is that the role ships no roughness map.
- `mean` is measured on the **decoded, normalised green channel of the shipped WebP**, not on the
  pre-encode buffer, because the encoder moves it.
- Targets live in a machine-readable block that the checker reads, not in a prose comment it would
  have to parse.
- A derived constant outside `[0, 1]` is a a failure, not a clamp. Target 0.95 against a map mean
  of 0.8 wants 1.1875, which is unrepresentable, and the fix is to re-window the map.

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

`body.paint` carries the real risk, because it is the surface adjacent to the decal and its
specular feeds the same frame. Paint can reach the decal's own pixels through blended and
antialiased boundaries, and through bloom if a changed highlight crosses its threshold; ACES
itself is pixel-local, so adjacency alone does not move opaque central decal pixels.
`tools/check_livery.mjs` becomes a required gate on every commit touching an exterior role. If it
moves, the map is wrong, not the artwork.

Two things about that gate have to change, or it certifies nothing:

- **It must run on a fresh capture tied to the changed revision.**
  [check_livery.mjs:7](../../tools/check_livery.mjs#L7) defaults to an existing PNG, so re-running
  it after an exterior change happily re-measures the *old* render and passes. The gate is
  `pnpm capture` then `check_livery.mjs`, in that order, and the capture's provenance is recorded.
- **"Green" is not "unmoved".** Its accepted hue band is
  [24–33°](../../tools/check_livery.mjs#L56), wide enough that the orange can drift several degrees
  and still pass. This pass requires the stricter reading: hue and saturation within a recorded
  delta of the pre-change baseline, not merely inside the band.

Orange peel cannot be photo-derived. At 0.18 px/mm the best exterior photograph resolves
nothing below ~50 mm. The same is true of tyre tread at 640 × 360 and of a wheel's cast texture.
Three options were put to the owner, who chose (a) on 2026-09-12. It is recorded here as decided:

- **(a) Roughness only — CHOSEN.** `body.paint`, `tyre` and `wheel` get windowed roughness maps,
  which are a low-frequency signal a 1080-wide photograph does carry, and **no normal maps**.
  Consistent with photo-derivation, and it needs no exception to the no-procedural rule. What the
  walkaround footage actually shows is gloss falloff across panels, not visible peel.
- **(b) One procedural exception.** A low-amplitude generated orange peel on `body.paint` only,
  argued for explicitly as the one map in the project that is not photographic, and tagged
  `estimated` the way the data layer tags a derived dimension.
- **(c) Defer the exterior.** Ship phases 1–3, re-scope with interior results in hand.

**Consequences of (a), which phase 4 implements.** All three exterior entries carry
`"normal": {"strength": 0}` in the manifest, so no `_n.webp` is emitted for any of them and the
§3 mirror's vector handling is never exercised on the exterior. `body.paint`'s roughness constant
is re-derived per §4's rule like any other. Because no normal map reaches `body.paint`, r185 adds
no geometry roughness there, which removes one of the two ways this pass could have moved the
livery measurement; the fresh-capture and drift-tolerance gate still applies, because specular
change from the roughness map alone remains possible.

The exterior therefore ships 3 roughness maps and 0 normal maps, and the project's total falls
from a candidate 13 normal maps to 10.

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

Every criterion below names the thing that would make it fail. The review this spec went through
found that the first draft's gates could each be passed by an incorrect implementation, so the
column that matters is the third one.

### Assertions

| Check | Kind | Asserts | Rejects |
|---|---|---|---|
| Texture URLs resolve | vitest | Every `TextureSpec.url` in the registry is a file under `public/`. nothing checks this today | A typo'd url rendering untextured in silence |
| Data maps are not sRGB | vitest | Every `normalMap` / `roughnessMap` spec has `srgb === false` | Lighting that is inverted but plausible |
| Maps stay in register | vitest | Within a variant, `normalMap.repeat` and `roughnessMap.repeat` equal `map.repeat` | Relief drifting off its grain after a retune |
| No `.glb` map regression | vitest | Every committed module's glTF materials carry 0 `normalTexture` and 0 `metallicRoughnessTexture` | A Blender change silently authoring maps the registry then overrides |
| `repeat` is derived | vitest | Tiling entries satisfy `repeat = 1000 / (2 × worldMm)`, decals `1000 / worldMm`, per axis | The 2× mirror-tile error enforcing a scale twice as wrong as today's |
| Variant round-trip | vitest | Swapping mapped → unmapped → mapped leaves `normalMap`, `roughnessMap` and `map` at their first-pass values | A stale map surviving a swap, which is what assign-or-null exists to prevent |
| Tangents survive batching | vitest | A role with a `normalMap` in any variant keeps `tangent` through `batchByRole`, asserted in production order — batch before finishes | The dead branch silently returning |
| Tangent seams | vitest | For one mirrored and one unmirrored primitive per mapped role, tangent handedness `w` is consistent within each and flipped across the reflection | `computeTangents()` and Blender tangents disagreeing inside one merged bucket |
| Roughness targets | `check_textures.mjs` | For each mapped role, the decoded normalised G-channel mean is 1.0 ± tol, the registry constant equals the machine-readable target, and every derived constant lies in `[0, 1]` | A constant silently out of range, or a target read from prose |
| De-artefact, both sides | `rectify_textures.test.mjs` | On a real compressed crop carried through stages 1–2: block-boundary energy below its threshold and 10–50 mm band energy above its floor | A filter that passes by flattening the image to grey |
| Normal mirror directions | `rectify_textures.test.mjs` | On the decoded output: a known directional slope reads with R negated in the top-right quadrant, G in the bottom-left, both in the bottom-right; seams are continuous across all four | The `.flop()`/`.flip()` bug lighting three quadrants backwards |
| Flat encodes flat | `rectify_textures.test.mjs` | A constant region decodes to (128, 128, 255) within a stated tolerance, OpenGL `+Y` up | An encoder-damaged normal field |
| `strength: 0` contract | `rectify_textures.test.mjs` | No `_n.webp` is emitted. Contract only — it carries no evidence about filter quality | (nothing; recorded so the earlier draft's claim is not reinstated) |
| Livery drift | `pnpm capture` → `check_livery.mjs` | Hue and saturation within a recorded delta of the pre-change baseline, measured on a fresh capture of the changed revision | A stale PNG re-measured, or a multi-degree drift inside the 24–33° band |
| Neutrals | browser `?calibrate` | The three saturations recorded as numbers, before and after, against a stated baseline, sampled only once the texture manager is idle and the probe refreshed | A sample taken mid-load, and the false inference that any movement must be a roughness map |
| Draw calls | browser `?verify` | Identical at all eight stops | A leaked role |
| Frame rate | browser `?verify` | Stated browser, hardware, drawing-buffer size, warm-up, sample duration and statistic; regression judged against a like-for-like baseline | A comparison against `pnpm capture`, which renders at 2880 × 1800 and disclaims FPS equivalence |
| GLBs byte-identical | `shasum` | Per-file hashes recorded before the run and re-checked after | An empty `git status` after the files were committed |
| Budget | `pnpm budget` | Under 25 MB with `public/textures/` counted, per `check_budget.mjs:54` | — |
| Relief, per role | `pnpm capture` | Side by side against the named walkthrough still, per role, with an explicit verdict of keep / reduce / `strength: 0` | Shipping a channel the evidence does not support |

### Two gates that must be defined before they are written

**The neutral gate cannot assume albedo is unchanged.** Stage 3 runs *before* the albedo branch,
so de-artefacting changes albedo's input; re-sourcing and the derived `repeat` change it again.
Normal maps move measured saturation through lighting on their own. So the earlier draft's
inference — movement means a roughness map caused it — is false and is withdrawn. The gate records
numbers on both sides instead of relying on the 0.08 pass flag, and phase 1 states plainly whether
the eight existing albedo bytes are preserved or deliberately regenerated.

**The neutral gate is also not currently reliable.**
[main.ts:207](../../src/main.ts#L207) starts calibration without waiting for the texture manager,
and [calibrate.ts:75-81](../../src/calibrate.ts#L75-L81) tweens then samples on the next frame.
With only baked AO that is nearly always fine. With asynchronous registry maps it is a race, so
readiness has to be established explicitly before any measurement is taken.

Deliberately not run: `check_blend.py`, `check_models.mjs`, `pnpm export`, `pnpm bake`. Geometry
does not move, and the `.glb`s must hash identically.

## 8. Phasing and risks

Sourcing is settled in §2, so there is no reconnaissance phase.

| # | Phase | Gate |
|---|---|---|
| 0 | Restore `docs/research/reference/` from `0abe397`; measure whether `q_90` differs in decoded pixels; record per-file `shasum` of `public/models/*.glb` | The decoded-difference number exists and decides the re-crop question either way |
| 1 | The three rectifier stages, the vector-aware mirror, and their tests | Both sides of the de-artefact gate; all four mirror quadrants correct on decoded output |
| 2 | The four runtime edits plus every vitest row in §7 that does not depend on an authored map | `pnpm check` green; glb hashes unchanged |
| 3 | Five new manifest entries, 12 interior roles authored, `check_textures.mjs`, roughness targets re-derived | `check_textures.mjs` green; per-role capture verdicts recorded |
| 4 | 3 exterior roles, per §9 open question 1 | Fresh capture then `check_livery.mjs` within the recorded delta |
| 5 | Derived `repeat` from `worldMm`, then the floor-pattern check | Side-by-side capture; **runs before any `strength` retune it invalidates** |

Phase 5's ordering is load-bearing: changing `repeat` changes the rendered scale of every tiling
map, and relief tuned at one scale does not stay tuned when the scale moves. The earlier draft put
it last, which would have invalidated phase 3's tuning.

| # | Risk | Mitigation |
|---|---|---|
| 1 | Artefact scale and signal scale overlap at ~11 mm, so no filter separates them cleanly | The two-sided gate in §7 fails a filter that wins on either side alone. If no setting passes both, the honest outcome is fewer channels, not a looser threshold |
| 2 | Derived relief is not recovered physics, so a map can look like material and be wrong | Per-role capture verdicts with `strength: 0` as an ordinary result; roles tagged `estimated` |
| 3 | Roughness constants not re-derived, or derived outside `[0, 1]` | `check_textures.mjs`, with out-of-range treated as failure rather than clamped |
| 4 | `body.paint` specular moves the livery measurement | Fresh capture plus a delta tolerance, not the 24–33° band |
| 5 | The tangent branch changes shading on the 22 primitives that already carry tangents, and a dormant variant forces `computeTangents()` on UVs never exercised for it | The seam and handedness assertion in §7, plus by-eye capture diff |
| 6 | GPU residency grows ~40 MB on the one platform never measured | Recorded, not pretended away. It compounds the parent spec's existing open gap |
| 7 | The neutral gate races texture loading | Readiness established before any sample; numbers recorded on both sides |

## 9. Open questions

1. ~~Which exterior option.~~ Closed 2026-09-12: (a), roughness maps only. `body.paint`, `tyre`
   and `wheel` carry `strength: 0` and emit no normal map. See §5.
2. Whether the three leather crops should share one normal map. They are three photographs of what
   is probably one hide; sharing would cut bytes and guarantee they read as one material, at the
   cost of the per-crop provenance the manifest otherwise holds.
3. Whether `panel.wall`, which has no map at all today, wants a normal map or only the roughness
   variation. A soft-touch bone panel is nearly featureless, and the honest answer may be neither.
4. ~~Whether the `q_90` re-fetch changes decoded pixels at all.~~ Closed by measurement: 71.3 % of
   samples differ, mean 2.09, max 33. It is a real decode difference and worth taking, but only for
   sohu-sourced crops, and no manifest entry sources from sohu today. Nothing already shipped
   changes.
5. Whether the derived `repeat` in phase 5 should ship at all. It is more faithful and it changes
   the look of every tiling surface at once, including ones nobody complained about.
6. Whether `floor`'s herringbone is printed on the vinyl or was a wrong reading. §2 establishes the
   material is vinyl, which the registry already says; the pattern is a separate question, and it
   decides whether the floor's seams may be embossed at all.

Carried forward from the parent, untouched: the mid-range phone frame rate has still never been
measured on hardware, and §5 of this spec makes that gap materially larger.

## 10. Review record

Reviewed once by `deep_reasoner` (job `job-2026-09-12T22-16-05-54420-spec-review`) before any
implementation. Seven blocking and three advisory findings, all ten accepted, none declined, so
the gate reached consensus without arbitration. Two would have shipped working-looking but wrong
output:

- The mirror-tile stage moves pixels without negating the normal map's tangent-space X and Y, so
  three quadrants in four would have lit backwards. §3.
- `rectify_textures.mjs:92` renders a tiling crop at half the output width before mirroring, so
  one tile spans twice the crop. The first draft's `repeat = 1000 / worldMm` would have enforced a
  scale twice as wrong as the one it replaced, with a passing test. §2.

Three claims the first draft got wrong about this repository, corrected above: the floor was
already `grey-vinyl` in the registry so the crawl confirmed rather than corrected it;
`strip_surface_maps()` does not justify assign-or-null, though direct glTF material evidence does;
and `q_90` returning more bytes is not evidence of different decoded pixels.
