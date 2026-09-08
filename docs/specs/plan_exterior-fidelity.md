# Exterior fidelity: close the gap to the walkaround footage

## Context

The exterior stop does not read as the same vehicle as the reference photographs. The complaint
was "looks nothing like the real vehicle photo", with the standing rule that where the model and
the source evidence disagree, the evidence wins.

This plan has been through one independent spec review (Codex `gpt-6-astra`, xhigh, read-only,
job `job-2026-09-07T23-09-04-40919-spec-review`). Twelve findings; the corrections are folded in
below and the ones that changed the design are called out in **Review corrections** so the
reasoning is not lost.

**The structural insight the second pass found: `EXTERIOR_ROLES` is incomplete, and completing it
is the cheapest change in the plan — it *reduces* draw calls at every stop, and it unlocks the
slide-out work for free.** Six of the ten roles in `exterior.glb` are absent from it, so the
skirt, every window reveal, the awning LED, the chrome and the rear lamps are drawn at all seven
interior stops and sit inside every `refreshProbe` capture. The parent spec already records this
trap; nothing had paid to fix it.

Blender owns geometry and UVs only. Its materials are flat placeholders carrying just the AO bake
— verified by reading the node graphs. Every appearance decision lives in `src/data/finishes.ts`,
`src/scene.ts`, `src/lighting.ts` and `model/side-livery.svg`. So "fix it in Blender" is about a
third of the job; Blender stays the verification surface per the child spec's §5.

### Settled by the user — implement, do not relitigate

1. Scope is **lighting, glazing, livery**. Body radii, wheel track and the cab sculpt are out.
2. The slide-out is **hidden at the exterior stop**, staying deployed everywhere else. They chose
   the do-it-properly option over composing around the box.
3. **A sky**, not the showroom the frames actually show. Raised and reaffirmed — see Phase 1.
4. A **Playwright capture script** replaces the deleted `docs/research/final/`.

## Evidence

Frames studied: `t02m38s` and `t03m14s` (the two closest analogues to the exterior stop's
framing), `t00m05s`, `h0140`, `w0059`–`w0140`, plus the committed
`docs/research/walkthrough/exterior-kerb-flank-0m59s.jpg`.

**Those frames are not in the repository** — they live in a prior session's scratchpad. Task 0 of
this plan is to commit the ones it cites into `docs/research/walkthrough/` and add them to that
directory's README table. A plan that cites evidence a reader cannot open is not reviewable.

Current model read directly out of `model/rv.blend` over the Blender MCP: 47 objects, 10
collections, the `exterior` collection enumerated with vertex counts, dimensions and materials,
plus a solid-shaded viewport screenshot to judge geometry independently of materials.

Baseline caveat: `public/renders/exterior.webp` predates `efe97a2`, and `docs/research/final/` —
the source it was cropped from — was deleted in `a771cf4`, so `pnpm thumbs` currently fails. That
image is not evidence of current runtime appearance.

### What differs

| # | Reference shows | Model does | Fix in |
|---|---|---|---|
| 1 | Body lit by its surroundings, strong speculars | `scene.environment` is the **interior** probe cubemap (walnut, cream panels, warm coves) at intensity 2.5 | `src/lighting.ts:70-96` |
| 2 | Vehicle grounded by a hard contact shadow | The **body masses cast no shadow** — the map is baked while they are hidden | `src/lighting.ts:73-77` |
| 3 | Dark tinted glazing in heavy black frames | **No pane at all.** The reveals are four strips scribed on solid paint, so the apertures read as white body paint | `tools/model_exterior.py:20-37` |
| 4 | Livery wraps the whole upper flank | Decal covers 700 mm of a 2550 mm flank, at z 0.60–1.30, entirely below the windows | `tools/model_exterior.py:185-192` |
| 5 | `DACHIRV 大驰` legible on the flank the camera faces | Kerb wordmark maps behind the deployed `slideout_box` | artwork composition |
| 6 | Flat kerb flank — slide-out retracted in every frame | 580 mm box protruding across half that flank | Phase 4 |

