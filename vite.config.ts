import { defineConfig, Plugin } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import { importMapPlugin } from "importmap-vite-plugin";
import { readFileSync } from "fs";
import { TestsNotFoundError } from "vitest/node.js";

// Custom plugin to handle WASM imports like Cloudflare Workers
const wasmPlugin = (): Plugin => {
  return {
    name: "wasm-loader",
    enforce: "pre",
    config(config, env) {
      return { build: { rollupOptions: { external: /.+\.wasm$/i } } };
    },
    resolveId(source, importer) {
      if (source.startsWith("wasm:")) return source;
      if (source.endsWith(".wasm")) {
        const abs = path.posix.resolve(
          importer ? path.dirname(importer) : process.cwd(),
          source,
        );
        return { id: "wasm:" + abs, external: false };
      }
      return null;
    },
    async load(id) {
      // Only load if our custom id prefix matches
      if (id.endsWith(".wasm")) {
        const absPath = id.slice("wasm:".length);
        const wasmBuffer = readFileSync(absPath);
        const wasmBase64 = wasmBuffer.toString("base64");

        // Return code that creates a WebAssembly.Module from the base64 data
        return `
        const wasmBase64 = "${wasmBase64}";
        const wasmBuffer = Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0));
        const wasmModule = await WebAssembly.compile(wasmBuffer);
        export default wasmModule;
      `;
      }
    },
  };
};

export default defineConfig({
  ssr: {
    noExternal: ["esbuild-wasm"],
  },
  resolve: {
    alias: {
      "cloudflare:workers": new URL(
        "./src/mocks/cloudflare-workers.ts",
        import.meta.url,
      ).pathname,
    },
  },
  plugins: [
    react(),
    wasmPlugin(),
    !process.env.VITEST &&
      importMapPlugin({
        imports: {
          // Map to local modules (these will be bundled)
          react: "./demo/import-map/react",
          "react-dom": "./demo/import-map/react-dom",
          "react-dom/client": "./demo/import-map/react-dom-client",
          "react/jsx-runtime": "./demo/import-map/react-jsx-runtime",
        },
      }),
  ],
  server: {
    port: 3000,
  },

  assetsInclude: ["**/*.wasm"],
});
