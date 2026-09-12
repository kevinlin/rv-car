import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveHomography, applyHomography } from './rectify_textures.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

test('maps the four source corners onto the four destination corners', () => {
  const src = [[120, 80], [900, 140], [880, 700], [100, 640]];
  const dst = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const h = solveHomography(src, dst);
  for (let i = 0; i < 4; i++) {
    const [u, v] = applyHomography(h, src[i][0], src[i][1]);
    close(u, dst[i][0]);
    close(v, dst[i][1]);
  }
});

test('is the identity for a unit square onto itself', () => {
  const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const [u, v] = applyHomography(solveHomography(unit, unit), 0.25, 0.75);
  close(u, 0.25);
  close(v, 0.75);
});

test('is invertible: the inverse maps destination corners back to source', () => {
  const src = [[120, 80], [900, 140], [880, 700], [100, 640]];
  const dst = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const inverse = solveHomography(dst, src);
  for (let i = 0; i < 4; i++) {
    const [x, y] = applyHomography(inverse, dst[i][0], dst[i][1]);
    close(x, src[i][0], 1e-4);
    close(y, src[i][1], 1e-4);
  }
});

import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { rectify } from './rectify_textures.mjs';

const temporary = async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'rv-textures-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
};
const decode = async (path) => sharp(await readFile(path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const pixel = ({ data, info }, x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
const absent = async (path) => assert.rejects(access(path), { code: 'ENOENT' });
const slopeEntry = async (dir, constant = false) => {
  const width = 128;
  const data = Buffer.alloc(width * width * 3);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      data.fill(constant ? 100 : Math.round(30 + x + y / 2), (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  const source = join(dir, 'slope.png');
  await sharp(data, { raw: { width, height: width, channels: 3 } }).png().toFile(source);
  return { out: 'slope', source, corners: [[0, 0], [128, 0], [128, 128], [0, 128]],
    size: 256, flatField: 0, normal: { strength: 1 }, worldMm: 136 };
};

test('decoded directional slope has OpenGL signs in all four mirror quadrants', async (t) => {
  const dir = await temporary(t);
  await rectify(await slopeEntry(dir), dir);
  const decoded = await decode(join(dir, 'slope_n.webp'));
  // Sobel of h=x+y/2: normalize(-1,+0.5,1). Allow 2 levels for sampling and quantisation.
  const expected = [42.5, 170, 212.5];
  for (const [x, y, flipX, flipY] of [[64, 64, false, false], [191, 64, true, false],
    [64, 191, false, true], [191, 191, true, true]]) {
    const actual = pixel(decoded, x, y);
    close(actual[0], flipX ? 255 - expected[0] : expected[0], 2);
    close(actual[1], flipY ? 255 - expected[1] : expected[1], 2);
    close(actual[2], expected[2], 2);
  }
});

test('decoded normals are continuous at horizontal and vertical internal and wrap boundaries', async (t) => {
  const dir = await temporary(t);
  await rectify(await slopeEntry(dir), dir);
  const decoded = await decode(join(dir, 'slope_n.webp'));
  // All pixels along both internal joins and both periodic joins, all three channels.
  let maximum = 0;
  for (let i = 0; i < 256; i++) {
    for (const [a, b] of [[pixel(decoded, 127, i), pixel(decoded, 128, i)],
      [pixel(decoded, i, 127), pixel(decoded, i, 128)],
      [pixel(decoded, 0, i), pixel(decoded, 255, i)],
      [pixel(decoded, i, 0), pixel(decoded, i, 255)]]) {
      for (let c = 0; c < 3; c++) maximum = Math.max(maximum, Math.abs(a[c] - b[c]));
    }
  }
  assert.ok(maximum <= 1, `decoded seam delta ${maximum} exceeds 1/255`);
});

test('a constant region decodes to a flat normal within 1/255', async (t) => {
  const dir = await temporary(t);
  await rectify(await slopeEntry(dir, true), dir);
  const { data } = await decode(join(dir, 'slope_n.webp'));
  // A reflected zero uses 255 - 128 = 127; allow exactly one code value, not encoder damage.
  for (let i = 0; i < data.length; i++) {
    assert.ok(Math.abs(data[i] - [128, 128, 255][i % 3]) <= 1);
  }
});

test('strength zero and omitted channels leave no maps, including stale normal output', async (t) => {
  const dir = await temporary(t);
  const entry = await slopeEntry(dir);
  await rectify(entry, dir);
  await access(join(dir, 'slope_n.webp'));
  await rectify({ ...entry, normal: { strength: 0 } }, dir);
  await absent(join(dir, 'slope_n.webp'));
  await absent(join(dir, 'slope_r.webp'));
  const { normal, ...legacy } = entry;
  await rectify(legacy, dir);
  await absent(join(dir, 'slope_n.webp'));
});

// Measure derivatives across the SOURCE JPEG lattice, projected through the inverse warp.
// This deliberately does not look for axis-aligned 8px boundaries in the rectified image.
const boundaryEnergy = (decoded, corners) => {
  const width = decoded.info.width;
  const h = solveHomography(corners, [[0, 0], [width, 0], [width, width], [0, width]]);
  const sampleGreen = (sx, sy) => {
    const [x, y] = applyHomography(h, sx, sy);
    return pixel(decoded, Math.max(0, Math.min(width - 1, Math.floor(x))),
      Math.max(0, Math.min(width - 1, Math.floor(y))))[1];
  };
  const inverse = solveHomography([[0, 0], [1, 0], [1, 1], [0, 1]], corners);
  const energies = [0, 0], counts = [0, 0];
  for (let y = 8; y < width - 8; y++) {
    for (let x = 8; x < width - 8; x++) {
      const [sx, sy] = applyHomography(inverse, (x + 0.5) / width, (y + 0.5) / width);
      for (let axis = 0; axis < 2; axis++) {
        const coordinate = axis === 0 ? sx : sy;
        // JPEG pixel centres are integers; boundary lies halfway between 8k-1 and 8k.
        const boundary = Math.round((coordinate + 0.5) / 8) * 8 - 0.5;
        if (Math.abs(coordinate - boundary) > 0.2) continue;
        const a = axis === 0 ? sampleGreen(boundary - 0.5, sy) : sampleGreen(sx, boundary - 0.5);
        const b = axis === 0 ? sampleGreen(boundary + 0.5, sy) : sampleGreen(sx, boundary + 0.5);
        energies[axis] += (a - b) ** 2;
        counts[axis]++;
      }
    }
  }
  assert.ok(counts.every((n) => n > 100), 'both warped source axes must be sampled');
  return energies.map((energy, axis) => energy / counts[axis]);
};

// Fourier power in wavelengths 10..50mm, using the CROP width (not the doubled tile).
// A Hann window avoids counting the crop edge as grain.
const bandEnergy = ({ data, info }, worldMm) => {
  const width = info.width;
  const means = data.reduce((sum, value, i) => sum + (i % 3 === 1 ? value : 0), 0) / (width * width);
  const power = [0, 0];
  for (let axis = 0; axis < 2; axis++) {
    for (let line = 0; line < width; line++) {
      for (let k = Math.ceil(worldMm / 50); k <= Math.floor(worldMm / 10); k++) {
        let real = 0, imaginary = 0;
        for (let i = 0; i < width; i++) {
          const p = axis === 0 ? line * width + i : i * width + line;
          const v = (data[p * 3 + 1] - means) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (width - 1)));
          real += v * Math.cos(2 * Math.PI * k * i / width);
          imaginary += v * Math.sin(2 * Math.PI * k * i / width);
        }
        power[axis] += (real * real + imaginary * imaginary) / width ** 3;
      }
    }
  }
  return power.reduce((sum, v) => sum + v, 0);
};

test('de-artefact suppresses warped JPEG boundaries AND retains 10-50mm grain on a real crop', async (t) => {
  const dir = await temporary(t);
  const manifest = JSON.parse(await readFile(new URL('../model/textures.json', import.meta.url), 'utf8'));
  const entry = manifest.textures.find((e) => e.out === 'walnut');
  // The restored JPEG is the fixture: keep its real compression and perspective, no grid synthesis.
  const { normal, roughness, ...legacy } = entry;
  // Decode the full production path. A non-tiled 256px output is the 512px tile's crop.
  await rectify({ ...legacy, size: 256, tile: false, out: 'before' }, dir);
  await rectify({ ...legacy, size: 256, tile: false, out: 'after', normal: { strength: 0 } }, dir);
  const before = await decode(join(dir, 'before.webp'));
  const after = await decode(join(dir, 'after.webp'));
  const originalBlocks = boundaryEnergy(before, entry.corners);
  const blocks = boundaryEnergy(after, entry.corners);
  const originalBand = bandEnergy(before, entry.worldMm);
  const band = bandEnergy(after, entry.worldMm);
  t.diagnostic(JSON.stringify({ originalBlocks, blocks, originalBand, band }));
  for (let axis = 0; axis < 2; axis++) {
    assert.ok(originalBlocks[axis] > 1, 'fixture must carry measurable block-boundary energy');
    assert.ok(blocks[axis] < 12, `axis ${axis} block energy exceeds 12 squared levels`);
    assert.ok(blocks[axis] < originalBlocks[axis] * 0.8, `axis ${axis} block energy must fall by 20%`);
  }
  assert.ok(originalBand > 1, 'fixture must carry real grain');
  assert.ok(band > 5, 'grain power must exceed the absolute floor of 5');
  assert.ok(band >= originalBand * 0.65, 'at least 65% of 10-50mm grain energy must survive');
});


test('invalid normal strength is rejected before writing', async (t) => {
  const dir = await temporary(t);
  const entry = await slopeEntry(dir);
  for (const strength of [-1, NaN, Infinity, '1']) {
    await assert.rejects(rectify({ ...entry, normal: { strength } }, dir), /normal.strength/);
  }
  await absent(join(dir, 'slope.webp'));
});

test('roughness spans its window, mirrors as a scalar, and reports the decoded mean', async (t) => {
  const dir = await temporary(t);
  const messages = [];
  t.mock.method(console, 'log', (message) => messages.push(message));
  const entry = { ...await slopeEntry(dir), roughness: { min: 0.35, max: 0.60 } };
  for (const tile of [true, false]) {
    await rectify({ ...entry, tile }, dir);
    const decoded = await decode(join(dir, 'slope_r.webp'));
    const greens = [];
    for (let i = 1; i < decoded.data.length; i += 3) greens.push(decoded.data[i] / 255);
    const mean = greens.reduce((sum, value) => sum + value, 0) / greens.length;
    assert.ok(mean >= entry.roughness.min && mean <= entry.roughness.max);
    assert.ok(greens.every((g) => g >= entry.roughness.min && g <= entry.roughness.max));
    const low = Math.min(...greens), high = Math.max(...greens);
    close(low, entry.roughness.min, 1 / 255);
    close(high, entry.roughness.max, 1 / 255);
    const sidecar = JSON.parse(await readFile(join(dir, 'slope_r.json'), 'utf8'));
    assert.deepEqual(sidecar.range, entry.roughness);
    assert.equal(sidecar.out, 'slope');
    assert.equal(sidecar.file, 'slope_r.webp');
    close(sidecar.meanGreen, mean, 1e-12);
    assert.ok(messages.includes(`  slope_r.webp decoded meanGreen=${sidecar.meanGreen}`));
    assert.ok(pixel(decoded, 20, 20)[1] > pixel(decoded, 100, 100)[1], 'darker height means rougher');
    if (tile) {
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          const a = pixel(decoded, x, y);
          assert.deepEqual(pixel(decoded, 255 - x, y), a);
          assert.deepEqual(pixel(decoded, x, 255 - y), a);
          assert.deepEqual(pixel(decoded, 255 - x, 255 - y), a);
        }
      }
    }
  }
  const { roughness, ...without } = entry;
  await rectify(without, dir);
  await absent(join(dir, 'slope_r.webp'));
  await absent(join(dir, 'slope_r.json'));
});

test('constant luminance uses the roughness window midpoint, and a fixed window stays fixed', async (t) => {
  const dir = await temporary(t);
  const entry = await slopeEntry(dir, true);
  for (const roughness of [{ min: 0.35, max: 0.6 }, { min: 0.4, max: 0.4 }]) {
    await rectify({ ...entry, roughness }, dir);
    const { data } = await decode(join(dir, 'slope_r.webp'));
    for (let i = 1; i < data.length; i += 3) close(data[i] / 255, (roughness.min + roughness.max) / 2, 1 / 255);
  }
});

test('invalid or unrepresentable roughness windows fail before writing', async (t) => {
  const dir = await temporary(t);
  const entry = await slopeEntry(dir);
  for (const roughness of [null, {}, { min: -0.1, max: 0.6 }, { min: 0.3, max: 1.1 },
    { min: 0.6, max: 0.3 }, { min: NaN, max: 0.6 }, { min: 0.3, max: Infinity },
    { min: '0.3', max: 0.6 }, { min: 0.3501, max: 0.3502 }]) {
    await assert.rejects(rectify({ ...entry, roughness }, dir), /roughness/);
  }
  await absent(join(dir, 'slope.webp'));
});
