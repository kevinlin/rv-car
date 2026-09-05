import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlacement, sceneNodes } from './check_models.mjs';

describe('exported placement verification', () => {
  it('checks world transforms and descendant bounds, detecting the Blender rear-axis sign bug', () => {
    const placement = { id: 'alcove_bed', location: [0, 1.25, -0.7], dimensions: [2.2, 0.2, 1.4] };
    const json = {
      scenes: [{ nodes: [0] }],
      nodes: [{ name: 'conversion', scale: [1, 1, -1], children: [1] },
        { name: 'alcove_bed', translation: [0, 1.25, 0.7], children: [2] }, { mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ min: [-1.1, -0.1, -0.7], max: [1.1, 0.1, 0.7] }],
    };
    const bed = () => sceneNodes(json).find((entry) => entry.node.name === 'alcove_bed');
    assert.deepEqual(checkPlacement(placement, bed()).errors, []);
    json.nodes[0].scale = [1, 1, 1];
    assert.ok(checkPlacement(placement, bed()).errors.includes('world origin differs from placement'));
    json.nodes[0].scale = [1, 1, -1];
    json.nodes[2].translation = [0.01, 0, 0];
    assert.ok(checkPlacement(placement, bed()).errors.includes('geometry exceeds placement box'));
    json.nodes[2].translation = [0, 0, 0];
    json.accessors[0].max[0] = 1.09;
    assert.ok(checkPlacement(placement, bed()).errors.includes('published bed footprint differs by more than 1 mm'));
  });
});
