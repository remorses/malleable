import { describe, it, expect } from 'vitest'
import type { BundleResult, BundleSuccessResult } from './types.js'
import { evaluateBundleExportsWithDeno } from './test-utils.js'
import { app } from './worker.js'

const useProd = !process.env.USE_LOCAL
const WORKER_URL = useProd
  ? 'https://remote-bundler.fumabase.com'
  : 'http://localhost'

if (useProd) {
  console.log(`using prod url`, WORKER_URL)
}

const DEFAULT_EXTERNAL_PACKAGES = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]

// Mock KV namespace for local testing
const mockKVNamespace = {
  put: async (key: string, value: string, options?: any) => {
    // Mock implementation - just return void
  },
  get: async (key: string) => {
    // Mock implementation - return null
    return null
  },
  getWithMetadata: async (key: string) => {
    // Mock implementation - return empty object
    return { value: null, metadata: null }
  },
}

const fetchImplementation = useProd
  ? fetch
  : async (url: string | Request, init?: RequestInit) => {
      // For local testing, use app.handle directly
      const request = typeof url === 'string' ? new Request(url, init) : url

      return await app.handle(request, {
        state: {
          jsCache: mockKVNamespace as any,
          BUN_CONTAINER: {} as any, // Mock container namespace for tests
        },
      } as any)
    }

