# Lovepack 💝

A Cloudflare Worker that bundles TypeScript/JSX with Tailwind on the fly. Two modes:

| Mode | Use it for |
|---|---|
| **Projects** | Versioned UI in Cloudflare Artifacts. Agents edit, viewers see live drafts, users undo or push with plain `git`. |
| **`/api/bundle`** | Stateless bundling. Send files, get URLs. |

## Projects

Agents edit files in a **session**, viewers see **live drafts**, each agent message becomes one **git commit**. Undo, restore and branches are built in.

```ts
const project = getProject(env.PROJECT, 'u123')           // Durable Object stub, RPC
const { sessionId } = await project.openSession({ author: { kind: 'agent', id: 'ses_1' } })
await project.write(sessionId, 'App.tsx', code)
await project.build(sessionId)                            // draft: viewers update live
await project.commit(sessionId, { message: 'Add chart' }) // one commit, sources + dist
await project.undo()                                      // new commit with the previous sources
```

Users can also edit with git:

```bash
git clone "$AUTHENTICATED_URL" app   # token from POST /api/projects/:id/git-access
git commit -am 'Tweak' && git push origin main
```

Setup, REST routes, the client SDK and the git remote are in [docs/projects.md](docs/projects.md). Try it with `examples/agent.ts` and the `/view/:id` page.

## Legacy API: `/api/bundle`

### POST `/api/bundle`

Bundle and transform TypeScript/JavaScript files with automatic dependency resolution from esm.sh CDN.

**URL:** `https://remote-bundler.fumabase.com/api/bundle`

**Request Body:**
```json
{
  "files": [
    {
      "path": "index.tsx",
      "content": "import React from 'react';\n\nfunction App() {\n  return <div className=\"text-blue-500\">Hello World</div>;\n}"
    }
  ],
  "entryPoint": "index.tsx",  // Optional, defaults to first file
  "externalPackages": ["react", "react-dom"],  // Optional, packages to mark as external
  "siteId": "my-site"  // Required, [a-zA-Z0-9_-]+, output folder
}
```

**Response:**
```json
{
  "success": true,
  "jsUrl": "https://remote-bundler.fumabase.com/bundle/my-site/index.js",
  "htmlUrl": "https://remote-bundler.fumabase.com/bundle/my-site/index.html",
  "files": {
    "my-site/index.js": "https://remote-bundler.fumabase.com/bundle/my-site/index.js",
    "my-site/chunks/[name]-[hash].js": "https://remote-bundler.fumabase.com/bundle/my-site/chunks/[name]-[hash].js"
  },
  "rawOutputs": [],
  "warnings": []  // Bundler warnings if any
}
```

## Features

- **TypeScript/JSX Support**: Full support for TypeScript and JSX syntax with React automatic runtime
- **Automatic Bundling**: Uses Rollup (WASM) + sucrase for lightning-fast bundling
- **CDN Resolution**: Automatically fetches npm packages from esm.sh
- **Tailwind CSS**: Generates Tailwind CSS based on classes used in your code
- **shadcn/ui Theme**: Includes default shadcn/ui theme configuration and CSS variables
- **Typography Plugin**: Tailwind Typography plugin included for prose styles
- **Multiple Files**: Support for projects with multiple files and relative imports
- **Code Splitting**: Support for dynamic imports and React.lazy with automatic chunking
- **KV storage**: `/api/bundle` outputs are stored in KV
- **Server Timing**: Detailed performance metrics via Server-Timing headers

## Example Usage

### Using cURL
```bash
curl -X POST https://remote-bundler.fumabase.com/api/bundle \
  -H "Content-Type: application/json" \
  -d '{
    "files": [{
      "path": "app.tsx",
      "content": "import React from \"react\";\nexport default function App() {\n  return <div className=\"p-4 bg-primary text-primary-foreground rounded-lg\">Hello</div>;\n}"
    }],
    "externalPackages": ["react"],
    "siteId": "demo"
  }'
```

### Using JavaScript
```javascript
const response = await fetch('https://remote-bundler.fumabase.com/api/bundle', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    files: [{
      path: 'index.tsx',
      content: `
        import React from 'react';

        function Button() {
          return (
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              Click me
            </button>
          );
        }

        export default Button;
      `
    }],
    externalPackages: ['react'],
    siteId: 'demo'
  })
});

const result = await response.json();
console.log(result.jsUrl);   // URL to bundled JavaScript
console.log(result.htmlUrl); // URL to preview HTML page
```

### Multiple Files with Imports
```javascript
const response = await fetch('https://remote-bundler.fumabase.com/api/bundle', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    files: [
      {
        path: 'utils.ts',
        content: `
          export const formatPrice = (price: number) => {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            }).format(price);
          };
        `
      },
      {
        path: 'Button.tsx',
        content: `
          import React from 'react';

          export const Button = ({ children, onClick }) => (
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={onClick}
            >
              {children}
            </button>
          );
        `
      },
      {
        path: 'app.tsx',
        content: `
          import React from 'react';
          import { Button } from './Button';
          import { formatPrice } from './utils';

          export default function App() {
            const price = 99.99;
            return (
              <div className="p-8 bg-gray-100">
                <h1 className="text-3xl font-bold mb-4">Product</h1>
                <p className="text-xl mb-4">{formatPrice(price)}</p>
                <Button onClick={() => alert('Purchased!')}>
                  Buy Now
                </Button>
              </div>
            );
          }
        `
      }
    ],
    entryPoint: 'app.tsx',
    externalPackages: ['react'],
    siteId: 'demo'
  })
});
```

## Default External Packages

The following packages are marked as external by default (not bundled):
- `react`
- `react-dom`
- `react/jsx-runtime`
- `react/jsx-dev-runtime`

## CSS Variables

The generated CSS includes default shadcn/ui CSS variables for both light and dark modes. These variables define colors for:
- `--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`
- `--background`, `--foreground`
- `--card`, `--popover`
- `--border`, `--input`, `--ring`
- `--radius` (border radius)

## Web Interface

Visit [https://remote-bundler.fumabase.com](https://remote-bundler.fumabase.com) to use the interactive web UI for uploading and bundling files.

## Development

```bash
# Install dependencies
pnpm install

# Run locally
pnpm dev

# Secrets for projects: LOVEPACK_API_KEY in .dev.vars (local) and `wrangler secret put` (deployed)

# Run tests (they hit the deployed worker, deploy first)
pnpm test
pnpm test:local   # legacy /api/bundle tests against the local bundler

# Deploy to Cloudflare Workers
pnpm deployment
```

## Testing

The project uses Vitest for testing with snapshots for output validation. Tests cover:
- TSX/JSX transformation
- Tailwind CSS extraction with modifiers
- Multiple file bundling with imports
- Dynamic imports and code splitting
- Error handling and formatting
- NPM package resolution
- Projects end to end (`src/project.test.ts`): sessions, drafts, commit, undo, branches, git clone and push. Needs `LOVEPACK_API_KEY`.

## License

MIT
