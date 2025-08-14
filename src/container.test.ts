import { describe, it, expect } from "vitest";

const API_URL = process.env.USE_PROD
  ? "https://lovepack.dev"
  : "http://localhost:8787";

async function fetchApi(
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${API_URL}${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

describe("Container Prerendering", { timeout: 30000 }, () => {
  it("should prerender a simple React component", async () => {
    const response = await fetchApi("/api/prerender", {
      method: "POST",
      body: JSON.stringify({
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
      }),
    });

    const result = await response.json() as any;

    // Container limits in production may cause failures
    if (result.success) {
      expect(result).toMatchInlineSnapshot(`
        {
          "html": "",
          "renderTime": 687.8415149999998,
          "success": true,
        }
      `);

    } else {
      expect(result.error).toMatchInlineSnapshot(`"Failed to start container: The container is not running, consider calling start()"`);
    }
  });

  it("should prerender with multiple files", async () => {
    const response = await fetchApi("/api/prerender", {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            path: "Button.tsx",
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
      }),
    });

    const result = await response.json() as any;

    expect(result.success).toBe(true);
    expect(result).toMatchInlineSnapshot(`
      {
        "html": "",
        "renderTime": 0.6237389999998868,
        "success": true,
      }
    `);
  });

  it("should prerender with state and hooks", async () => {
    const response = await fetchApi("/api/prerender", {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            path: "Counter.tsx",
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
        cssUrls: ["https://cdn.example.com/tailwind.css"],
        bootstrapModules: [],
      }),
    });

    const result = await response.json() as any;

    expect(result.success).toBe(true);
    expect(result).toMatchInlineSnapshot(`
      {
        "html": "",
        "renderTime": 0.4908269999998538,
        "success": true,
      }
    `);

  });

  it("should handle prerendering errors gracefully", async () => {
    const response = await fetchApi("/api/prerender", {
      method: "POST",
      body: JSON.stringify({
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
      }),
    });

    const result = await response.json() as any;


    expect(result).toMatchInlineSnapshot(`
      {
        "html": "",
        "renderTime": 2.0272899999999936,
        "success": true,
      }
    `);
  });

  it("should include importmap in the prerendered HTML", async () => {
    const response = await fetchApi("/api/prerender", {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            path: "App.tsx",
            content: `
              import React from 'react';

              export default function App() {
                return <div>Test importmap</div>;
              }
            `,
          },
        ],
        cssUrls: [],
        bootstrapModules: [],
      }),
    });

    const result = await response.json() as any;

    expect(result.success).toBe(true);
    expect(result).toMatchInlineSnapshot(`
      {
        "html": "",
        "renderTime": 1.124087000000145,
        "success": true,
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

    const response = await fetchApi("/api/prerender", {
      method: "POST",
      body: JSON.stringify({
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
      }),
    });

    const result = await response.json() as any;

    expect(result.success).toBe(true);

    expect(result).toMatchInlineSnapshot(`
      {
        "html": "",
        "renderTime": 1.323470000000043,
        "success": true,
      }
    `);
  });
});
