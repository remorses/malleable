# Lovepack 💝

A blazing-fast Cloudflare Worker that bundles TypeScript/JavaScript code on-the-fly with automatic Tailwind CSS generation and shadcn/ui theming support.

## API Endpoint

### POST `/api/bundle`

Bundle and transform TypeScript/JavaScript files with automatic dependency resolution from esm.sh CDN.

**URL:** `https://lovepack.dev/api/bundle`

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
  "externalPackages": ["react", "react-dom"]  // Optional, packages to mark as external
}
```

**Response:**
```json
{
  "success": true,
  "jsUrl": "https://lovepack.dev/bundle/[hash].js",
  "htmlUrl": "https://lovepack.dev/bundle/[hash].html",
  "files": {
    "[hash].js": "https://lovepack.dev/bundle/[hash].js",
    "chunks/[name]-[hash].js": "https://lovepack.dev/bundle/chunks/[name]-[hash].js"
  },
  "rawOutputs": [],
  "warnings": []  // ESBuild warnings if any
}
```

## Features

- **TypeScript/JSX Support**: Full support for TypeScript and JSX syntax with React automatic runtime
- **Automatic Bundling**: Uses ESBuild WASM for lightning-fast bundling
- **CDN Resolution**: Automatically fetches npm packages from esm.sh
- **Tailwind CSS**: Generates Tailwind CSS based on classes used in your code
- **shadcn/ui Theme**: Includes default shadcn/ui theme configuration and CSS variables
- **Typography Plugin**: Tailwind Typography plugin included for prose styles
- **Multiple Files**: Support for projects with multiple files and relative imports
- **Code Splitting**: Support for dynamic imports and React.lazy with automatic chunking
- **Smart Caching**: KV-based caching for bundled outputs
- **Server Timing**: Detailed performance metrics via Server-Timing headers

## Example Usage

### Using cURL
```bash
curl -X POST https://lovepack.dev/api/bundle \
  -H "Content-Type: application/json" \
  -d '{
    "files": [{
      "path": "app.tsx",
      "content": "import React from \"react\";\nexport default function App() {\n  return <div className=\"p-4 bg-primary text-primary-foreground rounded-lg\">Hello</div>;\n}"
    }],
    "externalPackages": ["react"]
  }'
```

### Using JavaScript
```javascript
const response = await fetch('https://lovepack.dev/api/bundle', {
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
    externalPackages: ['react']
  })
});

const result = await response.json();
console.log(result.jsUrl);   // URL to bundled JavaScript
console.log(result.htmlUrl); // URL to preview HTML page
```

### Multiple Files with Imports
```javascript
const response = await fetch('https://lovepack.dev/api/bundle', {
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
    externalPackages: ['react']
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

## Performance

- Initial requests: ~200-500ms (with dependency resolution)
- Cached requests: ~50-100ms (serving from KV cache)
- Tailwind CSS generation: ~50-100ms
- Code splitting: Automatic chunking for dynamic imports

## Web Interface

Visit [https://lovepack.dev](https://lovepack.dev) to use the interactive web UI for uploading and bundling files.

## Development

```bash
# Install dependencies
pnpm install

# Run locally
pnpm dev

# Run tests
pnpm test


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

## License

MIT