Separately, and **not** the cause of row 3: the `glass` role renders opaque, emissive and
`depthWrite: false`, because `src/finishes.ts` sets `transparent = false` over the glb's
`alphaMode: BLEND` without resetting `opacity` or `depthWrite`. That is a real defect — it affects
the interior panes and the washer window — but it is not why the exterior windows are white.

The livery palette is already correct: teal `#12657c`, black `#191b1c`, orange `#e8912a`,
re-checked against pixels sampled from `h0140` and white-balanced against body panels reading
`#7e8888`. **The palette is right; the extent and the composition are wrong.** Two composition
corrections the frames settle: the orange field carries the wordmark on a near-black band below
it, and the teal forms the graphic's leading top edge rather than a second nested chevron.

### Constraints

- **One role = one material, vehicle-wide.** `batching.ts:53` takes `meshes[0]!.material` and
  `shell` loads first, so a shared role cannot differ between interior and exterior.
- **A hidden mesh costs no draw call**, which is what makes Phase 4 cheap: three skips invisible
  objects when building the render list.
- **The four envelope extremes are untouchable**: nose y −1.948, rear y 4.050, flanks x ±1.225,
  alcove roof z 2.150. `check_models.mjs` asserts 2450 × 5998 × 3200 to 1 mm over eight named
  bodies — and only those eight, so passing it cannot prove the visible vehicle has no
  protrusions.
- **A builder-authored UV survives only under `KEEPS_OWN_UV`** (`model_interior.py:180`), which
  exempts an object from *both* the `<module>_details` join and the re-unwrap.
- **New roles break `check_blend.py:7`** (`== 23`) and each needs a `ROLE_VIEWPORT` entry in
  `tools/make_starter_blend.py` plus a `pnpm exec npm run model -- shell` re-run, because
  `setup_materials()` runs only for the `shell` module.
- **The cab stays a box.** Raking the windscreen puts `build_cab`'s seats 220 mm through it.

---

## Phase 0 — Commit the evidence

Copy the cited frames into `docs/research/walkthrough/` with descriptive names, and extend that
README's table with what each settles. Without this, nothing below is checkable by a reader.

## Phase 1 — Complete `EXTERIOR_ROLES`

Do this **first**. It is the enabling change, it pays for itself in draw calls, and every later
phase depends on the clean interior/exterior split it creates.

**1.1 Give the exterior its own roles** for the six it currently borrows. Five new roles cover the
six usages:

| New role | Replaces, on exterior geometry | Carries |
|---|---|---|
| `body.trim` | `metal.dark`, `metal.brushed` | skirt, window and door reveals, vents and blades, mudflaps, roof AC vent, cab grille and mirrors |
| `body.chrome` | `metal.chrome` | grab rail, door rail, washer door ring |
| `body.led` | `led.cove` | awning strip |
| `body.screen` | `graphic.screen` | keypad, control panel, rear lamps |
| `glass.tint` | `glass` | the new window panes, and the washer window |

All five go in `EXTERIOR_ROLES`, which then covers every role in `exterior.glb`.

**1.2 The payoff.** `showExterior(false)` at interior stops now hides the *whole* exterior, so the
skirt, reveals, awning strip and chrome stop being drawn at the six interior stops and stop
polluting `refreshProbe`. Interior draw calls should **fall**. The new batches exist at interior
stops but are hidden, so they cost nothing there.

**1.3 The complement.** Add `showInterior` beside `showExterior` in `main.ts`, selecting every
role *not* in `EXTERIOR_ROLES`. With 1.1 done, the two are exact complements.

> **Review correction.** This replaces the pipeline pass that splitting the `<module>_details`
> joins would have required, and reaches the same outcome the user chose. The review confirmed —
> and I verified in Blender — that hiding `slideout_box` alone exposes **eight objects across four
> collections**, protruding up to 548 mm past the flank, in a dozen interior roles, three of them
> joined catch-alls mixing protruding with non-protruding geometry. But at the exterior stop the
> cabin is enclosed by an opaque body with no apertures, so **the entire interior is invisible
> anyway**. Hiding all of it is free, needs no join-splitting, no AO re-pack and no UV re-unwrap,
> and as a bonus closes the pre-existing 125 mm cab/habitation step gap where interior geometry
> currently shows through.

