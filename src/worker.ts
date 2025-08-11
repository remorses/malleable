import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import * as esbuild from 'esbuild-wasm'
import wasm from "../node_modules/esbuild-wasm/esbuild.wasm"
import { generateTailwindCSS, shadcnTheme } from "./generate-tailwind.js"
import { createEsmShPlugin } from "./plugins.js"
import { createLocalResolverPlugin } from "./local-resolver-plugin.js"
import { logger, createRequestLogger } from "./logger.js"

interface Env {
  jsCache: KVNamespace
}

let init = false

// Generate hash for cache key
async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 16) // Use first 16 chars for shorter URLs
}

// Schema for bundle API
const fileSchema = z.object({
  path: z.string(),
  content: z.string()
})

const bundleSchema = z.object({
  files: z.array(fileSchema),
  entryPoint: z.string().optional(),
  externalPackages: z.array(z.string()).default([])
})

// Tagged template for HTML syntax highlighting
const html = (strings: TemplateStringsArray, ...values: any[]) =>
  strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')

// Create app with state
const app = new Spiceflow()
  .state('env', {} as Env)
  .route({
    method: 'OPTIONS',
    path: '/api/bundle',
    handler() {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      })
    }
  })
  .route({
    method: 'POST',
    path: '/api/bundle',
    request: bundleSchema,
    async handler({ request, state }) {
      // Create request-scoped logger
      const reqLogger = createRequestLogger()
      
      reqLogger.time(`total`)

      if (!init) {
        reqLogger.time(`esbuild-init`)
        await esbuild.initialize({
          wasmModule: wasm,
          worker: false
        })
        init = true
        reqLogger.timeEnd(`esbuild-init`)
      }

      try {
        reqLogger.time(`parse-body`)
        const body = await request.json()
        reqLogger.timeEnd(`parse-body`)
        const {
          files,
          entryPoint,
          externalPackages = []
        } = body

        // Determine actual entry point
        const actualEntryPoint = entryPoint || files[0]?.path

        if (!actualEntryPoint) {
          return Response.json({
            error: 'No files provided',
            success: false
          }, { status: 400 })
        }

        // Validate entry point exists
        const entryFile = files.find(f => f.path === actualEntryPoint)
        if (!entryFile) {
          return Response.json({
            error: `Entry point "${actualEntryPoint}" not found in provided files`,
            success: false
          }, { status: 400 })
        }

        // Static plugins array
        const plugins: esbuild.Plugin[] = [
          createLocalResolverPlugin({ files }),
          createEsmShPlugin({ externalPackages })
        ]

        // Generate hash for the entry point name
        const hashInput = JSON.stringify({
          files: files.sort((a, b) => a.path.localeCompare(b.path)),
          entryPoint: actualEntryPoint,
          externalPackages: externalPackages.sort(),
          tailwindConfig: JSON.stringify(shadcnTheme)
        })
        const entryHash = await generateHash(hashInput)

        // Determine jsxImportSource based on external packages
        const jsxImportSource = externalPackages.includes('react')
          ? undefined
          : 'https://unpkg.com/react'

        // Always use build API with bundling and code splitting
        reqLogger.time(`esbuild-build`)
        const result = await esbuild.build({
          entryPoints: { [entryHash]: actualEntryPoint },
          outdir: './',
          bundle: true,
          format: 'esm',
          splitting: true,
          sourcemap: true,
          target: 'es2020',
          platform: 'browser',
          write: false,
          minify: false,
          jsx: 'automatic',
          jsxImportSource,
          plugins,
          absWorkingDir: '/',
          loader: { '.tsx': 'tsx', '.ts': 'tsx', '.jsx': 'tsx', '.js': 'tsx' },
          // Configure output filenames - [name] will be our hash
          entryNames: '[name]',                   // entry outputs use hash as name
          chunkNames: 'chunks/[name]-[hash]',     // shared/lazy chunks
          assetNames: 'assets/[name]-[hash]',     // emitted assets
        })
        reqLogger.timeEnd(`esbuild-build`)

        const outputFiles = result.outputFiles || []
        const warnings = result.warnings

        // Collect all code for CSS extraction
        const allCode = files.map(f => f.content).join('\n')

        // Always generate Tailwind CSS
        reqLogger.time(`tailwind-css`)
        const css = await generateTailwindCSS(allCode)
        reqLogger.timeEnd(`tailwind-css`)

        // Use same hash for CSS file
        const cssKey = `${entryHash}.css`
        
        // Store all output files in KV
        const ttl = 60 * 60 * 24 * 7 // 7 days in seconds
        const kvPromises: Promise<void>[] = []
        const fileUrls: Record<string, string> = {}
        
        // Store JS/sourcemap files from esbuild
        for (const file of outputFiles) {
          // Extract filename from path (remove leading ./)
          const filename = file.path.replace(/^\.?\//, '')
          kvPromises.push(state.env.jsCache.put(filename, file.text, { expirationTtl: ttl }))
          fileUrls[filename] = `${new URL(request.url).origin}/bundle/${filename}`
        }
        
        // Store CSS file
        kvPromises.push(state.env.jsCache.put(cssKey, css, { expirationTtl: ttl }))
        fileUrls['styles.css'] = `${new URL(request.url).origin}/bundle/${cssKey}`
        
        reqLogger.time(`kv-store`)
        await Promise.all(kvPromises)
        reqLogger.timeEnd(`kv-store`)

        reqLogger.timeEnd(`total`)

        // The main entry file will be named with our hash
        const mainJsUrl = fileUrls[`${entryHash}.js`] || undefined

        // Return URLs for all files
        return Response.json({
          // Legacy fields for backwards compatibility
          jsUrl: mainJsUrl,
          cssUrl: fileUrls['styles.css'],
          // New field with all files
          files: fileUrls,
          warnings,
          success: true
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
            'Access-Control-Allow-Headers': '*',
            'Server-Timing': reqLogger.getServerTimingHeader()
          }
        })
      } catch (error: any) {
        reqLogger.timeEnd(`total`)
        logger.error(`Request error:`, error)

        return Response.json({
          error: error.message,
          success: false
        }, { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
            'Access-Control-Allow-Headers': '*',
            'Server-Timing': reqLogger.getServerTimingHeader()
          }
        })
      }
    }
  })
  .route({
    method: 'GET',
    path: '/bundle/:key',
    async handler({ params, state }) {
      const key = params.key
      
      if (!key) {
        return new Response('Not found', { status: 404 })
      }
      
      // Get content from KV
      const content = await state.env.jsCache.get(key)
      
      if (!content) {
        return new Response('Not found', { status: 404 })
      }
      
      // Determine content type based on file extension
      let contentType = 'application/octet-stream'
      if (key.endsWith('.css')) {
        contentType = 'text/css'
      } else if (key.endsWith('.js')) {
        contentType = 'application/javascript'
      } else if (key.endsWith('.map')) {
        contentType = 'application/json'
      }
      
      return new Response(content, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800', // Browser cache for 7 days
          'Access-Control-Allow-Origin': '*',
        }
      })
    }
  })
  .route({
    method: 'GET',
    path: '/',
    handler() {
      const htmlString = html`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remote Bundler</title>
</head>
<body>
    <div class="container">
        <h1>🚀 Remote Bundler</h1>

        <form id="bundleForm">
            <div class="form-group">
                <label for="externalPackages">External Packages (comma-separated)</label>
                <input type="text" id="externalPackages" name="externalPackages" placeholder="react, react-dom">
            </div>

            <div class="form-group">
                <div class="file-upload">
                    <input type="file" id="fileInput" accept=".js,.jsx,.ts,.tsx" multiple>
                    <label for="fileInput">📁 Or upload files (.js, .jsx, .ts, .tsx) - supports multiple files!</label>
                </div>
            </div>

            <div class="form-group" id="entryPointGroup" style="display: none;">
                <label for="entryPoint">Entry Point (for multiple files)</label>
                <input type="text" id="entryPoint" name="entryPoint" placeholder="index.tsx">
            </div>

            <div class="button-group">
                <button type="submit">Transform Code</button>
            </div>
        </form>

        <div id="output" class="output"></div>
    </div>

    <script>
        const form = document.getElementById('bundleForm');
        const fileInput = document.getElementById('fileInput');
        const output = document.getElementById('output');
        const entryPointGroup = document.getElementById('entryPointGroup');
        const entryPointInput = document.getElementById('entryPoint');

        let uploadedFiles = [];

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                uploadedFiles = [];

                // Read all files
                for (const file of files) {
                    const content = await file.text();
                    uploadedFiles.push({
                        path: file.name,
                        content: content
                    });
                }

                if (files.length === 1) {
                    entryPointGroup.style.display = 'none';
                } else {
                    entryPointGroup.style.display = 'block';

                    // Try to auto-detect entry point
                    const possibleEntries = ['index.tsx', 'index.ts', 'index.jsx', 'index.js', 'main.tsx', 'main.ts', 'app.tsx', 'app.ts'];
                    const entryFile = files.find(f => possibleEntries.includes(f.name));
                    if (entryFile) {
                        entryPointInput.value = entryFile.name;
                    } else {
                        entryPointInput.value = files[0].name;
                    }
                }
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);

            // Parse external packages
            const externalPackagesStr = formData.get('externalPackages') || '';
            const externalPackages = externalPackagesStr ?
                externalPackagesStr.split(',').map(p => p.trim()).filter(Boolean) : [];

            // Check if files were uploaded
            if (uploadedFiles.length === 0) {
                alert('Please upload files to bundle');
                return;
            }

            const body = {
                files: uploadedFiles,
                entryPoint: uploadedFiles.length > 1 ?
                    formData.get('entryPoint') :
                    undefined, // Let backend use first file for single file uploads
                externalPackages
            };

            try {
                const response = await fetch('/api/bundle', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                const result = await response.json();

                output.classList.add('show');

                if (result.success) {
                    let html = '<h3>✨ Bundle URLs</h3>';
                    
                    if (result.files && Object.keys(result.files).length > 0) {
                        html += '<div style="margin: 20px 0;">';
                        html += '<h4>Generated Files:</h4>';
                        html += '<ul>';
                        for (const [filename, url] of Object.entries(result.files)) {
                            html += '<li><a href="' + url + '" target="_blank">' + filename + '</a></li>';
                        }
                        html += '</ul>';
                        html += '</div>';
                    }
                    
                    if (result.jsUrl && result.cssUrl) {
                        html += '<h4>Include in your HTML:</h4>';
                        html += '<pre>' + escapeHtml('<link rel="stylesheet" href="' + result.cssUrl + '">\\n<script type="module" src="' + result.jsUrl + '"></script>') + '</pre>';
                    }
                    
                    output.innerHTML = html;
                } else {
                    output.innerHTML = '<div class="error">❌ Error: ' + escapeHtml(result.error) + '</div>';
                }
            } catch (error) {
                output.classList.add('show');
                output.innerHTML = '<div class="error">❌ Error: ' + escapeHtml(error.message) + '</div>';
            }
        });

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
    </script>
</body>
</html>`;

      return new Response(htmlString, {
        headers: {
          'content-type': 'text/html;charset=UTF-8'
        }
      })
    }
  })

export default {
  async fetch(request: Request, env: Env) {
    return await app.handle(request, { state: { env } })
  }
}