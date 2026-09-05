#!/usr/bin/env node
/**
 * Turn a perspective view of a flat surface in a photograph into a tileable, evenly-lit map.
 *
 * Three stages, in order:
 *   1. Homography — undo the perspective, so a rectangle in the world is a rectangle in the map.
 *   2. Flat-field — divide out the low-frequency illumination. A photograph of a lit cabinet
 *      door carries a brightness gradient; tiling that gradient makes a visible hotspot grid.
 *   3. Mirror-tile — reflect into a 2x2 so opposite edges match exactly. Cruder than seam
 *      blending and it cannot fail, which for a wood grain at tiling scale is the better trade.
 *
 * Driven by model/textures.json. Run: pnpm exec npm run textures
 */
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Mean level a modulation map is normalised to. High, because the map multiplies the registry
 * colour: at 230 a surface renders at 90 % of its palette value, which keeps the tables
 * honest, and leaves 25 levels of headroom before a bright grain band clips.
 */
const MODULATION_MEAN = 230;

/**
 * Solve the 8 unknowns of a 3x3 homography (h8 fixed at 1) from four point correspondences,
 * by Gaussian elimination with partial pivoting on the 8x8 system.
 */
export const solveHomography = (src, dst) => {
  const a = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('degenerate corner set');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      if (f === 0) continue;
      for (let c = col; c < 8; c++) a[r][c] -= f * a[col][c];
      b[r] -= f * b[col];
    }
  }

  const h = b.map((v, i) => v / a[i][i]);
  h.push(1);
  return h;
};

export const applyHomography = (h, x, y) => {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
};

/** Bilinear sample of a raw RGB buffer, clamped at the edges. */
const sample = (buf, w, h, x, y, out) => {
  const cx = Math.min(Math.max(x, 0), w - 1.001);
  const cy = Math.min(Math.max(y, 0), h - 1.001);
  const x0 = Math.floor(cx), y0 = Math.floor(cy);
  const fx = cx - x0, fy = cy - y0;
  for (let c = 0; c < 3; c++) {
    const i = (yy, xx) => buf[(yy * w + xx) * 3 + c];
    const top = i(y0, x0) * (1 - fx) + i(y0, x0 + 1) * fx;
    const bot = i(y0 + 1, x0) * (1 - fx) + i(y0 + 1, x0 + 1) * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
};

const rectify = async (entry) => {
  const srcPath = resolve(ROOT, entry.source);
  const image = sharp(srcPath).removeAlpha();
  const { width, height } = await image.metadata();
  const { data } = await image.raw().toBuffer({ resolveWithObject: true });

  // Half-size: mirror-tiling doubles it back to the requested output size.
  const half = Math.round(entry.size / 2);
  const inverse = solveHomography([[0, 0], [1, 0], [1, 1], [0, 1]], entry.corners);
  const flat = Buffer.alloc(half * half * 3);
  const px = [0, 0, 0];

  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const [sx, sy] = applyHomography(inverse, (x + 0.5) / half, (y + 0.5) / half);
      sample(data, width, height, sx, sy, px);
      const o = (y * half + x) * 3;
      flat[o] = px[0]; flat[o + 1] = px[1]; flat[o + 2] = px[2];
    }
  }

  const raw = { raw: { width: half, height: half, channels: 3 } };

  // Flat-field: heavy blur is the illumination estimate; divide it out, restore the mean.
  // flatField: 0 skips it, for a decal whose own shading is the point.
  //
  // The mean is restored PER CHANNEL. A single mean across all three divides out the
  // material's own hue along with the gradient: warm walnut has a red illumination estimate
  // near 140 against a blue one near 55, so a shared mean of 98 scales red by 0.7 and blue by
  // 1.8 and the tile comes out dark blue. Per channel, each one returns to its own average and
  // only the spatial gradient is removed.
  const blurRadius = entry.flatField ?? Math.round(half / 8);
  let corrected = flat;
  if (blurRadius > 0) {
    const illumination = await sharp(flat, raw).blur(blurRadius).raw().toBuffer();
    const means = [0, 0, 0];
    for (let i = 0; i < illumination.length; i += 3) {
      means[0] += illumination[i]; means[1] += illumination[i + 1]; means[2] += illumination[i + 2];
    }
    const pixels = illumination.length / 3;
    for (let c = 0; c < 3; c++) means[c] /= pixels;

    corrected = Buffer.alloc(flat.length);
    for (let i = 0; i < flat.length; i++) {
      const lit = illumination[i] || 1;
      corrected[i] = Math.min(255, Math.max(0, Math.round((flat[i] / lit) * means[i % 3])));
    }
  }

  // Modulation, not colour. THREE multiplies map by the material's colour, so a map carrying
  // its own hue tints twice: the camel bolster photograph has a mean of (125,82,46), and
  // multiplied by the registry's own 0xb08052 it rendered brick red. Flattening to luminance
  // around a fixed mean leaves the registry owning hue — which is what the palette tables in
  // both specs describe, and what the greyscale maps this pipeline replaces already did.
  // "colour": true keeps the photograph's own colour, for decals whose material is white.
  if (!entry.colour) {
    let sum = 0;
    const luminance = new Float32Array(corrected.length / 3);
    for (let i = 0, p = 0; i < corrected.length; i += 3, p++) {
      luminance[p] = 0.2126 * corrected[i] + 0.7152 * corrected[i + 1] + 0.0722 * corrected[i + 2];
      sum += luminance[p];
    }
    const mean = sum / luminance.length;
    const gain = entry.contrast ?? 1;
    const mono = Buffer.alloc(corrected.length);
    for (let p = 0; p < luminance.length; p++) {
      const v = Math.min(255, Math.max(0, Math.round(MODULATION_MEAN + (luminance[p] - mean) * gain)));
      mono[p * 3] = v; mono[p * 3 + 1] = v; mono[p * 3 + 2] = v;
    }
    corrected = mono;
  }

  // Mirror-tile into 2x2 so opposite edges match exactly.
  const tile = sharp(corrected, raw);
  const [a, b, c, d] = await Promise.all([
    tile.clone().toBuffer(),
    tile.clone().flop().toBuffer(),
    tile.clone().flip().toBuffer(),
    tile.clone().flip().flop().toBuffer(),
  ]);

  const outPath = resolve(ROOT, 'public/textures', `${entry.out}.webp`);
  await mkdir(dirname(outPath), { recursive: true });
  await sharp({
    create: { width: entry.size, height: entry.size, channels: 3, background: '#000' },
  })
    .composite([
      { input: a, raw: raw.raw, left: 0, top: 0 },
      { input: b, raw: raw.raw, left: half, top: 0 },
      { input: c, raw: raw.raw, left: 0, top: half },
      { input: d, raw: raw.raw, left: half, top: half },
    ])
    .webp({ quality: entry.quality ?? 82 })
    .toFile(outPath);

  return outPath;
};

const main = async () => {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'model/textures.json'), 'utf8'));
  const only = process.argv.slice(2);
  let total = 0;
  for (const entry of manifest.textures) {
    if (only.length && !only.includes(entry.out)) continue;
    const path = await rectify(entry);
    const size = (await readFile(path)).length;
    total += size;
    console.log(`  ${entry.out.padEnd(24)} ${entry.role.padEnd(22)} ${size} bytes`);
  }
  console.log(`Wrote ${total} bytes of texture.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
