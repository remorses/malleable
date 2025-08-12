import { createUnplugin } from 'unplugin'
import * as path from 'path-browserify'

export interface LocalFile {
  path: string
  content: string
}

export interface LocalResolverOptions {
  files: LocalFile[]
  workingDir?: string
}

export const createLocalResolverPlugin = createUnplugin<LocalResolverOptions>((options) => {
  const { files, workingDir = '/' } = options
  
  // Create a map for quick file lookup
  const fileMap = new Map<string, string>()
  files.forEach(file => {
    // Store with the original path and also with absolute path
    fileMap.set(file.path, file.content)
    
    // Also store with absolute path
    const absolutePath = path.isAbsolute(file.path) 
      ? file.path 
      : path.join(workingDir, file.path)
    fileMap.set(absolutePath, file.content)
  })

  return {
    name: 'local-resolver',
    enforce: 'pre', // Run before other plugins
    
    resolveId(id, importer) {
      // Skip if already processed
      if (id.startsWith('\0') || id.startsWith('https://')) {
        return null
      }
      
      // Handle entry points
      if (!importer) {
        if (fileMap.has(id)) {
          return '\0local:' + id
        }
      }
      
      // Handle relative imports
      if (id.startsWith('.') || id.startsWith('/')) {
        const basedir = importer 
          ? (importer.startsWith('\0local:') 
              ? path.dirname(importer.slice(7)) // Remove '\0local:' prefix
              : path.dirname(importer))
          : workingDir
        const resolvedPath = path.resolve(basedir, id)
        
        // Try with common extensions if no extension provided
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs']
        for (const ext of extensions) {
          const fullPath = resolvedPath + ext
          if (fileMap.has(fullPath)) {
            return '\0local:' + fullPath
          }
          
          // Also try index files
          const indexPath = path.join(resolvedPath, 'index' + ext)
          if (fileMap.has(indexPath)) {
            return '\0local:' + indexPath
          }
        }
      }
      
      // If not found locally, return null to let other plugins handle it
      return null
    },

    load(id) {
      // Only handle local files
      if (!id.startsWith('\0local:')) {
        return null
      }
      
      const filePath = id.slice(7) // Remove '\0local:' prefix
      const content = fileMap.get(filePath)
      
      if (!content) {
        this.error({
          message: `File not found: ${filePath}`,
          id: filePath,
        })
        return null
      }
      
      // Determine loader based on extension
      const ext = path.extname(filePath)
      let code = content
      
      // For TypeScript/JSX files, we just pass them through as-is
      // since esbuild will handle the transformation
      
      return {
        code,
        map: null
      }
    }
  }
})