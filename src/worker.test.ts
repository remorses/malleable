import { describe, it, expect } from "vitest";

const WORKER_URL = "https://remote-bundler.remorses.workers.dev";

describe("Remote Bundler Worker", () => {
  it("should transform TypeScript code", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: 'const greeting: string = "Hello World"; console.log(greeting);',
        loader: "ts",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const greeting = "Hello World";
      console.log(greeting);
      ",
        "css": "",
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should transform TSX code with React", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "const App = () => <div>Hello</div>;",
        loader: "tsx",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const App = () => /* @__PURE__ */ React.createElement("div", null, "Hello");
      ",
        "css": "",
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should extract Tailwind classes from JSX", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: 'const Button = () => <button className="bg-blue-500 text-white p-4">Click</button>;',
        loader: "tsx",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const Button = () => /* @__PURE__ */ React.createElement("button", { className: "bg-blue-500 text-white p-4" }, "Click");
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

  it("should handle JavaScript code", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "const add = (a, b) => a + b; export default add;",
        loader: "js",
      }),
    });

    const result = await response.json();
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "const add = (a, b) => a + b;
      var stdin_default = add;
      export {
        stdin_default as default
      };
      ",
        "css": "",
        "success": true,
        "warnings": [],
      }
    `);
  });

  it("should return error for invalid code", async () => {
    const response = await fetch(`${WORKER_URL}/api/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "const x = {",
        loader: "js",
      }),
    });

    const result = (await response.json()) as any;
    expect(result.success).toMatchInlineSnapshot(`false`);
    expect(result.error).toMatchInlineSnapshot(`
      "Transform failed with 1 error:
      <stdin>:1:11: ERROR: Expected identifier but found end of file"
    `);
  });

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
});
