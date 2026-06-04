/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  // On GitHub Pages the app is served from /<repo>/; locally and elsewhere from /.
  base: process.env.GITHUB_PAGES ? "/bioproject/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      // Mol* / tmalign WASM chunks are large; raise the precache size ceiling.
      workbox: { maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, globPatterns: ["**/*.{js,css,html,svg,wasm}"] },
      manifest: {
        name: "OpenFoldUI",
        short_name: "OpenFoldUI",
        description: "Compare predicted vs experimental protein structures, in your browser.",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  // tmalign-wasm does `import url from './tmalign-wasm.wasm'` and passes it to the
  // Emscripten module's locateFile. Treating .wasm as a static asset makes that
  // import resolve to a URL string (Mol* loads its own wasm at runtime, not via
  // import, so this doesn't affect it).
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: { exclude: ["tmalign-wasm"] },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
