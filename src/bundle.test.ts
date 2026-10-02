// Bundler output (Rollup, esm.sh, Tailwind) through draft builds of one project.
// Runs against the deployed worker: deploy first (`pnpm deployment`).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { Project, type Session } from './client.ts'
import type { ProjectConfig } from './project-do.ts'

const endpoint = 'https://remote-bundler.fumabase.com'
const apiKey =
  process.env.MALLEABLE_API_KEY ??
  /MALLEABLE_API_KEY=(\S+)/.exec(readFileSync('.dev.vars', 'utf8'))![1]

const project = new Project({ endpoint, apiKey, id: `b-${Math.random().toString(36).slice(2, 10)}` })
let session: Session

beforeAll(async () => {
  await project.init()
  session = await project.openSession({ author: { kind: 'agent', id: 'bundle-test' } })
}, 60_000)

afterAll(() => session?.discard())

/**
 * Replaces the session sources with `files` and runs a draft build.
 * Returns the build errors, or the text of every output file plus the module url.
 */
async function bundle(files: Record<string, string>, config: Partial<ProjectConfig> = {}) {
  // missing config keys fall back to the defaults (entry App.tsx, React external)
  const next = { ...files, 'malleable.json': JSON.stringify(config) }
  const keep = new Set(Object.keys(next))
  const stale = (await session.list()).filter((p) => !keep.has(p))
  await session.apply({
    ops: [
      ...stale.map((path) => ({ op: 'delete' as const, path })),
      ...Object.entries(next).map(([path, content]) => ({ op: 'write' as const, path, content })),
    ],
  })
  const result = await session.build()
  if (!result.ok) return result
  const url = new URL(result.url, endpoint)
  const outputs: Record<string, string> = {}
  for (const path of result.files) outputs[path] = await (await fetch(new URL(path, url))).text()
  return { ...result, url: url.href, outputs }
}

async function bundleOk(...args: Parameters<typeof bundle>) {
  const result = await bundle(...args)
  if (!result.ok) throw new Error(result.errorText)
  return result
}

