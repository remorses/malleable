import { describe, it, expect } from "vitest";

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

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "cssUrl": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.css",
        "files": {
          "0c39b72ef182cba0.js": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.js",
          "0c39b72ef182cba0.js.map": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.js.map",
          "styles.css": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.css",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/0c39b72ef182cba0.js",
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

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "cssUrl": "https://remote-bundler.fumabase.com/bundle/518d16db8496ff1f.css",
        "files": {
          "button-XWV7WR3J.js": "https://remote-bundler.fumabase.com/bundle/button-XWV7WR3J.js",
          "button-XWV7WR3J.js.map": "https://remote-bundler.fumabase.com/bundle/button-XWV7WR3J.js.map",
          "styles.css": "https://remote-bundler.fumabase.com/bundle/518d16db8496ff1f.css",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/button-XWV7WR3J.js",
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

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "cssUrl": "https://remote-bundler.fumabase.com/bundle/e42dae69905f1802.css",
        "files": {
          "card-ZZ5RTS2A.js": "https://remote-bundler.fumabase.com/bundle/card-ZZ5RTS2A.js",
          "card-ZZ5RTS2A.js.map": "https://remote-bundler.fumabase.com/bundle/card-ZZ5RTS2A.js.map",
          "styles.css": "https://remote-bundler.fumabase.com/bundle/e42dae69905f1802.css",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/card-ZZ5RTS2A.js",
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

      const result = (await response.json()) as any;
      expect(result.success).toMatchInlineSnapshot(`false`);
      expect(result.cssUrl).toMatchInlineSnapshot(`undefined`);
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

    const result = await response.json();
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

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "cssUrl": "https://remote-bundler.fumabase.com/bundle/eaf566c7918e4919.css",
        "files": {
          "hero-AOSZIDM5.js": "https://remote-bundler.fumabase.com/bundle/hero-AOSZIDM5.js",
          "hero-AOSZIDM5.js.map": "https://remote-bundler.fumabase.com/bundle/hero-AOSZIDM5.js.map",
          "styles.css": "https://remote-bundler.fumabase.com/bundle/eaf566c7918e4919.css",
        },
        "jsUrl": "https://remote-bundler.fumabase.com/bundle/hero-AOSZIDM5.js",
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
});
