# The livery's orange reads gold: two candidate fixes

## Context

[plan_exterior-fidelity.md](plan_exterior-fidelity.md) closed the gap between the exterior stop
and the walkaround footage, and its retune pass fixed the livery's *saturation* by measurement:
the exterior `environmentIntensity` went 0.45 → 0.20, putting the orange field at saturation
0.498 against the 0.46–0.51 the same wrap measures in the reference frames.

**Hue was not fixed and cannot be fixed by any brightness lever.** That is what this plan is for.
It carries two independent candidates. They are alternatives, not phases — pick one, or pick A and
then re-measure whether B is still needed.

Nothing here is started. The measurements below are done and are the basis for the whole plan.

## Evidence

All numbers are the median of pixels matching `r>g>b && r−b>50 && r>90`, the same filter and the
same statistic applied to render and photograph alike, so they compare.

| Source | Hue (median, IQR) | Saturation (median, IQR) |
|---|---|---|
| Flat artwork (`side-livery.webp`) | 32.2° | 0.815 |
| `exterior-kerb-flank-2m38s` | 27.9° [26.5–28.9] | 0.540 [0.451–0.682] |
| `exterior-kerb-three-quarter-3m14s` | 30.2° [29.4–31.2] | 0.827 [0.728–0.851] |
| `livery-wordmark-detail` | 26.5° [25.3–27.7] | 0.466 [0.397–0.638] |
| **Render today**, env 0.20 | **41.7°** [41.7–41.8] | 0.498 [0.496–0.502] |

**Hue is the defect and the gate.** The three frames agree within 4° despite different lighting,
distance and compression, and they bracket the artwork's 32.2°. The render sits at 41.7°.

**Saturation is not a target.** The same frames span 0.466 to 0.827 — a real wrap photographs at
wildly different saturation depending on how it is lit. `TARGET.saturation` is a wide sanity band
to catch a regression to the pale cream this work began at (0.293), nothing more. The render's
0.498 is already inside it, and raising it further is not an objective.

**The hue does not respond to light.** Thirteen combinations of `environmentIntensity` × `tone‑
MappingExposure`, spanning env 0.20–0.50 and exposure 0.40–1.05, hold hue between 40° and 42°
throughout while saturation swings 0.498 → 0.605:

| env × exposure | Saturation | Hue |
|---|---|---|
| 0.20 × 1.05 (today) | 0.498 | 42° |
| 0.20 × 0.70 | 0.605 | 40° |
| 0.30 × 0.70 | 0.506 | 42° |
| 0.35 × 0.60 | 0.506 | 41° |
| 0.45 × 0.45 | 0.519 | 41° |
| 0.50 × 0.40 | 0.528 | 41° |

Also ruled out by measurement, each a plausible-sounding wrong answer:

- **Not bloom, not the interior lights.** Dousing either changes the frame by not one byte;
  `RectAreaLight` is one-sided, so the cove strips never reached the body's outside at all.
- **Not the material.** The decal carries no `envMap` of its own, so `material.envMapIntensity`
  does nothing; the scene-level intensity is the only lever. Roughness moves saturation 0.02
  across its whole range.
- **Not the direct lights.** A 3× cut in the sun and hemisphere together moves the field by 0.005.
- **Not the artwork, the UVs, or the colour space.** Rendered with lighting removed, the same
  decal returns `#e6a838`, saturation 0.757 against the artwork's 0.815.

That leaves the tone curve. `scene.ts:28` sets `ACESFilmicToneMapping`, and ACES is known to
rotate saturated oranges toward yellow as luminance rises. The render sits at peak channel 237
against the photographs' 166–178, which is the part of the curve where the rotation is worst.

### The measurement harness already exists

`tools/capture_stops.mjs` drives the stops headless and `dist/captures/measured.json` records
draw calls per stop. The hue/saturation statistic above was computed with a throwaway script over
`dist/captures/exterior.png`. **Task 0 of whichever option is chosen is to commit that statistic
as `tools/check_livery.mjs`**, so the target is re-measurable rather than re-derived by hand each
time. It takes a PNG and prints median hex, saturation and hue for the orange, the teal and the
wordmark band.

One correction it must carry: the teal figures quoted during the retune were contaminated. The
naive teal filter selects sky pixels — its saturation tracked the sky's 0.207 exactly across every
sweep. The teal must be sampled inside the decal's screen-space bounding box, not frame-wide.

---

## Option A — a hue-preserving tone map

Three 0.185.1 ships both alternatives as first-class constants (`node_modules/three/src/constants.js`):
`AgXToneMapping = 6` and `NeutralToneMapping = 7`. `OutputPass` already dispatches on them
(`OutputPass.js:110-111`) and **re-derives its defines whenever `renderer.toneMapping` changes**
(`OutputPass.js:97-100`), so this is a property assignment, not a pipeline change. No new
dependency, no shader of our own.

