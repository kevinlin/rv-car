import { createScene } from './scene';
import { buildGreybox } from './greybox';
import { checkAll } from './check';

const violations = checkAll();
if (violations.length) {
  console.error('Dimensional violations:', violations);
} else {
  console.log('Dimensional checks pass.');
}

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const bundle = createScene(canvas);
bundle.scene.add(buildGreybox());
bundle.renderer.setAnimationLoop(bundle.render);

// Grey-box gate only: lets the phase 1 review drive the camera to reference viewpoints.
// main.ts is rewritten in Task 12 and this goes with it.
(window as unknown as { __gate: typeof bundle }).__gate = bundle;
