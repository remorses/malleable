import { Hono } from 'hono'
import { html } from 'hono/html'
import * as esbuild from 'esbuild-wasm'
import wasm from '../node_modules/esbuild-wasm/esbuild.wasm'
import { getTailwindClasses } from './get-tailwind-classes'

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
    const { code: inputCode, loader = 'tsx', extractCSS = true } = body

    if (!inputCode) {
      return c.json({ error: 'No code provided' }, 400)
    }

    const { code, warnings } = await esbuild.transform(inputCode, {
      loader: loader as esbuild.Loader,
      target: 'es2020',
      format: 'esm'
    })

    let css = ''
    if (extractCSS) {
      try {
        // Extract Tailwind classes using the WASM scanner
        const classes = await getTailwindClasses({
          content: inputCode,
          extension: loader === 'tsx' || loader === 'jsx' ? 'jsx' : 'js'
        })
        
        // Return the extracted classes
        // Note: @tailwindcss/oxide doesn't work in Cloudflare Workers (requires .node files)
        // Full CSS generation would require bundling Tailwind's CSS files
        css = `/* Extracted Tailwind classes: ${classes.join(', ')} */`
      } catch (cssError: any) {
        console.warn('CSS extraction failed:', cssError)
        css = `/* CSS extraction failed: ${cssError.message} */`
      }
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