AgX is the filmic one: it desaturates highlights on a long shoulder but holds hue far better than
ACES. Neutral (Khronos PBR neutral) is designed for product viewers and preserves *both* hue and
saturation in the midtones, clipping later. Both are worth measuring; **AgX will darken and flatten
the interior more, Neutral will change it least.** Do not pick between them from this paragraph —
A.2 measures it.

### A.1 What it costs

This is the honest reason the fix is not a one-liner: **the tone curve is upstream of every
appearance number the spec records.** Changing it invalidates, and requires re-deriving:

| Setting | Where | Why it moves |
|---|---|---|
| `toneMappingExposure` 1.05 | `scene.ts:29` | Tuned against ACES; AgX in particular renders darker at parity |
| ~~Bloom thresholds 5.0 and 12~~ | `scene.ts:115`, `main.ts:146` | **Struck — this was backwards.** The chain is RenderPass → bloom → OutputPass, and `LuminosityHighPassShader` thresholds the incoming *linear HDR* luminance, before any tone mapping. Changing the output curve cannot change which pixels cross 5 or 12. Review visible bloom, but do not re-derive the thresholds |
| Exterior `environmentIntensity` 0.20 | `main.ts:142` | Tuned against ACES by the sweep this plan quotes; must be re-swept |
| Cove tint `WARM = 0xffeed8` | `lighting.ts:24` | §7's warm-cast fix exists *because* "ACES saturates the warm end". Under a different curve the original `0xffd9a0` may be admissible again — re-measure before keeping the correction |
| The three `?calibrate` patches | recorded 0.052 / **0.084** / 0.074 against a 0.08 ceiling | All three are saturation measurements through the curve |

Note the chair panel already reads **0.084, over its ceiling**, and has done since before this
work. Do not let a tone-map change be blamed for it, and do not treat 0.084 as the pass mark.

### A.2 Choose the curve by measurement, not by eye

Extend the throwaway sweep harness into `tools/sweep_tonemap.mjs` (or fold it into
`check_livery.mjs` behind a flag): for each of ACES, AgX and Neutral, at a small grid of
exposures, report the livery triple **and** the three `?calibrate` saturations. Pick the curve and
exposure that put the orange hue nearest 27° with saturation in 0.46–0.51 **and** all three
patches under 0.08.

If no combination satisfies both, that is the finding, and the fallback is A.3.

### A.3 Variant: apply the curve at the exterior stop only

`goTo` already switches `environmentIntensity`, the bloom threshold, the background and the sky
per stop. `renderer.toneMapping` can join them, because `OutputPass` recompiles on change.

- **Buys:** the interior keeps ACES, so §7's warm cast, the cove tint and every `?calibrate`
  number stand untouched. The blast radius shrinks to the exterior stop.
- **Scope BOTH the curve and the exposure.** A.1 contemplates re-deriving `toneMappingExposure`,
  which lives on the renderer and is global. Switching the curve back at interior stops while
  leaving a new exposure applied still re-grades the interior, and the "interior untouched"
  guarantee is then false. Save and restore both, and include the plan stop on the interior side.
- **Costs:** a shader rebuild the first time each curve is used. `OutputPass` sets `needsUpdate`,
  but `WebGLRenderer` keys programs by cache key and reuses them, so later switches hit the cache
  — a recurring per-transition hitch is **not** established, only a first-use one. Measure it with
  a stop-to-stop transition, not a cold load; `capture_stops.mjs` reloads per stop and will not
  see it either way. It also means the vehicle is graded
  differently outdoors than indoors, which is defensible for a walkthrough but is a real
  inconsistency to state in the spec rather than discover later.
- **Open question this must answer:** which curve the **plan** stop gets. It orbits like the
  exterior but shows the sectioned interior, and `goTo` already keys `exterior` on
  `id === 'exterior'` precisely for that reason. Follow that precedent: plan stays on the interior
  curve.

### A.4 Files touched

| File | Change |
|---|---|
| [src/scene.ts](src/scene.ts) | The `toneMapping` constant and its exposure |
| [src/main.ts](src/main.ts) | A.3 only: per-stop curve in `goTo`; re-swept exterior `environmentIntensity` |
| [src/lighting.ts](src/lighting.ts) | Only if the re-measurement says the cove tint correction is no longer needed |
| [src/main.test.ts](src/main.test.ts) | Pins `environmentIntensity`; would pin the curve under A.3 |
| [docs/specs/design_rv-interior-3d.md](docs/specs/design_rv-interior-3d.md) | §7's warm-cast section, the calibration table, a new record entry |
| tools/check_livery.mjs, tools/sweep_tonemap.mjs | New |

---

## Option B — compensate in the artwork

