<div align='center' class='hidden'>
    <br/>
    <br/>
    <h3>Malleable UI</h3>
    <p>Versioned React UI that AI agents edit, build and commit live</p>
    <br/>
    <br/>
</div>

Versioned React UI projects on a Cloudflare Worker. Agents edit files in a **session**, viewers see **live drafts**, each agent message becomes one **git commit**. TypeScript, JSX and Tailwind are bundled on the fly.

```bash
npm i @malleable/ui
```

```ts
import { Project } from '@malleable/ui'

const project = new Project({ apiKey, id: 'u123' })
await project.init()

const session = await project.openSession({ author: { kind: 'agent', id: 'ses_1' } })
await session.apply({ ops: [{ op: 'write', path: 'App.tsx', content: code }] })
const draft = await session.build()             // draft: { ok, url } of the new module
await session.commit({ message: 'Add chart' })  // one commit, sources + dist, returns its url
await project.undo()                            // new commit with the previous sources
```

An agent loop in a Worker sends `draft.url` to the user in its own chat stream, next to the tokens. The client returns absolute urls, so the browser only runs `import(url)`. See [docs/projects.md](docs/projects.md#stream-component-urls-in-the-chat-response).

Or follow every change of a project over a WebSocket:

```ts
project.watch({
  onMessage: async (msg) => {
    if (msg.type !== 'update') return
    const mod = await import(msg.url)  // draft or commit module
    setComponent(() => mod.default)
  },
})
```

The client talks to `https://malleableui.dev` by default. If you **self-host** the worker, pass its origin:

```ts
const project = new Project({ endpoint: 'https://ui.example.com', apiKey, id: 'u123' })
```

Users can also edit with plain git:

```ts
const { authenticatedUrl } = await project.createGitToken({ label: 'laptop' })  // revocable, no expiry
```

```bash
git clone "$AUTHENTICATED_URL" app
git commit -am 'Tweak' && git push origin main   # the worker builds dist/ on top
```

## Embed in your app

Let users add screens to your dashboard with **your own** AI SDK agent loop. Each `write` or `edit` tool builds and returns a url; the browser imports it at once.

```ts
const edit = tool({
  inputSchema: z.object({ path: z.string(), oldString: z.string(), newString: z.string() }),
  async execute(input) {
    await session.apply({ ops: [{ op: 'replace', ...input }] })
    return session.build()   // { ok: true, url } or { ok: false, errorText } for the model
  },
})
```

```tsx
// browser: latest tool output url, React shared through an import map
const { default: View } = use(import(url))
return <View api={dashboardApi} />
```

Full guide with the agent route, import map and error handling: [docs/embedding.md](docs/embedding.md). Live example: https://demo.malleableui.dev, code in [`dashboard-demo/`](dashboard-demo).

## Features

- **Sessions**: atomic `write` / `replace` / `delete` ops
- **Parallel agents**: many sessions per branch; `commit` three-way merges, overlapping edits come back as conflict markers plus a `prompt` for the agent
- **Drafts**: `build()` publishes a module to viewers without touching git
- **History**: every commit holds sources and `dist/`; `undo`, `restore`, branches, fast-forward `merge`
- **Git remote**: clone and push with short-lived tokens
- **Bundling**: Rollup (wasm) + sucrase, code splitting for dynamic imports and `React.lazy`
- **npm packages**: bare imports load from esm.sh; React stays external by default
- **Tailwind CSS v4**: generated from the classes in your code, imported CSS supports `@apply`
- **shadcn/ui theme** and the Typography plugin included

## Project config

`malleable.json` at the repo root. Missing keys use the defaults:

```json
{
  "entry": "App.tsx",
  "externalPackages": ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"]
}
```

The entry module default-exports the component. Every bare import not listed in `externalPackages` is bundled from esm.sh.

## CSS variables

The generated CSS includes the default shadcn/ui variables for light and dark mode:

- `--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`
- `--background`, `--foreground`, `--card`, `--popover`
- `--border`, `--input`, `--ring`, `--radius`

## Docs

Setup, every REST route, live messages and the git remote are in [docs/projects.md](docs/projects.md).

Try it with an agent script, then open `/view/<projectId>`:

```bash
MALLEABLE_API_KEY=... pnpm tsx examples/agent.ts demo1
MALLEABLE_API_KEY=... pnpm tsx examples/dashboard-agent.ts dash1
```

## Development

```bash
pnpm install
pnpm dev          # wrangler dev; put MALLEABLE_API_KEY in .dev.vars
pnpm deployment   # typecheck and deploy
pnpm test         # runs against the deployed worker, deploy first
```

| Test | Covers |
|---|---|
| `src/bundle.test.ts` | Tailwind output, CSS imports, relative and npm imports, code splitting, build errors |
| `src/project.test.ts` | sessions, drafts, commit, undo, branches, live messages, git clone and push |
| `src/generate-tailwind.test.ts` | Tailwind class scanner, local, no network |

The worker tests need `MALLEABLE_API_KEY` (env or `.dev.vars`) and `deno` on the PATH.

## License

MIT
