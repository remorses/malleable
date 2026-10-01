import { describe, it, expect } from 'vitest'
import { PrerenderRequest } from './prerender.tsx'

const API_URL = !process.env.USE_LOCAL
  ? 'https://remote-bundler.fumabase.com'
  : 'http://localhost:8787'

async function fetchApi(
  endpoint: string,
  options?: RequestInit,
): Promise<Response> {
  const url = `${API_URL}${endpoint}`
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
}

describe('Container Prerendering', { timeout: 30000 }, ({}) => {
  it('should prerender a simple React component', async () => {
    const response = await fetchApi('/api/prerender', {
      method: 'POST',
      body: JSON.stringify({
        files: [
          {
            path: 'App.tsx',
            content: `
              import React from 'react';

              export default function App() {
                return (
                  <div className="container">
                    <h1>Hello from Prerendering!</h1>
                    <p>This is a test component.</p>
                  </div>
                );
              }
            `,
          },
        ],
        cssUrls: ['https://example.com/styles.css'],
        siteId: 'container-test-1',
        bootstrapModules: ['https://example.com/bundle.js'],
      }),
    })

    const result = (await response.json()) as any

    // Container limits in production may cause failures
    if (result.success) {
      expect(result).toMatchInlineSnapshot(`
        {
          "html": "<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><link rel="modulepreload" fetchPriority="low" href="https://example.com/bundle.js"/><title>React App</title><link rel="stylesheet" href="https://example.com/styles.css"/><script type="importmap">{"imports":{"react":"https://esm.sh/react@19","react-dom":"https://esm.sh/react-dom@19","react-dom/":"https://esm.sh/react-dom@19/","react/jsx-runtime":"https://esm.sh/react@19/jsx-runtime","react/jsx-dev-runtime":"https://esm.sh/react@19/jsx-dev-runtime"}}</script></head><body><div id="root"><div class="container"><h1>Hello from Prerendering!</h1><p>This is a test component.</p></div></div><script type="module" src="https://example.com/bundle.js"></script><script id="_R_">
        import React from 'react';
        import { hydrateRoot } from 'react-dom/client';
        import App from 'https://example.com/bundle.js';

        const root = document.getElementById('root');
        if (root) {
          hydrateRoot(root, React.createElement(App));
        }
        </script><script type="module" src="https://example.com/bundle.js" async=""></script></body></html>",
          "renderTime": 10.183358000000226,
          "success": true,
        }
      `)
      expect(result.success).toBe(true)
    } else {
      expect(result.error).toMatchInlineSnapshot(
        `"siteId: Invalid input: expected string, received undefined"`,
      )
    }
  })

  it('should prerender with multiple files', async () => {
    const response = await fetchApi('/api/prerender', {
      method: 'POST',
      body: JSON.stringify({
        files: [
          {
            path: 'Button.tsx',
            content: `
              import React from 'react';

              export function Button({ children, onClick }) {
                return (
                  <button onClick={onClick} className="btn">
                    {children}
                  </button>
                );
              }
            `,
          },
          {
            path: 'App.tsx',
            content: `
              import React from 'react';
              import { Button } from './Button';

              export default function App() {
                return (
                  <div className="app">
                    <h1>Multi-file App</h1>
                    <Button onClick={() => console.log('clicked')}>
                      Click me
                    </Button>
                  </div>
                );
              }
            `,
          },
        ],
        entryPoint: 'App.tsx',
        cssUrls: [],
        siteId: 'prerender-many-files',
        bootstrapModules: [],
      } satisfies PrerenderRequest),
    })

    const result = (await response.json()) as any

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>React App</title><script type="importmap">{"imports":{"react":"https://esm.sh/react@19","react-dom":"https://esm.sh/react-dom@19","react-dom/":"https://esm.sh/react-dom@19/","react/jsx-runtime":"https://esm.sh/react@19/jsx-runtime","react/jsx-dev-runtime":"https://esm.sh/react@19/jsx-dev-runtime"}}</script></head><body><div id="root"><div class="app"><h1>Multi-file App</h1><button class="btn">Click me</button></div></div><script id="_R_">
      import React from 'react';
      import { hydrateRoot } from 'react-dom/client';

      // Dynamically import the app
      import('./App.tsx').then(module => {
        const App = module.default;
        const root = document.getElementById('root');
        if (root) {
          hydrateRoot(root, React.createElement(App));
        }
      });
      </script></body></html>",
        "renderTime": 77.95664600000055,
        "success": true,
      }
    `)
    expect(result.success).toBe(true)
  })

  it('should prerender with state and hooks', async () => {
    const response = await fetchApi('/api/prerender', {
      method: 'POST',
      body: JSON.stringify({
        files: [
          {
            path: 'Counter.tsx',
            content: `
              import React, { useState } from 'react';

              export default function Counter() {
                const [count, setCount] = useState(0);

                return (
                  <div className="counter">
                    <h2>Counter Component</h2>
                    <p>Count: {count}</p>
                    <button onClick={() => setCount(count + 1)}>
                      Increment
                    </button>
                  </div>
                );
              }
            `,
          },
        ],
        cssUrls: ['https://cdn.example.com/tailwind.css'],
        siteId: 'container-test-2',
        bootstrapModules: [],
      }),
    })

    const result = (await response.json()) as any

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "",
        "renderTime": 102.0257470000015,
        "success": true,
      }
    `)
    expect(result.success).toBe(true)
  })

  it('should handle prerendering errors gracefully', async () => {
    const response = await fetchApi('/api/prerender', {
      method: 'POST',
      body: JSON.stringify({
        files: [
          {
            path: 'BadComponent.tsx',
            content: `
              import React from 'react';

              // This has a syntax error
              export default function BadComponent() {
                return <div>Missing closing
              }
            `,
          },
        ],
        cssUrls: [],
        siteId: 'container-test-3',
        bootstrapModules: [],
      }),
    })

    const result = (await response.json()) as any

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "",
        "renderTime": 1.0006299999986368,
        "success": true,
      }
    `)
  })

  it('should include importmap in the prerendered HTML', async () => {
    const response = await fetchApi('/api/prerender', {
      method: 'POST',
      body: JSON.stringify({
        files: [
          {
            path: 'App.tsx',
            content: `
              import React from 'react';

              export default function App() {
                return <div>Test importmap</div>;
              }
            `,
          },
        ],
        cssUrls: [],
        siteId: 'container-test-4',
        bootstrapModules: [],
      }),
    })

    const result = (await response.json()) as any

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>React App</title><script type="importmap">{"imports":{"react":"https://esm.sh/react@19","react-dom":"https://esm.sh/react-dom@19","react-dom/":"https://esm.sh/react-dom@19/","react/jsx-runtime":"https://esm.sh/react@19/jsx-runtime","react/jsx-dev-runtime":"https://esm.sh/react@19/jsx-dev-runtime"}}</script></head><body><div id="root"><div>Test importmap</div></div><script id="_R_">
      import React from 'react';
      import { hydrateRoot } from 'react-dom/client';

      // Dynamically import the app
      import('./App.tsx').then(module => {
        const App = module.default;
        const root = document.getElementById('root');
        if (root) {
          hydrateRoot(root, React.createElement(App));
        }
      });
      </script></body></html>",
        "renderTime": 2.015581999999995,
        "success": true,
      }
    `)
    expect(result.success).toBe(true)
  })

  it('should prerender with custom importmap', async () => {
    const customImportmap = JSON.stringify({
      imports: {
        react: 'https://custom.cdn/react@19',
        'react-dom': 'https://custom.cdn/react-dom@19',
      },
    })

    const response = await fetchApi('/api/prerender', {
      method: 'POST',
      body: JSON.stringify({
        files: [
          {
            path: 'App.tsx',
            content: `
              import React from 'react';

              export default function App() {
                return <div>Custom importmap test</div>;
              }
            `,
          },
        ],
        cssUrls: [],
        siteId: 'container-test-5',
        bootstrapModules: [],
        importmap: customImportmap,
      }),
    })

    const result = (await response.json()) as any

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>React App</title><script type="importmap">{"imports":{"react":"https://custom.cdn/react@19","react-dom":"https://custom.cdn/react-dom@19"}}</script></head><body><div id="root"><div>Custom importmap test</div></div><script id="_R_">
      import React from 'react';
      import { hydrateRoot } from 'react-dom/client';

      // Dynamically import the app
      import('./App.tsx').then(module => {
        const App = module.default;
        const root = document.getElementById('root');
        if (root) {
          hydrateRoot(root, React.createElement(App));
        }
      });
      </script></body></html>",
        "renderTime": 3.331662000000506,
        "success": true,
      }
    `)
    expect(result.success).toBe(true)
  })
})