Pre-rotate the artwork's hue so that what comes *out* of ACES matches the photographs. The
measured offset is +9.5° (32.2° authored → 41.7° rendered). To land on the photographs' ~27°, the
first probe is **27 − 9.5 ≈ 17.5° authored**, then iterate.

The plan first said "32 − 10 = 22", which targets 32° *output* — the artwork's own hue, not the
photographs'. That compensates the artwork-to-render gap instead of the render-to-photograph one,
and the spec review caught it. The offset is also not guaranteed constant across hue, which is why
this is a measure-fit-measure loop and not a subtraction.

### B.1 Why this is cheaper than it looks

`body.graphic` is in `EXTERIOR_ROLES`. The decal is drawn at the exterior and plan stops and
nowhere else, so **this option cannot touch the interior at all**: no `?calibrate` movement, no
cove-tint interaction, no exposure re-derivation. The blast radius is one texture.

Three colours are in play, and each needs its own measurement, not one global rotation:

| Field | Authored | Rendered | Needs |
|---|---|---|---|
| Orange `#e8912a` | 32° | 42° | Hue down ~10°, saturation re-checked after |
| Teal `#12657c` | — | **not yet measured** | Measure properly first (see the contamination note above) |
| Black `#191b1c` | — | recovered at env 0.20 | Probably nothing; confirm |

### B.2 Why it is not merely "change the hex"

**~~The skew is luminance-dependent.~~ Measured, and it is not, on this geometry.** The worry was
that ACES rotates more where the surface is brighter, so one pre-rotation could only be right at
one luminance. `tools/check_livery.mjs` reports the hue interquartile range across the field as
**41.7-41.8 degrees** — no spread at all. The decal is a single flat plane with a constant normal
and nothing shadows it, so every pixel of the field shades identically. A single pre-rotation is
therefore uniformly correct here, and this option is substantially safer than it looked when the
plan was drafted. Keep reporting the spread: it is what would catch a future decal that wraps a
corner or falls into shadow.

**It is a compensation, not a correction**, and it is tied to the current curve and the current
exterior lighting. If Option A is ever taken afterwards, or the exterior lighting is retuned, the
artwork is wrong again and in the opposite direction. Whatever lands must say so in the SVG header
next to the existing provenance note, so the next pass does not read `#c8912a` as a sampled
colour. This is the reason the parent plan marked the palette settled, and taking this option
knowingly reopens it.

### B.3 Procedure

1. Commit `tools/check_livery.mjs` (Task 0) with the corrected teal sampling.
2. Edit the palette in [model/side-livery.svg](model/side-livery.svg). It occupies **seven
   attributes, not three fills**: orange is one path fill plus two text fills; teal is a fill and
   a stroke; black is a fill and a stroke. Editing only the fills leaves the chevron strokes at
   the original colour and the graphic splits into two palettes.
3. `node tools/render_livery.mjs`, then `pnpm capture`, then `node tools/check_livery.mjs`.
4. Iterate. Two or three rounds should converge; if it does not, the luminance spread in B.2 is
   the reason and Option A is the answer instead.

### B.4 Files touched

