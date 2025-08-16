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
      `"import-esbuild;dur=0, esbuild-init;dur=0, parse-body;dur=1, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=92, total;dur=93, cfL4;desc="?proto=TCP&rtt=21361&min_rtt=20730&rtt_var=9035&sent=4&recv=5&lost=0&retrans=0&sent_bytes=2855&recv_bytes=999&delivery_rate=112343&cwnd=251&unsent_bytes=0&cid=b20f1c37f8d0bba9&ts=924&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-hcf0ei/index.js": "https://remote-bundler.fumabase.com/bundle/test-hcf0ei/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-hcf0ei/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-hcf0ei/index.js",
        "rawOutputs": [
          {
            "path": "/test-hcf0ei/index.js",
            "size": 787,
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
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=85, total;dur=85, cfL4;desc="?proto=TCP&rtt=22391&min_rtt=20730&rtt_var=5452&sent=13&recv=10&lost=0&retrans=0&sent_bytes=6231&recv_bytes=1797&delivery_rate=248253&cwnd=256&unsent_bytes=0&cid=b20f1c37f8d0bba9&ts=1426&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-7uif5d/index.js": "https://remote-bundler.fumabase.com/bundle/test-7uif5d/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-7uif5d/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-7uif5d/index.js",
        "rawOutputs": [
          {
            "path": "/test-7uif5d/index.js",
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
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=80, total;dur=80, cfL4;desc="?proto=TCP&rtt=23017&min_rtt=20730&rtt_var=4303&sent=21&recv=14&lost=0&retrans=0&sent_bytes=9118&recv_bytes=2694&delivery_rate=248253&cwnd=256&unsent_bytes=0&cid=b20f1c37f8d0bba9&ts=1890&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-e6pw9l/index.js": "https://remote-bundler.fumabase.com/bundle/test-e6pw9l/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-e6pw9l/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-e6pw9l/index.js",
        "rawOutputs": [
          {
            "path": "/test-e6pw9l/index.js",
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
        `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=2179, parallel-build;dur=2179, html-generation;dur=0, kv-storage;dur=76, total;dur=2255, cfL4;desc="?proto=TCP&rtt=31890&min_rtt=20730&rtt_var=20973&sent=27&recv=17&lost=0&retrans=1&sent_bytes=10544&recv_bytes=3313&delivery_rate=248253&cwnd=256&unsent_bytes=0&cid=b20f1c37f8d0bba9&ts=4746&x=0""`,
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
      `"cfL4;desc="?proto=TCP&rtt=41904&min_rtt=20730&rtt_var=35757&sent=31&recv=20&lost=0&retrans=2&sent_bytes=11924&recv_bytes=3618&delivery_rate=248253&cwnd=256&unsent_bytes=0&cid=b20f1c37f8d0bba9&ts=4878&x=0""`,
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
      `"import-esbuild;dur=0, esbuild-init;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=90, total;dur=90, cfL4;desc="?proto=TCP&rtt=21129&min_rtt=20467&rtt_var=8999&sent=3&recv=5&lost=0&retrans=0&sent_bytes=234&recv_bytes=1475&delivery_rate=56200&cwnd=250&unsent_bytes=0&cid=f478f0ea6eb047ef&ts=1024&x=0""`,
    )
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "test-rnjb6t/index.js": "https://remote-bundler.fumabase.com/bundle/test-rnjb6t/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-rnjb6t/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-rnjb6t/index.js",
        "rawOutputs": [
          {
            "path": "/test-rnjb6t/index.js",
            "size": 976,
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
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=352, parallel-build;dur=352, html-generation;dur=0, kv-storage;dur=70, total;dur=422, cfL4;desc="?proto=TCP&rtt=21546&min_rtt=20467&rtt_var=7585&sent=9&recv=9&lost=0&retrans=0&sent_bytes=2082&recv_bytes=4319&delivery_rate=177523&cwnd=253&unsent_bytes=0&cid=f478f0ea6eb047ef&ts=1818&x=0""`,
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
          "test-n0bjfi/index.js": "https://remote-bundler.fumabase.com/bundle/test-n0bjfi/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-n0bjfi/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-n0bjfi/index.js",
        "rawOutputs": [
          {
            "path": "/test-n0bjfi/index.js",
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
          "test-gwm6pe/chunks/DynamicModule-5NLYDKFO.js": "https://remote-bundler.fumabase.com/bundle/test-gwm6pe/chunks/DynamicModule-5NLYDKFO.js",
          "test-gwm6pe/chunks/LazyComponent-QWYJ2LE2.js": "https://remote-bundler.fumabase.com/bundle/test-gwm6pe/chunks/LazyComponent-QWYJ2LE2.js",
          "test-gwm6pe/index.js": "https://remote-bundler.fumabase.com/bundle/test-gwm6pe/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-gwm6pe/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-gwm6pe/index.js",
        "rawOutputs": [
          {
            "path": "/test-gwm6pe/index.js",
            "size": 2301,
            "type": "entry",
          },
          {
            "path": "/test-gwm6pe/chunks/LazyComponent-QWYJ2LE2.js",
            "size": 524,
            "type": "chunk",
          },
          {
            "path": "/test-gwm6pe/chunks/DynamicModule-5NLYDKFO.js",
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
      `"import-esbuild;dur=0, parse-body;dur=0, tailwind-css;dur=0, esbuild-build;dur=0, parallel-build;dur=0, html-generation;dur=0, kv-storage;dur=90, total;dur=90, cfL4;desc="?proto=TCP&rtt=34634&min_rtt=20713&rtt_var=20478&sent=41&recv=30&lost=0&retrans=2&sent_bytes=20133&recv_bytes=7843&delivery_rate=333205&cwnd=256&unsent_bytes=0&cid=b20f1c37f8d0bba9&ts=7865&x=0""`,
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
          "test-r0tbbj/index.js": "https://remote-bundler.fumabase.com/bundle/test-r0tbbj/index.js",
        },
        "htmlUrl": "https://remote-bundler.fumabase.com/bundle/test-r0tbbj/index.html",
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/test-r0tbbj/index.js",
        "rawOutputs": [
          {
            "path": "/test-r0tbbj/index.js",
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