## Phase 2 — Daylight, sun and a ground shadow

**2.1 A sky.** `three/addons/objects/Sky.js` ships with the installed three — no new dependency.
Build it once in `scene.ts`, render it through `THREE.PMREMGenerator.fromScene()`, and keep both
the PMREM texture and the sky mesh on the bundle. Add a sun `DirectionalLight` on the sky's own
sun vector, alongside — not replacing — the existing near-vertical `hatch` light, which is the
interior's only daylight source.

> **Recorded departure from the evidence.** Every reference frame is shot indoors: an exhibition
> hall with skylights, ceiling fixtures and a polished reflective floor. There is no sky in any of
> them, so this is an appearance choice, not an evidence-driven one. Raised with the user and
> reaffirmed — their call, and it is theirs to make for a portfolio piece. Write it into the spec
> as a deliberate departure rather than letting a later pass "correct" it back. Choose the sun
> azimuth so the speculars land where the frames put them, which is the part the evidence *does*
> constrain.

Implementation record (job A): the outdoor sky and sun are a deliberate, owner-approved
departure from the indoor exhibition-hall evidence. Retain this setting in later fidelity
passes. The sun points from the front kerb quarter (runtime vector `6, 8, -6`), lighting the
front and kerb flank where the walkaround shows the strongest highlights.

**2.2 Swap the environment at the exterior stop only.** `goTo` sets the sky PMREM when
`h.id === 'exterior'` and restores the interior probe otherwise.

Keyed on `id === 'exterior'`, deliberately **not** on `view.kind === 'orbit'`: the plan stop is
also an orbit stop and looks at the sectioned *interior*.

**2.3 Make `refreshProbe` state-safe.** As written it unconditionally ends with
`scene.environment = cubeTarget.texture; scene.environmentIntensity = 2.5`, and `main.ts` calls it
on every finish swap without going through `goTo`. So a wood swap at the exterior stop would
replace the sky with the interior probe and leave it there.

`refreshProbe` must save and restore `environment`, `environmentIntensity` and `background`, and
must **hide the sun and the sky mesh** for the capture — nulling `scene.environment` does not
remove either, and both would otherwise contaminate the interior probe. This is the same
save/restore shape the function already uses for `clippingPlanes` and exterior visibility.

**2.4 Fix the shadow bake.** `refreshProbe` sets `shadowMap.needsUpdate = true` *before* hiding
the exterior, and three clears that flag on the first of the six cube-face renders
(`WebGLShadowMap.js:95,369`), so the map is baked with the body masses hidden and, with
`autoUpdate = false`, never rebuilt.

Three things, not one:
- Set `needsUpdate` **after** visibility is restored.
- Invalidate on **stop transitions** too — install runs before the first stop is chosen, and a
  later probe can equally bake a map with the exterior visible. Moving one assignment is not
  enough.
- Note that global clipping planes are **excluded from shadow rendering**
  (`WebGLClipping.js:67`), so the child spec's §8 risk 4 — a dollhouse lit through a missing roof
  — does not happen by restoring the plan stop's plane. Record it; do not silently inherit the
  claim.

> **Review corrections.** Two of my claims here were wrong. The body is not the *only* thing that
> should shadow: the interior and the shared-role exterior details **do** cast today, so the
> ground is not shadowless — the body masses are simply missing from it. And the default ±5
> orthographic frustum is **10 m across** (`DirectionalLightShadow.js:16`), which does cover a 6 m
> vehicle; "does not cover" was false, and no frustum widening is needed.

## Phase 3 — Glazing that reads as glass

**3.1 A window-by-window disposition**, because "fill every aperture" strengthens a known
mismatch. The parent spec's record identifies the off-flank service and washroom windows as
absent from the exterior photographs.

