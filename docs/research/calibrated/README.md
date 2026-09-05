# Calibrated renders — 2026-09-06

The same six hotspots as [../tuned/](../tuned/), after the white-balance fix in Task 2 and the
neutral palette correction in Task 1. Captured at 1920 x 941 CSS pixels, device pixel ratio 2,
then downscaled to 1920 wide so the set costs 5 MB rather than 45 MB.

## `?calibrate` measurement

| Patch | Role | Sampled | Saturation | Under 0.08 |
|---|---|---|---|---|
| aisle floor | `floor` | `#9b9693` | 0.049 | yes |
| chair panel | `upholstery.seat` | `#d5d1cc` | 0.043 | yes |
| washroom wall | `washroom.shell` | `#dfdbd5` | 0.043 | yes |

Before the fix the same three patches measured 0.191, 0.219 and 0.151.

## What actually moved the cast

The cove tint, not `environmentIntensity`. Lowering `environmentIntensity` from 2.5 to 1.2 made
the floor patch *worse*, 0.155 to 0.245, because the probe cubemap carries the cool daylight
arriving through the glazing and the roof hatch, so weakening it concentrates the coves' orange
instead of diluting it. Cooling the `RectAreaLight` tint from `0xffd9a0` to `0xffeed8` was the
whole fix; exposure stayed at 1.05 and `environmentIntensity` at 2.5.

The `led.cove` emissive stays at `0xffd9a0`. The strips are meant to read warm in frame, and
they are too small a share of the image to move the measurement. Neutralising them as well
changed the floor patch by 0.003.

## Draw calls, measured in the browser

| Hotspot | Draw calls | Triangles |
|---|---|---|
| Lounge | 32 | 60,176 |
| Alcove bed | 22 | 48,912 |
| Slide-out bed | 25 | 54,448 |
| Galley | 15 | 45,052 |
| Washroom | 15 | 42,664 |
| Cab | 13 | 38,948 |
