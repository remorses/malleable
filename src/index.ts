import { Hono } from 'hono'
import { html } from 'hono/html'
import * as esbuild from 'esbuild-wasm'
import wasm from '../node_modules/esbuild-wasm/esbuild.wasm'
import { generateTailwindCSS } from './generate-tailwind'
import { createEsmShPlugin } from './plugins'

const script = `/// <reference lib="DOM" />

import { renderToString } from 'https://esm.sh/react-dom@18.2.0/server'
import React from 'https://esm.sh/react@18.2.0'

const add = (num1: number, num2: number): number => {
  return num1 + num2
}

const Component = () => (
  <div>
    <h1>
      Hello from <code>/static/hello.tsx</code>
    </h1>
    <p>{add(1, 2).toString()}</p>
  </div>
)

addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = renderToString(<Component />)
  }
})`

let init = false

const app = new Hono()

app.get('/script.js', async (c) => {
  if (!init) {
    await esbuild.initialize({
      wasmModule: wasm,
      worker: false
    })
    init = true
  }
  const { code } = await esbuild.transform(script, {
    loader: 'tsx'
  })
  return c.body(code, {
    headers: {
      'content-type': 'text/javascript'
    }
  })
})

app.get('/', (c) => {
  return c.html(html`
    <html>
      <head>
        <script type="module" src="/script.js"></script>
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `)
})

app.post('/api/bundle', async (c) => {
  if (!init) {
    await esbuild.initialize({
      wasmModule: wasm,
      worker: false
    })
    init = true
  }

  try {
    const body = await c.req.json()
    const { 
      code: inputCode, 
      loader = 'tsx', 
      extractCSS = true,
      resolveImports = false,
      externalPackages = []
    } = body

    if (!inputCode) {
      return c.json({ error: 'No code provided' }, 400)
    }

    // Use transform for simple transpilation or build for import resolution
    let code: string
    let warnings: esbuild.Message[] = []
    
    if (resolveImports) {
      // Use build API with esm.sh plugin for import resolution
      const result = await esbuild.build({
        stdin: {
          contents: inputCode,
          loader: loader as esbuild.Loader,
          resolveDir: '/',
        },
        bundle: true,
        format: 'esm',
        target: 'es2020',
        platform: 'browser',
        write: false,
        plugins: [createEsmShPlugin({ externalPackages })],
      })
      
      code = result.outputFiles?.[0]?.text || ''
      warnings = result.warnings
    } else {
      // Use transform API for simple transpilation
      const result = await esbuild.transform(inputCode, {
        loader: loader as esbuild.Loader,
        target: 'es2020',
        format: 'esm'
      })
      code = result.code
      warnings = result.warnings
    }

    let css = ''
    if (extractCSS) {
      // Generate Tailwind CSS using PostCSS and Tailwind v3
      css = await generateTailwindCSS(inputCode)
    }

    return c.json({
      code,
      css,
      warnings,
      success: true
    })
  } catch (error) {
    return c.json({
      error: error.message,
      success: false
    }, 500)
  }
})

export default app
