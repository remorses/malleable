import type { Plugin, OnResolveArgs } from 'esbuild-wasm'
import { logger } from "./logger.js"

export interface PluginOptions {
  externalPackages?: string[]
  cdnUrl?: string
}

// Global caches that persist across requests
const globalCodeCache = new Map<string, string>()
const globalRedirectCache = new Map<string, string>()

export function createEsmShPlugin(options: PluginOptions = {}): Plugin {
  const {
    externalPackages = [],
    // Use esm.sh for ESM module resolution
    cdnUrl = 'https://esm.sh',
  } = options

  return {
    name: 'esm-sh-plugin',
    setup(build) {
      const namespace = 'esm-sh'

      // Handle https:// URLs
      build.onResolve({ filter: /^https?:\/\// }, (args) => {
        return {
          path: args.path,
          namespace,
        }
      })

      // Handle npm packages and relative imports
      build.onResolve({ filter: /.*/, namespace }, async (args: OnResolveArgs) => {
        // Handle https URLs directly
        if (args.path.startsWith('https://')) {
          return {
            path: args.path,
            namespace,
          }
        }

        // Handle relative imports
        if (args.path.startsWith('.') || args.path.startsWith('/')) {
          const url = new URL(args.path, args.importer).toString()
          return {
            path: url,
            namespace,
          }
        }

        // Check if package should be external
        const packageName = getPackageName(args.path)
        if (externalPackages.some(pkg => 
          pkg === packageName || args.path.startsWith(pkg + '/')
        )) {
          return {
            path: args.path,
            external: true,
          }
        }

        // Resolve npm packages through esm.sh with external query params
        const externalsQuery = externalPackages.length > 0 
          ? `?external=${externalPackages.join(',')}` 
          : ''
        const url = `${cdnUrl}/${args.path}${externalsQuery}`
        return {
          path: url,
          namespace,
        }
      })

      // Handle regular npm imports in source files
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        // Check if package should be external
        const packageName = getPackageName(args.path)
        if (externalPackages.some(pkg => 
          pkg === packageName || args.path.startsWith(pkg + '/')
        )) {
          return {
            path: args.path,
            external: true,
          }
        }

        // Resolve through esm.sh with external query params
        const externalsQuery = externalPackages.length > 0 
          ? `?external=${externalPackages.join(',')}` 
          : ''
        const url = `${cdnUrl}/${args.path}${externalsQuery}`
        return {
          path: url,
          namespace,
        }
      })

      // Load files from CDN
      build.onLoad({ filter: /.*/, namespace }, async (args) => {
        const url = args.path

        // Check cache first
        if (globalCodeCache.has(url)) {
          logger.log(`Cache hit for ${url.substring(0, 50)}`)
          return {
            contents: globalCodeCache.get(url),
            loader: 'js',
          }
        }

        try {
          // Follow redirects
          const resolvedUrl = await resolveRedirect(url, globalRedirectCache)
          
          // Fetch the module
          const fetchId = Math.random().toString(36).substring(2, 9)
          logger.time(`${fetchId} fetch ${url.substring(0, 50)}`)
          const response = await fetch(resolvedUrl)
          logger.timeEnd(`${fetchId} fetch ${url.substring(0, 50)}`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch ${resolvedUrl}: ${response.status} ${response.statusText}`)
          }

          // Determine loader based on content type
          const contentType = response.headers.get('content-type') || ''
          let loader: 'js' | 'json' = 'js'
          if (contentType.includes('application/json')) {
            loader = 'json'
          }

          let contents = await response.text()

          // Transform import.meta.url references
          if (contents.includes('import.meta.url')) {
            contents = contents.replace(
              /import\.meta\.url/g,
              JSON.stringify(resolvedUrl)
            )
          }

          // Cache JavaScript modules
          if (loader === 'js') {
            globalCodeCache.set(url, contents)
          }

          return {
            contents,
            loader,
          }
        } catch (error: any) {
          return {
            errors: [{
              text: error.message,
              location: null,
            }],
          }
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
  cache: Map<string, string>
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