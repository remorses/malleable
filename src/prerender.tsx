import React from 'react'
import { prerender } from 'react-dom/static.edge'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { IMPORTMAP } from './importmap.js'

export const prerenderRequestSchema = z.object({
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
  runNpmInstall: z.boolean().default(false).optional(),
  siteId: z.string().optional(),
})

export const prerenderResultSchema = z.object({
  html: z.string(),
  error: z.string().optional(),
  renderTime: z.number(),
})

export type PrerenderRequest = z.infer<typeof prerenderRequestSchema>
export type PrerenderResult = z.infer<typeof prerenderResultSchema>

export interface PrerenderResponse {
  html: string
  error?: string
  renderTime: number
}

export async function prerenderComponent(
  input: PrerenderRequest,
  signal?: AbortSignal,
): Promise<PrerenderResponse> {
  const startTime = performance.now()
  const tempDir = `/tmp/render_${Date.now()}`

  try {
    const {
      files,
      entryPoint,
      cssUrls,
      bootstrapModules,
      importmap,
      runNpmInstall,
    } = input

    // Determine actual entry point
    const actualEntryPoint = entryPoint || files[0]?.path
    if (!actualEntryPoint) {
      throw new Error('No files provided')
    }

    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true })

    // If runNpmInstall is true, create package.json and install dependencies
    if (runNpmInstall) {
      const packageJson = {
        name: 'temp-prerender',
        version: '1.0.0',
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
        },
      }

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
        'utf8',
      )

      // Run npm install in the temp directory
      execSync('npm install', { cwd: tempDir, stdio: 'ignore' })
    }

    // Write all files to disk
    for (const file of files) {
      const filePath = path.join(tempDir, file.path)
      const dir = path.dirname(filePath)

      // Create directory if needed
      if (dir !== tempDir) {
        await fs.mkdir(dir, { recursive: true })
      }

      await fs.writeFile(filePath, file.content, 'utf8')
    }

    // Save current directory and change to temp directory
    const originalDir = process.cwd()
    process.chdir(tempDir)

    try {
      // Import the entry component dynamically
      const modulePath = path.resolve(tempDir, actualEntryPoint)
      const EntryComponent = (await import(modulePath)).default

      // Create wrapper component with HTML structure
      function App() {
        return (
          <html lang='en'>
            <head>
              <meta charSet='UTF-8' />
              <meta
                name='viewport'
                content='width=device-width, initial-scale=1.0'
              />
              <title>React App</title>
              {cssUrls.map((url) => (
                <link key={url} rel='stylesheet' href={url} />
              ))}
              <script
                type='importmap'
                dangerouslySetInnerHTML={{ __html: importmap || IMPORTMAP }}
              />
            </head>
            <body>
              <div id='root'>
                <EntryComponent />
              </div>
              {bootstrapModules.map((url) => (
                <script key={url} type='module' src={url} />
              ))}
            </body>
          </html>
        )
      }

      // Bootstrap script content for hydration
      const bootstrapScriptContent =
        bootstrapModules.length > 0
          ? `
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from '${bootstrapModules[0]}';

const root = document.getElementById('root');
if (root) {
  hydrateRoot(root, React.createElement(App));
}
`
          : `
import React from 'react';
import { hydrateRoot } from 'react-dom/client';

// Dynamically import the app
import('${bootstrapModules[0] || `./${actualEntryPoint}`}').then(module => {
  const App = module.default;
  const root = document.getElementById('root');
  if (root) {
    hydrateRoot(root, React.createElement(App));
  }
});
`

      // Render to string using prerender
      async function renderToString() {
        const { prelude } = await prerender(<App />, {
          bootstrapScriptContent,
          bootstrapModules,
          onError(error, errorInfo) {
            console.error(error, errorInfo)
          },
          signal,
        })

        const reader = prelude.getReader()
        let content = ''
        while (true) {
          const { done, value } = await reader.read()
          if (value) content += Buffer.from(value).toString('utf8')
          if (done) {
            return content
          }
        }
      }

      const html = await renderToString()

      return {
        html: html || '',
        renderTime: performance.now() - startTime,
      }
    } finally {
      // Always restore original directory
      process.chdir(originalDir)

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  } catch (error: any) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    return {
      html: '',
      error: error.message || 'Failed to prerender component',
      renderTime: performance.now() - startTime,
    }
  }
}
