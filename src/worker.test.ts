import { describe, it, expect } from "vitest";

const WORKER_URL = "https://remote-bundler.remorses.workers.dev";

describe("Remote Bundler Worker", () => {
  it("should transform TSX code with React and generate Tailwind CSS", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: 'const App = () => <div className="p-4 bg-blue-500 text-white">Hello</div>;',
        loader: "tsx",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const App = () => /* @__PURE__ */ React.createElement("div", { className: "p-4 bg-blue-500 text-white" }, "Hello");
      ",
        "css": ".bg-blue-500 {
          --tw-bg-opacity: 1;
          background-color: rgb(59 130 246 / var(--tw-bg-opacity, 1))
      }
      .p-4 {
          padding: 1rem
      }
      .text-white {
          --tw-text-opacity: 1;
          color: rgb(255 255 255 / var(--tw-text-opacity, 1))
      }",
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
        code: 'const Button = () => <button className="p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6">Click</button>;',
        loader: "tsx",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const Button = () => /* @__PURE__ */ React.createElement("button", { className: "p-4 bg-blue-500 text-white hover:bg-blue-600 md:p-6" }, "Click");
      ",
        "css": ".bg-blue-500 {
          --tw-bg-opacity: 1;
          background-color: rgb(59 130 246 / var(--tw-bg-opacity, 1))
      }
      .p-4 {
          padding: 1rem
      }
      .text-white {
          --tw-text-opacity: 1;
          color: rgb(255 255 255 / var(--tw-text-opacity, 1))
      }
      .hover\\:bg-blue-600:hover {
          --tw-bg-opacity: 1;
          background-color: rgb(37 99 235 / var(--tw-bg-opacity, 1))
      }
      @media (min-width: 768px) {
          .md\\:p-6 {
              padding: 1.5rem
          }
      }",
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
        code: `const Card = ({ isActive }) => {
          const baseClass = "p-6 rounded-xl shadow-lg";
          return <div className={\`\${baseClass} \${isActive ? "bg-green-500" : "bg-gray-200"}\`}>Content</div>;
        }`,
        loader: "tsx",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const Card = ({ isActive }) => {
        const baseClass = "p-6 rounded-xl shadow-lg";
        return /* @__PURE__ */ React.createElement("div", { className: \`\${baseClass} \${isActive ? "bg-green-500" : "bg-gray-200"}\` }, "Content");
      };
      ",
        "css": ".rounded-xl {
          border-radius: 0.75rem
      }
      .bg-gray-200 {
          --tw-bg-opacity: 1;
          background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1))
      }
      .bg-green-500 {
          --tw-bg-opacity: 1;
          background-color: rgb(34 197 94 / var(--tw-bg-opacity, 1))
      }
      .p-6 {
          padding: 1.5rem
      }
      .shadow-lg {
          --tw-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
          --tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);
          box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)
      }",
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
          code: `import { format } from 'date-fns';
        const App = () => <div className="text-lg font-bold">{format(new Date(), 'yyyy-MM-dd')}</div>;`,
          loader: "tsx",
          resolveImports: true,
        }),
      });

      const result = (await response.json()) as any;
      expect(result.success).toMatchInlineSnapshot(`true`);
      expect(result.css).toMatchInlineSnapshot(`
      ".text-lg {
          font-size: 1.125rem;
          line-height: 1.75rem
      }
      .font-bold {
          font-weight: 700
      }"
    `);
    },
    { timeout: 30000 },
  );

  it("should handle missing code parameter", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loader: "js",
      }),
    });

    const result = await response.json();
    expect(response.status).toMatchInlineSnapshot(`400`);
    expect(result).toMatchInlineSnapshot(`
      {
        "error": "No code provided",
      }
    `);
  });

  it("should handle complex Tailwind utilities including gradients and animations", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `const Hero = () => (
          <div className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text">Gradient Text</h1>
          </div>
        );`,
        loader: "tsx",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const Hero = () => /* @__PURE__ */ React.createElement("div", { className: "bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse transition-all duration-300" }, /* @__PURE__ */ React.createElement("h1", { className: "text-4xl font-bold text-transparent bg-clip-text" }, "Gradient Text"));
      ",
        "css": "@keyframes pulse {
          50% {
              opacity: .5
          }
      }
      .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite
      }
      .bg-gradient-to-r {
          background-image: linear-gradient(to right, var(--tw-gradient-stops))
      }
      .from-purple-400 {
          --tw-gradient-from: #c084fc var(--tw-gradient-from-position);
          --tw-gradient-to: rgb(192 132 252 / 0) var(--tw-gradient-to-position);
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to)
      }
      .via-pink-500 {
          --tw-gradient-to: rgb(236 72 153 / 0)  var(--tw-gradient-to-position);
          --tw-gradient-stops: var(--tw-gradient-from), #ec4899 var(--tw-gradient-via-position), var(--tw-gradient-to)
      }
      .to-red-500 {
          --tw-gradient-to: #ef4444 var(--tw-gradient-to-position)
      }
      .bg-clip-text {
          -webkit-background-clip: text;
                  background-clip: text
      }
      .text-4xl {
          font-size: 2.25rem;
          line-height: 2.5rem
      }
      .font-bold {
          font-weight: 700
      }
      .text-transparent {
          color: transparent
      }
      .transition-all {
          transition-property: all;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms
      }
      .duration-300 {
          transition-duration: 300ms
      }",
        "success": true,
        "warnings": [],
      }
    `);
  });
});
