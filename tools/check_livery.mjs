/**
 * Measure the flank livery as it renders, against the walkaround photographs.
 *
 * The defect this exists for: the orange field renders gold, at hue 41.7 degrees against the
 * ~27 the photographed wrap measures. See docs/specs/plan_livery-hue.md.
 *
 * Usage: node tools/check_livery.mjs [image] [--json]
 *        defaults to dist/captures/exterior.png, which `pnpm capture` writes.
 *        Runs against a reference photograph just as well, which is how TARGET was derived.
 *
 * Three rules make the number mean something. Each replaced a way of measuring that produced a
 * confident wrong answer earlier in this work, so none of them is incidental:
 *
 *  - **The sample is the largest connected blob of orange, not every orange pixel in frame.**
 *    Frame-wide, the filter selects skin, wood and warm lighting in the photographs: only 42% to
 *    64% of matching pixels belong to the graphic. An independent review caught a target derived
 *    from the unmasked population, where over half the pixels in one frame lay outside the
 *    graphic entirely.
 *  - **Hue is the median of per-pixel hues.** Taking the median of R, G and B separately and
 *    converting the result is a different statistic, and on one frame the two disagreed by 14
 *    degrees — enough to invent a target the wrap never had.
 *  - **The statistic is a median with its interquartile range**, because a mean is dragged toward
 *    cream by edge pixels antialiased against white bodywork.
 *
 * A known bias, left in deliberately because it is weak on hue and hue is what is gated: the
 * `r - b > 50` term imposes a saturation floor of 50/r, so darker pixels face a stricter cutoff
 * and can drop out of the sample as tuning changes. That can flatter a saturation reading. It
 * barely moves hue, which is why hue carries the gate and saturation only a sanity band.
 */
import sharp from 'sharp';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--')) ?? 'dist/captures/exterior.png';

/**
 * Measured from the wrap in three walkaround frames, with this file's own masking and statistic:
 *
 *   exterior-kerb-flank-2m38s         hue 27.9 [26.5-28.9]  saturation 0.540 [0.451-0.682]
 *   exterior-kerb-three-quarter-3m14s hue 30.2 [29.4-31.2]  saturation 0.827 [0.728-0.851]
 *   livery-wordmark-detail            hue 26.5 [25.3-27.7]  saturation 0.466 [0.397-0.638]
 *
 * **Hue is the gate.** The three frames agree to within 4 degrees despite different lighting,
 * distance and compression, and they bracket the flat artwork's 32.2. The render sits at 41.7.
 * That is the defect, and it is the one thing here the evidence establishes firmly.
 *
 * **Saturation is only a sanity band.** The same three frames span 0.466 to 0.827 — a real wrap
 * photographs at wildly different saturation depending on how it is lit, so the photographs do
 * not constrain it. The band exists to catch a regression to the pale cream this work started
 * from (0.293), not to pin a value. The render's current 0.498 is already inside it, and
 * "improving" saturation further is not an objective.
 *
 * Absolute luminance is not gated at all: the photographs are shot indoors under exhibition
 * lighting and the render's sky is an owner-approved departure, so only hue transfers cleanly.
 */
export const TARGET = { hue: [24, 33], saturation: [0.42, 0.85] };

const hueOf = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};
const satOf = (r, g, b) => { const max = Math.max(r, g, b); return max === 0 ? 0 : (max - Math.min(r, g, b)) / max; };
const quantile = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0);
const stats = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return { median: quantile(s, 0.5), p25: quantile(s, 0.25), p75: quantile(s, 0.75) };
};

const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const px = (i) => [data[i * C], data[i * C + 1], data[i * C + 2]];

const mask = new Uint8Array(W * H);
let matched = 0;
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = px(i);
  if (r > g && g > b && r - b > 50 && r > 90) { mask[i] = 1; matched++; }
}