| Aperture | Disposition |
|---|---|
| `body_window_lounge` (off) | Tinted pane |
| `body_window_alcove` (both) | Tinted pane |
| `body_window_cab` (both) | Tinted pane — but see 3.3 |
| `body_window_slideout` → flank | Tinted pane (Phase 5) |
| `body_window_rear` | Tinted pane. This is the **galley window**, explicitly relocated to the rear wall — not an ambiguous non-window caller. Y-normal, so its station is computed off `rear`, not off a flank x |
| `body_window_service`, `body_window_washroom` (off) | **No pane.** Parent record says they are absent from the photographs; a dark pane would make a known mismatch louder |
| `body_door_side` | No pane — it is a paint panel gap, not glazing |
| `body_window_alcove_front` | Already a filled `metal.dark` panel; re-role to `glass.tint` |
| `washer_glass` | Re-role from emissive `glass` to `glass.tint` |
| Windscreen | Not created by `_door_reveal` at all. In scope as glazing; needs its own aperture in `body_cab`'s front face. Does **not** require reopening the cab sculpt |

**3.2 Face stations, not centres.** Every surface here is a box, so state faces and thicknesses:

| Surface | Centre | Thickness | Outboard face |
|---|---|---|---|
| Body flank | — | — | 1.225 |
| Decal plane | 1.228 | 0.004 | **1.230** |
| Tinted pane | 1.2325 | 0.003 | 1.234 |
| Frame strips | 1.226 | 0.016 | 1.234 + bevel |

> **Review correction.** My earlier stack put the pane at 1.2295, *behind* the decal's outboard
> face at 1.230 — I had treated the decal's centre as its surface. The pane now sits outboard of
> the decal and flush-to-inboard of the frame's outer face. Frame bevel (`bevel=.006`) has to be
> checked against the pane, and `depthWrite` alone does not resolve intersecting surfaces.

**3.3** `body_window_cab` currently sits at x ±1.226 while `body_cab`'s flank is at ±1.100 — the
frames float 126 mm in open air. Moving them to ±1.100 is **not** the fix: `cab_side` reaches
±1.150 at window height and would bury them. Station them off `cab_side`'s actual outer face.

**3.4 Stop the `depthWrite` leak.** Set `depthWrite` explicitly in `src/finishes.ts` alongside
`transparent`. Root cause in the shared function, so it fixes interior glazing and the washer too.
A regression test must start from **GLTFLoader-like material state** (`transparent: true`,
`opacity: 0.24`, `depthWrite: false`); the existing material tests construct fresh materials and
would miss an inherited-state defect entirely.

## Phase 4 — The livery, at full flank extent

**4.1 Enlarge the decal planes** from `(.004, 3.4, .70)` at `(±1.228, 2.0, .95)` to
`(.004, 3.9, 1.75)` at `(±1.228, 2.0, 1.175)` — y 0.05–3.95, z 0.30–2.05, the habitation flank the
graphic actually occupies. Then `box_uv(plane, (3.9, 1.75))` and `repeat: [1/3.9, 1/1.75]`.

Keep `flip=x > 0` and the `body_graphic` name prefix — that prefix is what `KEEPS_OWN_UV` matches.

**4.2 No alpha cut-outs for the windows.** The frames and panes now sit outboard of the decal
(3.2), so they occlude it without the artwork needing holes.

> **Review correction, resolved cheaply.** The review was right that one mirrored texture cannot
> carry window cut-outs for two flanks with different window layouts — `flip` reverses the
> fore-aft mapping, so a mask aligned on one flank cuts unrelated graphic on the other. Ordering
> the surfaces by depth removes the need for a mask at all.

**4.3 Redraw `model/side-livery.svg`** to the new 3.9 : 1.75 aspect from `t02m38s`, `t03m14s` and
`h0140`. Same palette. Position the wordmark **from the reference composition**, not to dodge the
slide-out — Phase 5 removes that constraint. For reference when placing it, the kerb mapping is
now `y = 3.95 − u`.

**4.4 Re-rasterise** with `node tools/render_livery.mjs`. The SVG's text uses system fonts, so
inspect the WebP rather than trusting the re-run.

## Phase 5 — The retracted kerb flank

Cheap once Phase 1 is done.

**5.1** Union `slideout_box` into `batchByRole`'s owner set so it gets its own `batch.body.paint`
under the `slideout_box` node, wearing the same material as the rest of the paint. No new role.

