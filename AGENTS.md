use pnpm to install dependencies

after changes run `pnpm tsc`. after every big change run `pnpm deployment` to deploy the script and `pnpm test` to update snapshots (-u --run are already passed)

`pnpm test` runs against the deployed worker. `pnpm test:local` (`USE_LOCAL=1`) runs the legacy `/api/bundle` tests against the local bundler.


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

- TypeScript/TSX/JSX bundling using Rollup (`@rollup/browser`, patched wasm loader) + sucrase
- Tailwind CSS v4 generation via `compile()` (no PostCSS), see `docs/tailwind-v4-upgrade.md`
- npm package resolution via esm.sh CDN
- Interactive web UI with file upload support
- Deployed at: https://remote-bundler.fumabase.com

### API Endpoint (legacy, stateless)

POST /api/bundle

- `files`: `{ path, content }[]` (required)
- `entryPoint`: entry file (default: first file)
- `externalPackages`: packages to treat as external (default: [])
- `siteId`: output id, `[a-zA-Z0-9_-]+` (required)

Output is stored in KV and served from `GET /bundle/<siteId>/*`.

## Projects (Artifacts)

See `docs/projects.md`. Build logic shared with `/api/bundle` lives in `src/build.ts`. `ProjectDO` (`src/project-do.ts`) is the single writer; its storage and caches live only in `ProjectStore` (`src/project-store.ts`); REST in `src/projects-api.ts`; client in `src/client.ts`. `src/project.test.ts` runs against the deployed worker and needs `LOVEPACK_API_KEY` (read from `.dev.vars`).
