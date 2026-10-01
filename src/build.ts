import { generateTailwindCSS } from './generate-tailwind.js'
import { createEsmShPlugin } from './esm-https-plugin.js'
import { createLocalResolverPlugin } from './local-resolver-plugin.js'
import { createVirtualEntryPlugin } from './virtual-entry-plugin.js'

export interface BuildFile {
  path: string
  content: string
}

export interface BuildOutput {
  /** Path relative to the output dir, e.g. `index.js` or `chunks/a-HASH.js` */
  path: string
  text: string
}

export interface BuildOptions {
  files: BuildFile[]
  entryPoint: string
  externalPackages: string[]
  /** Absolute CSS URL for the entry. When omitted the CSS is resolved relative to the entry module. */
  cssUrl?: string
  baseUrl?: string
  /** Output dir name inside the virtual fs, only used to strip prefixes */
  outdir?: string
}

export interface BuildSuccess {
  ok: true
  outputs: BuildOutput[]
  css: string
  warnings: any[]
  rawOutputs: Array<{ path: string; size: number }>
}

export interface BuildFailure {
  ok: false
  /** True when esbuild reported the errors (user code problem) */
  fromEsbuild: boolean
  /** Formatted esbuild messages, no ANSI colors */
  errorText: string
  errors: Array<{ file?: string; line?: number; text: string }>
}

let initPromise: Promise<void> | undefined

async function loadEsbuild() {
  const [esbuild, wasm] = await Promise.all([
    import('esbuild-wasm'),
    import('../node_modules/esbuild-wasm/esbuild.wasm').then(
      (mod) => mod.default,
    ),
  ])
  initPromise ??= esbuild
    .initialize({
      wasmModule: process.env.VITEST ? undefined : wasm,
      worker: false,
    })
    .catch((e) => {
      initPromise = undefined
      throw e
    })
  await initPromise
  return esbuild
}

const CODE_FILE = /\.(tsx?|jsx?|mjs|css|html)$/

export async function formatBuildError(error: any): Promise<BuildFailure> {
  const esbuild = await loadEsbuild()
  const raw: any[] = error?.errors ?? []
  const errorText = raw.length
    ? (
        await esbuild.formatMessages(raw, {
          kind: 'error',
          color: false,
          terminalWidth: 100,
        })
      ).join('\n')
    : String(error?.message || 'Build failed')
  const errors = raw.length
    ? raw.map((e) => ({
        file: e.location?.file,
        line: e.location?.line,
        text: String(e.text),
      }))
    : [{ text: String(error?.message || 'Build failed') }]
  return { ok: false, fromEsbuild: raw.length > 0, errorText, errors }
}

/** Bundle a set of files with esbuild and generate Tailwind CSS. Never throws on build errors. */
export async function buildFiles(
  options: BuildOptions,
): Promise<BuildSuccess | BuildFailure> {
  const esbuild = await loadEsbuild()
  const outdir = options.outdir ?? 'out'
  const { files, entryPoint, externalPackages, cssUrl, baseUrl = '' } = options

  const allCode = files
    .filter((f) => CODE_FILE.test(f.path))
    .map((f) => f.content)
    .join('\n')

  try {
    const [result, css] = await Promise.all([
      esbuild.build({
        entryPoints: { index: 'virtual:entry' },
        outdir: `./${outdir}`,
        bundle: true,
        format: 'esm',
        splitting: true,
        sourcemap: false,
        target: 'es2020',
        platform: 'browser',
        write: false,
        minify: false,
        jsx: 'automatic',
        plugins: [
          createVirtualEntryPlugin({
            actualEntryPath: entryPoint,
            cssUrl,
            baseUrl,
          }),
          createLocalResolverPlugin({ files }),
          createEsmShPlugin({ externalPackages }),
        ],
        absWorkingDir: '/',
        loader: {
          '.tsx': 'tsx',
          '.ts': 'tsx',
          '.jsx': 'tsx',
          '.js': 'tsx',
          '.css': 'css',
        },
        entryNames: '[dir]/[name]',
        chunkNames: '[dir]/chunks/[name]-[hash]',
        assetNames: '[dir]/assets/[name]-[hash]',
      }),
      generateTailwindCSS(allCode),
    ])

    const prefix = new RegExp(`^/?\\.?/?${outdir}/`)
    const outputFiles = result.outputFiles || []
    return {
      ok: true,
      css,
      warnings: result.warnings,
      outputs: outputFiles.map((f) => ({
        path: f.path.replace(prefix, ''),
        text: f.text,
      })),
      rawOutputs: outputFiles.map((f) => ({
        path: f.path,
        size: f.contents.byteLength,
      })),
    }
  } catch (error) {
    return formatBuildError(error)
  }
}
