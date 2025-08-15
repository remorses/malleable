import { Spiceflow } from 'spiceflow'
import { z } from 'zod'

import { generateTailwindCSS, shadcnTheme } from './generate-tailwind.js'
import { createEsmShPlugin } from './esm-https-plugin.js'
import { createLocalResolverPlugin } from './local-resolver-plugin.js'
import { createVirtualEntryPlugin } from './virtual-entry-plugin.js'
import { logger, createRequestLogger } from './logger.js'
import { Container, getContainer, getRandom } from '@cloudflare/containers'
import { createSpiceflowClient } from 'spiceflow/client'
import type { ContainerApp } from './bun-server.js'
import { IMPORTMAP } from './importmap.js'
import { waitUntil } from 'cloudflare:workers'
import { PrerenderRequest, PrerenderResult } from './prerender.tsx'

// Bun container using the @cloudflare/containers utility
export class BunContainer extends Container {
  // Configure default port for the container
  defaultPort = 8080

  // Sleep after 1 second of inactivity for quick cleanup
  sleepAfter = '1m'

  // Lifecycle hooks
  // override onStart(): void {
  //   console.log('Bun container started!')
  // }

  // override onStop(): void {
  //   console.log('Bun container stopped')
  // }
  //
  //
  async prerender(input: PrerenderRequest) {
    const res = await this.containerFetch('http://localhost/prerender', {
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`failed prerender in Bun: ${await res.text()}`)
    const json = (await res.json()) as PrerenderResult
    return json
  }

  override onError(error: unknown): void {
    console.error('Container error:', error)
  }
}

interface Env {
  jsCache: KVNamespace
  BUN_CONTAINER: DurableObjectNamespace<BunContainer>
}

interface State extends Env {
  waitUntil?: (promise: Promise<any>) => void
}

// Helper to create a Spiceflow client from a container stub

let init = false

// Generate hash for cache key
async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 16) // Use first 16 chars for shorter URLs
}

// Schema for bundle API
const fileSchema = z.object({
  path: z.string(),
  content: z.string(),
})

const bundleSchema = z.object({
  files: z.array(fileSchema),
  entryPoint: z.string().optional(),
  externalPackages: z.array(z.string()).default([]),
})

// Tagged template for HTML syntax highlighting
const html = (strings: TemplateStringsArray, ...values: any[]) =>
  strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')

