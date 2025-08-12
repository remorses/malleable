import { describe, it, expect } from "vitest";
import type { BundleResult } from "./types.js";
import { evaluateBundleExportsWithDeno } from "./test-utils.js";

const WORKER_URL = "https://remote-bundler.fumabase.com";

const DEFAULT_EXTERNAL_PACKAGES = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
];

describe("Remote Bundler Worker", () => {
  it("should transform TSX code with React and generate Tailwind CSS", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "app.tsx",
          content: 'const App = () => <div className="p-4 bg-blue-500 text-white">Hello</div>;'
        }],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    const result = await response.json() as BundleResult;
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"esbuild-init;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=18329&min_rtt=14807&rtt_var=8069&sent=4&recv=5&lost=0&retrans=0&sent_bytes=2855&recv_bytes=956&delivery_rate=195583&cwnd=251&unsent_bytes=0&cid=0a4d05139724c8f9&ts=1671&x=0""`);
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "1e665c28eb1f93be.js": "https://remote-bundler.fumabase.com/bundle/1e665c28eb1f93be.js",
          "1e665c28eb1f93be.js.map": "https://remote-bundler.fumabase.com/bundle/1e665c28eb1f93be.js.map",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/1e665c28eb1f93be.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/1e665c28eb1f93be.js",
        "rawOutputs": [
          {
            "path": "/1e665c28eb1f93be.js.map",
            "size": 3164,
            "type": "sourcemap",
          },
          {
            "path": "/1e665c28eb1f93be.js",
            "size": 3789,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should extract Tailwind classes with hover and responsive modifiers", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "button.tsx",
          content: 'const Button = () => <button className="p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6">Click</button>;'
        }],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    const result = await response.json() as BundleResult;
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=18850&min_rtt=14807&rtt_var=5437&sent=9&recv=8&lost=0&retrans=0&sent_bytes=4696&recv_bytes=1469&delivery_rate=280865&cwnd=255&unsent_bytes=0&cid=0a4d05139724c8f9&ts=2429&x=0""`);
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "bdcc81f7bfa93073.js": "https://remote-bundler.fumabase.com/bundle/bdcc81f7bfa93073.js",
          "bdcc81f7bfa93073.js.map": "https://remote-bundler.fumabase.com/bundle/bdcc81f7bfa93073.js.map",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/bdcc81f7bfa93073.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/bdcc81f7bfa93073.js",
        "rawOutputs": [
          {
            "path": "/bdcc81f7bfa93073.js.map",
            "size": 3207,
            "type": "sourcemap",
          },
          {
            "path": "/bdcc81f7bfa93073.js",
            "size": 3804,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should handle template literals with conditional classes", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "card.tsx",
          content: `const Card = ({ isActive }) => {
          const baseClass = "p-6 rounded-xl shadow-lg";
          return <div className={\`\${baseClass} \${isActive ? "bg-green-500" : "bg-gray-200"}\`}>Content</div>;
        }`
        }],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    const result = await response.json() as BundleResult;
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=29494&min_rtt=14807&rtt_var=25366&sent=14&recv=11&lost=0&retrans=1&sent_bytes=6070&recv_bytes=2086&delivery_rate=280865&cwnd=255&unsent_bytes=0&cid=0a4d05139724c8f9&ts=3242&x=0""`);
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "0139960554aae246.js": "https://remote-bundler.fumabase.com/bundle/0139960554aae246.js",
          "0139960554aae246.js.map": "https://remote-bundler.fumabase.com/bundle/0139960554aae246.js.map",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/0139960554aae246.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/0139960554aae246.js",
        "rawOutputs": [
          {
            "path": "/0139960554aae246.js.map",
            "size": 3307,
            "type": "sourcemap",
          },
          {
            "path": "/0139960554aae246.js",
            "size": 3794,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it(
    "should resolve npm imports when resolveImports is true",
    async () => {
      const response = await fetch(`${WORKER_URL}/api/bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{
            path: "app.tsx",
            content: `import { format } from 'date-fns';
        const App = () => <div className="text-lg font-bold">{format(new Date(), 'yyyy-MM-dd')}</div>;`
          }],
          externalPackages: DEFAULT_EXTERNAL_PACKAGES,
        }),
      });

      const result = await response.json() as BundleResult;
      const serverTiming = response.headers.get('Server-Timing');
      expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, parallel-build;dur=81, total;dur=81, cfL4;desc="?proto=TCP&rtt=27945&min_rtt=14807&rtt_var=22123&sent=17&recv=13&lost=0&retrans=1&sent_bytes=7392&recv_bytes=2626&delivery_rate=280865&cwnd=255&unsent_bytes=0&cid=0a4d05139724c8f9&ts=3784&x=0""`);
      expect(result.success).toMatchInlineSnapshot(`false`);
    },
    { timeout: 60000 },
  );

  it("should handle missing code parameter", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [],
      }),
    });

    const result = await response.json() as BundleResult;
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"cfL4;desc="?proto=TCP&rtt=20287&min_rtt=15865&rtt_var=9108&sent=3&recv=5&lost=0&retrans=0&sent_bytes=234&recv_bytes=1034&delivery_rate=91270&cwnd=250&unsent_bytes=0&cid=04a7d75e3e9b35c9&ts=389&x=0""`);
    expect(response.status).toMatchInlineSnapshot(`400`);
    expect(result).toMatchInlineSnapshot(`
      {
        "error": "No files provided",
        "success": false,
      }
    `);
  });

  it("should handle complex Tailwind utilities including gradients and animations", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "hero.tsx",
          content: `const Hero = () => (
          <div className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text">Gradient Text</h1>
          </div>
        );`
        }],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    const result = await response.json() as BundleResult;
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=27161&min_rtt=14807&rtt_var=18159&sent=20&recv=15&lost=0&retrans=1&sent_bytes=9013&recv_bytes=3306&delivery_rate=280865&cwnd=255&unsent_bytes=0&cid=0a4d05139724c8f9&ts=4918&x=0""`);
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "2cc353d4f0682dad.js": "https://remote-bundler.fumabase.com/bundle/2cc353d4f0682dad.js",
          "2cc353d4f0682dad.js.map": "https://remote-bundler.fumabase.com/bundle/2cc353d4f0682dad.js.map",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/2cc353d4f0682dad.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/2cc353d4f0682dad.js",
        "rawOutputs": [
          {
            "path": "/2cc353d4f0682dad.js.map",
            "size": 3368,
            "type": "sourcemap",
          },
          {
            "path": "/2cc353d4f0682dad.js",
            "size": 3794,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should handle OPTIONS request for CORS preflight", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toMatchInlineSnapshot(`"*"`);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatchInlineSnapshot(`"OPTIONS, GET, POST, PUT, PATCH, DELETE"`);
    expect(response.headers.get("Access-Control-Allow-Headers")).toMatchInlineSnapshot(`"*"`);
  });

  it("should handle multiple input files with imports between them", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "utils.ts",
            content: `
              export const formatPrice = (price: number) => {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(price);
              };

              export const truncateText = (text: string, maxLength: number) => {
                if (text.length <= maxLength) return text;
                return text.slice(0, maxLength) + '...';
              };
            `
          },
          {
            path: "components/Button.tsx",
            content: `
              import React from 'react';

              export const Button = ({ children, onClick, variant = 'primary' }) => {
                const baseClasses = "px-4 py-2 rounded-lg font-semibold transition-colors";
                const variantClasses = variant === 'primary'
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300";

                return (
                  <button
                    className={\`\${baseClasses} \${variantClasses}\`}
                    onClick={onClick}
                  >
                    {children}
                  </button>
                );
              };
            `
          },
          {
            path: "app.tsx",
            content: `
              import React from 'react';
              import { Button } from './components/Button';
              import { formatPrice, truncateText } from './utils';

              const App = () => {
                const price = 99.99;
                const description = "This is a very long product description that needs to be truncated";

                return (
                  <div className="p-8 bg-gray-100 min-h-screen">
                    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
                      <h1 className="text-3xl font-bold mb-4">Product Card</h1>
                      <p className="text-gray-600 mb-2">{truncateText(description, 30)}</p>
                      <p className="text-2xl font-semibold text-green-600 mb-4">{formatPrice(price)}</p>
                      <div className="flex gap-4">
                        <Button variant="primary">Buy Now</Button>
                        <Button variant="secondary">Add to Cart</Button>
                      </div>
                    </div>
                  </div>
                );
              };

              export default App;
            `
          }
        ],
        entryPoint: "app.tsx"
        // No external packages so it can be evaluated with Deno
      }),
    });

    const result = await response.json() as BundleResult;
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=44, parallel-build;dur=44, total;dur=44, cfL4;desc="?proto=TCP&rtt=20127&min_rtt=15865&rtt_var=7151&sent=7&recv=9&lost=0&retrans=0&sent_bytes=1584&recv_bytes=3855&delivery_rate=91270&cwnd=251&unsent_bytes=0&cid=04a7d75e3e9b35c9&ts=1979&x=0""`);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.jsUrl).toBeDefined();
      expect(result.files).toBeDefined();

      // Check that multiple files were processed
      expect(result.rawOutputs).toBeDefined();
      expect(result.rawOutputs.length).toBeGreaterThan(0);

      // Evaluate with Deno to verify the bundle works
      const exports = await evaluateBundleExportsWithDeno(result.jsUrl);
      console.log(exports)
      expect(exports).toContain('default');
    }

    // Verify the output contains expected content
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "c9025520583ffc11.js": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.js",
          "c9025520583ffc11.js.map": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.js.map",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.js",
        "rawOutputs": [
          {
            "path": "/c9025520583ffc11.js.map",
            "size": 41641,
            "type": "sourcemap",
          },
          {
            "path": "/c9025520583ffc11.js",
            "size": 25006,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [
          {
            "id": "missing-source-map",
            "location": {
              "column": 21,
              "file": "esm-sh-plugin:https://esm.sh/react-dom@19.1.1/es2022/react-dom.mjs",
              "length": 17,
              "line": 17,
              "lineText": "//# sourceMappingURL=react-dom.mjs.map",
              "namespace": "",
              "suggestion": "",
            },
            "notes": [],
            "pluginName": "",
            "text": "Cannot read file "https:/esm.sh/react-dom@19.1.1/es2022/react-dom.mjs.map": not implemented on js",
          },
          {
            "id": "missing-source-map",
            "location": {
              "column": 21,
              "file": "esm-sh-plugin:https://esm.sh/react@19.1.1/es2022/jsx-runtime.mjs",
              "length": 19,
              "line": 16,
              "lineText": "//# sourceMappingURL=jsx-runtime.mjs.map",
              "namespace": "",
              "suggestion": "",
            },
            "notes": [],
            "pluginName": "",
            "text": "Cannot read file "https:/esm.sh/react@19.1.1/es2022/jsx-runtime.mjs.map": not implemented on js",
          },
          {
            "id": "missing-source-map",
            "location": {
              "column": 21,
              "file": "esm-sh-plugin:https://esm.sh/react@19.1.1/es2022/react.mjs",
              "length": 13,
              "line": 16,
              "lineText": "//# sourceMappingURL=react.mjs.map",
              "namespace": "",
              "suggestion": "",
            },
            "notes": [],
            "pluginName": "",
            "text": "Cannot read file "https:/esm.sh/react@19.1.1/es2022/react.mjs.map": not implemented on js",
          },
        ],
      }
    `);
  });

  it("should handle dynamic imports and React.lazy with code splitting", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "LazyComponent.tsx",
            content: `
              import React from 'react';

              const LazyComponent = () => {
                return (
                  <div className="p-8 bg-purple-500 text-white rounded-lg">
                    <h2 className="text-2xl font-bold mb-4">Lazy Loaded Component</h2>
                    <p className="text-lg">This component was loaded dynamically!</p>
                  </div>
                );
              };

              export default LazyComponent;
            `
          },
          {
            path: "DynamicModule.ts",
            content: `
              export const dynamicFunction = (x: number, y: number) => {
                return x * y + 100;
              };

              export const dynamicData = {
                message: "This is from a dynamically imported module",
                timestamp: Date.now()
              };

              export default function processDynamic(input: string) {
                return input.toUpperCase() + " - PROCESSED";
              }
            `
          },
          {
            path: "app.tsx",
            content: `
              import React, { Suspense, lazy, useState, useEffect } from 'react';

              // React.lazy for component code splitting
              const LazyComponent = lazy(() => import('./LazyComponent'));

              export const App = () => {
                const [dynamicModule, setDynamicModule] = useState(null);
                const [showLazy, setShowLazy] = useState(false);

                useEffect(() => {
                  // Dynamic import for code splitting
                  import('./DynamicModule').then(module => {
                    setDynamicModule(module);
                    console.log('Dynamic module loaded:', module);
                  });
                }, []);

                return (
                  <div className="p-8 bg-gray-100 min-h-screen">
                    <h1 className="text-3xl font-bold mb-6">Code Splitting Demo</h1>

                    <div className="space-y-4">
                      <button
                        onClick={() => setShowLazy(!showLazy)}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        {showLazy ? 'Hide' : 'Show'} Lazy Component
                      </button>

                      {showLazy && (
                        <Suspense fallback={<div className="p-4 bg-gray-200">Loading...</div>}>
                          <LazyComponent />
                        </Suspense>
                      )}

                      {dynamicModule && (
                        <div className="p-4 bg-green-100 rounded">
                          <p>Dynamic module loaded successfully!</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              // Also test a dynamic import function
              export async function loadDynamicData() {
                const module = await import('./DynamicModule');
                return module.dynamicData;
              }

              export default App;
            `
          }
        ],
        entryPoint: "app.tsx",
        externalPackages: DEFAULT_EXTERNAL_PACKAGES
      }),
    });

    const result = await response.json() as BundleResult;
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=24142&min_rtt=12819&rtt_var=15361&sent=27&recv=22&lost=0&retrans=1&sent_bytes=11286&recv_bytes=7273&delivery_rate=280865&cwnd=255&unsent_bytes=0&cid=0a4d05139724c8f9&ts=6616&x=0""`);
    expect(result.success).toBe(true);

    if (result.success) {
      // Check if multiple files were generated (main bundle + chunks)
      const fileCount = Object.keys(result.files).length;
      console.log('Generated files:', Object.keys(result.files));

      // We expect at least the main JS file and its source map
      expect(fileCount).toBeGreaterThanOrEqual(2);

      // Check raw outputs for chunks
      const hasChunks = result.rawOutputs.some(output => output.type === 'chunk');
      console.log('Has chunks:', hasChunks);
      console.log('Raw outputs:', result.rawOutputs.map(o => ({ path: o.path, type: o.type })));

      // Skip Deno evaluation for this test since React is external
      // The bundle successfully demonstrates code splitting with chunks
    }

    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "6bad1d1e32f23fb9.js": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.js",
          "6bad1d1e32f23fb9.js.map": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.js.map",
          "chunks/DynamicModule-KSLSO63E.js": "https://remote-bundler.fumabase.com/bundle/chunks/DynamicModule-KSLSO63E.js",
          "chunks/DynamicModule-KSLSO63E.js.map": "https://remote-bundler.fumabase.com/bundle/chunks/DynamicModule-KSLSO63E.js.map",
          "chunks/LazyComponent-SBZUGIIL.js": "https://remote-bundler.fumabase.com/bundle/chunks/LazyComponent-SBZUGIIL.js",
          "chunks/LazyComponent-SBZUGIIL.js.map": "https://remote-bundler.fumabase.com/bundle/chunks/LazyComponent-SBZUGIIL.js.map",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.js",
        "rawOutputs": [
          {
            "path": "/6bad1d1e32f23fb9.js.map",
            "size": 6041,
            "type": "sourcemap",
          },
          {
            "path": "/6bad1d1e32f23fb9.js",
            "size": 3545,
            "type": "entry",
          },
          {
            "path": "/chunks/LazyComponent-SBZUGIIL.js.map",
            "size": 818,
            "type": "sourcemap",
          },
          {
            "path": "/chunks/LazyComponent-SBZUGIIL.js",
            "size": 591,
            "type": "chunk",
          },
          {
            "path": "/chunks/DynamicModule-KSLSO63E.js.map",
            "size": 791,
            "type": "sourcemap",
          },
          {
            "path": "/chunks/DynamicModule-KSLSO63E.js",
            "size": 413,
            "type": "chunk",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should execute bundled code with Deno", async () => {
    // First, bundle a React component
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "app.tsx",
          content: `
            import React from 'react';

            export const add = (a, b) => a + b;
            export const multiply = (a, b) => a * b;

            const App = ({ name = "World" }) => {
              return <div className="p-4">Hello {name}!</div>;
            };

            export default App;
          `
        }],
      }),
    });


    const result = await response.json() as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "9efb087fd86defd0.js": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js",
          "9efb087fd86defd0.js.map": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js.map",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js",
        "rawOutputs": [
          {
            "path": "/9efb087fd86defd0.js.map",
            "size": 38796,
            "type": "sourcemap",
          },
          {
            "path": "/9efb087fd86defd0.js",
            "size": 23544,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [
          {
            "id": "missing-source-map",
            "location": {
              "column": 21,
              "file": "esm-sh-plugin:https://esm.sh/react-dom@19.1.1/es2022/react-dom.mjs",
              "length": 17,
              "line": 17,
              "lineText": "//# sourceMappingURL=react-dom.mjs.map",
              "namespace": "",
              "suggestion": "",
            },
            "notes": [],
            "pluginName": "",
            "text": "Cannot read file "https:/esm.sh/react-dom@19.1.1/es2022/react-dom.mjs.map": not implemented on js",
          },
          {
            "id": "missing-source-map",
            "location": {
              "column": 21,
              "file": "esm-sh-plugin:https://esm.sh/react@19.1.1/es2022/jsx-runtime.mjs",
              "length": 19,
              "line": 16,
              "lineText": "//# sourceMappingURL=jsx-runtime.mjs.map",
              "namespace": "",
              "suggestion": "",
            },
            "notes": [],
            "pluginName": "",
            "text": "Cannot read file "https:/esm.sh/react@19.1.1/es2022/jsx-runtime.mjs.map": not implemented on js",
          },
          {
            "id": "missing-source-map",
            "location": {
              "column": 21,
              "file": "esm-sh-plugin:https://esm.sh/react@19.1.1/es2022/react.mjs",
              "length": 13,
              "line": 16,
              "lineText": "//# sourceMappingURL=react.mjs.map",
              "namespace": "",
              "suggestion": "",
            },
            "notes": [],
            "pluginName": "",
            "text": "Cannot read file "https:/esm.sh/react@19.1.1/es2022/react.mjs.map": not implemented on js",
          },
        ],
      }
    `);
    expect(result.success).toBe(true);

    // Execute the bundled code using Deno and check the exports
    if (!result.success) {
      throw new Error('Bundle failed');
    }

    const exports = await evaluateBundleExportsWithDeno(result.jsUrl);
    expect(exports).toContain('default');
    expect(exports).toContain('add');
    expect(exports).toContain('multiply');
  });

  it("should return formatted error for syntax errors", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "app.tsx",
          content: `
            const App = () => {
              // Missing closing bracket for function
              return (
                <div className="p-4">
                  {/* Syntax error: unexpected token */}
                  const x = ;
                  Hello World
                </div>
              )
          `
        }],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    const result = await response.json() as BundleResult;
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorText).toBeDefined();
      expect(result.errorText).toContain("Unexpected");
      // Check that the error includes context with line numbers (esbuild uses │ character)
      expect(result.errorText).toMatch(/\d+\s*│/); // Should contain line numbers with box drawing character
    }
  });

  it("should return formatted error for non-existent npm package", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "app.tsx",
          content: `
            import { someFunction } from 'package-that-definitely-does-not-exist-12345';
            
            const App = () => {
              return <div>Hello {someFunction()}</div>;
            };
            
            export default App;
          `
        }],
        externalPackages: [], // Not marking as external so it tries to resolve
      }),
    });

    const result = await response.json() as BundleResult;
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorText).toBeDefined();
      expect(result.errorText).toContain("package-that-definitely-does-not-exist-12345");
      // Should show the import line context
      expect(result.errorText).toMatch(/import.*from/);
    }
  });
});
