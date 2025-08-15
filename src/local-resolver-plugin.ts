import type { Plugin } from 'esbuild-wasm'
import * as path from 'path-browserify'
import { processCSSFileWithTailwind } from './generate-tailwind.js'

export interface LocalFile {
  path: string
  content: string
}

export interface LocalResolverOptions {
  files?: LocalFile[]
  filePaths?: string[]
  workingDir?: string
  getFileContent?: (filePath: string) => Promise<string | null>
}

export function createLocalResolverPlugin(
  options: LocalResolverOptions = {},
): Plugin {
  const {
    files = [],
    filePaths = [],
    workingDir = '/',
    getFileContent,
  } = options

  // Create a map for quick file lookup
  const fileMap = new Map<string, string>()
  const fileContentCache = new Map<string, string>()

  // Create a set of available file paths for quick resolution
  const availablePaths = new Set<string>(filePaths)

  // Populate fileMap from files array
  files.forEach((file) => {
    fileMap.set(file.path, file.content)
    const absolutePath = path.isAbsolute(file.path)
      ? file.path
      : path.join(workingDir, file.path)
    fileMap.set(absolutePath, file.content)
  })

  return {
    name: 'local-resolver',
    setup(build) {
      // Handle entry points and imports
      build.onResolve({ filter: /.*/ }, (args) => {
        // Skip if already processed or is an HTTP URL
        if (
          args.path.startsWith('\0') ||
          args.path.startsWith('https://') ||
          args.path.startsWith('http://')
        ) {
          return null
        }

        // Handle entry points (no importer)
        if (!args.importer) {
          const resolvedPath = path.isAbsolute(args.path)
            ? args.path
            : path.posix.resolve(workingDir, args.path)

          // Check if file exists in fileMap
          if (fileMap.has(resolvedPath)) {
            return {
              path: resolvedPath,
              namespace: 'local',
            }
          }
          // Check if file exists in available paths (for GitHub mode)
          if (availablePaths.has(resolvedPath)) {
            return {
              path: resolvedPath,
              namespace: 'local',
            }
          }
        }

        // Handle relative imports
        if (args.path.startsWith('.') || args.path.startsWith('/')) {
          // Determine base directory
          let basedir = workingDir

          if (args.importer) {
            if (args.namespace === 'local') {
              basedir = path.dirname(args.importer)
            } else if (!args.importer.startsWith('http')) {
              basedir = path.dirname(args.importer)
            }
          }

          const resolvedPath = path.posix.resolve(
            workingDir,
            basedir,
            args.path,
          )

          // Try with common extensions if no extension provided
          const extensions = ['', '.css', '.ts', '.tsx', '.js', '.jsx', '.mjs']
          for (const ext of extensions) {
            const fullPath = resolvedPath + ext

            // Check local files first
            if (fileMap.has(fullPath)) {
              return {
                path: fullPath,
                namespace: 'local',
              }
            }

            // Check available paths (for GitHub mode)
            if (availablePaths.has(fullPath)) {
              return {
                path: fullPath,
                namespace: 'local',
              }
            }

            // Also try index files (not for CSS)
            if (ext !== '.css') {
              const indexPath = path.join(resolvedPath, 'index' + ext)
              if (fileMap.has(indexPath)) {
                return {
                  path: indexPath,
                  namespace: 'local',
                }
              }
              if (availablePaths.has(indexPath)) {
                return {
                  path: indexPath,
                  namespace: 'local',
                }
              }
            }
          }
        }

        // If not found locally, return null to let other plugins handle it
        return null
      })

      // Load content from local namespace
      build.onLoad({ filter: /.*/, namespace: 'local' }, async (args) => {
        console.log({ id: args.path })

        const filePath = args.path

        // Check fileMap first (for local files)
        let content = fileMap.get(filePath) || fileContentCache.get(filePath)

        // If not found and we have getFileContent, fetch it
        if (!content && getFileContent) {
          const fetchedContent = await getFileContent(filePath)
          if (fetchedContent !== null) {
            content = fetchedContent
            fileContentCache.set(filePath, fetchedContent)
          }
        }

        if (!content) {
          return {
            errors: [
              {
                text: `File not found: ${filePath}`,
                location: null,
                notes: [],
                detail: null,
                pluginName: 'local-resolver',
              },
            ],
          }
        }

        // Determine loader based on extension
        const ext = path.extname(filePath)

        // Handle CSS files
        if (ext === '.css') {
          try {
            // Process CSS with Tailwind
            const processedCSS = await processCSSFileWithTailwind(content)

            return {
              contents: processedCSS,
              loader: 'css',
            }
          } catch (error: any) {
            return {
              errors: [
                {
                  text: `Failed to process CSS file ${filePath}: ${error.message}`,
                  location: null,
                  notes: [],
                  detail: error,
                  pluginName: 'local-resolver',
                },
              ],
            }
          }
        }

        // For TypeScript/JSX files, determine the appropriate loader
        let loader: 'tsx' | 'ts' | 'jsx' | 'js' = 'tsx'
        if (ext === '.ts') loader = 'ts'
        else if (ext === '.tsx') loader = 'tsx'
        else if (ext === '.jsx') loader = 'jsx'
        else if (ext === '.js' || ext === '.mjs') loader = 'js'

        return {
          contents: content,
          loader,
        }
      })
    },
  }
}
