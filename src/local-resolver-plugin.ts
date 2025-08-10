import type { Plugin } from 'esbuild-wasm'
import * as path from 'path-browserify'

export interface LocalFile {
  path: string
  content: string
}

export interface LocalResolverOptions {
  files: LocalFile[]
  workingDir?: string
}

export function createLocalResolverPlugin(options: LocalResolverOptions): Plugin {
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
    setup(build) {
      // Handle entry points
      build.onResolve({ filter: /.*/ }, (args) => {
        // Only handle entry points and imports, not external modules
        if (args.kind === 'entry-point') {
          // Check if we have this file
          if (fileMap.has(args.path)) {
            return {
              path: args.path,
              namespace: 'local-file'
            }
          }
        }
        return undefined
      })
      
      // Resolve relative imports
      build.onResolve({ filter: /^\.\.?[/\\]/ }, (args) => {
        const basedir = path.dirname(args.importer)
        const resolvedPath = path.resolve(basedir, args.path)
        
        // Try with common extensions if no extension provided
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs']
        for (const ext of extensions) {
          const fullPath = resolvedPath + ext
          if (fileMap.has(fullPath)) {
            return {
              path: fullPath,
              namespace: 'local-file'
            }
          }
          
          // Also try index files
          const indexPath = path.join(resolvedPath, 'index' + ext)
          if (fileMap.has(indexPath)) {
            return {
              path: indexPath,
              namespace: 'local-file'
            }
          }
        }
        
        // If not found locally, return undefined to let other plugins handle it
        return undefined
      })

      // Load local files
      build.onLoad({ filter: /.*/, namespace: 'local-file' }, (args) => {
        const content = fileMap.get(args.path)
        if (!content) {
          return {
            errors: [{
              text: `File not found: ${args.path}`,
              location: null,
            }]
          }
        }

        // Determine loader based on extension
        const ext = path.extname(args.path)
        let loader: 'ts' | 'tsx' | 'js' | 'jsx' = 'tsx'
        if (ext === '.ts') loader = 'ts'
        else if (ext === '.tsx') loader = 'tsx'
        else if (ext === '.js' || ext === '.mjs') loader = 'js'
        else if (ext === '.jsx') loader = 'jsx'

        return {
          contents: content,
          loader,
          resolveDir: path.dirname(args.path)
        }
      })
    }
  }
}