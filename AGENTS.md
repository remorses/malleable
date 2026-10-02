use pnpm to install dependencies

after changes run `pnpm tsc`. after every big change run `pnpm deployment` to deploy the script and `pnpm test` to update snapshots (-u --run are already passed)

`pnpm test` runs against the deployed worker. Use the typed client (`src/client.ts`) in tests, scripts and examples, not raw `fetch` to `/api/*`.


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

This is a Cloudflare Workers project for versioned React UI projects: agents edit files, the worker bundles TypeScript/TSX/JSX with Tailwind CSS and commits sources plus `dist/` to Cloudflare Artifacts.

### Key Features

- TypeScript/TSX/JSX bundling using Rollup (`@rollup/browser`, patched wasm loader) + sucrase
- Tailwind CSS v4 generation via `compile()` (no PostCSS), see `docs/tailwind-v4-upgrade.md`
- npm package resolution via esm.sh CDN
- Live viewer page at `/view/:id`
- Deployed at: https://remote-bundler.fumabase.com

## Projects (Artifacts)

See `docs/projects.md`. Build logic lives in `src/build.ts` (Rollup plugins in `src/rollup-plugins.ts`). `ProjectDO` (`src/project-do.ts`) is the single writer; its storage and caches live only in `ProjectStore` (`src/project-store.ts`); REST in `src/projects-api.ts`; client in `src/client.ts`. `src/project.test.ts` and `src/bundle.test.ts` run against the deployed worker and need `LOVEPACK_API_KEY` (read from `.dev.vars`). `bundle.test.ts` tests bundler output through draft builds of one project.
