import { readFile, writeFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { ALL_ROLES, EXTERIOR_ROLES } from '../src/data/finishes.ts';
import { MAX_BYTES, MAX_TRIANGLES } from './check_budget.mjs';

const MODULES = ['shell', 'cab', 'alcove_bed', 'dinette', 'sofa_slideout', 'galley', 'washroom', 'lockers', 'softgoods', 'exterior'];
const TOLERANCE = 0.001; // One millimetre, including float and compression error.
const ROLES = new Set(ALL_ROLES.map((role) => `role.${role}`));
const EXTERIOR = new Set(EXTERIOR_ROLES.map((role) => `role.${role}`));

// Accessor bounds also survive Draco compression. Traverse descendants so an empty
// placement root does not hide an incorrectly positioned chair back or cabinet door.
export function sceneNodes(json) {
  const entries = [];
  function visit(index, parent, ancestors) {
    const node = json.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation ?? [0, 0, 0]),
      new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
      new Vector3().fromArray(node.scale ?? [1, 1, 1]),
    );
    const world = parent.clone().multiply(local);
    const bounds = new Box3();
    const primitives = json.meshes?.[node.mesh]?.primitives ?? [];
    for (const primitive of primitives) {
      const accessor = json.accessors?.[primitive.attributes.POSITION];
      if (!accessor?.min || !accessor?.max) throw new Error(`${node.name}: missing POSITION bounds`);
      bounds.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(world));
    }
    const entry = { node, world, bounds, primitives, ancestors };
    entries.push(entry);
    for (const child of node.children ?? []) bounds.union(visit(child, world, [...ancestors, node.name]));
    return bounds;
  }
  for (const root of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(root, new Matrix4(), []);
  return entries;
}

export function checkPlacement(placement, entry, requireGeometry = true) {
  const errors = [];
  const origin = new Vector3().setFromMatrixPosition(entry.world).toArray();
  if (origin.some((v, i) => Math.abs(v - placement.location[i]) > TOLERANCE)) errors.push('world origin differs from placement');
  if (entry.bounds.isEmpty()) {
    if (requireGeometry) errors.push('placement has no descendant geometry');
  } else {
    const min = entry.bounds.min.toArray(), max = entry.bounds.max.toArray();
    if (min.some((v, i) => v < placement.location[i] - placement.dimensions[i] / 2 - TOLERANCE)
      || max.some((v, i) => v > placement.location[i] + placement.dimensions[i] / 2 + TOLERANCE)) errors.push('geometry exceeds placement box');
    if (['alcove_bed', 'slideout_bed'].includes(placement.id)) {
      const size = entry.bounds.getSize(new Vector3()).toArray();
      if ([0, 2].some((i) => Math.abs(size[i] - placement.dimensions[i]) > TOLERANCE)) errors.push('published bed footprint differs by more than 1 mm');
    }
  }
  return { id: placement.id, origin, bounds: entry.bounds.isEmpty() ? null : { min: entry.bounds.min.toArray(), max: entry.bounds.max.toArray() }, errors };
}

export function checkLiveryUV(doc) {
  const errors = [];
  for (const name of ['body_graphic_off', 'body_graphic_kerb']) {
    const node = doc.getRoot().listNodes().find((n) => n.getName() === name);
    const primitives = node?.getMesh()?.listPrimitives() ?? [];
    if (!primitives.length) { errors.push(`${name}: missing decal geometry`); continue; }
    const world = new Matrix4().fromArray(node.getWorldMatrix());
    const bounds = new Box3();
    for (const primitive of primitives) {
      const positions = primitive.getAttribute('POSITION');
      const uv = primitive.getAttribute('TEXCOORD_0');
      if (!positions || !uv) { errors.push(`${name}: missing positions or livery UV`); continue; }
      if (primitive.getMaterial()?.getName().replace(/\.\d{3}$/, '') !== 'role.body.graphic') {
        errors.push(`${name}: decal must use role.body.graphic`);
      }
      if (positions.getCount() !== uv.getCount()) { errors.push(`${name}: livery UV count differs`); continue; }
      for (let i = 0; i < positions.getCount(); i++) {
        const point = new Vector3().fromArray(positions.getElement(i, [])).applyMatrix4(world);
        bounds.expandByPoint(point);
        const [u, v] = uv.getElement(i, []);
        const expectedU = name.endsWith('kerb') ? 3.95 - point.z : point.z - 0.05;
        if (![u, v].every(Number.isFinite) || Math.abs(u - expectedU) > TOLERANCE || Math.abs(v - (point.y - 0.30)) > TOLERANCE) {
          errors.push(`${name}: exported livery UV origin, orientation or span differs`);
        }
      }
    }
    const centre = bounds.getCenter(new Vector3()).toArray();
    const size = bounds.getSize(new Vector3()).toArray();
    const x = name.endsWith('kerb') ? 1.228 : -1.228;
    if (centre.some((v, i) => Math.abs(v - [x, 1.175, 2.0][i]) > TOLERANCE)
      || size.some((v, i) => Math.abs(v - [0.004, 1.75, 3.9][i]) > TOLERANCE)) {
      errors.push(`${name}: decal must cover the 3.9 x 1.75 m flank`);
    }
  }
  return [...new Set(errors)];
}

