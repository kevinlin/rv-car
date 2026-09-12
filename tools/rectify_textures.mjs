#!/usr/bin/env node
/**
 * Turn a perspective view of a flat surface in a photograph into a tileable, evenly-lit map.
 *
 * Stages, in order:
 *   1. Homography — undo the perspective, so a rectangle in the world is a rectangle in the map.
 *   2. Flat-field — divide out the low-frequency illumination. A photograph of a lit cabinet
 *      door carries a brightness gradient; tiling that gradient makes a visible hotspot grid.
 *   3. De-artefact: edge-preserving lowpass for entries opting into PBR channels.
 *   4. Albedo modulation, Sobel normals and windowed inverse-luminance roughness.
 *   5. Mirror-tile — reflect into a 2x2 so opposite edges match exactly. Cruder than seam
 *      blending and it cannot fail, which for a wood grain at tiling scale is the better trade.
 *
 * Driven by model/textures.json. Run: pnpm exec npm run textures
 * TEXTURE_OUTPUT_DIR redirects generated files for verification without replacing shipped assets.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
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

const rectifySurface = async (entry) => {
  const srcPath = resolve(ROOT, entry.source);
  const image = sharp(srcPath).removeAlpha();
  const { width, height } = await image.metadata();
  const { data } = await image.raw().toBuffer({ resolveWithObject: true });

  // A tiling map is rendered at half size and mirrored back up; a decal is rendered whole.
  // "tile": false is what a logo needs — mirroring one turns its lettering into a Rorschach.
  // "size" may be [width, height] for a decal that is not square.
  const tiled = entry.tile !== false;
  const [outW, outH] = Array.isArray(entry.size) ? entry.size : [entry.size, entry.size];
  const w0 = tiled ? Math.round(outW / 2) : outW;
  const h0 = tiled ? Math.round(outH / 2) : outH;

  const inverse = solveHomography([[0, 0], [1, 0], [1, 1], [0, 1]], entry.corners);
  const flat = Buffer.alloc(w0 * h0 * 3);
  const px = [0, 0, 0];

  for (let y = 0; y < h0; y++) {
    for (let x = 0; x < w0; x++) {
      const [sx, sy] = applyHomography(inverse, (x + 0.5) / w0, (y + 0.5) / h0);
      sample(data, width, height, sx, sy, px);
      const o = (y * w0 + x) * 3;
      flat[o] = px[0]; flat[o + 1] = px[1]; flat[o + 2] = px[2];
    }
  }

  const raw = { raw: { width: w0, height: h0, channels: 3 } };

  // Flat-field: heavy blur is the illumination estimate; divide it out, restore the mean.
  // flatField: 0 skips it, for a decal whose own shading is the point.
  //
  // The mean is restored PER CHANNEL. A single mean across all three divides out the
  // material's own hue along with the gradient: warm walnut has a red illumination estimate
  // near 140 against a blue one near 55, so a shared mean of 98 scales red by 0.7 and blue by
  // 1.8 and the tile comes out dark blue. Per channel, each one returns to its own average and
  // only the spatial gradient is removed.
  const blurRadius = entry.flatField ?? Math.round(Math.min(w0, h0) / 8);
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

  return { corrected, w0, h0 };
};

/** Bilateral lowpass in rectified pixels; range weights retain strong grain edges. */
const deArtefact = (rgb, width, height, sigma) => {
  const radius = Math.ceil(2 * sigma);
  const result = Buffer.alloc(rgb.length);
  const offsets = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      offsets.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))]);
    }
  }
  const luma = luminance(rgb);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const sums = [0, 0, 0];
      let weights = 0;
      for (const [dx, dy, spatial] of offsets) {
        const q = Math.max(0, Math.min(height - 1, y + dy)) * width
          + Math.max(0, Math.min(width - 1, x + dx));
        const delta = luma[p] - luma[q];
        const weight = spatial * Math.exp(-delta * delta / (2 * 16 * 16));
        weights += weight;
        for (let c = 0; c < 3; c++) sums[c] += weight * rgb[q * 3 + c];
      }
      for (let c = 0; c < 3; c++) result[p * 3 + c] = Math.round(sums[c] / weights);
    }
  }
  return result;
};

