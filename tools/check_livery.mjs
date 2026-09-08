/**
 * Measure the flank livery as it renders, against the walkaround photographs.
 *
 * The defect this exists for: the orange field renders gold. Saturation was fixed by dropping the
 * exterior environmentIntensity to 0.20; hue was not, and does not respond to any brightness
 * lever. See docs/specs/plan_livery-hue.md.
 *
 * Usage: node tools/check_livery.mjs [image.png] [--json]
 *        defaults to dist/captures/exterior.png, which `pnpm capture` writes.
 *
 * The statistic is the MEDIAN, not the mean: the field's edge pixels are antialiased against
 * white bodywork and drag a mean toward cream, which is how the first reading of this defect
 * came out worse than the field actually is.
 *
 * Two sampling rules matter, and both were learned by getting them wrong:
 *
 *  - **Teal is sampled inside the decal's bounding box only.** Frame-wide, a `b > r` filter
 *    selects sky: during the retune the "teal" saturation tracked the sky's 0.207 across every
 *    sweep because it *was* the sky. The box is derived from the orange field, which is the one
 *    region no other surface in frame imitates.
 *  - **Hue carries a spread, not just a median.** ACES rotates orange toward yellow as luminance
 *    rises, so if a decal spanned sunlit and shaded areas no single pre-compensation could fit it.
 *    On this geometry it measures 41.7-41.8 degrees — no spread, because the decal is one flat
 *    plane with a constant normal that nothing shadows. Kept because that is a property of the
 *    current geometry, not of the method: a decal that wraps a corner would show up here.
 */
import sharp from 'sharp';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--')) ?? 'dist/captures/exterior.png';

/**
 * Targets, measured from the wrap in three walkaround frames with this same filter and this same
 * statistic — exterior-kerb-flank-2m38s (0.463 / 27deg), exterior-kerb-three-quarter-3m14s
 * (0.511 / 15deg) and livery-wordmark-detail (0.506 / 26deg).
 *
 * Deliberately NOT the flat artwork's 0.815 / 32deg. A real vehicle's wrap carries the same
 * specular wash the render does, just less of it, so the artwork hex is a paint chip and was
 * never the target. Absolute luminance is not gated at all: the photographs are shot indoors and
 * the render's sky is an owner-approved departure, so only hue and saturation transfer.
 */
export const TARGET = { hue: [15, 27], saturation: [0.46, 0.51] };

const hueOf = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};
const satOf = (r, g, b) => { const max = Math.max(r, g, b); return max === 0 ? 0 : (max - Math.min(r, g, b)) / max; };
const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;

/** Median colour of a pixel set, with the hue spread that says whether one correction can fit. */
const summarise = (pixels) => {
  if (!pixels.length) return null;
  const med = (k) => quantile(pixels.map((p) => p[k]).sort((a, b) => a - b), 0.5);
  const [r, g, b] = [med(0), med(1), med(2)];
  const hues = pixels.map((p) => hueOf(...p)).sort((a, b) => a - b);
  return {
    hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    saturation: Number(satOf(r, g, b).toFixed(3)),
    hue: Number(hueOf(r, g, b).toFixed(1)),
    hueP25: Number(quantile(hues, 0.25).toFixed(1)),
    hueP75: Number(quantile(hues, 0.75).toFixed(1)),
    peak: Math.max(r, g, b),
    pixels: pixels.length,
  };
};

const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
const at = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };

// Pass one: the orange field, frame-wide. Nothing else in frame is a saturated warm mass.
const orange = [];
let x0 = info.width, x1 = 0, y0 = info.height, y1 = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const [r, g, b] = at(x, y);
    if (r > g && g > b && r - b > 50 && r > 90) {
      orange.push([r, g, b]);
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
}

// Pass two: teal and the wordmark band, inside the decal's own box only. Padded, because the
// teal runs along the graphic's leading top edge and can sit just outside the orange extent.
const teal = [], band = [];
if (orange.length) {
  const pad = Math.round((x1 - x0) * 0.1);
  for (let y = Math.max(0, y0 - pad); y <= Math.min(info.height - 1, y1 + pad); y++) {
    for (let x = Math.max(0, x0 - pad); x <= Math.min(info.width - 1, x1 + pad); x++) {
      const [r, g, b] = at(x, y);
      if (b > g && g > r && b - r > 30) teal.push([r, g, b]);
      // Informational only, and known to be impure: the tinted window panes sit inside the same
      // box and are also dark, so this reads the band and the glazing together. It is here to
      // catch the band going grey again, not as a gate.
      if (Math.max(r, g, b) < 120 && satOf(r, g, b) < 0.3) band.push([r, g, b]);
    }
  }
}

const result = {
  file,
  orange: summarise(orange),
  teal: summarise(teal),
  band: summarise(band),
};
const inBand = (v, [lo, hi]) => v >= lo && v <= hi;
result.pass = Boolean(result.orange
  && inBand(result.orange.hue, TARGET.hue)
  && inBand(result.orange.saturation, TARGET.saturation));

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (!result.orange) {
    console.log(`${file}: no orange field found — is this the exterior stop?`);
    process.exit(1);
  }
  const row = (name, s) => s && console.log(
    `  ${name.padEnd(7)} ${s.hex}  sat ${s.saturation.toFixed(3)}  hue ${String(s.hue).padStart(5)}deg` +
    `  spread ${s.hueP25}-${s.hueP75}deg  peak ${s.peak}  n=${s.pixels}`);
  console.log(`${file}`);
  row('orange', result.orange);
  row('teal', result.teal);
  row('band', result.band);
  console.log(`\n  target  orange hue ${TARGET.hue[0]}-${TARGET.hue[1]}deg, saturation ${TARGET.saturation[0]}-${TARGET.saturation[1]}`);
  console.log(`  ${result.pass ? 'PASS' : 'FAIL'}: orange hue ${result.orange.hue}deg, saturation ${result.orange.saturation}`);
}

process.exitCode = result.pass ? 0 : 1;
