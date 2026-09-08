/**
 * Rasterise model/side-livery.svg into public/textures/side-livery.webp.
 *
 * Not part of `pnpm textures`, which is the photo rectifier and keyed off model/textures.json.
 * The livery is hand-drawn artwork rather than a rectified photograph — see the SVG's header for
 * why — so it gets its own two-line renderer instead of an entry in that manifest.
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = 'public/textures/side-livery.webp';

// density 72 is 1 SVG px to 1 output px, so the file lands at the SVG's own 2048 x 919.
await sharp(await readFile('model/side-livery.svg'), { density: 72 })
  .webp({ quality: 88, alphaQuality: 100 })
  .toFile(OUT);

const { width, height, size } = await sharp(OUT).metadata();
console.log(`wrote ${OUT}: ${width}x${height}, ${size} bytes`);
