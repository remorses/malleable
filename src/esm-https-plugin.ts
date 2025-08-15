import type { Plugin } from 'esbuild-wasm'

import { logger } from './logger.ts'

export interface PluginOptions {
  externalPackages?: string[]
  cdnUrl?: string
}

// Global caches that persist across requests
const globalCodeCache = new Map<string, string>()
const globalRedirectCache = new Map<string, string>()

export function createEsmShPlugin(options: PluginOptions = {}): Plugin {
  const { externalPackages = [], cdnUrl = 'https://esm.sh' } = options

  return {
    name: 'esm-sh-plugin',
    setup(build) {
      // Handle direct https:// URL imports
      build.onResolve({ filter: /^https?:\/\// }, (args) => {
        return {
          path: args.path,
          namespace: 'http-url',
        }
      })

      // Handle relative imports from within http-url namespace
      build.onResolve({ filter: /.*/, namespace: 'http-url' }, (args) => {
        // For relative imports, resolve against the importer URL
        if (args.path.startsWith('.')) {
          const url = new URL(args.path, args.importer).toString().trim()
          return {
            path: url,
            namespace: 'http-url',
          }
        }

        // For absolute paths starting with /, resolve relative to the origin
        if (args.path.startsWith('/')) {
          const importerUrl = new URL(args.importer)
          const url = new URL(args.path, importerUrl.origin).toString().trim()
          return {
            path: url,
            namespace: 'http-url',
          }
        }

        // For bare imports within http-url namespace, resolve through esm.sh
        if (!args.path.startsWith('http')) {
          const packageName = getPackageName(args.path)
          if (
            externalPackages.some(
              (pkg) => pkg === packageName || args.path.startsWith(pkg + '/'),
            )
          ) {
            return {
              path: args.path,
              external: true,
            }
          }

          const externalsQuery =
            externalPackages.length > 0
              ? '?' +
                new URLSearchParams({
                  external: externalPackages.join(','),
                }).toString()
              : ''
          const url = `${cdnUrl}/${args.path}${externalsQuery}`.trim()
          return {
            path: url,
            namespace: 'http-url',
          }
        }

        // Already a full URL
        return {
          path: args.path,
          namespace: 'http-url',
        }
      })

      // Handle npm packages in the default (file) namespace
      build.onResolve({ filter: /.*/ }, (args) => {
        // Skip if already processed or is a relative/absolute path
        if (
          args.path.startsWith('.') ||
          args.path.startsWith('/') ||
          args.path.startsWith('\0')
        ) {
          return null
        }

        // Check if package should be external
        const packageName = getPackageName(args.path)
        if (
          externalPackages.some(
            (pkg) => pkg === packageName || args.path.startsWith(pkg + '/'),
          )
        ) {
          return {
            path: args.path,
            external: true,
          }
        }

        // Resolve through esm.sh with external query params
        const externalsQuery =
          externalPackages.length > 0
            ? '?' +
              new URLSearchParams({
                external: externalPackages.join(','),
              }).toString()
            : ''
        const url = `${cdnUrl}/${args.path}${externalsQuery}`.trim()

        return {
          path: url,
          namespace: 'http-url',
        }
      })

      // Load content from http-url namespace
      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
        const url = args.path

        // Check cache first
        if (globalCodeCache.has(url)) {
          logger.log(`Cache hit for ${url.substring(0, 50)}`)
          return {
            contents: globalCodeCache.get(url)!,
            loader: 'js',
          }
        }

        // Follow redirects
        const resolvedUrl = await resolveRedirect(url, globalRedirectCache)

        // Fetch the module
        const fetchId = Math.random().toString(36).substring(2, 9)
        logger.time(`${fetchId} fetch ${url.substring(0, 50)}`)
        const response = await fetch(resolvedUrl)
        logger.timeEnd(`${fetchId} fetch ${url.substring(0, 50)}`)

        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${resolvedUrl}: ${response.status} ${response.statusText}`,
          )
        }

        // Determine if it's JSON based on content type
        const contentType = response.headers.get('content-type') || ''
        const isJson = contentType.includes('application/json')

        let contents = await response.text()
        if (!contents) throw new Error(`https url returned empty string ${url}`)

        // Transform import.meta.url references
        if (contents.includes('import.meta.url')) {
          contents = contents.replace(
            /\bimport\.meta\.url\b/g,
            JSON.stringify(resolvedUrl),
          )
        }

        // For JSON files, export as default
        if (isJson) {
          contents = `export default ${contents}`
        }

        // Cache JavaScript modules
        if (!isJson) {
          globalCodeCache.set(url, contents)
        }

        return {
          contents,
          loader: 'js',
        }
      })
    },
  }
}

// Helper function to extract package name from import path
function getPackageName(path: string): string {
  // Handle scoped packages (@org/package)
  if (path.startsWith('@')) {
    const parts = path.split('/')
    return parts.slice(0, 2).join('/')
  }
  // Handle regular packages
  return path.split('/')[0]
}

// Helper function to resolve redirects
async function resolveRedirect(
  url: string,
  cache: Map<string, string>,
): Promise<string> {
  if (cache.has(url)) {
    return cache.get(url)!
  }

  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location) {
      const resolvedUrl = new URL(location, url).toString()
      cache.set(url, resolvedUrl)
      return resolveRedirect(resolvedUrl, cache)
    }
  }

  cache.set(url, url)
  return url
}