**5.2** In `goTo`, at the exterior stop: `showInterior(false)`, `showExterior(true)`, then hide the
slide-out subtree. **Order matters** — `showExterior` selects meshes by role and would otherwise
re-show the box's batch, and the original node and its batch are both in that list. Define
effective visibility for the whole subtree, and confirm it against the probe capture.

**5.3** Replace `body_window_slideout` at `(1.806, 1.10, 1.115)`, on the box's outboard face, with
a reveal plus pane at the kerb flank, same size. With the box shown it hides behind it; with the
box hidden it reads as the retracted window, which is what `t02m38s` shows at that station.

## Phase 6 — Re-capture

**6.1** `tools/capture_stops.mjs`, Playwright, declared in `package.json` (it is not today). The
contract has to be explicit:

- **Filenames are not hotspot ids.** `make_render_thumbs.mjs`'s `STOPS` are `lounge` and
  `slideout`; the hotspot ids are `dinette` and `sofa`. Carry an explicit map — using one as the
  other either duplicates the lounge for `#slideout` or breaks `pnpm thumbs`.
- Start the dev server, set device scale factor, navigate per hash, and **wait for all ten modules
  to load and textures to settle before capturing** — `loadModules` uses `allSettled` and
  deliberately continues on failure, and texture loading is async, so a naive screenshot can
  capture the grey-box fallback or an untextured frame.

**6.2** Re-validate the `CROPS` fractions in `make_render_thumbs.mjs` against the standardised
capture size. Those fractions encode the old hand-capture framing, not only UI-bar removal.

**6.3** Re-run `pnpm thumbs`, and correct the `CLAUDE.md` paragraph claiming the renders are
committed.

---

## Files touched

| File | Phase |
|---|---|
| [src/data/finishes.ts](src/data/finishes.ts) | 1, 3, 4 — five new roles, `EXTERIOR_ROLES`, livery `repeat` |
| [src/main.ts](src/main.ts) | 1, 2, 5 — `showInterior`, environment swap, slide-out visibility in `goTo` |
| [src/lighting.ts](src/lighting.ts) | 2 — sun, probe state save/restore, shadow invalidation |
| [src/scene.ts](src/scene.ts) | 2 — sky, PMREM |
| [src/finishes.ts](src/finishes.ts) | 3 — explicit `depthWrite` |
| [src/batching.ts](src/batching.ts) | 5 — `slideout_box` as its own batch owner |
| [tools/model_exterior.py](tools/model_exterior.py) | 1, 3, 4, 5 — re-role, panes, windscreen, decal planes, flank window, cab frames |
| [tools/make_starter_blend.py](tools/make_starter_blend.py) | 1, 3 — five `ROLE_VIEWPORT` entries |
| [tools/check_blend.py](tools/check_blend.py) | 1, 3 — role count 23 → 28 |
| [tools/check_budget.mjs](tools/check_budget.mjs) | verification — include `public/textures` |
| [model/side-livery.svg](model/side-livery.svg) | 4 — redrawn |
| tools/capture_stops.mjs | 6 — new |
| [docs/research/walkthrough/](docs/research/walkthrough/) | 0 — commit the cited frames |
| [CLAUDE.md](CLAUDE.md) | 6 — the `pnpm thumbs` paragraph |

Reused rather than rewritten: `a.box` / `a.wedge` / `a.cylinder` / `a.tube` / `a.box_uv` and
`a.placement` from [tools/model_interior.py](tools/model_interior.py), `_door_reveal`,
`tools/render_livery.mjs`, `make_render_thumbs.mjs`'s crop machinery, `createTextureResolver`, and
`refreshProbe`'s existing save/restore pattern.

## Tests

- Livery repeat assertion in `src/data/finishes.test.ts:39-47` moves to 3.9 × 1.75.
- New: every role appearing in `exterior.glb` is in `EXTERIOR_ROLES` — this is the invariant that
  keeps Phase 1 from silently regressing, and nothing tests it today.
- New: `glass.tint` and the four `body.*` roles are in `EXTERIOR_ROLES`.
- New: the `depthWrite` regression, seeded from GLTFLoader-like state (3.4).
- New: `slideout_box` resolves to its own batch, and the whole subtree is hidden at the exterior
  stop and visible at every other.
