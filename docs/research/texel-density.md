# UV1 texel density — 2026-09-06

Spec risk 1, measured before any map was authored. Tiling maps only read as one material if
every object sharing a role carries the same UV-units-per-metre; otherwise wood grain runs at
different scales on adjacent cabinet doors.

Measured by `texel_density()` in [../../tools/check_blend.py](../../tools/check_blend.py), as
√(UV area / world area) per polygon, pooled per role. `spread` is p95/p5.

## Before: the gate failed

```
TEXEL_DENSITY role.floor n=6350 p5=0.04 p95=0.19 spread=4.30
TEXEL_DENSITY role.glass n=5352 p5=0.04 p95=0.06 spread=1.32
TEXEL_DENSITY role.led.cove n=5352 p5=0.04 p95=0.06 spread=1.32
TEXEL_DENSITY role.metal.brushed n=12982 p5=0.26 p95=0.42 spread=1.58
TEXEL_DENSITY role.metal.chrome n=7900 p5=0.08 p95=0.70 spread=8.57
TEXEL_DENSITY role.metal.dark n=1246 p5=0.33 p95=0.71 spread=2.18
TEXEL_DENSITY role.panel.locker n=2254 p5=0.22 p95=0.41 spread=1.91
TEXEL_DENSITY role.panel.wall n=9504 p5=0.05 p95=0.31 spread=6.50
TEXEL_DENSITY role.textile.curtain n=1642 p5=0.14 p95=0.17 spread=1.19
TEXEL_DENSITY role.upholstery.bolster n=9918 p5=0.27 p95=0.41 spread=1.52
TEXEL_DENSITY role.upholstery.seat n=9918 p5=0.27 p95=0.41 spread=1.52
TEXEL_DENSITY role.upholstery.sofa n=882 p5=0.17 p95=0.23 spread=1.40
TEXEL_DENSITY role.washroom.duckboard n=4210 p5=0.08 p95=0.10 spread=1.27
TEXEL_DENSITY role.washroom.shell n=4210 p5=0.08 p95=0.10 spread=1.27
TEXEL_DENSITY role.wood.cabinet n=14654 p5=0.22 p95=0.38 spread=1.73
TEXEL_DENSITY role.wood.trim n=5352 p5=0.04 p95=0.06 spread=1.32
TEXEL_DENSITY role.worktop n=1784 p5=0.18 p95=0.47 spread=2.57
```

`role.floor` measured 4.30 against the plan's threshold of 4, so the gate stopped map authoring.
`role.panel.wall` (6.50) and `role.metal.chrome` (8.57) are worse still; they are outside the
nine roles receiving maps, but they would have become a problem the moment a tenth role did.

## The cause was between objects, not within them

Per-object medians for `role.floor`:

| Object | Median UV/m | Spread within the object |
|---|---|---|
| `floor` | 0.200 | 1.00 |
| `slideout_shell` | 0.178 | 1.44 |
| `shell_details` | 0.056 | 1.32 |

Each object is internally consistent. `smart_project` normalises every object into the 0..1
square, so density falls as the object grows, and `shell_details` is the joined catch-all that
`model_interior.main()` builds out of every mesh not named in `PLACEMENTS` — a dozen meshes in
one object, hence 3.5× less dense than the standalone floor beside it.

## The fix

`normalise_uv_density()` in `tools/model_interior.py`, called after `smart_project` in the
unwrap loop: scale each object's UVMap by the median ratio so every object lands on
`TEXEL_DENSITY = 1.0` UV units per metre. This rescales an existing unwrap rather than
replacing it, so UV2 is untouched and the packed AO atlas stays valid — no re-bake was needed.

1.0 UV/m also makes `repeat` in the finish registry read directly as tiles per metre.

## After

```
TEXEL_DENSITY role.floor n=6350 p5=0.79 p95=1.06 spread=1.35
TEXEL_DENSITY role.glass n=5352 p5=0.79 p95=1.04 spread=1.32
TEXEL_DENSITY role.led.cove n=5352 p5=0.79 p95=1.04 spread=1.32
TEXEL_DENSITY role.metal.brushed n=12982 p5=0.79 p95=1.05 spread=1.33
TEXEL_DENSITY role.metal.chrome n=7900 p5=0.80 p95=1.05 spread=1.30
TEXEL_DENSITY role.metal.dark n=1246 p5=0.80 p95=1.08 spread=1.36
TEXEL_DENSITY role.panel.locker n=2254 p5=0.79 p95=1.09 spread=1.38
TEXEL_DENSITY role.panel.wall n=9504 p5=0.79 p95=1.07 spread=1.35
TEXEL_DENSITY role.textile.curtain n=1642 p5=0.84 p95=1.00 spread=1.19
TEXEL_DENSITY role.upholstery.bolster n=9918 p5=0.79 p95=1.04 spread=1.31
TEXEL_DENSITY role.upholstery.seat n=9918 p5=0.79 p95=1.04 spread=1.31
TEXEL_DENSITY role.upholstery.sofa n=882 p5=0.78 p95=1.09 spread=1.40
TEXEL_DENSITY role.washroom.duckboard n=4210 p5=0.83 p95=1.05 spread=1.27
TEXEL_DENSITY role.washroom.shell n=4210 p5=0.83 p95=1.05 spread=1.27
TEXEL_DENSITY role.wood.cabinet n=14654 p5=0.79 p95=1.07 spread=1.35
TEXEL_DENSITY role.wood.trim n=5352 p5=0.79 p95=1.04 spread=1.32
TEXEL_DENSITY role.worktop n=1784 p5=0.80 p95=1.04 spread=1.29
```

Worst spread across the whole model: 1.40, down from 8.57. `check_blend.py` now asserts spread
≤ 2.0 and median density within 0.5–2.0 UV/m for the nine textured roles. The threshold is 2.0
rather than the measured 1.40 because 4.0 is where the mismatch becomes visible, and Phase D
adds tubes and pleated cloth whose own unwraps spread more than a box's.