| File | Change |
|---|---|
| [model/side-livery.svg](model/side-livery.svg) | Three `fill` values, plus a header note that these are pre-compensated |
| public/textures/side-livery.webp | Regenerated; committed |
| public/renders/*.webp | Re-captured |
| [docs/specs/design_rv-interior-3d.md](docs/specs/design_rv-interior-3d.md) | §14 and a record entry |
| tools/check_livery.mjs | New |

**Not touched:** `render_livery.mjs` needs no change, but its header comment claims the SVG lands
at "2048 x 422". It is 2048 × 919 and has been since the livery was redrawn to the 3.9 : 1.75
flank. Fix the comment while in there.

---

## Spec review

Reviewed once by `deep_reasoner` (codex `gpt-6-astra`, xhigh, read-only, job
`job-2026-09-08T17-47-29-52843-spec-review`). It verified every three.js and line-number claim in
this plan as correct, and found nine issues. Seven are folded in above; two are recorded here.

**Accepted and folded in.** The photographic target was contaminated — the statistic quoted was
the median of R, G and B converted to HSV, not the median hue, and the unmasked filter selected
skin, wood and warm lighting, over half the sample in one frame. Re-measured with a largest-blob
mask and a true median hue, the 15° outlier disappears and the three frames cluster at 26.5–30.2°.
Also folded in: the bloom cost was backwards, `?calibrate#exterior` does inherit exterior state,
A.3 must scope exposure as well as the curve, the SVG palette is seven attributes, the shader
rebuild is cached rather than per-transition, and B's starting arithmetic targeted the wrong hue.

**Accepted, not resolvable here.** The review is right that matching filters do not make
photographs under different lighting a controlled colour measurement, and that the `r − b > 50`
term imposes a brightness-dependent saturation floor. That is why saturation is now a sanity band
rather than a target, and why hue — which the three frames agree on to within 4° across very
different lighting — carries the gate. This remains an owner-chosen appearance target informed by
evidence, not a demonstrated colorimetric match, and the plan should not be read as claiming the
latter.

**Rejected.** None outright. The review's causal caution is fair: ACES is the best-supported
explanation rather than a proven sole cause, and the sweep that "ruled out brightness" mostly held
`environmentIntensity × exposure` near 0.20, so it varied brightness far less than it appeared to.
That weakens the diagnosis but not the plan — both options are judged by outcome against
`check_livery.mjs`, not by whether the diagnosis was right.

## Recommendation

**Option B, then re-measure.** It addresses the one measured defect, it cannot regress the
interior, and it is reversible by editing three hex values back. Option A is the more correct fix
in principle — it treats the cause rather than the symptom — but it re-grades every surface in the
vehicle to fix one graphic, against a calibration baseline that is already carrying a failing
patch at 0.084.

Take Option A instead if the goal is broader than the livery — if the white body clipping at peak
channel 246 against the photographs' `#7e8888` is also considered wrong. That is a real gap, it is
recorded nowhere as settled, and it is the same root cause. **It is out of scope for this plan**,
which is about hue, but it is the argument that would justify A's cost.

If A is taken, prefer **A.3's per-stop variant** unless the hitch measures badly, and re-measure
whether B is still needed afterwards — a hue-preserving curve may remove the need entirely.

## Verification

Common to both:

1. `pnpm check`.
2. `node tools/check_livery.mjs dist/captures/exterior.png` — orange hue within 15–27°, saturation
   within 0.46–0.51, teal and band reported.
3. `pnpm capture && pnpm thumbs`, then the kerb three-quarter beside `exterior-kerb-flank-2m38s`
   and `exterior-kerb-three-quarter-3m14s`. Same success criterion as the parent plan.
4. Draw calls unchanged: 46 worst interior, 26 exterior, 63 plan. **Two ceilings are already
   exceeded** — the plan stop's 60, and the parent spec's interior ceiling of 40, which 46 passes.
   Holding these numbers proves non-regression, not compliance. This work must not make either
   worse.
5. `node tools/check_livery.mjs dist/captures/plan.png` — the plan stop shows the same decal under
   the interior probe, so a change to either the curve or the artwork lands there too. Report it;
   it is not gated, because the photographs frame no equivalent view.

Option A only:

5. `?calibrate` at 1920 × 1080, all three patches, against 0.052 / 0.084 / 0.074. Treat 0.084 as
   the inherited baseline to hold, not as a pass — it is already over its 0.08 ceiling.
   **Invoke as `tour.html?calibrate` with no hash.** `runCalibration` moves the camera with
   `tweenTo` and bypasses `goTo`, but startup calls `goTo` from the URL hash *before* calibration
   starts (`main.ts:172` then `main.ts:207`), so `?calibrate#exterior` measures with the exterior
   environment set and the cabin hidden. The no-hash form falls back to `HOTSPOTS[0]`. The plan
   previously claimed calibration "never sees" exterior settings; that was wrong.
   The three patches are also still unverified against a marked screenshot, so treat the historical
   numbers as a baseline to compare against, not as proof of today's state.
6. Every interior stop compared against its committed `public/renders/*.webp` before and after —
   the whole point is that these change, so the question is whether they change acceptably.
7. A.3 only: frame time across an exterior↔interior transition, measuring the recompile.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | A re-tints the interior and the warm-cast fix silently regresses | A.2 measures all three `?calibrate` patches alongside the livery, in the same sweep |
| 2 | ~~B's compensation is correct only at one luminance~~ | Measured and dissolved: the field's hue spread is 41.7-41.8 degrees. The check still reports it, so a future decal that wraps or shadows would show up |
| 3 | A later pass reads the compensated artwork as a sampled colour | The SVG header states it, and §14 records it |
| 4 | The teal target is wrong because the old measurement sampled sky | Task 0 fixes the sampling before any tuning decision is made |
| 5 | A.3's recompile hitch is invisible to the capture harness | Measure a transition, not a cold load |
| 6 | Neither option reaches 27° | Possible: the render sits at peak 237 against the photographs' 166–178, and some of the gap is the owner-approved outdoor sky, which is brighter than the exhibition hall the evidence was shot in. Decide explicitly whether the residual is accepted rather than tuning indefinitely |

## Deliberately not taken

- **Matching the photographs' absolute luminance.** They are shot indoors; the sky is an
  owner-approved departure recorded in the spec. Only hue and saturation transfer.
- **A `CustomToneMapping` curve.** Hand-authoring a tone curve to fix one graphic is a large
  liability for a portfolio piece, and two shipped alternatives are untried.
- **Re-lighting the exterior to bring the body down to `#7e8888`.** Same root cause, larger
  question, argued above.
