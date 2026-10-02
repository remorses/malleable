import { rollup, type Plugin } from '@rollup/browser'
import commonjsImport from '@rollup/plugin-commonjs'
import path from 'path-browserify'
import { generateTailwindCSS, type TailwindOptions } from './generate-tailwind.js'
import {
  ENTRY_PATH,
  entryWrapperSource,
  esmShPlugin,
  localFilesPlugin,
} from './rollup-plugins.ts'

export interface BuildFile {
  path: string
  content: string
}

export interface BuildOutput {
  /** Path relative to the output dir, e.g. `index.js` or `chunks/a-HASH.js` */
  path: string
  text: string
}

/** Content-addressed cache. A miss or an error must never fail a build. */
export interface BuildCache {
  get(key: string): Promise<string | null>
  put(key: string, value: string, ttlSeconds: number): void
}

const CACHE_VERSION = 'v4'

/** KV-backed cache under the `cache:` prefix. */
export function createKvBuildCache(
  kv: KVNamespace,
  waitUntil: (promise: Promise<unknown>) => void,
): BuildCache {
  const prefixed = (key: string) => `cache:${CACHE_VERSION}:${key}`
  return {
    get: (key) => kv.get(prefixed(key)).catch(() => null),
    put: (key, value, ttlSeconds) =>
      waitUntil(
        kv
          .put(prefixed(key), value, { expirationTtl: Math.max(60, ttlSeconds) })
          .catch(() => {}),
      ),
  }
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Per-isolate layer in front of KV. Tailwind output is ~10-30KB, so keep it small.
const tailwindMemory = new Map<string, string>()
const TAILWIND_MEMORY_LIMIT = 50
const TAILWIND_TTL_SECONDS = 7 * 24 * 3600

/** Tailwind CSS keyed by the exact source and project CSS, so a hit is always correct. */
async function generateTailwindCached(
  code: string,
  options: Required<TailwindOptions>,
  cache?: BuildCache,
) {
  const input = JSON.stringify([code, options.userCss, [...options.cssFiles]])
  const key = `tw:${CACHE_VERSION}:${await sha256Hex(input)}`
  const hit = tailwindMemory.get(key) ?? (await cache?.get(key))
  if (hit != null) return hit
  const css = await generateTailwindCSS(code, options)
  if (tailwindMemory.size >= TAILWIND_MEMORY_LIMIT) {
    tailwindMemory.delete(tailwindMemory.keys().next().value!)
  }
  tailwindMemory.set(key, css)
  cache?.put(key, css, TAILWIND_TTL_SECONDS)
  return css
}

export interface BuildOptions {
  /** Optional shared cache for Tailwind output and CDN modules */
  cache?: BuildCache
  files: BuildFile[]
  entryPoint: string
  externalPackages: string[]
}

export interface BuildSuccess {
  ok: true
  outputs: BuildOutput[]
  css: string
}

export interface BuildFailure {
  ok: false
  /** Formatted bundler messages, no ANSI colors */
  errorText: string
  errors: Array<{ file?: string; line?: number; text: string }>
}

// TODO: drop patches/@rollup__browser.patch once @rollup/browser lets us pass the wasm module.
// workerd cannot compile wasm from bytes, so the patch reads a precompiled module from this
// global instead of fetching the file. https://github.com/rollup/rollup/issues/5722
// Lazy: vitest imports this module in Node, where a static .wasm import cannot load.
let wasmReady: Promise<void> | undefined
function loadRollupWasm() {
  wasmReady ??= import('../node_modules/@rollup/browser/dist/es/bindings_wasm_bg.wasm').then(
    (mod) => {
      ;(globalThis as any).__ROLLUP_WASM_MODULE__ = mod.default
    },
  )
  return wasmReady
}

// TODO: drop the casts once @rollup/plugin-commonjs types work with nodenext and @rollup/browser.
// Its .d.ts is read as CJS, and its Plugin type comes from the `rollup` package, not @rollup/browser.
const commonjs = commonjsImport as unknown as (
  options: Parameters<typeof commonjsImport.default>[0],
) => Plugin

const CODE_FILE = /\.(tsx?|jsx?|mjs|css|html)$/

function formatBuildError(error: any): BuildFailure {
  const message = String(error?.message || 'Build failed')
  const loc = error?.loc as { file?: string; line: number; column: number } | undefined
  const file = loc?.file ?? error?.id
  const where = loc ? `\n\n    ${file}:${loc.line}:${loc.column}:\n${error.frame ?? ''}` : ''
  return {
    ok: false,
    errorText: `✘ [ERROR] ${message}${where}\n`,
    errors: [{ file, line: loc?.line, text: message }],
  }
}

/** Bundle a set of files with Rollup and generate Tailwind CSS. Never throws on build errors. */
export async function buildFiles(
  options: BuildOptions,
): Promise<BuildSuccess | BuildFailure> {
  const { files, entryPoint, externalPackages, cache } = options

  const allCode = files
    .filter((f) => CODE_FILE.test(f.path))
    .map((f) => f.content)
    .join('\n')

  try {
    await loadRollupWasm()
    const bundle = await rollup({
      input: ENTRY_PATH,
      plugins: [
        localFilesPlugin({
          files: [...files, { path: ENTRY_PATH, content: entryWrapperSource(entryPoint) }],
          entry: ENTRY_PATH,
        }),
        // local files only; CDN modules are already ESM
        commonjs({ include: /^\/[^?]*\.c?js$/ }),
        esmShPlugin({ externalPackages, cache }),
      ],
      // warnings are not shown to users; CDN modules emit many of them
      onwarn: () => {},
    })
    const output = await bundle
      .generate({
        format: 'es',
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      })
      .then((r) => r.output)
      .finally(() => bundle.close())

    const all = output.map((o) => ({
      path: o.fileName,
      text: o.type === 'chunk' ? o.code : String(o.source),
    }))
    // Imported CSS goes through Tailwind too, so @apply and @import work
    const importedCss = all.find((o) => o.path === 'index.css')?.text ?? ''
    const outputs = all.filter((o) => o.path !== 'index.css')
    const cssFiles = new Map(
      files
        .filter((f) => f.path.endsWith('.css'))
        .map((f) => [path.posix.resolve('/', f.path), f.content]),
    )
    const css = await generateTailwindCached(allCode, { userCss: importedCss, cssFiles }, cache)
    return { ok: true, css, outputs }
  } catch (error) {
    return formatBuildError(error)
  }
}
