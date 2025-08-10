# Remote Bundler

A Cloudflare Worker that bundles TypeScript/JavaScript code on-the-fly with automatic Tailwind CSS generation and shadcn/ui theming support.

## API Endpoint

### POST `/api/bundle`

Bundle and transform TypeScript/JavaScript files with automatic dependency resolution from unpkg CDN.

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
  "externalPackages": ["react", "react-dom"]  // Optional, packages to mark as external
}
```

**Response:**
```json
{
  "success": true,
  "code": "// Bundled JavaScript output",
  "css": "/* Generated Tailwind CSS with shadcn/ui theme */",
  "warnings": []  // ESBuild warnings if any
}
```

## Features

- **TypeScript/JSX Support**: Full support for TypeScript and JSX syntax
- **Automatic Bundling**: Uses ESBuild to bundle all dependencies
- **CDN Resolution**: Automatically fetches npm packages from unpkg (Cloudflare-hosted)
- **Tailwind CSS**: Generates Tailwind CSS based on classes used in your code
- **shadcn/ui Theme**: Includes default shadcn/ui theme configuration and CSS variables
- **Typography Plugin**: Tailwind Typography plugin included for prose styles
- **Multiple Files**: Support for projects with multiple files and relative imports
- **Smart Caching**: Global caching for CDN fetches to improve performance

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
    "externalPackages": ["react"]
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
      `
    }],
    externalPackages: ['react']
  })
});

const result = await response.json();
console.log(result.code); // Bundled JavaScript
console.log(result.css);  // Generated Tailwind CSS
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

- Initial requests: ~200-500ms (fetching dependencies)
- Cached requests: ~80-120ms (with global CDN cache)
- Tailwind CSS generation: ~75-115ms

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

## License

MIT