import { describe, it, expect } from "vitest";
import type { BundleResult, BundleSuccessResult } from "./types.js";
import { evaluateBundleExportsWithDeno } from "./test-utils.js";
import { app } from "./worker.js";


const useProd = process.env.USE_PROD
const WORKER_URL = useProd
  ? "https://remote-bundler.fumabase.com"
  : "http://localhost";

if (useProd) {
  console.log(`using prod url`, WORKER_URL);
}

const DEFAULT_EXTERNAL_PACKAGES = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

// Mock KV namespace for local testing
const mockKVNamespace = {
  put: async (key: string, value: string, options?: any) => {
    // Mock implementation - just return void
  },
  get: async (key: string) => {
    // Mock implementation - return null
    return null;
  },
  getWithMetadata: async (key: string) => {
    // Mock implementation - return empty object
    return { value: null, metadata: null };
  },
};

const fetchImplementation = useProd
  ? fetch
  : async (url: string | Request, init?: RequestInit) => {
      // For local testing, use app.handle directly
      const request = typeof url === "string" ? new Request(url, init) : url;

      return await app.handle(request, {
        state: {
          jsCache: mockKVNamespace as any,
          BUN_CONTAINER: {} as any, // Mock container namespace for tests
        }
      } as any);
    };



describe("Remote Bundler Worker", () => {
  it("should transform TSX code with React and generate Tailwind CSS", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "app.tsx",
            content:
              'const App = () => <div className="p-4 bg-blue-500 text-white">Hello</div>; export default App;',
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as BundleResult;
    const serverTiming = response.headers.get("Server-Timing");
    expect(serverTiming).toMatchInlineSnapshot(
      `"esbuild-init;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=30007&min_rtt=14545&rtt_var=16156&sent=5&recv=6&lost=0&retrans=0&sent_bytes=2856&recv_bytes=976&delivery_rate=198006&cwnd=244&unsent_bytes=0&cid=1f921c3969427439&ts=1033&x=0""`,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "3585043d56339b0a.js": "https://remote-bundler.fumabase.com/bundle/3585043d56339b0a.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/3585043d56339b0a.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/3585043d56339b0a.js",
        "rawOutputs": [
          {
            "path": "/3585043d56339b0a.js",
            "size": 1952,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);

    // Fetch and verify the JS output
    if (result.success && result.jsUrl) {
      const jsResponse = await fetchImplementation(result.jsUrl);
      const jsContent = await jsResponse.text();
      await expect(jsContent).toMatchFileSnapshot(
        "./snapshots/simple-tsx-output.js",
      );
    }
  });

  it("should extract Tailwind classes with hover and responsive modifiers", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "button.tsx",
            content:
              'const Button = () => <button className="xxx p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6">Click</button>; export default Button;',
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as BundleSuccessResult;
    const serverTiming = response.headers.get("Server-Timing");
    expect(serverTiming).toMatchInlineSnapshot(
      `"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=26397&min_rtt=14395&rtt_var=15335&sent=13&recv=10&lost=0&retrans=0&sent_bytes=6491&recv_bytes=1750&delivery_rate=299086&cwnd=250&unsent_bytes=0&cid=1f921c3969427439&ts=1500&x=0""`,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "0560b17ccb7f158e.js": "https://remote-bundler.fumabase.com/bundle/0560b17ccb7f158e.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/0560b17ccb7f158e.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/0560b17ccb7f158e.js",
        "rawOutputs": [
          {
            "path": "/0560b17ccb7f158e.js",
            "size": 1999,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
    expect(await fetchImplementation(result.jsUrl).then(x => x.text())).toMatchFileSnapshot('snapshots/commonjs-issue.js')
  });

  it("should handle template literals with conditional classes", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "card.tsx",
            content: `const Card = ({ isActive }) => {
          const baseClass = "p-6 rounded-xl shadow-lg";
          return <div className={\`\${baseClass} \${isActive ? "bg-green-500" : "bg-gray-200"}\`}>Content</div>;
        }; export default Card;`,
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as BundleResult;
    const serverTiming = response.headers.get("Server-Timing");
    expect(serverTiming).toMatchInlineSnapshot(
      `"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=23868&min_rtt=14395&rtt_var=12972&sent=21&recv=14&lost=0&retrans=0&sent_bytes=9669&recv_bytes=2623&delivery_rate=356965&cwnd=250&unsent_bytes=0&cid=1f921c3969427439&ts=1960&x=0""`,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "71a5d3cf45f8c9cd.js": "https://remote-bundler.fumabase.com/bundle/71a5d3cf45f8c9cd.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/71a5d3cf45f8c9cd.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/71a5d3cf45f8c9cd.js",
        "rawOutputs": [
          {
            "path": "/71a5d3cf45f8c9cd.js",
            "size": 2064,
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
      const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              path: "app.tsx",
              content: `import { format } from 'date-fns';
              const App = () => <div className="text-lg font-bold">{format(new Date(), 'yyyy-MM-dd')}</div>;
              export default App
              `,
            },
          ],
          externalPackages: DEFAULT_EXTERNAL_PACKAGES,
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      const result = (await response.json()) as BundleResult;
      const serverTiming = response.headers.get("Server-Timing");
      expect(serverTiming).toMatchInlineSnapshot(
        `"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=539, parallel-build;dur=539, total;dur=539, cfL4;desc="?proto=TCP&rtt=22730&min_rtt=14395&rtt_var=12004&sent=24&recv=16&lost=0&retrans=0&sent_bytes=10951&recv_bytes=3219&delivery_rate=356965&cwnd=250&unsent_bytes=0&cid=1f921c3969427439&ts=3605&x=0""`,
      );
      expect(result.success).toMatchInlineSnapshot(`true`);
    },
    { timeout: 60000 },
  );

  it("should handle missing code parameter", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [],
      }),
    });

    const result = (await response.json()) as BundleResult;
    const serverTiming = response.headers.get("Server-Timing");
    expect(serverTiming).toMatchInlineSnapshot(`"cfL4;desc="?proto=TCP&rtt=27514&min_rtt=14395&rtt_var=18571&sent=29&recv=19&lost=0&retrans=1&sent_bytes=12295&recv_bytes=3502&delivery_rate=356965&cwnd=250&unsent_bytes=0&cid=1f921c3969427439&ts=3685&x=0""`);
    expect(response.status).toMatchInlineSnapshot(`400`);
    expect(result).toMatchInlineSnapshot(`
      {
        "error": "No files provided",
        "success": false,
      }
    `);
  });

  it("should handle complex Tailwind utilities including gradients and animations", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "hero.tsx",
            content: `const Hero = () => (
          <div className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text">Gradient Text</h1>
          </div>
        ); export default Hero;`,
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as BundleResult;
    const serverTiming = response.headers.get("Server-Timing");
    expect(serverTiming).toMatchInlineSnapshot(
      `"esbuild-init;dur=0, parse-body;dur=1, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=1, cfL4;desc="?proto=TCP&rtt=14092&min_rtt=13988&rtt_var=5454&sent=3&recv=5&lost=0&retrans=0&sent_bytes=234&recv_bytes=1452&delivery_rate=97152&cwnd=250&unsent_bytes=0&cid=0772bed043071de3&ts=1710&x=0""`,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "69020c56b7576729.js": "https://remote-bundler.fumabase.com/bundle/69020c56b7576729.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/69020c56b7576729.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/69020c56b7576729.js",
        "rawOutputs": [
          {
            "path": "/69020c56b7576729.js",
            "size": 2141,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should handle OPTIONS request for CORS preflight", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    if (!response.ok) throw new Error(await response.text());
    expect(response.status).toBe(200);
    expect(
      response.headers.get("Access-Control-Allow-Origin"),
    ).toMatchInlineSnapshot(`"*"`);
    expect(
      response.headers.get("Access-Control-Allow-Methods"),
    ).toMatchInlineSnapshot(`"OPTIONS, GET, POST, PUT, PATCH, DELETE"`);
    expect(
      response.headers.get("Access-Control-Allow-Headers"),
    ).toMatchInlineSnapshot(`"*"`);
  });

  it("should handle multiple input files with imports between them", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
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
            `,
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
            `,
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
            `,
          },
        ],
        entryPoint: "app.tsx",
        // No external packages so it can be evaluated with Deno
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as BundleResult;
    const serverTiming = response.headers.get("Server-Timing");
    expect(serverTiming).toMatchInlineSnapshot(
      `"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=102, parallel-build;dur=102, total;dur=102, cfL4;desc="?proto=TCP&rtt=14101&min_rtt=13988&rtt_var=4109&sent=9&recv=9&lost=0&retrans=0&sent_bytes=2025&recv_bytes=4273&delivery_rate=304934&cwnd=253&unsent_bytes=0&cid=0772bed043071de3&ts=2567&x=0""`,
    );

    if (result.success) {
      expect(result.jsUrl).toBeDefined();
      expect(result.files).toBeDefined();

      // Check that multiple files were processed
      expect(result.rawOutputs).toBeDefined();
      expect(result.rawOutputs.length).toBeGreaterThan(0);

      // Evaluate with Deno to verify the bundle works
      const exports = await evaluateBundleExportsWithDeno(result.jsUrl);

      expect(exports).toMatchInlineSnapshot(`
        [
          "default",
        ]
      `);
    }

    // Verify the output contains expected content
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "c9025520583ffc11.js": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/c9025520583ffc11.js",
        "rawOutputs": [
          {
            "path": "/c9025520583ffc11.js",
            "size": 24897,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);

    // Fetch and verify the JS output
    if (result.success && result.jsUrl) {
      const jsResponse = await fetchImplementation(result.jsUrl);
      const jsContent = await jsResponse.text();
      await expect(jsContent).toMatchFileSnapshot(
        "./snapshots/multiple-files-output.js",
      );
    }
  });

  it("should handle dynamic imports and React.lazy with code splitting", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
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
            `,
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
            `,
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
            `,
          },
        ],
        entryPoint: "app.tsx",
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as BundleResult;

    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "6bad1d1e32f23fb9.js": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.js",
          "chunks/DynamicModule-637SF6U4.js": "https://remote-bundler.fumabase.com/bundle/chunks/DynamicModule-637SF6U4.js",
          "chunks/LazyComponent-BHKR2BZZ.js": "https://remote-bundler.fumabase.com/bundle/chunks/LazyComponent-BHKR2BZZ.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/6bad1d1e32f23fb9.js",
        "rawOutputs": [
          {
            "path": "/6bad1d1e32f23fb9.js",
            "size": 3482,
            "type": "entry",
          },
          {
            "path": "/chunks/LazyComponent-BHKR2BZZ.js",
            "size": 524,
            "type": "chunk",
          },
          {
            "path": "/chunks/DynamicModule-637SF6U4.js",
            "size": 346,
            "type": "chunk",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);

    const serverTiming = response.headers.get("Server-Timing");
    expect(serverTiming).toMatchInlineSnapshot(
      `"parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, total;dur=0, cfL4;desc="?proto=TCP&rtt=23517&min_rtt=14395&rtt_var=13771&sent=40&recv=28&lost=0&retrans=1&sent_bytes=22810&recv_bytes=7703&delivery_rate=621838&cwnd=250&unsent_bytes=0&cid=1f921c3969427439&ts=6919&x=0""`,
    );

    if (result.success) {
      // Check if multiple files were generated (main bundle + chunks)
      const fileCount = Object.keys(result.files).length;
      console.log("Generated files:", Object.keys(result.files));

      // We expect at least the main JS file and its source map
      expect(fileCount).toBeGreaterThanOrEqual(2);

      // Check raw outputs for chunks
      const hasChunks = result.rawOutputs.some(
        (output) => output.type === "chunk",
      );
      console.log("Has chunks:", hasChunks);
      console.log(
        "Raw outputs:",
        result.rawOutputs.map((o) => ({ path: o.path, type: o.type })),
      );

      // Skip Deno evaluation for this test since React is external
      // The bundle successfully demonstrates code splitting with chunks
    }

    // Fetch and verify the main JS output
    if (result.success && result.jsUrl) {
      const jsResponse = await fetchImplementation(result.jsUrl);
      const jsContent = await jsResponse.text();
      await expect(jsContent).toMatchFileSnapshot(
        "./snapshots/dynamic-imports-output.js",
      );
    }
  });

  it("should execute bundled code with Deno", async () => {
    // First, bundle a React component
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "app.tsx",
            content: `
            import React from 'react';

            export const add = (a, b) => a + b;
            export const multiply = (a, b) => a * b;

            const App = ({ name = "World" }) => {
              return <div className="p-4">Hello {name}!</div>;
            };

            export default App;
          `,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "9efb087fd86defd0.js": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js",
        "rawOutputs": [
          {
            "path": "/9efb087fd86defd0.js",
            "size": 23467,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);

    // Execute the bundled code using Deno and check the exports
    if (!result.success) {
      throw new Error("Bundle failed");
    }

    const exports = await evaluateBundleExportsWithDeno(result.jsUrl);
    expect(exports).toMatchInlineSnapshot(`
      [
        "add",
        "default",
        "multiply",
      ]
    `);
  });

  it("should return formatted error for syntax errors", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
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
            export default App
          `,
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    });

    const result = (await response.json()) as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "error": "Build failed with 1 error:
      local:/app.tsx:11:12: ERROR: Unexpected "export"",
        "errorText": "✘ [ERROR] Unexpected "export"

          local:/app.tsx:11:12:
            11 │             export default App
               ╵             ~~~~~~

      ",
        "success": false,
      }
    `);
  });

  it("should return formatted error for non-existent npm package", async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "app.tsx",
            content: `
            import { someFunction } from 'package-that-definitely-does-not-exist-12345';

            const App = () => {
              return <div>Hello {someFunction()}</div>;
            };

            export default App;
          `,
          },
        ],
        externalPackages: [], // Not marking as external so it tries to resolve
      }),
    });

    const result = (await response.json()) as BundleResult;

    expect(result).toMatchInlineSnapshot(`
      {
        "error": "Build failed with 1 error:
      local:/app.tsx:2:41: ERROR: [plugin: esm-sh-plugin] Failed to fetch https://esm.sh/package-that-definitely-does-not-exist-12345: 404 Not Found",
        "errorText": "✘ [ERROR] Failed to fetch https://esm.sh/package-that-definitely-does-not-exist-12345: 404 Not Found [plugin esm-sh-plugin]

          local:/app.tsx:2:41:
            2 │             import { someFunction } from 'package-that-definitely-does-not-exist-12345';
              ╵                                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

      ",
        "success": false,
      }
    `);
  });
});
