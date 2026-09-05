# Runtime and asset-check review

Date: 2026-09-05. Scope: `src/batching.ts`, `src/main.ts`, `src/lighting.ts`, and `tools/check_models.mjs`. Read-only implementation review, following the geometry review in `blender-modelling-review.md`.

No blocking correctness regression found for the current static interior and its wood-finish controls.

- Batching retains placement node identity and transforms, and puts each movable chair/table batch under its original placement root. Static geometry uses vehicle-local coordinates. Reflection handling reverses triangle indices and tangent handedness, while normals use the inverse-transpose transform. AO UVs survive; unused inconsistent tangents are removed.
- The current modules share texture content per material role. Choosing one material per role therefore preserves the authored atlas and finish mapping. Different textures for the same role would require separate batches, but that is not the current asset contract.
- Shadow caching is valid while furniture and the hatch light remain fixed. `refreshProbe()` marks shadows dirty before rendering the cubemap, so a finish change refreshes the probe and shadow map. Camera movement alone does not require a directional-light shadow update. A future furniture-move control must call the same refresh function; no such control currently exists.
- The asset checker evaluates scene-world origins and descendant accessor bounds, including reflected parents. It distinguishes actual exported primitives from a batching estimate. Its AO check establishes UV/image wiring, not pixel variation. Compressed accessor bounds are metadata checks, not an independent decoding of quantized vertices. Final exported assets still require the separate completed pipeline run.

The empty source meshes retain their original materials and texture references after batching. This is bounded retention during the current one-time load, not a growing leak; the geometry replacement occurs before first rendering, so the old geometry has no uploaded GPU buffers to release. It does leave redundant material/texture objects reachable and keeps empty mesh traversal work. No out-of-memory outcome was observed in this review, and desktop frame rate does not establish a mobile memory budget.

Verification run: eight focused Vitest tests passed (batching and existing light specifications), the exported-placement regression passed, and `tsc --noEmit` passed. Shadow invalidation itself was inspected in source rather than exercised by a mocked renderer. The full asset check was deliberately not rerun while optimization was active.

The integrating agent reported all nine modules loaded, 25 bound placements, and 35 steady-state render calls after shadow caching, compared with 70 before caching, with over 60 FPS at desktop 1080p. Those browser observations were supplied to this review, not independently repeated here. They exclude one-time cubemap/shadow refresh work and do not establish phone performance.