const luminance = (rgb) => Float32Array.from({ length: rgb.length / 3 }, (_, p) =>
  0.2126 * rgb[p * 3] + 0.7152 * rgb[p * 3 + 1] + 0.0722 * rgb[p * 3 + 2]);

/** OpenGL: image rows run down, so the height derivative contributes positive G. */
const deriveNormal = (rgb, width, height, strength) => {
  const heightfield = luminance(rgb);
  const at = (x, y) => heightfield[Math.max(0, Math.min(height - 1, y)) * width
    + Math.max(0, Math.min(width - 1, x))];
  const normal = Buffer.alloc(rgb.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Zero perpendicular slope at the reflection edges, including the wrap seams.
      const dx = x === 0 || x === width - 1 ? 0 : (
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)
        - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) / 8;
      const dy = y === 0 || y === height - 1 ? 0 : (
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)
        - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) / 8;
      const nx = -dx * strength, ny = dy * strength;
      const length = Math.hypot(nx, ny, 1);
      const p = (y * width + x) * 3;
      normal[p] = Math.round(127.5 * (1 + nx / length));
      normal[p + 1] = Math.round(127.5 * (1 + ny / length));
      normal[p + 2] = Math.round(127.5 * (1 + 1 / length));
    }
  }
  return normal;
};

// Stretch inverse luminance into the requested window, without normalising its mean.
const deriveRoughness = (rgb, { min, max }) => {
  const values = luminance(rgb);
  let low = Infinity, high = -Infinity;
  for (const value of values) { low = Math.min(low, value); high = Math.max(high, value); }
  const result = Buffer.alloc(rgb.length);
  // Inward quantisation keeps every decoded sample inside the requested range.
  const first = Math.ceil(min * 255), last = Math.floor(max * 255);
  for (let p = 0; p < values.length; p++) {
    const inverse = high === low ? 0.5 : (high - values[p]) / (high - low);
    const value = Math.max(first, Math.min(last, Math.round(255 * (min + inverse * (max - min)))));
    result.fill(value, p * 3, p * 3 + 3);
  }
  return result;
};

export const rectify = async (entry, outputDir = resolve(ROOT, 'public/textures'), metadataDir = outputDir) => {
  for (const channel of ['normal', 'roughness']) {
    const size = entry[channel]?.size;
    if (size !== undefined && !(Array.isArray(size) ? size.length === 2 && size.every(validSize) : validSize(size))) {
      throw new Error(`${channel}.size must be a positive integer or [width, height]`);
    }
  }
  if (entry.normal && (!Number.isFinite(entry.normal.strength) || entry.normal.strength < 0)) {
    throw new Error('normal.strength must be a finite nonnegative number');
  }
  if (entry.roughness !== undefined) {
    const { min, max } = entry.roughness ?? {};
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 1 || min > max
      || Math.ceil(min * 255) > Math.floor(max * 255)) {
      throw new Error('roughness must specify 0 <= min <= max <= 1 with a representable 8-bit value');
    }
  }
  const { w0, h0, corrected: surface } = await rectifySurface(entry);
  // Legacy entries keep their exact albedo bytes. All channels of a PBR entry share stage 3.
  const pbr = entry.normal !== undefined || entry.roughness !== undefined;
  const sourceWidth = Math.hypot(entry.corners[1][0] - entry.corners[0][0],
    entry.corners[1][1] - entry.corners[0][1]);
  const sourceHeight = Math.hypot(entry.corners[3][0] - entry.corners[0][0],
    entry.corners[3][1] - entry.corners[0][1]);
  const filtered = pbr ? deArtefact(surface, w0, h0,
    Math.max(0.5, Math.max(w0 / sourceWidth, h0 / sourceHeight))) : surface;
  let corrected = filtered;

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

  const outPath = resolve(outputDir, `${entry.out}.webp`);
  await mkdir(dirname(outPath), { recursive: true });

  await writeMap(corrected, w0, h0, outPath, entry);
  const normalPath = resolve(outputDir, `${entry.out}_n.webp`);
  if (entry.normal?.strength > 0) {
    await writeMap(deriveNormal(filtered, w0, h0, entry.normal.strength),
      w0, h0, normalPath, entry, 'normal');
  } else {
    await rm(normalPath, { force: true });
  }
  const roughnessPath = resolve(outputDir, `${entry.out}_r.webp`);
  const measurementPath = resolve(metadataDir, `${entry.out}_r.json`);
  if (entry.roughness !== undefined) {
    await writeMap(deriveRoughness(filtered, entry.roughness), w0, h0, roughnessPath, entry, 'roughness');
    // Read fresh bytes: sharp can cache a previous decode when a path is overwritten.
    const decoded = await sharp(await readFile(roughnessPath)).removeAlpha().raw().toBuffer();
    let sum = 0;
    for (let i = 1; i < decoded.length; i += 3) sum += decoded[i];
    const meanGreen = sum / (decoded.length / 3) / 255;
    await mkdir(metadataDir, { recursive: true });
    await writeFile(measurementPath, JSON.stringify({
      out: entry.out, file: `${entry.out}_r.webp`, range: entry.roughness, meanGreen,
    }, null, 2) + '\n');
    console.log(`  ${entry.out}_r.webp decoded meanGreen=${meanGreen}`);
  } else {
    await rm(roughnessPath, { force: true });
    await rm(measurementPath, { force: true });
  }
  return outPath;
};

