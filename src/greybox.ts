import * as THREE from 'three';
import { PLACEMENTS, type Placement, type ZoneId } from './data/vehicle';

const ZONE_COLOUR: Record<ZoneId, number> = {
  shell: 0x8899aa,
  cab: 0x666666,
  alcove: 0xd6a15a,
  dinette: 0x6fa8dc,
  sofa: 0x93c47d,
  storage: 0xb4a7d6,
  galley: 0xe06666,
  washroom: 0xf0f0f0,
  exterior: 0x556070,
};

const UNIT = new THREE.BoxGeometry(1, 1, 1);

export const buildGreybox = (ps: readonly Placement[] = PLACEMENTS): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'greybox';

  for (const p of ps) {
    if (p.zone === 'exterior') continue; // the grey-box is an interior debug view
    const isShell = p.zone === 'shell';
    const material = new THREE.MeshStandardMaterial({
      color: ZONE_COLOUR[p.zone],
      transparent: isShell,
      opacity: isShell ? 0.12 : 1,
      roughness: 0.9,
      metalness: 0,
      side: isShell ? THREE.BackSide : THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(UNIT, material);
    mesh.name = p.id;
    mesh.scale.set(p.size[0].v / 1000, p.size[1].v / 1000, p.size[2].v / 1000);
    mesh.position.set(
      (p.origin[0].v + p.size[0].v / 2) / 1000,
      (p.origin[1].v + p.size[1].v / 2) / 1000,
      (p.origin[2].v + p.size[2].v / 2) / 1000,
    );
    group.add(mesh);
  }

  return group;
};
