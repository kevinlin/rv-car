# Handedness, settled against the walkthrough video (2026-09-06)

Captured at 1600 x 900 CSS pixels, device pixel ratio 2. Evidence for Task 1 of
[../../specs/plan_correct-against-walkthrough-video.md](../../specs/plan_correct-against-walkthrough-video.md),
after the plan's whole-cabin mirror was corrected to a hybrid.

The two halves of the cabin are handed opposite ways:

| | Off flank (−X) | Kerb flank (+X) |
|---|---|---|
| Lounge | 卡座 booth, fridge | slide-out, sofa bed, wardrobe |
| Service room | washroom pod | galley run |

The plan assumed one chain of inference ran the length of the vehicle — pod and galley face each
other, galley continues the fridge's line, fridge sits beside a booth seat — so moving the pod
moved everything. The middle link is false for this vehicle: the galley sits behind the wardrobe,
opposite the fridge. That is why the exterior kerb-window crop (galley kerb) and the lounge frame
(booth off) had looked irreconcilable.

| File | Shows |
|---|---|
| `lounge.png` | Looking forward: booth off on the left, sofa kerb on the right |
| `galley.png` | Counter on the kerb flank, window over it, walnut overheads |
| `washroom.png` | Pod in the rear off corner, opening onto the aisle |
| `exterior.png` | Off three-quarter — the flat flank, since the slide deploys kerb |
| `patch-probe.json` | Raycast sweep behind `src/calibrate.ts`'s patch coordinates |

Source frames in [../walkthrough/](../walkthrough/). These renders predate Tasks 2 to 7, so the
palette is still bone-dominant and the exterior is still a plain white box; `docs/research/final/`
gets the re-capture once those land.
