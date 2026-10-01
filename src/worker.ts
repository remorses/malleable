import { Spiceflow } from 'spiceflow'
import { z } from 'zod'

import { buildFiles, createKvBuildCache, formatBuildError } from './build.js'
import { projectsApi, projectsPublic, type ProjectsEnv } from './projects-api.js'
import { logger, createRequestLogger } from './logger.js'
import { IMPORTMAP } from './importmap.js'
import { waitUntil } from 'cloudflare:workers'

export { ProjectDO } from './project-do.js'

interface Env extends ProjectsEnv {
  jsCache: KVNamespace
}

function corsHeaders(serverTiming?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
    'Access-Control-Allow-Headers': '*',
    ...(serverTiming ? { 'Server-Timing': serverTiming } : {}),
  }
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
  siteId: z
    .string()
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Only alphanumeric, underscore, and dash characters are allowed',
    ),
})

export type BundleInput = z.infer<typeof bundleSchema>

// Tagged template for HTML syntax highlighting
const html = (strings: TemplateStringsArray, ...values: any[]) =>
  strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')

// Create app with state
const app = new Spiceflow()
  .state('env', {} as Env)
  .use(projectsApi)
  .use(projectsPublic)
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
    async handler({ request, state }) {
      // Create request-scoped logger
      const reqLogger = createRequestLogger()

      reqLogger.time(`total`)

      try {
        reqLogger.time(`parse-body`)
        const body = await request.json()
        reqLogger.timeEnd(`parse-body`)
        const {
          files,
          entryPoint,
          externalPackages = [],
          siteId,
        } = body

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

        // Prepare CSS URL for the virtual entry
        const baseUrl = new URL(request.url).origin
        const cssUrl = `${baseUrl}/bundle/${siteId}/index.css`

        reqLogger.time(`build`)
        const built = await buildFiles({
          files,
          entryPoint: actualEntryPoint,
          externalPackages,
          cssUrl,
          outdir: siteId,
          cache: createKvBuildCache(state.env.jsCache, waitUntil),
        })
        reqLogger.timeEnd(`build`)
        if (!built.ok) {
          reqLogger.timeEnd(`total`)
          return Response.json(
            {
              error: built.errors[0]?.text || 'Build failed',
              errorText: built.errorText,
              success: false,
            },
            { status: built.fromBundler ? 400 : 500,
              headers: corsHeaders(reqLogger.getServerTimingHeader()), },
          )
        }
        const css = built.css
        const warnings = built.warnings
        const outputFiles = built.outputs.map((o) => ({
          path: `${siteId}/${o.path}`,
          text: o.text,
        }))

        // Store all output files in KV
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
          filename: `${siteId}/index.css`,
          text: css,
          isJs: false,
        })

        fileUrls[`${siteId}/index.css`] = cssUrl

        // The main entry file will be at siteId/index.js
        const mainJsUrl = fileUrls[`${siteId}/index.js`] || undefined

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
        const htmlKey = `${siteId}/index.html`
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

            console.log(`${siteId}: storing in jsCache`, file.filename)
            return state.env.jsCache.put(
              file.filename,
              file.text,
              metadata ? { metadata } : undefined,
            )
          }),
        )
        reqLogger.timeEnd(`kv-storage`)

        reqLogger.timeEnd(`total`)

        // Create HTML URL
        const htmlUrl = `${baseUrl}/bundle/${htmlKey}`

        // Create raw bundler output metadata (without text content)
        const rawOutputs = built.rawOutputs.map((file) => ({
          path: file.path,
          size: file.size,
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
      } catch (error) {
        // Make sure to end any timers that might still be running
        try {
          reqLogger.timeEnd(`total`)
        } catch {}
        logger.error(`Request error:`, error)

        const failure = formatBuildError(error)
        return Response.json(
          {
            error: failure.errors[0]?.text || 'Build failed',
            errorText: failure.errorText,
            success: false,
          },
          {
            status: failure.fromBundler ? 400 : 500,
            headers: corsHeaders(reqLogger.getServerTimingHeader()),
          },
        )
      }
    },
  })
  .route({
    method: 'GET',
    path: '/bundle/*',
    async handler({ params, state }) {
      const key = params['*']

      if (!key) {
        return new Response('Not found', { status: 404 })
      }

      // Get content and metadata from KV
      const kvResult = (await state.env.jsCache.getWithMetadata(key)) as {
        value: string | null
        metadata: { serverTiming?: string } | null
      }

      if (!kvResult.value) {
        // Extract siteId from key (format: siteId/filename)
        const siteId = key.split('/')[0] || 'unknown'
        console.log(`${siteId}: not found`, key, params)
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
    const state = {
      ...env,
      env,
      waitUntil: ctx.waitUntil.bind(ctx),
    }
    return await app.handle(request, { state } as any)
  },
}
