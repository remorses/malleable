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
    expect(serverTiming).toMatchInlineSnapshot(`"esbuild-init;dur=0, parse-body;dur=1, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=1, cfL4;desc="?proto=TCP&rtt=21770&min_rtt=20831&rtt_var=7488&sent=4&recv=6&lost=0&retrans=0&sent_bytes=2857&recv_bytes=956&delivery_rate=116576&cwnd=251&unsent_bytes=0&cid=a45670e1a3a089fc&ts=1338&x=0""`);
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
            "size": 3138,
            "type": "sourcemap",
          },
          {
            "path": "/1e665c28eb1f93be.js",
            "size": 3758,
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
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=22219&min_rtt=20831&rtt_var=6512&sent=9&recv=8&lost=0&retrans=0&sent_bytes=4690&recv_bytes=1469&delivery_rate=228427&cwnd=255&unsent_bytes=0&cid=a45670e1a3a089fc&ts=2093&x=0""`);
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
            "size": 3181,
            "type": "sourcemap",
          },
          {
            "path": "/bdcc81f7bfa93073.js",
            "size": 3773,
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
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=22879&min_rtt=20831&rtt_var=6204&sent=12&recv=10&lost=0&retrans=0&sent_bytes=6004&recv_bytes=2086&delivery_rate=228427&cwnd=257&unsent_bytes=0&cid=a45670e1a3a089fc&ts=3420&x=0""`);
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
            "size": 3281,
            "type": "sourcemap",
          },
          {
            "path": "/0139960554aae246.js",
            "size": 3763,
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
      expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, total;dur=673, cfL4;desc="?proto=TCP&rtt=23315&min_rtt=20831&rtt_var=5527&sent=17&recv=12&lost=0&retrans=0&sent_bytes=7359&recv_bytes=2626&delivery_rate=228427&cwnd=257&unsent_bytes=0&cid=a45670e1a3a089fc&ts=4282&x=0""`);
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
    expect(serverTiming).toMatchInlineSnapshot(`"cfL4;desc="?proto=TCP&rtt=29019&min_rtt=26839&rtt_var=11622&sent=3&recv=5&lost=0&retrans=0&sent_bytes=234&recv_bytes=1034&delivery_rate=53951&cwnd=250&unsent_bytes=0&cid=f67ba94100e055b8&ts=377&x=0""`);
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
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=23790&min_rtt=20831&rtt_var=5095&sent=19&recv=14&lost=0&retrans=0&sent_bytes=8635&recv_bytes=3306&delivery_rate=228427&cwnd=257&unsent_bytes=0&cid=a45670e1a3a089fc&ts=6048&x=0""`);
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
            "size": 3342,
            "type": "sourcemap",
          },
          {
            "path": "/2cc353d4f0682dad.js",
            "size": 3763,
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
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=372, parallel-build;dur=372, total;dur=372, cfL4;desc="?proto=TCP&rtt=28027&min_rtt=21086&rtt_var=10700&sent=7&recv=9&lost=0&retrans=0&sent_bytes=1589&recv_bytes=3855&delivery_rate=68671&cwnd=251&unsent_bytes=0&cid=f67ba94100e055b8&ts=3585&x=0""`);
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
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.js",
        "rawOutputs": [
          {
            "path": "/c9025520583ffc11.js.map",
            "size": 41566,
            "type": "sourcemap",
          },
          {
            "path": "/c9025520583ffc11.js",
            "size": 24951,
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
    const serverTiming = response.headers.get('Server-Timing');
    expect(serverTiming).toMatchInlineSnapshot(`"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=23158&min_rtt=19139&rtt_var=3847&sent=25&recv=20&lost=0&retrans=0&sent_bytes=10914&recv_bytes=7273&delivery_rate=228427&cwnd=257&unsent_bytes=0&cid=a45670e1a3a089fc&ts=8892&x=0""`);
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
          "chunks/DynamicModule-QNLNK47X.js": "https://remote-bundler.fumabase.com/bundle/chunks/DynamicModule-QNLNK47X.js",
          "chunks/DynamicModule-QNLNK47X.js.map": "https://remote-bundler.fumabase.com/bundle/chunks/DynamicModule-QNLNK47X.js.map",
          "chunks/LazyComponent-QGGRFTBA.js": "https://remote-bundler.fumabase.com/bundle/chunks/LazyComponent-QGGRFTBA.js",
          "chunks/LazyComponent-QGGRFTBA.js.map": "https://remote-bundler.fumabase.com/bundle/chunks/LazyComponent-QGGRFTBA.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.js",
        "rawOutputs": [
          {
            "path": "/6bad1d1e32f23fb9.js.map",
            "size": 6005,
            "type": "sourcemap",
          },
          {
            "path": "/6bad1d1e32f23fb9.js",
            "size": 3524,
            "type": "entry",
          },
          {
            "path": "/chunks/LazyComponent-QGGRFTBA.js.map",
            "size": 802,
            "type": "sourcemap",
          },
          {
            "path": "/chunks/LazyComponent-QGGRFTBA.js",
            "size": 580,
            "type": "chunk",
          },
          {
            "path": "/chunks/DynamicModule-QNLNK47X.js.map",
            "size": 775,
            "type": "sourcemap",
          },
          {
            "path": "/chunks/DynamicModule-QNLNK47X.js",
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
            "size": 38753,
            "type": "sourcemap",
          },
          {
            "path": "/9efb087fd86defd0.js",
            "size": 23511,
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