/** Top-level and nested class selectors of a stylesheet, in order */
const selectors = (css: string) => [...css.matchAll(/^\s*(\.[^\s{,]+)/gm)].map((m) => m[1])

/** Export names of a module, evaluated by Deno */
function exportsOf(url: string): string[] {
  const code = `import(${JSON.stringify(url)}).then(m => console.log(JSON.stringify(Object.keys(m))))`
  return JSON.parse(execFileSync('deno', ['eval', code], { encoding: 'utf8' }))
}

describe('bundle', { timeout: 60_000 }, () => {
  it('bundles TSX with React external and links the CSS next to the module', async () => {
    const r = await bundleOk({
      'App.tsx': 'const App = () => <div className="p-4 bg-blue-500 text-white">Hello</div>; export default App;',
    })
    expect(r.files).toMatchInlineSnapshot(`
      [
        "index.js",
        "index.css",
      ]
    `)
    await expect(r.outputs['index.js']).toMatchFileSnapshot('./snapshots/simple-tsx-output.js')
  })

  it('generates Tailwind for modifiers, template literals and gradients', async () => {
    const r = await bundleOk({
      'App.tsx': `
        const Card = ({ isActive }) => {
          const base = "p-6 rounded-xl shadow-lg";
          return <div className={\`\${base} \${isActive ? "bg-green-500" : "bg-gray-200"}\`}>Content</div>;
        };
        export default function App() {
          return (
            <div className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300">
              <button className="xxx p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6">Click</button>
              <Card isActive />
            </div>
          );
        }
      `,
    })
    expect(selectors(r.outputs['index.css'])).toMatchInlineSnapshot(`
      [
        ".animate-pulse",
        ".rounded-xl",
        ".bg-blue-500",
        ".bg-gray-200",
        ".bg-green-500",
        ".bg-gradient-to-r",
        ".from-purple-400",
        ".via-pink-500",
        ".to-red-500",
        ".p-4",
        ".p-6",
        ".text-white",
        ".shadow-lg",
        ".transition-all",
        ".duration-300",
        ".hover\\:bg-blue-600:hover",
        ".md\\:p-6",
      ]
    `)
  })

  it('runs imported CSS through Tailwind, with @apply', async () => {
    const r = await bundleOk({
      'App.tsx': `
        import './styles.css';
        export default function App() {
          return (
            <div className="container">
              <h1 className="text-4xl font-bold text-blue-600">Hello World</h1>
              <p className="mt-4 text-gray-700">This is a test component with CSS import</p>
            </div>
          );
        }
      `,
      'styles.css': `
        .container {
          @apply mx-auto px-4 py-8 max-w-4xl;
        }
        .custom-button {
          @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
        }
      `,
    })
    const css = r.outputs['index.css']
    expect(selectors(css)).toMatchInlineSnapshot(`
      [
        ".container",
        ".mx-auto",
        ".mt-4",
        ".max-w-4xl",
        ".rounded",
        ".bg-blue-500",
        ".px-4",
        ".py-2",
        ".py-8",
        ".text-4xl",
        ".font-bold",
        ".text-blue-600",
        ".text-gray-700",
        ".text-white",
        ".hover\\:bg-blue-700:hover",
        ".container",
        ".custom-button",
      ]
    `)
    expect(css.slice(css.lastIndexOf('.container {'), css.indexOf('@property'))).toMatchInlineSnapshot(`
      ".container {
        margin-inline: auto;
        max-width: var(--container-4xl);
        padding-inline: calc(var(--spacing) * 4);
        padding-block: calc(var(--spacing) * 8);
      }
      .custom-button {
        border-radius: 0.25rem;
        background-color: var(--color-blue-500);
        padding-inline: calc(var(--spacing) * 4);
        padding-block: calc(var(--spacing) * 2);
        --tw-font-weight: var(--font-weight-bold);
        font-weight: var(--font-weight-bold);
        color: var(--color-white);
        &:hover {
          @media (hover: hover) {
            background-color: var(--color-blue-700);
          }
        }
      }
      "
    `)
  })

  it('bundles relative imports and npm packages into a module Deno can run', async () => {
    const r = await bundleOk(
      {
        'utils.ts': `
          export const formatPrice = (price: number) =>
            new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
          export const truncateText = (text: string, maxLength: number) =>
            text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
        `,
        'components/Button.tsx': `
          export const Button = ({ children, variant = 'primary' }) => {
            const variantClasses = variant === 'primary'
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300";
            return <button className={\`px-4 py-2 rounded-lg \${variantClasses}\`}>{children}</button>;
          };
        `,
        'App.tsx': `
          import { format } from 'date-fns';
          import { Button } from './components/Button';
          import { formatPrice, truncateText } from './utils';
          export const add = (a: number, b: number) => a + b;
          export const today = () => format(new Date(0), 'yyyy-MM-dd');
          export default function App() {
            return (
              <div className="p-8 bg-gray-100">
                <p className="text-gray-600">{truncateText("A very long product description", 10)}</p>
                <p className="text-2xl text-green-600">{formatPrice(99.99)}</p>
                <Button>Buy</Button>
                <Button variant="secondary">Add to Cart</Button>
              </div>
            );
          }
        `,
      },
      // React is bundled from esm.sh too, so Deno can import the module without an import map
      { externalPackages: [] },
    )
    expect(r.files).toMatchInlineSnapshot(`
      [
        "index.js",
        "index.css",
      ]
    `)
    expect(exportsOf(r.url)).toMatchInlineSnapshot(`
      [
        "add",
        "default",
        "today",
      ]
    `)
  })

  it('splits dynamic imports and React.lazy into chunks', async () => {
    const r = await bundleOk({
      'LazyComponent.tsx': `
        export default function LazyComponent() {
          return <div className="p-8 bg-purple-500 text-white rounded-lg">Lazy Loaded Component</div>;
        }
      `,
      'DynamicModule.ts': `
        export const dynamicData = { message: "This is from a dynamically imported module" };
        export default function processDynamic(input: string) {
          return input.toUpperCase() + " - PROCESSED";
        }
      `,
      'App.tsx': `
        import { Suspense, lazy, useState } from 'react';
        const LazyComponent = lazy(() => import('./LazyComponent'));
        export async function loadDynamicData() {
          const module = await import('./DynamicModule');
          return module.dynamicData;
        }
        export default function App() {
          const [show, setShow] = useState(false);
          return (
            <div className="p-8 bg-gray-100">
              <button onClick={() => setShow(!show)} className="px-6 py-3 bg-blue-500 hover:bg-blue-600">Toggle</button>
              {show && <Suspense fallback={<div className="p-4 bg-gray-200">Loading...</div>}><LazyComponent /></Suspense>}
            </div>
          );
        }
      `,
    })
    expect(r.files).toMatchInlineSnapshot(`
      [
        "index.js",
        "chunks/LazyComponent-DIGiiDRE.js",
        "chunks/DynamicModule-DQFd5tIm.js",
        "index.css",
      ]
    `)
    await expect(r.outputs['index.js']).toMatchFileSnapshot('./snapshots/dynamic-imports-output.js')
  })

  it('reports syntax errors with a code frame', async () => {
    const r = await bundle({
      'App.tsx': `
        const App = () => {
          return (
            <div className="p-4">
              const x = ;
            </div>
          )
        export default App
      `,
    })
    expect(r).toMatchInlineSnapshot(`
      {
        "errorText": "✘ [ERROR] [plugin local-files] App.tsx (2:23): Unexpected token, expected ";"

          /App.tsx:2:23:
      1: 
      2:         const App = () => {
                                ^
      3:           return (
      4:             <div className="p-4">
      ",
        "errors": [
          {
            "file": "/App.tsx",
            "line": 2,
            "text": "[plugin local-files] App.tsx (2:23): Unexpected token, expected ";"",
          },
        ],
        "ok": false,
      }
    `)
  })

  it('reports npm packages that do not exist', async () => {
    const r = await bundle(
      {
        'App.tsx': `
          import { someFunction } from 'package-that-definitely-does-not-exist-12345';
          export default function App() { return <div>Hello {someFunction()}</div> }
        `,
      },
      { externalPackages: [] },
    )
    expect(r).toMatchInlineSnapshot(`
      {
        "errorText": "✘ [ERROR] Could not load https://esm.sh/package-that-definitely-does-not-exist-12345 (imported by App.tsx): Failed to fetch https://esm.sh/package-that-definitely-does-not-exist-12345: 404 Not Found
      ",
        "errors": [
          {
            "text": "Could not load https://esm.sh/package-that-definitely-does-not-exist-12345 (imported by App.tsx): Failed to fetch https://esm.sh/package-that-definitely-does-not-exist-12345: 404 Not Found",
          },
        ],
        "ok": false,
      }
    `)
  })
})
