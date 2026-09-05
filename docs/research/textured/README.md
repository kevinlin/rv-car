# Textured renders — 2026-09-06

The lounge hotspot under each of the three wood variants, after Task 6 moved appearance out of
Blender and into the finish registry. Captured at 1920 x 941 CSS pixels, device pixel ratio 2,
downscaled to 1920 wide.

## The seam, measured

Every material in the live scene, read before and after clicking a swatch:

| Role | Walnut | Oak | Light ash |
|---|---|---|---|
| `wood.cabinet` | `5a3a24` repeat 2,2 | `a97f4f` repeat 2,2 | `d8c3a0` repeat 2.6,2.6 |
| `wood.trim` | `5a3a24` repeat 2,2 | `a97f4f` repeat 2,2 | `d8c3a0` repeat 2.6,2.6 |

Two roles change and nothing else does, and the change now covers grain scale as well as tint,
which is what moving maps into the registry was for. All three variants share `walnut.webp`,
because the reference shows one veneer throughout; ash reads coarser through its repeat.

## Maps are modulation, not colour

The rectifier flattens each map to luminance around a fixed mean of 230 and lets the registry
own hue. Carrying the photograph's own colour tints twice: the camel bolster crop has a mean of
(125, 82, 46), and multiplied by the registry's `0xb08052` it first rendered brick red. This
also matches what the greyscale maps in `tools/surface_textures.py` did before this change.

`"colour": true` in `model/textures.json` opts an entry out, for decals whose material is white.

## Transferred bytes

| | Before | After |
|---|---|---|
| `.glb` total | 11,089,388 | 9,786,140 |
| `public/textures` | — | 75,762 |
| Combined | 11,089,388 | 9,861,902 |

The `.glb`s shrank because the packed grain images left them; the eight photo-derived maps cost
74 KB. Ceiling is 25 MB.