describe('Remote Bundler Worker', () => {
  it('should transform TSX code with React and generate Tailwind CSS', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'app.tsx',
            content:
              'const App = () => <div className="p-4 bg-blue-500 text-white">Hello</div>; export default App;',
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    })

    if (!response.ok) throw new Error(await response.text())
    const result = (await response.json()) as BundleResult
    const serverTiming = response.headers.get('Server-Timing')
    expect(serverTiming).toMatchInlineSnapshot(
      `"import-esbuild;dur=0, esbuild-init;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=101, total;dur=101, cfL4;desc="?proto=TCP&rtt=13775&min_rtt=13717&rtt_var=5261&sent=4&recv=5&lost=0&retrans=0&sent_bytes=2856&recv_bytes=998&delivery_rate=203017&cwnd=251&unsent_bytes=0&cid=035309d24dd76906&ts=1412&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-9cjwu/index.js": "https://remote-bundler.fumabase.com/bundle/test-9cjwu/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-9cjwu/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-9cjwu/index.js",
        "rawOutputs": [
          {
            "path": "/test-9cjwu/index.js",
            "size": 786,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `)

    // Fetch and verify the JS output
    if (result.success && result.jsUrl) {
      const jsResponse = await fetchImplementation(result.jsUrl)
      const jsContent = await jsResponse.text()
      await expect(jsContent).toMatchFileSnapshot(
        './snapshots/simple-tsx-output.js',
      )
    }
  })

  it('should extract Tailwind classes with hover and responsive modifiers', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'button.tsx',
            content:
              'const Button = () => <button className="xxx p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6">Click</button>; export default Button;',
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    })

    if (!response.ok) throw new Error(await response.text())
    const result = (await response.json()) as BundleSuccessResult
    const serverTiming = response.headers.get('Server-Timing')
    expect(serverTiming).toMatchInlineSnapshot(
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=76, total;dur=76, cfL4;desc="?proto=TCP&rtt=14057&min_rtt=13717&rtt_var=3501&sent=12&recv=9&lost=0&retrans=0&sent_bytes=6208&recv_bytes=1795&delivery_rate=305710&cwnd=257&unsent_bytes=0&cid=035309d24dd76906&ts=2022&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-fduxeg/index.js": "https://remote-bundler.fumabase.com/bundle/test-fduxeg/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-fduxeg/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-fduxeg/index.js",
        "rawOutputs": [
          {
            "path": "/test-fduxeg/index.js",
            "size": 834,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `)
    expect(
      await fetchImplementation(result.jsUrl).then((x) => x.text()),
    ).toMatchFileSnapshot('snapshots/commonjs-issue.js')
  })

  it('should handle template literals with conditional classes', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'card.tsx',
            content: `const Card = ({ isActive }) => {
          const baseClass = "p-6 rounded-xl shadow-lg";
          return <div className={\`\${baseClass} \${isActive ? "bg-green-500" : "bg-gray-200"}\`}>Content</div>;
        }; export default Card;`,
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    })

    if (!response.ok) throw new Error(await response.text())
    const result = (await response.json()) as BundleResult
    const serverTiming = response.headers.get('Server-Timing')
    expect(serverTiming).toMatchInlineSnapshot(
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=82, total;dur=82, cfL4;desc="?proto=TCP&rtt=21280&min_rtt=13717&rtt_var=15936&sent=21&recv=14&lost=0&retrans=1&sent_bytes=9125&recv_bytes=2692&delivery_rate=305710&cwnd=257&unsent_bytes=0&cid=035309d24dd76906&ts=2686&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-xo6iw9/index.js": "https://remote-bundler.fumabase.com/bundle/test-xo6iw9/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-xo6iw9/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-xo6iw9/index.js",
        "rawOutputs": [
          {
            "path": "/test-xo6iw9/index.js",
            "size": 899,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `)
  })

  it(
    'should resolve npm imports when resolveImports is true',
    async () => {
      const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
          files: [
            {
              path: 'app.tsx',
              content: `import { format } from 'date-fns';
              const App = () => <div className="text-lg font-bold">{format(new Date(), 'yyyy-MM-dd')}</div>;
              export default App
              `,
            },
          ],
          externalPackages: DEFAULT_EXTERNAL_PACKAGES,
        }),
      })

      if (!response.ok) throw new Error(await response.text())
      const result = (await response.json()) as BundleResult
      const serverTiming = response.headers.get('Server-Timing')
      expect(serverTiming).toMatchInlineSnapshot(
        `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=707, parallel-build;dur=707, html-generation;dur=0, kv-storage;dur=300, total;dur=1007, cfL4;desc="?proto=TCP&rtt=20439&min_rtt=13717&rtt_var=13633&sent=25&recv=16&lost=0&retrans=1&sent_bytes=10500&recv_bytes=3311&delivery_rate=305710&cwnd=257&unsent_bytes=0&cid=035309d24dd76906&ts=5038&x=0""`,
      )
      expect(result.success).toMatchInlineSnapshot(`true`)
    },
    { timeout: 60000 },
  )

  it('should handle missing code parameter', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [],
      }),
    })

    const result = (await response.json()) as BundleResult
    const serverTiming = response.headers.get('Server-Timing')
    expect(serverTiming).toMatchInlineSnapshot(
      `"cfL4;desc="?proto=TCP&rtt=19708&min_rtt=13717&rtt_var=11687&sent=29&recv=18&lost=0&retrans=1&sent_bytes=11895&recv_bytes=3617&delivery_rate=305710&cwnd=257&unsent_bytes=0&cid=035309d24dd76906&ts=5071&x=0""`,
    )
    expect(response.status).toMatchInlineSnapshot(`400`)
    expect(result).toMatchInlineSnapshot(`
      {
        "error": "No files provided",
        "success": false,
      }
    `)
  })

  it('should handle complex Tailwind utilities including gradients and animations', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'hero.tsx',
            content: `const Hero = () => (
          <div className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text">Gradient Text</h1>
          </div>
        ); export default Hero;`,
          },
        ],
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    })

    if (!response.ok) throw new Error(await response.text())
    const result = (await response.json()) as BundleResult
    const serverTiming = response.headers.get('Server-Timing')
    expect(serverTiming).toMatchInlineSnapshot(
      `"import-esbuild;dur=0, esbuild-init;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=104, total;dur=104, cfL4;desc="?proto=TCP&rtt=14123&min_rtt=13808&rtt_var=5403&sent=3&recv=5&lost=0&retrans=0&sent_bytes=234&recv_bytes=1474&delivery_rate=104287&cwnd=250&unsent_bytes=0&cid=036c16a9b2a0cc27&ts=1006&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-je8mt/index.js": "https://remote-bundler.fumabase.com/bundle/test-je8mt/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-je8mt/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-je8mt/index.js",
        "rawOutputs": [
          {
            "path": "/test-je8mt/index.js",
            "size": 975,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `)
  })

  it('should handle OPTIONS request for CORS preflight', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })

    if (!response.ok) throw new Error(await response.text())
    expect(response.status).toBe(200)
    expect(
      response.headers.get('Access-Control-Allow-Origin'),
    ).toMatchInlineSnapshot(`"*"`)
    expect(
      response.headers.get('Access-Control-Allow-Methods'),
    ).toMatchInlineSnapshot(`"OPTIONS, GET, POST, PUT, PATCH, DELETE"`)
    expect(
      response.headers.get('Access-Control-Allow-Headers'),
    ).toMatchInlineSnapshot(`"*"`)
  })

  it('should handle multiple input files with imports between them', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'utils.ts',
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
            path: 'components/Button.tsx',
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
            path: 'app.tsx',
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
        entryPoint: 'app.tsx',
        // No external packages so it can be evaluated with Deno
      }),
    })

    if (!response.ok) throw new Error(await response.text())
    const result = (await response.json()) as BundleResult
    const serverTiming = response.headers.get('Server-Timing')
    expect(serverTiming).toMatchInlineSnapshot(
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=50, parallel-build;dur=50, html-generation;dur=0, kv-storage;dur=73, total;dur=123, cfL4;desc="?proto=TCP&rtt=14089&min_rtt=13801&rtt_var=4120&sent=9&recv=9&lost=0&retrans=0&sent_bytes=2075&recv_bytes=4318&delivery_rate=311890&cwnd=253&unsent_bytes=0&cid=036c16a9b2a0cc27&ts=1555&x=0""`,
    )

    if (result.success) {
      expect(result.jsUrl).toBeDefined()
      expect(result.files).toBeDefined()

      // Check that multiple files were processed
      expect(result.rawOutputs).toBeDefined()
      expect(result.rawOutputs.length).toBeGreaterThan(0)

      // Evaluate with Deno to verify the bundle works
      const exports = await evaluateBundleExportsWithDeno(result.jsUrl)

      expect(exports).toMatchInlineSnapshot(`
        [
          "default",
        ]
      `)
    }

    // Verify the output contains expected content
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-nk1bz9/index.js": "https://remote-bundler.fumabase.com/bundle/test-nk1bz9/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-nk1bz9/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-nk1bz9/index.js",
        "rawOutputs": [
          {
            "path": "/test-nk1bz9/index.js",
            "size": 15976,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `)

    // Fetch and verify the JS output
    if (result.success && result.jsUrl) {
      const jsResponse = await fetchImplementation(result.jsUrl)
      const jsContent = await jsResponse.text()
      await expect(jsContent).toMatchFileSnapshot(
        './snapshots/multiple-files-output.js',
      )
    }
  })

  it('should handle dynamic imports and React.lazy with code splitting', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'LazyComponent.tsx',
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
            path: 'DynamicModule.ts',
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
            path: 'app.tsx',
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
        entryPoint: 'app.tsx',
        externalPackages: DEFAULT_EXTERNAL_PACKAGES,
      }),
    })

    if (!response.ok) throw new Error(await response.text())
    const result = (await response.json()) as BundleResult

    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-tln21n/chunks/DynamicModule-5NLYDKFO.js": "https://remote-bundler.fumabase.com/bundle/test-tln21n/chunks/DynamicModule-5NLYDKFO.js",
          "test-tln21n/chunks/LazyComponent-QWYJ2LE2.js": "https://remote-bundler.fumabase.com/bundle/test-tln21n/chunks/LazyComponent-QWYJ2LE2.js",
          "test-tln21n/index.js": "https://remote-bundler.fumabase.com/bundle/test-tln21n/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-tln21n/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-tln21n/index.js",
        "rawOutputs": [
          {
            "path": "/test-tln21n/index.js",
            "size": 2301,
            "type": "entry",
          },
          {
            "path": "/test-tln21n/chunks/LazyComponent-QWYJ2LE2.js",
            "size": 524,
            "type": "chunk",
          },
          {
            "path": "/test-tln21n/chunks/DynamicModule-5NLYDKFO.js",
            "size": 346,
            "type": "chunk",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `)

    const serverTiming = response.headers.get('Server-Timing')
    expect(serverTiming).toMatchInlineSnapshot(
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=134, total;dur=134, cfL4;desc="?proto=TCP&rtt=17281&min_rtt=13683&rtt_var=6853&sent=40&recv=29&lost=0&retrans=1&sent_bytes=20100&recv_bytes=7842&delivery_rate=587275&cwnd=257&unsent_bytes=0&cid=035309d24dd76906&ts=7839&x=0""`,
    )

    if (result.success) {
      // Check if multiple files were generated (main bundle + chunks)
      const fileCount = Object.keys(result.files).length
      console.log('Generated files:', Object.keys(result.files))

      // We expect at least the main JS file and its source map
      expect(fileCount).toBeGreaterThanOrEqual(2)

      // Check raw outputs for chunks
      const hasChunks = result.rawOutputs.some(
        (output) => output.type === 'chunk',
      )
      console.log('Has chunks:', hasChunks)
      console.log(
        'Raw outputs:',
        result.rawOutputs.map((o) => ({ path: o.path, type: o.type })),
      )

      // Skip Deno evaluation for this test since React is external
      // The bundle successfully demonstrates code splitting with chunks
    }

    // Fetch and verify the main JS output
    if (result.success && result.jsUrl) {
      const jsResponse = await fetchImplementation(result.jsUrl)
      const jsContent = await jsResponse.text()
      await expect(jsContent).toMatchFileSnapshot(
        './snapshots/dynamic-imports-output.js',
      )
    }
  })

  it('should execute bundled code with Deno', async () => {
    // First, bundle a React component
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'app.tsx',
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
    })

    if (!response.ok) throw new Error(await response.text())
    const result = (await response.json()) as BundleResult
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-95e4cn/index.js": "https://remote-bundler.fumabase.com/bundle/test-95e4cn/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-95e4cn/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-95e4cn/index.js",
        "rawOutputs": [
          {
            "path": "/test-95e4cn/index.js",
            "size": 14546,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `)

    // Execute the bundled code using Deno and check the exports
    if (!result.success) {
      throw new Error('Bundle failed')
    }

    const exports = await evaluateBundleExportsWithDeno(result.jsUrl)
    expect(exports).toMatchInlineSnapshot(`
      [
        "add",
        "default",
        "multiply",
      ]
    `)
  })

  it('should return formatted error for syntax errors', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'app.tsx',
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
    })

    const result = (await response.json()) as BundleResult
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
    `)
  })

  it('should return formatted error for non-existent npm package', async () => {
    const response = await fetchImplementation(`${WORKER_URL}/api/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: "test-" + Math.random().toString(36).substring(7),
        files: [
          {
            path: 'app.tsx',
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
    })

    const result = (await response.json()) as BundleResult

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
    `)
  })
})