- New: an **exported-UV** check for `body.graphic` — origin, orientation and span. `check:blend`
  does not cover it (`body.graphic` is not in `TEXTURED_ROLES`) and the repeat-only unit test
  cannot see the exported UV.
- Assert `PLAN_CUT_MM` and the camera invariants still hold, since Phase 2 changes what
  `refreshProbe` does.

## Verification

1. `pnpm check` — vitest plus `tsc --noEmit`.
2. **Measure a fresh draw-call baseline before changing anything.** The 57 in the child spec's
   §7b is a historical measurement; later passes changed geometry without republishing one.
3. `pnpm exec npm run model -- shell` (creates the five new materials), then
   `pnpm exec npm run model -- exterior`.
4. `pnpm exec npm run bake` — new geometry needs UV2 and AO or `check_models.mjs`'s `TEXCOORD_1`
   assertion fails.
5. `pnpm exec npm run check:blend` — role count and UV-set assertions.
6. `pnpm export && pnpm optimize`, then **commit `public/models/`** — the Pages runner has no
   Blender, and an un-tracked `public/models/` deploys the grey-box.
7. `pnpm exec npm run check:models` — envelope still `width 2.450, length 5.998, height 3.200`.
   `pnpm budget` for triangles and bytes, **after 6.x adds `public/textures` to it**: it totals
   optimized GLBs only today, so the enlarged livery's contribution to the 25 MB criterion is
   currently unchecked.
8. `?verify` at 1920 × 1080: draw calls and fps at the exterior, plan and lounge stops, against
   the Phase-2 baseline. Expect interior stops to **fall**. Do not resolve any overrun by dropping
   the slide-out behaviour — that is a settled requirement.
9. Finish swaps at the **exterior, plan and lounge** stops, each followed by returning to a common
   interior stop and comparing. This is what proves Phase 2.3. Note that `?calibrate` records once
   at startup and `runCalibration` moves the camera with `tweenTo`, **bypassing `goTo`** and its
   visibility and environment switches — so a click-through sequence will not refresh it. Specify
   a repeatable invocation, and treat the recorded 0.084 chair-panel overrun as inherited
   baseline evidence, not as passing.
10. Blender MCP viewport screenshot of the `exterior` collection, compensating for the exporter's
    `scale.y = -1` reflection as the parent spec requires when comparing against photographs.
11. `node tools/capture_stops.mjs && pnpm thumbs`, then the kerb three-quarter beside `t02m38s`
    and `t03m14s`. That comparison is the success criterion.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Sky and sun contaminate the interior probe | Phase 2.3 hides both for the capture and restores environment, intensity and background; step 9 measures it |
| 2 | Five new roles overrun the draw-call ceiling | They are hidden at interior stops and replace geometry already being drawn there, so the net should be negative; step 2's fresh baseline and step 8 measure it rather than assuming |
| 3 | Hiding the whole interior at the exterior stop reveals a gap in the body | The body is a solid mass with no apertures; verify by orbiting the full azimuth, particularly the cab/habitation step |
| 4 | Decal, pane and frame z-fight at ~2 mm separations | Explicit face stations in 3.2, including frame bevel; the repo has three prior fixes of this exact shape (wheel face, hatch trim, slide-out box) to copy the spacing discipline from |
| 5 | Redrawn artwork rasterises differently elsewhere (system fonts) | Pre-existing; inspect the WebP after `render_livery.mjs` |
| 6 | `check_models.mjs` passing is taken as proof of no protrusions | It measures eight named bodies only. Detail-mesh protrusions need the eye, which is what step 10 and 11 are for |

## Deliberately not taken

- **Body radii.** `bevel=.06` against reference radii nearer 150–250 mm. Safe to raise, since a
  corner bevel does not move a bounding box, but out of the chosen scope.
- **The cab sculpt.** Blocked by `build_cab`'s seats, not by the envelope.
- **Wheel track.** Tyres sit 237 mm inboard of the flanks; the photographs show them near-flush.
- **Splitting the `<module>_details` joins.** Phase 1 reaches the same outcome without it.
