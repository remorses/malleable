import dedent from 'string-dedent'
import { IMPORTMAP } from './importmap.js'

const HTML = dedent

/**
 * Minimal live viewer: follows a project over the socket and renders its entry component.
 * `?ref=<sha|branch>` pins a version and stops following.
 */
export function viewPage(projectId: string) {
  return HTML`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${projectId}</title>
        <script type="importmap">${IMPORTMAP}</script>
      </head>
      <body>
        <div id="status" data-testid="status" style="font:12px monospace;padding:4px;background:#eee"></div>
        <div id="root"></div>
        <script type="module">
          import React from 'react'
          import { createRoot } from 'react-dom/client'
          const id = ${JSON.stringify(projectId)}
          const pinned = new URLSearchParams(location.search).get('ref')
          const root = createRoot(document.getElementById('root'))
          const status = document.getElementById('status')
          const base = location.origin + '/p/' + id
          const show = async (url, label) => {
            const mod = await import(url)
            root.render(React.createElement(mod.default))
            status.textContent = label
          }
          if (pinned) {
            show(base + '/r/' + pinned + '/index.js', 'pinned ' + pinned.slice(0, 7))
          } else {
            const ws = new WebSocket(base.replace('http', 'ws') + '/live')
            ws.onmessage = (e) => {
              const m = JSON.parse(e.data)
              if (m.type === 'hello' && m.heads.main) show(base + '/r/' + m.heads.main + '/index.js', 'commit ' + m.heads.main.slice(0, 7))
              if (m.type === 'draft') show(base + '/d/' + m.session + '/' + m.build + '/index.js', 'draft ' + m.build)
              if (m.type === 'update') show(base + '/r/' + m.sha + '/index.js', 'commit ' + m.sha.slice(0, 7) + ': ' + m.message)
              if (m.type === 'draft-error') status.textContent = 'build error'
            }
          }
        </script>
      </body>
    </html>
  `
}
