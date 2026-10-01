import type { BunPlugin as Plugin } from 'bun'

import { logger } from './logger.ts'

// Global caches that persist across requests
const globalCodeCache = new Map<string, Expiring<string>>()
const globalRedirectCache = new Map<string, Expiring<string>>()
const MEMORY_TTL_MS = 3600 * 1000
const MEMORY_LIMIT = 500

interface Expiring<T> {
  value: T
  expires: number
}

function memoryGet<T>(map: Map<string, Expiring<T>>, key: string): T | undefined {
  const hit = map.get(key)
  if (!hit) return undefined
  if (hit.expires < Date.now()) {
    map.delete(key)
    return undefined
  }
  return hit.value
}

function memorySet<T>(map: Map<string, Expiring<T>>, key: string, value: T) {
  if (map.size >= MEMORY_LIMIT) map.delete(map.keys().next().value!)
  map.set(key, { value, expires: Date.now() + MEMORY_TTL_MS })
}

/**
 * Bun runtime plugin that lets `bun` import https:// modules (used by src/preload-bun.ts).
 * Bun passes https imports in the `https` namespace with the path `//host/path`, and
 * relative imports inside them arrive in the default namespace with the URL as importer.
 * Bare imports are left to Bun.
 */
export function createBunHttpImportsPlugin(): Plugin {
  return {
    name: 'http-imports',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!/^https?:\/\//.test(args.importer)) return undefined
        if (!args.path.startsWith('.') && !args.path.startsWith('/')) return undefined
        const url = new URL(args.path, args.importer)
        return {
          path: url.href.slice(url.protocol.length),
          namespace: url.protocol.slice(0, -1),
        }
      })
      for (const namespace of ['http', 'https']) {
        build.onLoad({ filter: /.*/, namespace }, async (args) => ({
          contents: await fetchModuleSource(`${namespace}:${args.path}`),
          loader: 'js',
        }))
      }
    },
  }
}

/** Fetch a module from a CDN url, following redirects, with a per-isolate cache. */
export async function fetchModuleSource(
  url: string,
  cache?: { get(key: string): Promise<string | null>; put(key: string, value: string, ttl: number): void },
): Promise<string> {
  const cached = memoryGet(globalCodeCache, url)
  if (cached !== undefined) {
    logger.log(`Cache hit for ${url.substring(0, 50)}`)
    return cached
  }
  // Unversioned CDN urls redirect to the latest version, so keep this short
  const kvKey = `esm:${url}`
  const stored = await cache?.get(kvKey)
  if (stored != null) {
    memorySet(globalCodeCache, url, stored)
    return stored
  }

  const resolvedUrl = await resolveRedirect(url, globalRedirectCache)

  const fetchId = Math.random().toString(36).substring(2, 9)
  logger.time(`${fetchId} fetch ${url.substring(0, 50)}`)
  const response = await fetch(resolvedUrl)
  logger.timeEnd(`${fetchId} fetch ${url.substring(0, 50)}`)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${resolvedUrl}: ${response.status} ${response.statusText}`,
    )
  }

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  let contents = await response.text()
  if (!contents) throw new Error(`https url returned empty string ${url}`)

  if (contents.includes('import.meta.url')) {
    contents = contents.replace(
      /\bimport\.meta\.url\b/g,
      JSON.stringify(resolvedUrl),
    )
  }

  if (isJson) return `export default ${contents}`

  memorySet(globalCodeCache, url, contents)
  cache?.put(kvKey, contents, 3600)
  return contents
}

// Helper function to extract package name from import path
export function getPackageName(path: string): string {
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
  cache: Map<string, Expiring<string>>,
): Promise<string> {
  const known = memoryGet(cache, url)
  if (known !== undefined) return known

  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location) {
      const resolvedUrl = new URL(location, url).toString()
      memorySet(cache, url, resolvedUrl)
      return resolveRedirect(resolvedUrl, cache)
    }
  }

  memorySet(cache, url, url)
  return url
}