// Create app with state
const app = new Spiceflow()
  .route({
    method: 'POST',
    path: '/api/prerender',
    request: z.object({
      files: z.array(
        z.object({
          path: z.string(),
          content: z.string(),
        }),
      ),
      entryPoint: z.string().optional(),
      cssUrls: z.array(z.string()).default([]),
      bootstrapModules: z.array(z.string()).default([]),
      importmap: z.string().optional(),
    }),
    async handler({ request, state }: any) {
      try {
        const body = await request.json()

        // Use load-balanced container pool with 3 instances
        const containerStub = (await getRandom(
          state.BUN_CONTAINER,
          1,
        )) as DurableObjectStub<BunContainer>

        // Use the Spiceflow client to prerender

        const data = await containerStub.prerender({
          files: body.files,
          entryPoint: body.entryPoint,
          cssUrls: body.cssUrls,
          bootstrapModules: body.bootstrapModules,
          importmap: body.importmap || IMPORTMAP,
        })

        return Response.json({
          success: true,
          html: data.html,
          renderTime: data.renderTime,
        })
      } catch (error: any) {
        return Response.json(
          {
            success: false,
            error: error.message || 'Failed to prerender',
          },
          { status: 500 },
        )
      }
    },
  })
  .route({
    method: 'OPTIONS',
    path: '/api/bundle',
    handler() {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods':
            'OPTIONS, GET, POST, PUT, PATCH, DELETE',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      })
    },
  })
  .route({
    method: 'POST',
    path: '/api/bundle',
    request: bundleSchema,
    async handler({ request, state }: any) {
      // Create request-scoped logger
      const reqLogger = createRequestLogger()

      reqLogger.time(`total`)

      reqLogger.time(`import-esbuild`)
      const [esbuild, wasm] = await Promise.all([
        import('esbuild-wasm'),
        import('../node_modules/esbuild-wasm/esbuild.wasm').then(
          (mod) => mod.default,
        ),
      ])
      reqLogger.timeEnd(`import-esbuild`)

      if (!init) {
        reqLogger.time(`esbuild-init`)
        await esbuild.initialize({
          wasmModule: process.env.VITEST ? undefined : wasm,
          worker: false,
        })
        init = true
        reqLogger.timeEnd(`esbuild-init`)
      }

      try {
        reqLogger.time(`parse-body`)
        const body = await request.json()
        reqLogger.timeEnd(`parse-body`)
        const { files, entryPoint, externalPackages = [] } = body

        // Determine actual entry point
        const actualEntryPoint = entryPoint || files[0]?.path

        if (!actualEntryPoint) {
          return Response.json(
            {
              error: 'No files provided',
              success: false,
            },
            { status: 400 },
          )
        }

        // Validate entry point exists
        const entryFile = files.find((f) => f.path === actualEntryPoint)
        if (!entryFile) {
          return Response.json(
            {
              error: `Entry point "${actualEntryPoint}" not found in provided files`,
              success: false,
            },
            { status: 400 },
          )
        }

        // Generate hash for the entry point name
        reqLogger.time(`hash-generation`)
        const hashInput = JSON.stringify({
          files: files.sort((a, b) => a.path.localeCompare(b.path)),
          entryPoint: actualEntryPoint,
          externalPackages: externalPackages.sort(),
          tailwindConfig: JSON.stringify(shadcnTheme),
        })
        const entryHash = await generateHash(hashInput)
        reqLogger.timeEnd(`hash-generation`)

        // Prepare CSS URL for the virtual entry
        const baseUrl = new URL(request.url).origin
        const cssUrl = `${baseUrl}/bundle/${entryHash}.css`

        // Collect all code for CSS extraction
        const allCode = files.map((f) => f.content).join('\n')

        // Run esbuild and Tailwind CSS extraction concurrently
        reqLogger.time(`parallel-build`)
        const [result, css] = await Promise.all([
          // Build with esbuild using virtual entry
          (async () => {
            reqLogger.time(`esbuild-build`)
            const res = await esbuild.build({
              entryPoints: { [entryHash]: 'virtual:entry' },
              outdir: './',
              bundle: true,
              format: 'esm',
              splitting: true,
              sourcemap: false,
              target: 'es2020',
              platform: 'browser',
              write: false,
              minify: false,
              jsx: 'automatic',
              plugins: [
                createVirtualEntryPlugin({
                  actualEntryPath: actualEntryPoint,
                  cssUrl,
                  baseUrl,
                }),
                createLocalResolverPlugin({
                  files,
                }),
                createEsmShPlugin({ externalPackages }),
              ],
              absWorkingDir: '/',
              loader: {
                '.tsx': 'tsx',
                '.ts': 'tsx',
                '.jsx': 'tsx',
                '.js': 'tsx',
                '.css': 'css',
              },
              // Configure output filenames - [name] will be our hash
              entryNames: '[name]', // entry outputs use hash as name
              chunkNames: 'chunks/[name]-[hash]', // shared/lazy chunks
              assetNames: 'assets/[name]-[hash]', // emitted assets
            })
            reqLogger.timeEnd(`esbuild-build`)
            return res
          })(),
          // Generate Tailwind CSS
          (async () => {
            reqLogger.time(`tailwind-css`)
            const styles = await generateTailwindCSS(allCode)
            reqLogger.timeEnd(`tailwind-css`)
            return styles
          })(),
        ])
        reqLogger.timeEnd(`parallel-build`)

        const outputFiles = result.outputFiles || []
        const warnings = result.warnings

        // Store all output files in KV
        const ttl = 60 * 60 * 24 * 7 // 7 days in seconds
        const fileUrls: Record<string, string> = {}

        // Prepare files for storage
        const filesToStore: Array<{
          filename: string
          text: string
          isJs: boolean
        }> = []

        for (const file of outputFiles) {
          // Extract filename from path (remove leading ./)
          const filename = file.path.replace(/^\.?\//, '')
          filesToStore.push({
            filename,
            text: file.text,
            isJs: filename.endsWith('.js'),
          })
          fileUrls[filename] =
            `${new URL(request.url).origin}/bundle/${filename}`
        }

        let serverTimingHeader = reqLogger.getServerTimingHeader()

        // Now store all files with metadata
        const kvPromises: Promise<void>[] = []

        // Store CSS file
        filesToStore.push({
          filename: `${entryHash}.css`,
          text: css,
          isJs: false,
        })

        // The main entry file will be named with our hash
        const mainJsUrl = fileUrls[`${entryHash}.js`] || undefined

        // Collect all CSS file URLs
        const cssUrls: string[] = [cssUrl]
        for (const [filename, url] of Object.entries(fileUrls)) {
          if (filename.endsWith('.css')) {
            cssUrls.push(url)
          }
        }

        // Generate initial HTML for client-side rendering
        reqLogger.time(`html-generation`)
        const htmlContent = html`<!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              />
              <title>React App</title>
              ${cssUrls
                .map((url) => `<link rel="stylesheet" href="${url}">`)
                .join('\n    ')}
              <script type="importmap">
                ${IMPORTMAP}
              </script>
            </head>
            <body>
              <div id="root"></div>
              <script type="module">
                import React from 'react'
                import ReactDOM from 'react-dom/client'
                import App from '${mainJsUrl}'

                const root = ReactDOM.createRoot(
                  document.getElementById('root'),
                )
                root.render(React.createElement(App))
              </script>
            </body>
          </html>`
        reqLogger.timeEnd(`html-generation`)

        // Store HTML in KV
        const htmlKey = `${entryHash}.html`
        filesToStore.push({
          filename: htmlKey,
          text: htmlContent,
          isJs: false,
        })

        // Store other files with metadata for JS files
        reqLogger.time(`kv-storage`)
        await Promise.all(
          filesToStore.map((file) => {
            const metadata = file.isJs
              ? { serverTiming: serverTimingHeader }
              : undefined

            console.log(`storing in jsCache`, file.filename)
            return state.jsCache.put(file.filename, file.text, {
              expirationTtl: ttl,
              metadata,
            })
          }),
        )
        reqLogger.timeEnd(`kv-storage`)

        reqLogger.timeEnd(`total`)

        waitUntil(
          (async () => {
            try {
              // Use load-balanced container pool for background prerendering
              const containerStub = (await getRandom(
                state.BUN_CONTAINER,
                3,
              )) as DurableObjectStub<BunContainer>

              // Use the Spiceflow client to prerender

              const data = await containerStub.prerender({
                files,
                entryPoint: actualEntryPoint,
                cssUrls,
                bootstrapModules: mainJsUrl ? [mainJsUrl] : [],
                importmap: IMPORTMAP,
              })

              if (data.html) {
                // Update the HTML in KV with prerendered content
                console.log(`Updating ${htmlKey} with prerendered HTML`)
                await state.jsCache.put(htmlKey, data.html, {
                  expirationTtl: ttl,
                })
              }
            } catch (error) {
              console.error('Background prerender error:', error)
            }
          })(),
        )

        // Create HTML URL
        const htmlUrl = `${baseUrl}/bundle/${htmlKey}`

        // Create raw esbuild output metadata (without text content)
        const rawOutputs = outputFiles.map((file) => ({
          path: file.path,
          size: file.contents.byteLength,
          type: file.path.endsWith('.map')
            ? 'sourcemap'
            : file.path.includes('chunks/')
              ? 'chunk'
              : 'entry',
        }))

        // Return URLs for all files (CSS is now injected via JS)
        return Response.json(
          {
            jsUrl: mainJsUrl,
            htmlUrl,
            files: fileUrls,
            rawOutputs,
            warnings,
            success: true,
          },
          {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods':
                'OPTIONS, GET, POST, PUT, PATCH, DELETE',
              'Access-Control-Allow-Headers': '*',
              'Server-Timing': reqLogger.getServerTimingHeader(),
            },
          },
        )
      } catch (error: any) {
        // Make sure to end any timers that might still be running
        try {
          reqLogger.timeEnd(`parallel-build`)
        } catch {}
        try {
          reqLogger.timeEnd(`total`)
        } catch {}
        logger.error(`Request error:`, error)

        // Format the error nicely using esbuild's built-in formatMessages if it's a build error
        let errorText = 'Build failed'
        if (error && error.errors && error.errors.length > 0) {
          const formatted = await esbuild.formatMessages(error.errors, {
            kind: 'error',
            color: false, // No ANSI colors for web output
            terminalWidth: 100,
          })
          errorText = formatted.join('\n')
        } else if (error && error.message) {
          errorText = error.message
        }

        // Also format warnings if any
        let warningText = ''
        if (error && error.warnings && error.warnings.length > 0) {
          const formatted = await esbuild.formatMessages(error.warnings, {
            kind: 'warning',
            color: false, // No ANSI colors for web output
            terminalWidth: 100,
          })
          warningText = formatted.join('\n')
        }

        return Response.json(
          {
            error: error?.message || 'Build failed',
            errorText,
            warningText: warningText || undefined,
            success: false,
          },
          {
            status: error?.errors ? 400 : 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods':
                'OPTIONS, GET, POST, PUT, PATCH, DELETE',
              'Access-Control-Allow-Headers': '*',
              'Server-Timing': reqLogger.getServerTimingHeader(),
            },
          },
        )
      }
    },
  })
  .route({
    method: 'GET',
    path: '/bundle/*',
    async handler({ params, state }: any) {
      const key = params['*']

      if (!key) {
        return new Response('Not found', { status: 404 })
      }

      // Get content and metadata from KV
      const kvResult = (await state.jsCache.getWithMetadata(key)) as {
        value: string | null
        metadata: { serverTiming?: string } | null
      }

      if (!kvResult.value) {
        console.log('not found', key, params)
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
      } else if (key.endsWith('.html')) {
        contentType = 'text/html'
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        // 'Cache-Control': 'public, max-age=604800', // Browser cache for 7 days
        'Access-Control-Allow-Origin': '*',
      }

      // Add Server-Timing header if available in metadata
      if (kvResult.metadata?.serverTiming) {
        headers['Server-Timing'] = kvResult.metadata.serverTiming
      }

      return new Response(kvResult.value, { headers })
    },
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
    <title>Lovepack - Fast TypeScript/React Bundler</title>
</head>
<body>
    <div class="container">
        <h1>💝 Lovepack</h1>

        <form id="bundleForm">
            <div class="form-group">
                <label for="externalPackages">External Packages (comma-separated)</label>
                <input type="text" id="externalPackages" name="externalPackages" placeholder="react, react-dom">
            </div>

            <div class="form-group">
                <div class="file-upload">
                    <input type="file" id="fileInput" accept=".js,.jsx,.ts,.tsx,.css" multiple>
                    <label for="fileInput">📁 Or upload files (.js, .jsx, .ts, .tsx, .css) - supports multiple files!</label>
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

                    if (result.htmlUrl) {
                        html += '<h4>🎉 React App Preview:</h4>';
                        html += '<p><a href="' + result.htmlUrl + '" target="_blank" style="font-size: 1.2em; font-weight: bold;">Open React App →</a></p>';
                        html += '<p><small>This HTML page automatically renders your React component</small></p>';
                    }

                    if (result.jsUrl) {
                        html += '<h4>Include in your HTML:</h4>';
                        html += '<pre>' + escapeHtml('<script type="module" src="' + result.jsUrl + '"></script>') + '</pre>';
                        html += '<p><small>CSS is automatically loaded by the JavaScript bundle</small></p>';
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
</html>`

      return new Response(htmlString, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
        },
      })
    },
  })

export { app }

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const state: State = {
      ...env,
      waitUntil: ctx.waitUntil.bind(ctx),
    }
    return await app.handle(request, { state } as any)
  },
}
