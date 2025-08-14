import { describe, it, expect } from "vitest";
import { prerenderComponent, prerenderRequestSchema, type PrerenderRequest } from "./prerender.js";

describe("Prerender Module", () => {
  it("should prerender a simple React component", async () => {
    const request: PrerenderRequest = {
      files: [
        {
          path: "App.tsx",
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
      cssUrls: ["https://example.com/styles.css"],
      bootstrapModules: ["https://example.com/bundle.js"],
      runNpmInstall: true,
    };

    const result = await prerenderComponent(request);

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><link rel="modulepreload" fetchPriority="low" href="https://example.com/bundle.js"/><title>React App</title><link rel="stylesheet" href="https://example.com/styles.css"/><script type="importmap">{"imports":{"react":"https://esm.sh/react@19","react-dom":"https://esm.sh/react-dom@19","react-dom/":"https://esm.sh/react-dom@19/","react/jsx-runtime":"https://esm.sh/react@19/jsx-runtime","react/jsx-dev-runtime":"https://esm.sh/react@19/jsx-dev-runtime"}}</script></head><body><div id="root"><div class="container"><h1>Hello from Prerendering!</h1><p>This is a test component.</p></div></div><script type="module" src="https://example.com/bundle.js"></script><script>
      import React from 'react';
      import { hydrateRoot } from 'react-dom/client';
      import App from 'https://example.com/bundle.js';

      const root = document.getElementById('root');
      if (root) {
        hydrateRoot(root, React.createElement(App));
      }
      </script><script type="module" src="https://example.com/bundle.js" async=""></script></body></html>",
        "renderTime": 955.890125,
      }
    `);
  });

  it("should prerender with multiple files", async () => {
    const request: PrerenderRequest = {
      files: [
        {
          path: "Button.tsx",
          content: `
            import React from 'react';

            export function Button({ children, onClick }: any) {
              return (
                <button onClick={onClick} className="btn">
                  {children}
                </button>
              );
            }
          `,
        },
        {
          path: "App.tsx",
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
      entryPoint: "App.tsx",
      cssUrls: [],
      bootstrapModules: [],
      runNpmInstall: true,
    };

    const result = await prerenderComponent(request);

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>React App</title><script type="importmap">{"imports":{"react":"https://esm.sh/react@19","react-dom":"https://esm.sh/react-dom@19","react-dom/":"https://esm.sh/react-dom@19/","react/jsx-runtime":"https://esm.sh/react@19/jsx-runtime","react/jsx-dev-runtime":"https://esm.sh/react@19/jsx-dev-runtime"}}</script></head><body><div id="root"><div class="app"><h1>Multi-file App</h1><button class="btn">Click me</button></div></div><script>
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
        "renderTime": 368.90704100000016,
      }
    `);
  });

  it("should handle prerendering errors gracefully", async () => {
    const request: PrerenderRequest = {
      files: [
        {
          path: "BadComponent.tsx",
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
      bootstrapModules: [],
      runNpmInstall: true,
    };

    const result = await prerenderComponent(request);

    expect(result).toMatchInlineSnapshot(`
      {
        "error": "Transform failed with 2 errors:
      /private/tmp/render_1755174983699/BadComponent.tsx:7:12: ERROR: The character "}" is not valid inside a JSX element
      /private/tmp/render_1755174983699/BadComponent.tsx:8:10: ERROR: Unexpected end of file before a closing "div" tag",
        "html": "",
        "renderTime": 358.8144169999998,
      }
    `);
  });

  it("should validate request schema", () => {
    const validRequest = {
      files: [
        {
          path: "App.tsx",
          content: "export default function App() { return <div>Test</div>; }",
        },
      ],
      cssUrls: ["https://example.com/styles.css"],
      bootstrapModules: [],
    };

    const parsed = prerenderRequestSchema.parse(validRequest);
    expect(parsed).toMatchInlineSnapshot(`
      {
        "bootstrapModules": [],
        "cssUrls": [
          "https://example.com/styles.css",
        ],
        "files": [
          {
            "content": "export default function App() { return <div>Test</div>; }",
            "path": "App.tsx",
          },
        ],
        "runNpmInstall": false,
      }
    `);
  });

  it("should use default values when not provided", () => {
    const minimalRequest = {
      files: [
        {
          path: "App.tsx",
          content: "export default function App() { return <div>Test</div>; }",
        },
      ],
    };

    const parsed = prerenderRequestSchema.parse(minimalRequest);
    expect(parsed).toMatchInlineSnapshot(`
      {
        "bootstrapModules": [],
        "cssUrls": [],
        "files": [
          {
            "content": "export default function App() { return <div>Test</div>; }",
            "path": "App.tsx",
          },
        ],
        "runNpmInstall": false,
      }
    `);
  });

  it("should prerender with custom importmap", async () => {
    const customImportmap = JSON.stringify({
      imports: {
        react: "https://custom.cdn/react@19",
        "react-dom": "https://custom.cdn/react-dom@19",
      },
    });

    const request: PrerenderRequest = {
      files: [
        {
          path: "App.tsx",
          content: `
            import React from 'react';

            export default function App() {
              return <div>Custom importmap test</div>;
            }
          `,
        },
      ],
      cssUrls: [],
      bootstrapModules: [],
      importmap: customImportmap,
      runNpmInstall: true,
    };

    const result = await prerenderComponent(request);

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>React App</title><script type="importmap">{"imports":{"react":"https://custom.cdn/react@19","react-dom":"https://custom.cdn/react-dom@19"}}</script></head><body><div id="root"><div>Custom importmap test</div></div><script>
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
        "renderTime": 334.6444580000002,
      }
    `);
  });

  it("should handle no files provided error", async () => {
    const request: PrerenderRequest = {
      files: [],
      cssUrls: [],
      bootstrapModules: [],
      runNpmInstall: false
    };

    const result = await prerenderComponent(request);

    expect(result).toMatchInlineSnapshot(`
      {
        "error": "No files provided",
        "html": "",
        "renderTime": 0.07162500000004002,
      }
    `);
  });
});
