export interface CdnModule {
  /** Final url after redirects; relative imports resolve against this */
  url: string
  code: string
}

export interface CdnCache {
  get(key: string): Promise<string | null>
  put(key: string, value: string, ttl: number): void
}

// Per-isolate layer in front of the shared cache
const memory = new Map<string, { module: CdnModule; expires: number }>()
const MEMORY_TTL_MS = 3600 * 1000
const MEMORY_LIMIT = 500

function remember(url: string, module: CdnModule) {
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value!)
  memory.set(url, { module, expires: Date.now() + MEMORY_TTL_MS })
}

/** Fetch a module from a CDN url. Unversioned urls redirect to the latest version, so the cache TTL is short. */
export async function fetchCdnModule(
  url: string,
  cache?: CdnCache,
): Promise<CdnModule> {
  const hit = memory.get(url)
  if (hit && hit.expires > Date.now()) return hit.module

  const key = `esm:${url}`
  const stored = await cache?.get(key)
  if (stored != null) {
    const module: CdnModule = JSON.parse(stored)
    remember(url, module)
    return module
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${response.url}: ${response.status} ${response.statusText}`,
    )
  }
  const text = await response.text()
  if (!text) throw new Error(`https url returned empty string ${url}`)

  const isJson = (response.headers.get('content-type') || '').includes(
    'application/json',
  )
  const module: CdnModule = {
    url: response.url,
    code: isJson ? `export default ${text}` : text,
  }
  remember(url, module)
  cache?.put(key, JSON.stringify(module), 3600)
  return module
}

/** Package name of a bare import: `@org/pkg/sub` gives `@org/pkg`, `pkg/sub` gives `pkg`. */
export function getPackageName(path: string): string {
  const parts = path.split('/')
  return path.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}
