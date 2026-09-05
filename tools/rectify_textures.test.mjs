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
