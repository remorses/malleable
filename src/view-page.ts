import dedent from 'string-dedent'
const HTML = dedent

const IMPORTMAP = JSON.stringify({
  imports: {
    react: 'https://esm.sh/react@19',
    'react-dom': 'https://esm.sh/react-dom@19',
    'react-dom/': 'https://esm.sh/react-dom@19/',
    'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
    'react/jsx-dev-runtime': 'https://esm.sh/react@19/jsx-dev-runtime',
  },
})

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

          // A module that fails to import or render is replaced by the last one that worked
          let shown = null
          let fallback = null
          let failedUrl = null
          class Boundary extends React.Component {
            state = { failed: false }
            static getDerivedStateFromError() {
              return { failed: true }
            }
            componentDidCatch(error) {
              failed(this.props.module, error)
            }
            render() {
              return this.state.failed ? null : React.createElement(this.props.module.Component)
            }
          }
          const render = () => {
            root.render(shown && React.createElement(Boundary, { key: shown.url, module: shown }))
          }
          const failed = (module, error) => {
            console.error('preview ' + module.url + ' failed', error)
            failedUrl = module.url
            if (shown?.url === module.url) {
              shown = fallback?.url === module.url ? null : fallback
              fallback = shown
              render()
            }
            status.textContent = 'error in ' + module.label + ', showing ' + (shown ? shown.label : 'nothing') + ': ' + error.message
          }
          const show = async (url, label) => {
            const module = { url, label }
            try {
              module.Component = (await import(location.origin + url)).default
            } catch (error) {
              return failed(module, error)
            }
            if (shown && shown.url !== failedUrl) fallback = shown
            shown = module
            failedUrl = null
            status.textContent = label
            render()
          }
          if (pinned) {
            show('/p/' + id + '/r/' + pinned + '/index.js', 'pinned ' + pinned.slice(0, 7))
          } else {
            const ws = new WebSocket(base.replace('http', 'ws') + '/live')
            ws.onmessage = (e) => {
              const m = JSON.parse(e.data)
              if (m.type === 'hello' && m.heads.main) show('/p/' + id + '/r/' + m.heads.main + '/index.js', 'commit ' + m.heads.main.slice(0, 7))
              if (m.type === 'update') show(m.url, m.kind === 'draft' ? 'draft ' + m.build : 'commit ' + m.sha.slice(0, 7) + ': ' + m.message)
              if (m.type === 'build-error') status.textContent = 'build error'
            }
          }
        </script>
      </body>
    </html>
  `
}
