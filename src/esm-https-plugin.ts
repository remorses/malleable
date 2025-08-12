import { createUnplugin } from 'unplugin'
import { logger } from "./logger.ts"

export interface PluginOptions {
  externalPackages?: string[]
  cdnUrl?: string
}

// Global caches that persist across requests
const globalCodeCache = new Map<string, string>()
const globalRedirectCache = new Map<string, string>()

export const createEsmShPlugin = createUnplugin<PluginOptions>((options = {}) => {
  const {
    externalPackages = [],
    cdnUrl = 'https://esm.sh',
  } = options

  return {
    name: 'esm-sh-plugin',

    resolveId(id, importer) {
      // Handle https:// URLs directly
      if (id.startsWith('https://') || id.startsWith('http://')) {
        return id
      }

      // Handle relative imports from remote modules
      if (importer?.startsWith('https://') && (id.startsWith('.') || id.startsWith('/'))) {
        const url = new URL(id, importer).toString().trim()
        return url
      }

      // Handle npm packages (not relative/absolute paths)
      if (!id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')) {
        // Check if package should be external
        const packageName = getPackageName(id)
        if (externalPackages.some(pkg =>
          pkg === packageName || id.startsWith(pkg + '/')
        )) {
          return { id, external: true }
        }

        // Resolve through esm.sh with external query params
        const externalsQuery = externalPackages.length > 0
          ? '?' + new URLSearchParams({ external: externalPackages.join(',') }).toString()
          : ''
        const url = `${cdnUrl}/${id}${externalsQuery}`.trim()
        return url
      }

      return null
    },

    async load(id) {
      // Only handle https:// URLs
      if (!id.startsWith('https://') && !id.startsWith('http://')) {
        return null
      }

      const url = id

      // Check cache first
      if (globalCodeCache.has(url)) {
        logger.log(`Cache hit for ${url.substring(0, 50)}`)
        return globalCodeCache.get(url)
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

        // Determine if it's JSON based on content type
        const contentType = response.headers.get('content-type') || ''
        const isJson = contentType.includes('application/json')

        let contents = await response.text()
        if (!contents) throw new Error(`https url returned empty string ${url}`)

        // Transform import.meta.url references
        if (contents.includes('import.meta.url')) {
          contents = contents.replace(
            /import\.meta\.url/g,
            JSON.stringify(resolvedUrl)
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

        return contents
      } catch (error: any) {
        this.error({
          message: error.message,
          id: url,
        })
        return null
      }
    }
  }
})

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
