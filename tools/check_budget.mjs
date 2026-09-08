import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';

export const MAX_TRIANGLES = 350_000;
export const MAX_BYTES = 25 * 1024 * 1024;

const RAW_DIR = 'dist/raw';
const OUT_DIR = 'public/models';

export const summarise = (triangles, bytes) => {
  const violations = [];
  if (triangles > MAX_TRIANGLES) {
    violations.push(`over triangle budget: ${triangles} > ${MAX_TRIANGLES}`);
  }
  if (bytes > MAX_BYTES) {
    violations.push(`over bytes budget: ${bytes} > ${MAX_BYTES}`);
  }
  return { triangles, bytes, violations };
};

/**
 * Counted from the uncompressed exports: Draco does not change triangle count, and reading
 * compressed meshes would drag in the Draco decoder for no benefit.
 */
export const countTriangles = async (path) => {
  const doc = await new NodeIO().read(path);
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      const count = indices ? indices.getCount() : position ? position.getCount() : 0;
      total += Math.floor(count / 3);
    }
  }
  return total;
};

const glbsIn = async (dir) => {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.glb')).map((f) => join(dir, f));
  } catch {
    return [];
  }
};

export const checkBudget = async () => {
  let triangles = 0;
  for (const f of await glbsIn(RAW_DIR)) triangles += await countTriangles(f);

  let bytes = 0;
  for (const f of await glbsIn(OUT_DIR)) bytes += (await stat(f)).size;
  for (const file of await readdir('public/textures', { recursive: true, withFileTypes: true })) {
    if (file.isFile()) bytes += (await stat(join(file.parentPath, file.name))).size;
  }

  return summarise(triangles, bytes);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await checkBudget();
  console.log(`triangles: ${r.triangles} / ${MAX_TRIANGLES}`);
  console.log(`bytes:     ${r.bytes} / ${MAX_BYTES}`);
  if (r.violations.length) {
    for (const v of r.violations) console.error(`BUDGET: ${v}`);
    process.exit(1);
  }
  console.log('Budget OK.');
}
