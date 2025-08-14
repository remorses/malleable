/// <reference types="bun" />

import { Spiceflow } from "spiceflow";
import { z } from "zod";
import { IMPORTMAP } from "./importmap.js";

// Create a Spiceflow API for the container
const app = new Spiceflow().route({
  method: "POST",
  path: "/prerender",
  request: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        content: z.string(),
      }),
    ),
    entryPoint: z.string().optional(),
    cssUrls: z.array(z.string()).default([]),
    bootstrapModules: z.array(z.string()).default([]),
    importmap: z.string().optional(),
  }),
  response: z.object({
    html: z.string(),
    error: z.string().optional(),
    renderTime: z.number(),
  }),
  async handler({ request }) {
    const { files, entryPoint, cssUrls, bootstrapModules, importmap } =
      await request.json();
    const startTime = performance.now();

    try {
      // Determine actual entry point
      const actualEntryPoint = entryPoint || files[0]?.path;
      if (!actualEntryPoint) {
        throw new Error("No files provided");
      }

      // Create a temporary directory for the project
      const tempDir = `/tmp/render_${Date.now()}`;
      await Bun.$`mkdir -p ${tempDir}`;

      // Write all files to disk
      for (const file of files) {
        const filePath = `${tempDir}/${file.path}`;
        // Create directory if needed
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        if (dir !== tempDir) {
          await Bun.$`mkdir -p ${dir}`;
        }
        await Bun.write(filePath, file.content);
      }

      // Change to the temp directory for relative imports
      process.chdir(tempDir);

      // Dynamically import React and prerendering functions
      const React = await import("react");
      const { prerender } = await import("react-dom/static");

      // Import the entry component dynamically
      const EntryComponent = (await import(`./${actualEntryPoint}`)).default;

      // Create wrapper component with HTML structure
      function App() {
        const head = React.createElement(
          "head",
          null,
          React.createElement("meta", { charSet: "UTF-8" }),
          React.createElement("meta", {
            name: "viewport",
            content: "width=device-width, initial-scale=1.0",
          }),
          React.createElement("title", null, "React App"),
          ...cssUrls.map((url) =>
            React.createElement("link", { rel: "stylesheet", href: url }),
          ),
          React.createElement("script", {
            type: "importmap",
            dangerouslySetInnerHTML: { __html: importmap || IMPORTMAP },
          }),
        );

        const body = React.createElement(
          "body",
          null,
          React.createElement(
            "div",
            { id: "root" },
            React.createElement(EntryComponent),
          ),
          ...bootstrapModules.map((url) =>
            React.createElement("script", { type: "module", src: url }),
          ),
        );

        return React.createElement("html", { lang: "en" }, head, body);
      }

      // Bootstrap script content for hydration
      const bootstrapScriptContent =
        bootstrapModules.length > 0
          ? `
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from '${bootstrapModules[0]}';

const root = document.getElementById('root');
if (root) {
  hydrateRoot(root, React.createElement(App));
}
`
          : `
import React from 'react';
import { hydrateRoot } from 'react-dom/client';

// Dynamically import the app
import('${bootstrapModules[0] || `./${actualEntryPoint}`}').then(module => {
  const App = module.default;
  const root = document.getElementById('root');
  if (root) {
    hydrateRoot(root, React.createElement(App));
  }
});
`;

      // Render to string using prerender
      async function renderToString() {
        const { prelude } = await prerender(React.createElement(App), {
          bootstrapScriptContent,
          bootstrapModules,
        });

        const reader = prelude.getReader();
        let content = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            return content;
          }
          content += Buffer.from(value).toString("utf8");
        }
      }

      const html = await renderToString();

      // Clean up temp directory
      process.chdir("/");
      await Bun.$`rm -rf ${tempDir}`;

      return {
        html: html || "",
        renderTime: performance.now() - startTime,
      };
    } catch (error: any) {
      return {
        html: "",
        success: false,
        error: error.message || "Failed to prerender component",
        renderTime: performance.now() - startTime,
      };
    }
  },
});

// Export the app type for client generation
export type ContainerApp = typeof app;

// Start the server
const server = Bun.serve({
  port: 8080,
  hostname: "0.0.0.0",

  fetch: async (req, server) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    return app.handle(req);
  },
});

console.log(`🚀 Spiceflow container server running on port ${server.port}`);
