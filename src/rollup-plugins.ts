import type { Plugin } from '@rollup/browser'
import path from 'path-browserify'
import { transform as sucrase } from 'sucrase'
import dedent from 'string-dedent'
import {
  fetchModuleSource,
  getPackageName,
} from './esm-https-plugin.ts'
import type { BuildCache } from './build.ts'

const VIRTUAL_ENTRY = '\0virtual:entry'
const CDN_URL = 'https://esm.sh'
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.json']
const isHttp = (id: string) => /^https?:\/\//.test(id)

const js = dedent

/** Wraps the user entry: re-exports it and adds a stylesheet link around the default export. */
export function virtualEntryPlugin(options: {
  actualEntryPath: string
  cssUrl?: string
}): Plugin {
  const { actualEntryPath, cssUrl } = options
  const cssHref = cssUrl
    ? JSON.stringify(cssUrl)
    : `new URL('./index.css', import.meta.url).href`
  const entrySpecifier = JSON.stringify('./' + actualEntryPath)
  return {
    name: 'virtual-entry',
    resolveId(source) {
      return source === VIRTUAL_ENTRY ? VIRTUAL_ENTRY : null
    },
    load(id) {
      if (id !== VIRTUAL_ENTRY) return null
      // createElement instead of JSX so this module needs no transform
      return js`
        import React from 'react';
        import * as ActualEntry from ${entrySpecifier};
        export * from ${entrySpecifier};
        const OriginalDefault = ActualEntry.default;
        export default function WrappedComponent(props) {
          return React.createElement(
            React.Fragment,
            null,
            React.createElement('link', { rel: 'stylesheet', href: ${cssHref} }),
            OriginalDefault ? React.createElement(OriginalDefault, props) : null,
          );
        }
      `
    },
  }
}

/** Modules in execution order: dependencies before their importer, each visited once. */
function executionOrder(root: string, deps: (id: string) => string[]): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  const visit = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    for (const dep of deps(id)) visit(dep)
    order.push(id)
  }
  visit(root)
  return order
}

