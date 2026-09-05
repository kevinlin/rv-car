import * as THREE from 'three';
import type { TextureSpec } from './data/finishes';

export type Resolve = (spec: TextureSpec) => THREE.Texture | null;

/**
 * Caches by url plus the settings that would otherwise force a second GPU upload of the same
 * image. Two roles sharing a url and a repeat share one texture.
 */
export const createTextureResolver = (): Resolve => {
  const loader = new THREE.TextureLoader();
  const cache = new Map<string, THREE.Texture>();

  return (spec) => {
    const key = `${spec.url}|${spec.repeat?.join(',') ?? '1,1'}|${spec.srgb !== false}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const texture = loader.load(spec.url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (spec.repeat) texture.repeat.set(spec.repeat[0], spec.repeat[1]);
    texture.colorSpace = spec.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    cache.set(key, texture);
    return texture;
  };
};
