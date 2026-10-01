---
title: Projects API
description: Versioned UI projects on Cloudflare Artifacts. Agents edit files in a session, viewers see live drafts, every agent message is one git commit.
---

# Projects

A **project** is a git repo in Cloudflare Artifacts plus a Durable Object (`ProjectDO`) that is its only writer.

```
 agent (Worker) ──RPC──▶ ProjectDO ──git push──▶ Artifacts repo  (src files + dist/ in one commit)
 agent (HTTP)  ──REST──▶    │  rollup + tailwind run here
                            └──WebSocket──▶ viewers: draft / update messages
 browser ◀── import() ── GET /p/:id/r/:sha/index.js   (immutable)  or  /d/:session/:n/index.js (draft)
```

## Setup

```jsonc
// wrangler.jsonc (needs wrangler >= 4.145; Artifacts is in beta)
{
  "compatibility_date": "2026-09-01",
  "artifacts": [{ "binding": "ARTIFACTS", "namespace": "lovepack" }],
  "kv_namespaces": [{ "binding": "jsCache", "id": "<kv id>" }],  // build cache
  "durable_objects": { "bindings": [{ "class_name": "ProjectDO", "name": "PROJECT" }] },
  "migrations": [{ "tag": "v3", "new_sqlite_classes": ["ProjectDO"] }]
}
```

```bash
wrangler secret put LOVEPACK_API_KEY     # REST auth and git token signing key
```

```ts
export { ProjectDO } from './project-do.js'   // the class must be exported from the Worker entry
```

## Flow

```ts
const project = env.PROJECT.get(env.PROJECT.idFromName('u123'))   // Durable Object stub, RPC
await project.init({ projectId: 'u123' })               // idempotent; { template } forks a repo

const { sessionId } = await project.openSession({ author: { kind: 'agent', id: 'ses_1' } })
await project.apply({                                   // atomic, in memory, logged in DO SQLite
  sessionId,
  ops: [
    { op: 'write', path: 'App.tsx', content: code },
    { op: 'replace', path: 'Card.tsx', oldString, newString }, // throws unless `oldString` occurs once
  ],
})
await project.build({ sessionId })                      // draft: viewers update, nothing is committed
await project.commit({ sessionId, message: 'Add chart' }) // build + git add . + commit + push
// or project.discard({ sessionId })
```

- **One open session per branch.** A session idle for 10 minutes is replaced.
- **Failed builds do not commit.** `commit` returns `{ ok: false, reason: 'build-error', errorText }`; the session stays open.
- **Head moved since open** returns `{ ok: false, reason: 'conflict' }`. Retry with `{ rebase: true }` to replay the ops over the new head.
- **History**: `log`, `undo` (new commit with the previous sources), `restore({ sha })`. History is never rewritten.
- **Branches**: `createBranch`, `branches`, `merge` (fast-forward only), `deleteBranch`.
- **Drafts live in DO memory only.** The last 3 builds per session are kept. A DO restart loses them; call `build` again.

## Repo layout

| Path | Content |
|---|---|
| `lovepack.json` | `{ "entry": "App.tsx", "externalPackages": ["react", ...] }` |
| source files | whatever the agent writes; `dist/` and `.git/` paths are rejected |
| `dist/index.js`, `dist/chunks/*`, `dist/index.css` | build output, written by the DO on commit |

The entry module default-exports the component. Its CSS is loaded relative to the module URL, so a commit sha URL is self-contained.

## REST

`/api/projects/*` needs `Authorization: Bearer $LOVEPACK_API_KEY`. `/p/*` and `/view/*` are **public by project id**, including the WebSocket. Use unguessable ids.

| Route | Method | Purpose |
|---|---|---|
| `/api/projects/:id` | POST, GET | init, info |
| `/api/projects/:id/sessions` | POST, GET | open, list |
| `/api/projects/:id/sessions/:sid/ops` | POST | `{ ops: [{ op: 'write' \| 'replace' \| 'delete', ... }] }`, atomic |
| `/api/projects/:id/sessions/:sid/{files,file?path=,diff}` | GET | list, read, diff against base |
| `/api/projects/:id/sessions/:sid/{build,commit}` | POST | draft build, commit |
| `/api/projects/:id/sessions/:sid` | DELETE | discard |
| `/api/projects/:id/{log,files,undo,restore,branches,merge}` | | history and branches |
| `/p/:id/r/:ref/*` | GET | built file at a branch or sha |
| `/p/:id/d/:sid/:build/*` | GET | draft build file |
| `/p/:id/live` | WS | `hello`, `update` (`kind: 'draft' \| 'commit'`), `build-error`, `draft-end` |
| `/view/:id` | GET | minimal live viewer page |
| `/api/projects/:id/git-access` | POST | mint a git token, see Git remote |
| `/git/:id.git/*` | GET, POST | git smart HTTP proxy |

