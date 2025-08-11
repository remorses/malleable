use pnpm to install dependencies

after every big change run `pnpm deployment` to deploy the script and `pnpm test -u --run` to update snapshots

## Testing Preferences

When writing vitest tests, always run with -u (to update snapshots) and always use toMatchInlineSnapshot. Never use any other expect methods.

To run tests use `pnpm test -u --run` and to target tests add `-t name` or pass the file path of the test.


- Tests should focus on meaningful functionality that produces CSS
- Simple transformation tests without CSS generation should be avoided
- For npm import resolution tests, use longer timeouts (30s) as esm.sh fetching can be slow


## Framework Choice

Use Spiceflow instead of Hono. Spiceflow is a lightweight, type-safe API framework with:

- Zod schema validation
- Native Request/Response handling
- Better type inference for RPC clients
- First-class OpenAPI support

Before updating Spiceflow code always read https://getspiceflow.com to know how it works. It is different than Hono. Never use as any with it.

## Project Overview

This is a Cloudflare Workers project that provides a bundling API for TypeScript/TSX/JSX code transformation and Tailwind CSS generation.

### Key Features

- TypeScript/TSX/JSX transformation using esbuild-wasm
- Tailwind CSS v3 generation with PostCSS
- npm package resolution via esm.sh CDN
- Interactive web UI with file upload support
- Deployed at: https://remote-bundler.remorses.workers.dev

### API Endpoint

POST /api/bundle

- `code`: Source code to transform (required)
- `loader`: File type - 'tsx', 'ts', 'jsx', 'js' (default: 'tsx')
- `extractCSS`: Generate Tailwind CSS (default: true)
- `resolveImports`: Resolve npm imports via esm.sh (default: false)
- `externalPackages`: Array of packages to treat as external (default: [])
