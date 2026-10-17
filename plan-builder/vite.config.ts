import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages serves staging/production under a sub-path (set by the deploy workflows).
  base: process.env.VITE_BASE ?? '/',
  worker: { format: 'es' },
  // Dev only: lets local testing load sample PDFs from ../samples (git-ignored client files).
  server: { fs: { allow: ['..'] } },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // PDFium's WebAssembly engine is ~4 MB; precache it so the viewer works offline.
        globPatterns: ['**/*.{js,mjs,css,html,svg,wasm,webp}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Plan Builder',
        short_name: 'Plan Builder',
        description: 'Open a plot plan on site and build a landscape plan.',
        display: 'standalone',
        background_color: '#1f2523',
        theme_color: '#1f2523',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
