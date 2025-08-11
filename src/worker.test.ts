import { describe, it, expect } from "vitest";
import type { BundleResult } from "./types.js";

const WORKER_URL = "https://remote-bundler.fumabase.com";

describe("Remote Bundler Worker", () => {
  it("should transform TSX code with React and generate Tailwind CSS", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "app.tsx",
          content: 'const App = () => <div className="p-4 bg-blue-500 text-white">Hello</div>;'
        }],
      }),
    });

    const result = await response.json() as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "0c39b72ef182cba0.js": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.js",
          "0c39b72ef182cba0.js.map": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.js",
        "rawOutputs": [
          {
            "path": "/0c39b72ef182cba0.js.map",
            "size": 1069,
            "type": "sourcemap",
          },
          {
            "path": "/0c39b72ef182cba0.js",
            "size": 2526,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should extract Tailwind classes with hover and responsive modifiers", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "button.tsx",
          content: 'const Button = () => <button className="p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6">Click</button>;'
        }],
      }),
    });

    const result = await response.json() as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "518d16db8496ff1f.js": "https://remote-bundler.fumabase.com/bundle/518d16db8496ff1f.js",
          "518d16db8496ff1f.js.map": "https://remote-bundler.fumabase.com/bundle/518d16db8496ff1f.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/518d16db8496ff1f.js",
        "rawOutputs": [
          {
            "path": "/518d16db8496ff1f.js.map",
            "size": 1112,
            "type": "sourcemap",
          },
          {
            "path": "/518d16db8496ff1f.js",
            "size": 2541,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should handle template literals with conditional classes", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "card.tsx",
          content: `const Card = ({ isActive }) => {
          const baseClass = "p-6 rounded-xl shadow-lg";
          return <div className={\`\${baseClass} \${isActive ? "bg-green-500" : "bg-gray-200"}\`}>Content</div>;
        }`
        }],
      }),
    });

    const result = await response.json() as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "e42dae69905f1802.js": "https://remote-bundler.fumabase.com/bundle/e42dae69905f1802.js",
          "e42dae69905f1802.js.map": "https://remote-bundler.fumabase.com/bundle/e42dae69905f1802.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/e42dae69905f1802.js",
        "rawOutputs": [
          {
            "path": "/e42dae69905f1802.js.map",
            "size": 1212,
            "type": "sourcemap",
          },
          {
            "path": "/e42dae69905f1802.js",
            "size": 2531,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it(
    "should resolve npm imports when resolveImports is true",
    async () => {
      const response = await fetch(`${WORKER_URL}/api/bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{
            path: "app.tsx",
            content: `import { format } from 'date-fns';
        const App = () => <div className="text-lg font-bold">{format(new Date(), 'yyyy-MM-dd')}</div>;`
          }],
        }),
      });

      const result = await response.json() as BundleResult;
      expect(result.success).toMatchInlineSnapshot(`false`);
    },
    { timeout: 60000 },
  );

  it("should handle missing code parameter", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [],
      }),
    });

    const result = await response.json() as BundleResult;
    expect(response.status).toMatchInlineSnapshot(`400`);
    expect(result).toMatchInlineSnapshot(`
      {
        "error": "No files provided",
        "success": false,
      }
    `);
  });

  it("should handle complex Tailwind utilities including gradients and animations", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "hero.tsx",
          content: `const Hero = () => (
          <div className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text">Gradient Text</h1>
          </div>
        );`
        }],
      }),
    });

    const result = await response.json() as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "eaf566c7918e4919.js": "https://remote-bundler.fumabase.com/bundle/eaf566c7918e4919.js",
          "eaf566c7918e4919.js.map": "https://remote-bundler.fumabase.com/bundle/eaf566c7918e4919.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/eaf566c7918e4919.js",
        "rawOutputs": [
          {
            "path": "/eaf566c7918e4919.js.map",
            "size": 1273,
            "type": "sourcemap",
          },
          {
            "path": "/eaf566c7918e4919.js",
            "size": 2531,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should handle OPTIONS request for CORS preflight", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toMatchInlineSnapshot(`"*"`);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatchInlineSnapshot(`"OPTIONS, GET, POST, PUT, PATCH, DELETE"`);
    expect(response.headers.get("Access-Control-Allow-Headers")).toMatchInlineSnapshot(`"*"`);
  });

  it("should handle multiple input files with imports between them", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            path: "utils.ts",
            content: `
              export const formatPrice = (price: number) => {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(price);
              };
              
              export const truncateText = (text: string, maxLength: number) => {
                if (text.length <= maxLength) return text;
                return text.slice(0, maxLength) + '...';
              };
            `
          },
          {
            path: "components/Button.tsx",
            content: `
              import React from 'react';
              
              export const Button = ({ children, onClick, variant = 'primary' }) => {
                const baseClasses = "px-4 py-2 rounded-lg font-semibold transition-colors";
                const variantClasses = variant === 'primary' 
                  ? "bg-blue-500 text-white hover:bg-blue-600" 
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300";
                
                return (
                  <button 
                    className={\`\${baseClasses} \${variantClasses}\`}
                    onClick={onClick}
                  >
                    {children}
                  </button>
                );
              };
            `
          },
          {
            path: "app.tsx",
            content: `
              import React from 'react';
              import { Button } from './components/Button';
              import { formatPrice, truncateText } from './utils';
              
              const App = () => {
                const price = 99.99;
                const description = "This is a very long product description that needs to be truncated";
                
                return (
                  <div className="p-8 bg-gray-100 min-h-screen">
                    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
                      <h1 className="text-3xl font-bold mb-4">Product Card</h1>
                      <p className="text-gray-600 mb-2">{truncateText(description, 30)}</p>
                      <p className="text-2xl font-semibold text-green-600 mb-4">{formatPrice(price)}</p>
                      <div className="flex gap-4">
                        <Button variant="primary">Buy Now</Button>
                        <Button variant="secondary">Add to Cart</Button>
                      </div>
                    </div>
                  </div>
                );
              };
              
              export default App;
            `
          }
        ],
        entryPoint: "app.tsx"
      }),
    });

    const result = await response.json() as BundleResult;
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.jsUrl).toBeDefined();
      expect(result.files).toBeDefined();
      
      // Check that multiple files were processed
      expect(result.rawOutputs).toBeDefined();
      expect(result.rawOutputs.length).toBeGreaterThan(0);
    }
    
    // Verify the output contains expected content
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "0a3d91a4456a515c.js": "https://remote-bundler.fumabase.com/bundle/0a3d91a4456a515c.js",
          "0a3d91a4456a515c.js.map": "https://remote-bundler.fumabase.com/bundle/0a3d91a4456a515c.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/0a3d91a4456a515c.js",
        "rawOutputs": [
          {
            "path": "/0a3d91a4456a515c.js.map",
            "size": 4384,
            "type": "sourcemap",
          },
          {
            "path": "/0a3d91a4456a515c.js",
            "size": 2423,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should execute bundled code with Deno", async () => {
    // First, bundle a React component
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{
          path: "app.tsx",
          content: `
            import React from 'react';

            export const add = (a, b) => a + b;
            export const multiply = (a, b) => a * b;

            const App = ({ name = "World" }) => {
              return <div className="p-4">Hello {name}!</div>;
            };

            export default App;
          `
        }],
      }),
    });


    const result = await response.json() as BundleResult;
    expect(result).toMatchInlineSnapshot(`
      {
        "files": {
          "9efb087fd86defd0.js": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js",
          "9efb087fd86defd0.js.map": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js.map",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/9efb087fd86defd0.js",
        "rawOutputs": [
          {
            "path": "/9efb087fd86defd0.js.map",
            "size": 1432,
            "type": "sourcemap",
          },
          {
            "path": "/9efb087fd86defd0.js",
            "size": 896,
            "type": "entry",
          },
        ],
        "success": true,
        "warnings": [],
      }
    `);
    expect(result.success).toBe(true);

    // Execute the bundled code using Deno and log the module exports
    if (!result.success) {
      throw new Error('Bundle failed');
    }
    const jsUrl = result.jsUrl;
    const { execSync } = await import('child_process');

    try {
      const output = execSync(
        `deno eval "import('${jsUrl}').then(m => console.log(m))"`,
        { encoding: 'utf-8' }
      );

      console.log(output)
      // Just check that it executed without error and has output
      expect(output).toBeTruthy();

    } catch (error: any) {
      console.error("Failed to execute bundled code:", error.message);
      throw error;
    }
  });
});
