import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// Read the canonical app version from src/core/version.js so the deployed
// bundle and the static /version.json always agree.
function emitVersionJson() {
  return {
    name: 'emit-version-json',
    buildStart() {
      try {
        const src = readFileSync('./src/core/version.js', 'utf8');
        const m = /APP_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(src);
        const version = m ? m[1] : '0.0.0';
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, builtAt: new Date().toISOString() }) });
      } catch (e) { console.warn('[emit-version-json] could not derive version', e); }
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  // Relative asset paths — works whether deployed at /, /Focusflow/, /Focusflow/dist/, etc.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    emitVersionJson(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-48x48.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'FocusFlow — Your Day, Elevated',
        short_name: 'FocusFlow',
        description: 'Habits, tasks, deep work, meditation, journal — your all-in-one focus OS.',
        theme_color: '#3ecfb0',
        background_color: '#0f0f13',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Pollinations AI — network-first, fall back to cache
            urlPattern: /^https:\/\/(?:image|text)\.pollinations\.ai\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pollinations-ai',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Any stray CDN requests — cache-first
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
});
