import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages (/era-runner/) and from any folder.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
