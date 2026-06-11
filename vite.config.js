import { defineConfig } from 'vite';

// REMIT builds with Vite (ADR-0015). Root is `app/` so the existing module layout and
// relative imports are unchanged; output goes to repo-root `dist/` (gitignored).
// `base: './'` keeps a single build working under both /<repo>/app/ (deploy) and
// /<repo>/pr-preview/pr-<n>/ (preview) — neither path is known at build time.
export default defineConfig({
  root: 'app',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1500, // deck.gl / luma.gl ship large ESM bundles
  },
});
