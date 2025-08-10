import { Hono } from 'hono'
import { html } from 'hono/html'
import * as esbuild from 'esbuild-wasm'
import wasm from '../node_modules/esbuild-wasm/esbuild.wasm'

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

export default app
