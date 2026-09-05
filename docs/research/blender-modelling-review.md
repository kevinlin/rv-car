# Blender modelling review

Date: 2026-09-05. Scope: Tasks 12 and 13, geometry, export transforms and AO setup. Read-only source review of `tools/model_interior.py`, `tools/model_furniture.py`, `tools/bake_ao.py`, `tools/export_modules.py` and `tools/surface_textures.py`. No Blender process or tests were run during this review while the export pipeline was active.

## Finding requiring regenerated assets

1. **Bowl surfaces initially had reversed normals.** The angular-first quads in `bowl()` gave the basin floor a downward normal and inner walls outward/downward normals. This affects the kitchen sink, vanity basin and toilet, including their AO. The implementation has now reversed the faces at `tools/model_interior.py:93`, which addresses the source defect. Completion still requires regenerating the galley and washroom meshes and rebaking/exporting those corrected surfaces. This review did not independently inspect the regenerated binary assets.

## Checks and limits

- Shell windows and roof hatch are actual gaps between solid panel pieces. No uncut wall lies behind the named glazing. The slide-out aperture and passage beneath the alcove are similarly open. The solid panels' cabin-facing sides already point inward; reversing all faces on these volumetric walls would be incorrect.
- The galley sink has a real countertop opening and a hollow cabinet beneath it. Its bowl is not buried in an intact countertop or solid cabinet block. The toilet pedestal stops below the bowl.
- The prior conservative bounds check covered all 18 furniture placement groups, including tube radii, bowl lips and rotated washroom corner panels. All were contained. Bed foundations retain 2200 by 1400 mm and 1280 by 1900 mm footprints. That analytic check is not a substitute for inspecting the final exported vertex bounds.
- AO generation explicitly hides every other mesh for each bake, uses `UV2`, and writes disjoint object regions of a shared atlas. Consequently movable chairs do not retain shadows from adjacent furniture. `UVMap` remains the surface-map UV set; glTF occlusion explicitly references `UV2`. The global minimum/maximum assertion proves atlas variation but does not prove every object's region received a valid bake.
- The export root's Y reflection compensates for Blender-to-glTF rearward-axis reversal without changing authored placement coordinates. Keeping the reflection as a transform preserves the renderer's ability to account for determinant sign.
- Surface maps reuse existing material roles. This source review did not independently verify the exporter recognized the Multiply shader chain or that optimized GLBs retained every texture and second UV set.

## Accepted simplifications and follow-ups

The washroom remains a simplified open cutaway with a segmented rounded corner. Its shelf niches are projecting shelves, and the dedicated shower curtain is absent. The chrome mirror uses the shared metal material rather than a dedicated mirror surface. These should be disclosed as remaining reference-fidelity limits of the weakest zone, rather than called an exact reconstruction.

Final binary inspection should confirm outward bowl normals after the correction, named mesh bounds, texture/UV retention and the published budgets. Matched-camera visual comparison, exposure tuning and frame-rate checks belong to Tasks 14 and 15; this review does not classify those later steps as failures of the asset-modelling work.

## Integration follow-up

The galley and washroom were regenerated after the bowl fix, followed by a fresh 29-object
AO bake and export. `tools/check_blend.py` reopens the saved binary and verifies 32 upward
basin-floor faces in each of the three bowls, rays reaching glazing through the roof hatch
and both lounge windows, all nine modelled collections, 17 materials and packed UV2 AO.
The binary check passed. Exported placement checks also passed for all 25 named nodes.
