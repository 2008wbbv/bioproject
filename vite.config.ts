/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
