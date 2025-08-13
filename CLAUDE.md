use pnpm to install dependencies

after changes run `pnpm tsc`. after every big change run `pnpm deployment` to deploy the script and `pnpm test:prod` to update snapshots (-u --run are already passed)

`pnpm test` will run the tests against the local bundler instead of the remote worker


to read github files and repos docs use gitchamber. use `curl https://gitchamber.com` to see docs

IMPORTANT: tests must be run after deployment. the tests use the deployed worker!

## Testing Preferences

When writing vitest tests, always use toMatchInlineSnapshot. Never use any other expect methods. these are difficult to update and slow us down. we are still in the idea phase.

If you are not able to make a test pass do not revert it and change the test to make it pass changing the requirements. instead leave it failing and call the think tool to try to use an approach to make the test pass with the same requirements. if that does not help ask help to the user.

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
- Deployed at: https://lovepack.dev

### API Endpoint

POST /api/bundle

- `code`: Source code to transform (required)
- `loader`: File type - 'tsx', 'ts', 'jsx', 'js' (default: 'tsx')
- `extractCSS`: Generate Tailwind CSS (default: true)
- `resolveImports`: Resolve npm imports via esm.sh (default: false)
- `externalPackages`: Array of packages to treat as external (default: [])