// Largest 4-connected component of that mask: the graphic. Iterative flood fill — the field runs
// to hundreds of thousands of pixels and recursion overflows.
const seen = new Uint8Array(W * H);
const stack = new Int32Array(W * H);
let field = [];
for (let start = 0; start < W * H; start++) {
  if (!mask[start] || seen[start]) continue;
  let sp = 0; const comp = [];
  stack[sp++] = start; seen[start] = 1;
  while (sp) {
    const p = stack[--sp];
    comp.push(p);
    const x = p % W, y = (p - x) / W;
    if (x + 1 < W && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
    if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
    if (y + 1 < H && mask[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
    if (y > 0 && mask[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
  }
  if (comp.length > field.length) field = comp;
}

const summarise = (pixels) => {
  if (!pixels.length) return null;
  const hue = stats(pixels.map(([r, g, b]) => hueOf(r, g, b)));
  const sat = stats(pixels.map(([r, g, b]) => satOf(r, g, b)));
  const mid = (k) => stats(pixels.map((p) => p[k])).median;
  return {
    hex: `#${[mid(0), mid(1), mid(2)].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`,
    hue: Number(hue.median.toFixed(1)),
    hueP25: Number(hue.p25.toFixed(1)),
    hueP75: Number(hue.p75.toFixed(1)),
    saturation: Number(sat.median.toFixed(3)),
    satP25: Number(sat.p25.toFixed(3)),
    satP75: Number(sat.p75.toFixed(3)),
    pixels: pixels.length,
  };
};

let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
for (const p of field) {
  const x = p % W, y = (p - x) / W;
  if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
  if (y < by0) by0 = y; if (y > by1) by1 = y;
}

// Teal and the wordmark band, inside the field's own box only. Frame-wide, a `b > r` filter
// selects sky — during an earlier retune the "teal" saturation tracked the sky's 0.207 exactly
// across every sweep, because it was the sky. Padded, since the teal edge runs just outside the
// orange extent. Both are reported and neither is gated: the box also holds the tinted panes.
const teal = [], band = [];
if (field.length) {
  const pad = Math.round((bx1 - bx0) * 0.1);
  for (let y = Math.max(0, by0 - pad); y <= Math.min(H - 1, by1 + pad); y++) {
    for (let x = Math.max(0, bx0 - pad); x <= Math.min(W - 1, bx1 + pad); x++) {
      const [r, g, b] = px(y * W + x);
      if (b > g && g > r && b - r > 30) teal.push([r, g, b]);
      if (Math.max(r, g, b) < 120 && satOf(r, g, b) < 0.3) band.push([r, g, b]);
    }
  }
}

const orange = summarise(field.map((p) => px(p)));
const inBand = (v, [lo, hi]) => v >= lo && v <= hi;
const result = {
  file,
  orange,
  teal: summarise(teal),
  band: summarise(band),
  fieldShare: matched ? Number((field.length / matched).toFixed(2)) : 0,
  bbox: field.length ? `${bx0},${by0}-${bx1},${by1} of ${W}x${H}` : null,
  pass: Boolean(orange && inBand(orange.hue, TARGET.hue) && inBand(orange.saturation, TARGET.saturation)),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else if (!orange) {
  console.log(`${file}: no orange field found — is this the exterior stop?`);
} else {
  const row = (name, s) => s && console.log(
    `  ${name.padEnd(7)} ${s.hex}  hue ${String(s.hue).padStart(5)} [${s.hueP25}-${s.hueP75}]` +
    `  sat ${s.saturation.toFixed(3)} [${s.satP25.toFixed(3)}-${s.satP75.toFixed(3)}]  n=${s.pixels}`);
  console.log(file);
  row('orange', orange);
  row('teal', result.teal);
  row('band', result.band);
  console.log(`  field is ${(result.fieldShare * 100).toFixed(0)}% of matching pixels, bbox ${result.bbox}`);
  console.log(`\n  target  hue ${TARGET.hue[0]}-${TARGET.hue[1]} (the gate), saturation ${TARGET.saturation[0]}-${TARGET.saturation[1]} (sanity only)`);
  console.log(`  ${result.pass ? 'PASS' : 'FAIL'}: hue ${orange.hue}, saturation ${orange.saturation}`);
}

process.exitCode = result.pass ? 0 : 1;
