import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so the built site works from a GitHub Pages project subpath without the repo
  // name being compiled in. `pnpm dev` still serves from `/`.
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2022',
    // Two pages: the home page and the walkthrough. Vite only picks up index.html on its own,
    // so tour.html has to be named here or the built site links to a 404.
    rollupOptions: { input: { home: 'index.html', tour: 'tour.html' } },
    // The Blender export writes its uncompressed .glb files to dist/raw, and check_budget.mjs
    // counts triangles from them. Vite empties its outDir by default, so `pnpm build` deleted
    // them and the next `pnpm budget` reported 0 triangles against a 350k ceiling — a check
    // that passes because its input vanished.
    emptyOutDir: false,
  },
});