export async function checkModels() {
  const placements = JSON.parse(await readFile('model/placements.json', 'utf8')).objects;
  const report = { checkedAt: new Date().toISOString(), toleranceMetres: TOLERANCE, modules: [], violations: [], triangles: 0, bytes: 0, optimizedPrimitiveInstances: 0 };
  const batchedRoles = new Set();
  for (const module of MODULES) {
    for (const stage of ['raw', 'optimized']) {
      const path = `${stage === 'raw' ? 'dist/raw' : 'public/models'}/${module}.glb`;
      const result = { module, stage, path, placements: [], primitives: 0, aoPrimitives: 0, errors: [] };
      report.modules.push(result);
      try {
        const { json } = await new NodeIO().readAsJSON(path);
        if (module === 'exterior' && stage === 'raw') {
          result.errors.push(...checkLiveryUV(await new NodeIO().read(path)));
        }
        const entries = sceneNodes(json);
        if (!entries.some((entry) => entry.primitives.length)) result.errors.push('module contains no geometry');
        for (const placement of placements.filter((p) => p.collection === module)) {
          const matches = entries.filter((entry) => entry.node.name === placement.id);
          if (matches.length !== 1) result.errors.push(`${placement.id}: expected one named node, found ${matches.length}`);
          else {
            const checked = checkPlacement(placement, matches[0], stage === 'raw' || placement.movable);
            result.placements.push(checked);
            result.errors.push(...checked.errors.map((error) => `${placement.id}: ${error}`));
          }
        }
        for (const entry of entries) {
          if (entry.node.extensions?.EXT_mesh_gpu_instancing) result.errors.push('GPU instancing is not supported by the placement bounds check');
          for (const primitive of entry.primitives) {
            result.primitives++;
            const material = json.materials?.[primitive.material];
            const role = material?.name?.replace(/\.\d{3}$/, '');
            if (!ROLES.has(role)) result.errors.push(`unknown material role: ${material?.name}`);
            if (module === 'exterior' && !EXTERIOR.has(role)) {
              result.errors.push(`exterior primitive uses non-exterior role: ${material?.name}`);
            }
            if (stage === 'raw') {
              const count = json.accessors[primitive.indices ?? primitive.attributes.POSITION].count;
              if ((primitive.mode ?? 4) !== 4) result.errors.push('non-triangle primitive cannot be budgeted');
              report.triangles += count / 3;
            } else {
              const owner = placements.find((p) => (p.movable || p.id === 'slideout_box')
                && (p.id === entry.node.name || entry.ancestors.includes(p.id)));
              batchedRoles.add(`${owner?.id ?? 'static'}:${role}`);
            }
            // Glass and emissive strips do not receive ambient occlusion.
            if (['role.glass', 'role.glass.tint', 'role.led.cove', 'role.body.led'].includes(role)) continue;
            const ao = material?.occlusionTexture;
            const texture = json.textures?.[ao?.index];
            const image = json.images?.[texture?.extensions?.KHR_texture_basisu?.source ?? texture?.source];
            if (primitive.attributes.TEXCOORD_1 === undefined || (ao?.texCoord ?? 0) !== 1 || !image) {
              result.errors.push(`${entry.node.name ?? role}: missing UV2 or AO image using TEXCOORD_1`);
            } else result.aoPrimitives++;
          }
        }
        if (stage === 'optimized') {
          report.bytes += (await stat(path)).size;
          report.optimizedPrimitiveInstances += result.primitives;
        }
      } catch (error) { result.errors.push(error.message); }
      result.errors = [...new Set(result.errors)];
      report.violations.push(...result.errors.map((error) => `${stage}/${module}: ${error}`));
    }
  }
  // The published envelope, now verifiable geometry rather than a number in a table.
  // slideout_box is excluded: 2450 mm is the RETRACTED width, and this vehicle is modelled
  // deployed, so a correct slide-out legitimately exceeds it by its 580 mm of travel.
  const EXTERIOR_BODY = ['body_cab', 'body_alcove', 'body_habitation', 'skirt',
    'wheel_front_off', 'wheel_front_kerb', 'wheel_rear_off', 'wheel_rear_kerb'];
  const body = report.modules
    .filter((m) => m.module === 'exterior' && m.stage === 'raw')
    .flatMap((m) => m.placements)
    .filter((p) => EXTERIOR_BODY.includes(p.id) && p.bounds);

  if (body.length !== EXTERIOR_BODY.length) {
    report.violations.push(`exterior envelope: expected ${EXTERIOR_BODY.length} bodies, found ${body.length}`);
  } else {
    const span = (i) => Math.max(...body.map((p) => p.bounds.max[i]))
                      - Math.min(...body.map((p) => p.bounds.min[i]));
    // Height is measured from the ground, which sits floorAboveGround below the origin.
    const roof = Math.max(...body.map((p) => p.bounds.max[1]));
    const envelope = [['width', span(0), 2.450], ['length', span(2), 5.998],
                      ['height', roof + 1.050, 3.200]];
    for (const [name, measured, published] of envelope) {
      if (Math.abs(measured - published) > TOLERANCE) {
        report.violations.push(`exterior ${name} is ${measured.toFixed(4)} m, published ${published} m`);
      }
    }
    report.exteriorEnvelope = Object.fromEntries(envelope.map(([n, m]) => [n, Number(m.toFixed(4))]));
  }

  report.potentialRoleBatchedDrawCalls = batchedRoles.size;
  report.drawCallNote = 'Primitive instances are exported geometry draws. Role batching is a feasibility estimate; browser renderer.info.render.calls must be measured separately.';
  report.aoNote = 'Checks texture/UV wiring only. Nonconstant baked AO and visible shading require bake evidence and visual verification.';
  if (report.triangles > MAX_TRIANGLES) report.violations.push(`triangle budget exceeded: ${report.triangles} > ${MAX_TRIANGLES}`);
  if (report.bytes > MAX_BYTES) report.violations.push(`byte budget exceeded: ${report.bytes} > ${MAX_BYTES}`);
  // 60, not 40. This counts role batches across the whole scene, and the scene now includes
  // the exterior. The spec's interior ceiling of 40 is a per-hotspot number measured in the
  // browser: the worst interior stop draws 35, and the exterior stop is allowed 60.
  const MAX_ROLE_BATCHES = 60;
  if (batchedRoles.size > MAX_ROLE_BATCHES) report.violations.push(`even role batching exceeds draw budget: ${batchedRoles.size} > ${MAX_ROLE_BATCHES}`);
  report.passed = report.violations.length === 0;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkModels();
  await writeFile('model/verification.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.passed ? 'PASS' : 'FAIL'}: ${report.triangles} triangles, ${report.bytes} bytes, ${report.optimizedPrimitiveInstances} exported draws; role-batched estimate ${report.potentialRoleBatchedDrawCalls}.`);
  if (report.exteriorEnvelope) {
    console.log(Object.entries(report.exteriorEnvelope).map(([name, value]) => `${name} ${value.toFixed(3)}`).join(', '));
  }
  for (const violation of report.violations) console.error(violation);
  console.log('Report: model/verification.json');
  process.exitCode = report.passed ? 0 : 1;
}