const CSS_IMPORT = /@import\s+(?:url\(\s*)?(["'])([^"']+)\1\s*\)?([^;]*);/g

/** Inlines local `@import "./x.css"` rules in place. Remote and non-local imports stay. */
function inlineCssImports(
  id: string,
  css: string,
  files: Map<string, string>,
  stack: string[] = [],
): string {
  if (stack.includes(id)) return ''
  return css.replace(CSS_IMPORT, (rule, _q, spec: string, conditions: string) => {
    if (isHttp(spec) || spec.startsWith('data:')) return rule
    const target = path.posix.resolve(path.posix.dirname(id), spec)
    const content = files.get(target)
    if (content === undefined) return rule
    const inner = inlineCssImports(target, content, files, [...stack, id])
    const cond = conditions.trim()
    return cond ? `@media ${cond} {\n${inner}\n}` : inner
  })
}

type Node = { type: string; start: number; end: number; [key: string]: any }

/** Replaces `process.env.NODE_ENV` member expressions (not strings or comments) with "development". */
function replaceNodeEnv(code: string, parse: (code: string) => Node): string {
  if (!code.includes('process.env.NODE_ENV')) return code
  const ranges: Array<[number, number]> = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    const n = node as Node
    if (
      n.type === 'MemberExpression' &&
      !n.computed &&
      n.property.name === 'NODE_ENV' &&
      n.object.type === 'MemberExpression' &&
      !n.object.computed &&
      n.object.property.name === 'env' &&
      n.object.object.type === 'Identifier' &&
      n.object.object.name === 'process'
    ) {
      ranges.push([n.start, n.end])
      return
    }
    for (const key in n) if (key !== 'type') walk(n[key])
  }
  walk(parse(code))
  let out = code
  for (const [start, end] of ranges.reverse()) {
    out = out.slice(0, start) + '"development"' + out.slice(end)
  }
  return out
}

/** Resolves, loads and transforms the in-memory project files. Collects imported CSS; Tailwind processes it later. */
export function localFilesPlugin(options: {
  files: Array<{ path: string; content: string }>
}): Plugin {
  const fileMap = new Map<string, string>()
  for (const file of options.files) {
    fileMap.set(path.posix.resolve('/', file.path), file.content)
  }
  const cssById = new Map<string, string>()

  return {
    name: 'local-files',
    resolveId(source, importer) {
      if (source.startsWith('\0') || isHttp(source)) return null
      if (importer && isHttp(importer)) return null
      const isPath = source.startsWith('.') || source.startsWith('/')
      if (!isPath) return null
      const basedir =
        importer && !importer.startsWith('\0') ? path.posix.dirname(importer) : '/'
      const resolved = path.posix.resolve(basedir, source)
      for (const ext of RESOLVE_EXTENSIONS) {
        if (fileMap.has(resolved + ext)) return resolved + ext
      }
      for (const ext of RESOLVE_EXTENSIONS) {
        if (ext === '.css' || ext === '.json') continue
        const index = path.posix.join(resolved, 'index' + ext)
        if (fileMap.has(index)) return index
      }
      return null
    },
    load(id) {
      const content = fileMap.get(id)
      if (content === undefined) return null
      if (id.endsWith('.css')) {
        cssById.set(id, inlineCssImports(id, content, fileMap))
        return { code: 'export default undefined', moduleSideEffects: true }
      }
      if (id.endsWith('.json')) return `export default ${content}`
      return content
    },
    transform(code, id) {
      if (!fileMap.has(id) || !/\.(tsx?|jsx?|mjs)$/.test(id)) return null
      // .ts is parsed without JSX so `<T>(x) => x` stays a generic
      const transforms: Array<'typescript' | 'jsx'> = id.endsWith('.ts')
        ? ['typescript']
        : ['typescript', 'jsx']
      try {
        const out = sucrase(code, {
          transforms,
          jsxRuntime: 'automatic',
          production: true,
          filePath: id,
        })
        return { code: replaceNodeEnv(out.code, this.parse.bind(this)), map: null }
      } catch (e: any) {
        this.error({
          message: String(e.message)
            .replace(/^Error transforming [^:]*: /, '')
            .replace(/\s*\(\d+:\d+\)$/, ''),
          loc: e.loc && { file: id, line: e.loc.line, column: Math.max(0, e.loc.column - 1) },
        })
      }
    },
    generateBundle() {
      const css = executionOrder(VIRTUAL_ENTRY, (id) => {
        const info = this.getModuleInfo(id)
        return info ? [...info.importedIds, ...info.dynamicallyImportedIds] : []
      })
        .map((id) => cssById.get(id))
        .filter(Boolean)
        .join('\n')
      if (css) this.emitFile({ type: 'asset', fileName: 'index.css', source: css })
    },
  }
}

/** Resolves bare imports and https:// imports through the CDN, or leaves externals alone. */
export function esmShPlugin(options: {
  externalPackages: string[]
  cache?: BuildCache
}): Plugin {
  const { externalPackages, cache } = options
  const isExternal = (spec: string) => {
    const name = getPackageName(spec)
    return externalPackages.some((pkg) => pkg === name || spec.startsWith(pkg + '/'))
  }
  const cdnUrl = (spec: string) => {
    const query = externalPackages.length
      ? '?' + new URLSearchParams({ external: externalPackages.join(',') })
      : ''
    return `${CDN_URL}/${spec}${query}`.trim()
  }

  return {
    name: 'esm-sh',
    resolveId(source, importer) {
      if (source.startsWith('\0')) return null
      if (isHttp(source)) return source
      const fromCdn = importer && isHttp(importer)
      if (fromCdn && source.startsWith('.')) {
        return new URL(source, importer).toString().trim()
      }
      if (fromCdn && source.startsWith('/')) {
        return new URL(source, new URL(importer).origin).toString().trim()
      }
      if (source.startsWith('.') || source.startsWith('/')) return null
      if (isExternal(source)) return { id: source, external: true }
      return cdnUrl(source)
    },
    load(id) {
      return isHttp(id) ? fetchModuleSource(id, cache) : null
    },
  }
}