const validSize = (value) => Number.isSafeInteger(value) && value > 0;

const writeMap = async (pixels, w0, h0, outPath, entry, channel = 'albedo') => {
  const normal = channel === 'normal';
  const lossless = channel !== 'albedo';
  const raw = { raw: { width: w0, height: h0, channels: 3 } };
  const [outW, outH] = Array.isArray(entry.size) ? entry.size : [entry.size, entry.size];
  const size = entry[channel]?.size ?? entry.size;
  const [width, height] = Array.isArray(size) ? size : [size, size];
  const encode = async (map) => {
    if (width !== outW || height !== outH) {
      // Materialise the composite first: sharp otherwise resizes BEFORE compositing.
      const { data, info } = await map.raw().toBuffer({ resolveWithObject: true });
      map = sharp(data, { raw: info }).resize(width, height, { fit: 'fill', kernel: 'lanczos3' });
    }
    await map.webp({ quality: entry.quality ?? 82, lossless }).toFile(outPath);
  };
  if (entry.tile === false) {
    await encode(sharp(pixels, raw));
    return;
  }

  // Mirror-tile into 2x2. Reflections transform tangent vectors as well as pixels.
  // Lossy WebP chroma subsampling damages vector seams.
  // Data maps use lossless WebP to preserve vectors and roughness bounds; albedo is unchanged.
  const tile = sharp(pixels, raw);
  const [a, b, c, d] = await Promise.all([
    tile.clone().toBuffer(),
    tile.clone().flop().toBuffer(),
    tile.clone().flip().toBuffer(),
    tile.clone().flip().flop().toBuffer(),
  ]);
  if (normal) {
    for (let i = 0; i < a.length; i += 3) {
      b[i] = 255 - b[i];
      c[i + 1] = 255 - c[i + 1];
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
    }
  }

  await encode(sharp({
    create: { width: outW, height: outH, channels: 3, background: '#000' },
  })
    .composite([
      { input: a, raw: raw.raw, left: 0, top: 0 },
      { input: b, raw: raw.raw, left: w0, top: 0 },
      { input: c, raw: raw.raw, left: 0, top: h0 },
      { input: d, raw: raw.raw, left: w0, top: h0 },
    ]));
};

const main = async () => {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'model/textures.json'), 'utf8'));
  const only = process.argv.slice(2);
  let total = 0;
  for (const entry of manifest.textures) {
    if (only.length && !only.includes(entry.out)) continue;
    const path = await rectify(entry, process.env.TEXTURE_OUTPUT_DIR, resolve(ROOT, 'model'));
    const size = (await readFile(path)).length + (entry.normal?.strength > 0
      ? (await readFile(resolve(dirname(path), `${entry.out}_n.webp`))).length : 0) + (entry.roughness !== undefined
      ? (await readFile(resolve(dirname(path), `${entry.out}_r.webp`))).length : 0);
    total += size;
    console.log(`  ${entry.out.padEnd(24)} ${entry.role.padEnd(22)} ${size} bytes`);
  }
  console.log(`Wrote ${total} bytes of texture.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
