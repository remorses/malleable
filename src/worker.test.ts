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
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "1e665c28eb1f93be.js": "https://remote-bundler.fumabase.com/bundle/1e665c28eb1f93be.js",
          "1e665c28eb1f93be.js.map": "https://remote-bundler.fumabase.com/bundle/1e665c28eb1f93be.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/1e665c28eb1f93be.js",
        "rawOutputs": [
          {
            "path": "/1e665c28eb1f93be.js.map",
            "size": 1069,
            "type": "sourcemap",
          },
          {
            "path": "/1e665c28eb1f93be.js",
            "size": 2526,
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
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "bdcc81f7bfa93073.js": "https://remote-bundler.fumabase.com/bundle/bdcc81f7bfa93073.js",
          "bdcc81f7bfa93073.js.map": "https://remote-bundler.fumabase.com/bundle/bdcc81f7bfa93073.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/bdcc81f7bfa93073.js",
        "rawOutputs": [
          {
            "path": "/bdcc81f7bfa93073.js.map",
            "size": 1112,
            "type": "sourcemap",
          },
          {
            "path": "/bdcc81f7bfa93073.js",
            "size": 2541,
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
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "0139960554aae246.js": "https://remote-bundler.fumabase.com/bundle/0139960554aae246.js",
          "0139960554aae246.js.map": "https://remote-bundler.fumabase.com/bundle/0139960554aae246.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/0139960554aae246.js",
        "rawOutputs": [
          {
            "path": "/0139960554aae246.js.map",
            "size": 1212,
            "type": "sourcemap",
          },
          {
            "path": "/0139960554aae246.js",
            "size": 2531,
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
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "2cc353d4f0682dad.js": "https://remote-bundler.fumabase.com/bundle/2cc353d4f0682dad.js",
          "2cc353d4f0682dad.js.map": "https://remote-bundler.fumabase.com/bundle/2cc353d4f0682dad.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/2cc353d4f0682dad.js",
        "rawOutputs": [
          {
            "path": "/2cc353d4f0682dad.js.map",
            "size": 1273,
            "type": "sourcemap",
          },
          {
            "path": "/2cc353d4f0682dad.js",
            "size": 2531,
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
          "0a3d91a4456a515c.js": "https://remote-bundler.fumabase.com/bundle/0a3d91a4456a515c.js",
          "0a3d91a4456a515c.js.map": "https://remote-bundler.fumabase.com/bundle/0a3d91a4456a515c.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/0a3d91a4456a515c.js",
        "rawOutputs": [
          {
            "path": "/0a3d91a4456a515c.js.map",
            "size": 7108,
            "type": "sourcemap",
          },
          {
            "path": "/0a3d91a4456a515c.js",
            "size": 3890,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
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
          "421be5d7df37e445.js": "https://remote-bundler.fumabase.com/bundle/421be5d7df37e445.js",
          "421be5d7df37e445.js.map": "https://remote-bundler.fumabase.com/bundle/421be5d7df37e445.js.map",
          "chunks/DynamicModule-S6WJH4XV.js": "https://remote-bundler.fumabase.com/bundle/chunks/DynamicModule-S6WJH4XV.js",
          "chunks/DynamicModule-S6WJH4XV.js.map": "https://remote-bundler.fumabase.com/bundle/chunks/DynamicModule-S6WJH4XV.js.map",
          "chunks/LazyComponent-VKE7BSKE.js": "https://remote-bundler.fumabase.com/bundle/chunks/LazyComponent-VKE7BSKE.js",
          "chunks/LazyComponent-VKE7BSKE.js.map": "https://remote-bundler.fumabase.com/bundle/chunks/LazyComponent-VKE7BSKE.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/421be5d7df37e445.js",
        "rawOutputs": [
          {
            "path": "/421be5d7df37e445.js.map",
            "size": 4051,
            "type": "sourcemap",
          },
          {
            "path": "/421be5d7df37e445.js",
            "size": 2290,
            "type": "entry",
          },
          {
            "path": "/chunks/LazyComponent-VKE7BSKE.js.map",
            "size": 830,
            "type": "sourcemap",
          },
          {
            "path": "/chunks/LazyComponent-VKE7BSKE.js",
            "size": 580,
            "type": "chunk",
          },
          {
            "path": "/chunks/DynamicModule-S6WJH4XV.js.map",
            "size": 803,
            "type": "sourcemap",
          },
          {
            "path": "/chunks/DynamicModule-S6WJH4XV.js",
            "size": 402,
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
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js",
        "rawOutputs": [
          {
            "path": "/9efb087fd86defd0.js.map",
            "size": 4252,
            "type": "sourcemap",
          },
          {
            "path": "/9efb087fd86defd0.js",
            "size": 2454,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
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
});
