import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const KTX2_PATH = 'https://cdn.jsdelivr.net/npm/three/examples/jsm/libs/basis/';

export const MODULE_NAMES = [
  'shell', 'dinette', 'sofa_slideout', 'alcove_bed',
  'lockers', 'cab', 'galley', 'softgoods', 'washroom', 'exterior',
] as const;

let loader: GLTFLoader | null = null;

const getLoader = (renderer: THREE.WebGLRenderer): GLTFLoader => {
  if (loader) return loader;

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  const ktx2 = new KTX2Loader().setTranscoderPath(KTX2_PATH).detectSupport(renderer);

  loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
  return loader;
};

export interface LoadResult {
  root: THREE.Group;
  loaded: string[];
  missing: string[];
}

/**
 * Loads each module .glb from public/models.
 *
 * Missing modules are reported rather than thrown: the modules land one at a time as they are
 * built in Blender, and the app has to stay runnable throughout. `bindPlacements` is what
 * enforces the naming contract once a module is actually present.
 */
/**
 * Rebases an absolute registry path onto the deployment root. Pages serves this project from a
 * subpath, where `/models/shell.glb` would resolve against the domain root and 404. `BASE_URL`
 * is `/` under `pnpm dev` and `./` in the built site.
 */
export const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

export const loadModules = async (
  renderer: THREE.WebGLRenderer,
  names: readonly string[] = MODULE_NAMES,
): Promise<LoadResult> => {
  const gltfLoader = getLoader(renderer);
  const root = new THREE.Group();
  root.name = 'vehicle';

  const loaded: string[] = [];
  const missing: string[] = [];

  const results = await Promise.allSettled(
    names.map((n) => gltfLoader.loadAsync(assetUrl(`/models/${n}.glb`))),
  );

  results.forEach((r, i) => {
    const name = names[i]!;
    if (r.status === 'fulfilled') {
      root.add(r.value.scene);
      loaded.push(name);
    } else {
      missing.push(name);
    }
  });

  return { root, loaded, missing };
};
