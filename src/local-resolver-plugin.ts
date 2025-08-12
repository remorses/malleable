import { createUnplugin } from 'unplugin'
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

export const createLocalResolverPlugin = createUnplugin<LocalResolverOptions>((options) => {
  const { files = [], filePaths = [], workingDir = '/', getFileContent } = options

  // Create a map for quick file lookup
  const fileMap = new Map<string, string>()
  const fileContentCache = new Map<string, string>()

  // Create a set of available file paths for quick resolution
  const availablePaths = new Set<string>(filePaths)

  // Populate fileMap from files array
  files.forEach(file => {
    fileMap.set(file.path, file.content)
    const absolutePath = path.isAbsolute(file.path)
      ? file.path
      : path.join(workingDir, file.path)
    fileMap.set(absolutePath, file.content)
  })

  return {
    name: 'local-resolver',
    enforce: 'pre', // Run before other plugins
    esbuild: {
      loader: (code, id) => {
        // Use JSX loader for our virtual entry
        if (id.endsWith('.css')) {
          return 'css'
        }
        return 'tsx'
      }
    },
    async resolveId(id, importer) {
      // Always resolve relative to workingDir for entrypoints
      const resolvedPath = path.isAbsolute(id) ? id : path.posix.resolve(workingDir, id)
      // Skip if already processed
      if (id.startsWith('\0') || id.startsWith('https://')) {
        return null
      }

      // Handle entry points
      if (!importer) {

        // Check if file exists in fileMap
        if (fileMap.has(resolvedPath)) {
          return '\0local:' + resolvedPath
        }
        // Check if file exists in available paths (for GitHub mode)
        if (availablePaths.has(resolvedPath)) {
          return '\0local:' + resolvedPath
        }
      }


      // Handle relative imports
      if (id.startsWith('.') || id.startsWith('/')) {
        const basedir = importer
          ? (importer.startsWith('\0local:')
              ? path.dirname(importer.slice(7)) // Remove '\0local:' prefix
              : path.dirname(importer))
          : workingDir
        const resolvedPath = path.posix.resolve(workingDir, basedir, id)


        // Try with common extensions if no extension provided
        const extensions = ['', '.css', '.ts', '.tsx', '.js', '.jsx', '.mjs']
        for (const ext of extensions) {
          const fullPath = resolvedPath + ext

          // Check local files first
          if (fileMap.has(fullPath)) {
            return '\0local:' + fullPath
          }

          // Check available paths (for GitHub mode)
          if (availablePaths.has(fullPath)) {
            return '\0local:' + fullPath
          }

          // Also try index files (not for CSS)
          if (ext !== '.css') {
            const indexPath = path.join(resolvedPath, 'index' + ext)
            if (fileMap.has(indexPath)) {
              return '\0local:' + indexPath
            }
            if (availablePaths.has(indexPath)) {
              return '\0local:' + indexPath
            }
          }
        }
      }

      // If not found locally, return null to let other plugins handle it
      return null
    },

    async load(id) {
      // Only handle local files
      if (!id.startsWith('\0local:')) {
        return null
      }
      console.log({id})

      const filePath = id.slice(7) // Remove '\0local:' prefix

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
        this.error({
          message: `File not found: ${filePath}`,
          id: filePath,
        })
        return null
      }

      // Determine loader based on extension
      const ext = path.extname(filePath)

      // Handle CSS files
      if (ext === '.css') {
        try {
          // Process CSS with Tailwind
          const processedCSS = await processCSSFileWithTailwind(content)

          return {
            code: processedCSS,
            map: null
          }
        } catch (error: any) {
          this.error({
            message: `Failed to process CSS file ${filePath}: ${error.message}`,
            id: filePath,
          })
          return null
        }
      }

      // For TypeScript/JSX files, we just pass them through as-is
      // since esbuild will handle the transformation

      return {
        code: content,
        map: null
      }
    }
  }
})