## Git remote

Users can edit with plain git. The Worker proxies Artifacts' git remote and checks its own tokens, so Artifacts credentials never leave the Worker.

```bash
# mint a token (API key needed); scope read|write, ttl 60..86400 seconds
curl -X POST $ORIGIN/api/projects/u123/git-access -H "Authorization: Bearer $LOVEPACK_API_KEY" \
  -H 'content-type: application/json' -d '{"scope":"write"}'   # => { url, authenticatedUrl, password, expiresAt }

git clone "$AUTHENTICATED_URL" app && cd app
# edit App.tsx
git commit -am 'Tweak' && git push origin main
```

- **After a push**, `ProjectDO.afterGitPush()` builds the pushed sources. If `dist/` does not match, it adds a commit `Build dist for pushed sources`, and viewers get an `update`. Run `git pull` to get it.
- **Tokens** are stateless HMACs (`lp_<scope>_<expiry>_<mac>`) signed with `LOVEPACK_API_KEY`, bound to one project.
- **Push while an agent session is open** is allowed. The session's next `commit` returns `conflict`; retry with `rebase: true`.
- A push with a build error still lands, viewers get `draft-error`, and the head keeps its old `dist/`.

## Legacy `/api/bundle`

The stateless `POST /api/bundle` route still works (KV storage, `/bundle/<siteId>/*`). It shares `src/build.ts` with projects. Projects add history, drafts and git.

## Example

`/view/:id` is a minimal live viewer. `examples/agent.ts` plays an agent (two messages, one commit each):

```bash
LOVEPACK_API_KEY=... pnpm tsx examples/agent.ts demo1     # then open $ORIGIN/view/demo1
```

## Client

`src/client.ts` wraps the REST routes and the socket. `demo/App.tsx` is the reference use.

```ts
const project = new Project({ endpoint, apiKey, id: 'u123' })
project.watch({
  onMessage: async (msg) => {
    // draft or commit, every update has its own module url
    if (msg.type === 'update') {
      const mod = await import(new URL(msg.url, endpoint).href)
      setComponent(() => mod.default)
    }
  },
})
```

All methods take a single object argument, in the RPC, the client and the REST bodies. Edits go through one method, `apply({ ops })`.

### Live messages

| Message | When | Fields |
|---|---|---|
| `hello` | on connect | `heads`, `drafts[]` (each has `url`, `session`, `branch`, `build`) |
| `update` `kind: 'draft'` | `build` | `url`, `session`, `branch`, `build`. Not in git, lost on DO restart |
| `update` `kind: 'commit'` | commit, undo, restore, merge, git push | `url`, `branch`, `sha`, `message`, `author`. Immutable url |
| `build-error` | build failed | `session` (`git-push` for pushes), `errors` |
| `draft-end` | session committed or discarded | `session`, `outcome` |

`url` is relative to the Worker origin, so clients never build `/r/` or `/d/` paths themselves.

## Learnings

- Artifacts has no file-write API. Writes are `git push` with `isomorphic-git` on an in-memory fs (`src/memory-fs.ts`).
- `isomorphic-git` needs `readlink` and `symlink` on the fs, and `err.code` on fs errors.
- `git.commit({ ref })` needs the full ref (`refs/heads/main`). A short name writes a stray ref and the push fails with a bare 500.
- `git.fetch` needs the `origin` remote configured (`addRemote`) and returns the fetched sha in `fetchHead`.
- The DO keeps the clone in memory only. After hibernation the first call re-fetches (depth 1) and replays the session op log.
- All DO state goes through `ProjectStore` (`src/project-store.ts`). It writes SQLite/KV first, then its in-memory cache, and loads caches lazily, so a fresh instance after hibernation reads storage. `ProjectDO` never touches `ctx.storage`.
- Debug failed pushes through `gitHttp` in `project-do.ts`: it keeps the 5xx response body.
