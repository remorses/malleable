import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Runs against the deployed worker: deploy first (`pnpm deployment`)
const URL_BASE = 'https://remote-bundler.fumabase.com'
const KEY =
  process.env.LOVEPACK_API_KEY ??
  /LOVEPACK_API_KEY=(\S+)/.exec(readFileSync('.dev.vars', 'utf8'))![1]

const shas: string[] = []
/** Replace commit shas with stable placeholders so snapshots do not change per run */
function stable(value: unknown) {
  return JSON.parse(
    JSON.stringify(value)
      .replace(/\b[0-9a-f]{40}\b/g, (sha) => {
        let i = shas.indexOf(sha)
        if (i === -1) i = shas.push(sha) - 1
        return `<sha${i}>`
      })
      .replace(/s_[0-9a-f-]{12,}/g, '<session>')
      .replace(/Undo [0-9a-f]{7}:/g, 'Undo <short>:')
      .replace(/t-[a-z0-9]{8}/g, '<project>'),
  )
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${KEY}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json()) as any }
}

const author = { kind: 'agent', id: 'test-agent' }

describe('projects: session, draft, commit, undo, branches', () => {
  it('runs the full flow', { timeout: 180_000 }, async () => {
    const id = `t-${Math.random().toString(36).slice(2, 10)}`
    const p = `/api/projects/${id}`

    const init = await api('POST', p, {})
    expect(stable(init)).toMatchInlineSnapshot(`
      {
        "json": {
          "defaultBranch": "main",
          "heads": {
            "main": "<sha0>",
          },
          "projectId": "<project>",
          "repo": "p-<project>",
        },
        "status": 200,
      }
    `)

    // live socket: collect every message the DO broadcasts
    const messages: any[] = []
    const waiters: Array<() => void> = []
    const ws = new WebSocket(`${URL_BASE.replace('https', 'wss')}/p/${id}/live`)
    ws.onmessage = (e) => {
      messages.push(JSON.parse(String(e.data)))
      waiters.splice(0).forEach((w) => w())
    }
    const until = (pred: (m: any) => boolean) =>
      new Promise<void>((resolve) => {
        const check = () => (messages.some(pred) ? resolve() : waiters.push(check))
        check()
      })
    await until((m) => m.type === 'hello')

    const unauthorized = await fetch(`${URL_BASE}${p}`)
    expect(unauthorized.status).toMatchInlineSnapshot(`401`)

    // open a session; a second one on the same branch is rejected
    const open = await api('POST', `${p}/sessions`, { author })
    const sid = open.json.sessionId as string
    expect(stable(open.json.base)).toMatchInlineSnapshot(`"<sha0>"`)
    const busy = await api('POST', `${p}/sessions`, { author })
    expect(busy.status).toMatchInlineSnapshot(`409`)

    // ops are atomic: a failing op applies nothing
    const bad = await api('POST', `${p}/sessions/${sid}/ops`, {
      ops: [
        { op: 'write', path: 'Card.tsx', content: 'export const x = 1' },
        { op: 'replace', path: 'App.tsx', oldString: 'nope', newString: 'x' },
      ],
    })
    expect(bad).toMatchInlineSnapshot(`
      {
        "json": {
          "code": "REPLACE_NOT_FOUND",
          "message": "REPLACE_NOT_FOUND: App.tsx",
        },
        "status": 422,
      }
    `)
    expect((await api('GET', `${p}/sessions/${sid}/files`)).json).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "lovepack.json",
      ]
    `)

    const ops = await api('POST', `${p}/sessions/${sid}/ops`, {
      ops: [
        {
          op: 'write',
          path: 'Card.tsx',
          content:
            'export default function Card({ title }: { title: string }) { return <div className="rounded border p-4 bg-blue-500">{title}</div> }',
        },
        {
          op: 'write',
          path: 'App.tsx',
          content:
            "import Card from './Card'\nexport default function App() { return <Card title=\"Revenue\" /> }",
        },
      ],
    })
    expect(ops).toMatchInlineSnapshot(`
      {
        "json": {
          "ok": true,
        },
        "status": 200,
      }
    `)
    expect((await api('GET', `${p}/sessions/${sid}/diff`)).json).toMatchInlineSnapshot(`
      [
        [
          "modified",
          "App.tsx",
        ],
        [
          "added",
          "Card.tsx",
        ],
      ]
    `)

    // draft build is served from the DO and is not in git history
    const build = await api('POST', `${p}/sessions/${sid}/build`)
    expect(build).toMatchInlineSnapshot(`
      {
        "json": {
          "build": 1,
          "files": [
            "index.js",
            "index.css",
          ],
          "ok": true,
        },
        "status": 200,
      }
    `)
    const draftJs = await fetch(`${URL_BASE}/p/${id}/d/${sid}/1/index.js`)
    expect(draftJs.status).toMatchInlineSnapshot(`200`)
    expect((await draftJs.text()).includes('Revenue')).toMatchInlineSnapshot(`true`)
    const draftCss = await (await fetch(`${URL_BASE}/p/${id}/d/${sid}/1/index.css`)).text()
    expect(draftCss.includes('bg-blue-500')).toMatchInlineSnapshot(`true`)
    expect((await api('GET', `${p}/log`)).json.length).toMatchInlineSnapshot(`1`)

    // a broken build blocks the commit and keeps the session open
    await api('POST', `${p}/sessions/${sid}/ops`, {
      ops: [{ op: 'write', path: 'Broken.tsx', content: 'export default <div' }],
    })
    await api('POST', `${p}/sessions/${sid}/ops`, {
      ops: [
        {
          op: 'write',
          path: 'App.tsx',
          content: "import B from './Broken'\nexport default function App() { return <B /> }",
        },
      ],
    })
    const failed = await api('POST', `${p}/sessions/${sid}/commit`, { message: 'broken' })
    expect({ status: failed.status, reason: failed.json.reason, text: failed.json.errorText }).toMatchInlineSnapshot(`
      {
        "reason": "build-error",
        "status": 200,
        "text": "✘ [ERROR] Expected ">" but found end of file

          local:/Broken.tsx:1:19:
            1 │ export default <div
              │                    ^
              ╵                    >

      ",
      }
    `)
    await api('POST', `${p}/sessions/${sid}/ops`, {
      ops: [
        { op: 'delete', path: 'Broken.tsx' },
        {
          op: 'write',
          path: 'App.tsx',
          content:
            "import Card from './Card'\nexport default function App() { return <Card title=\"Revenue\" /> }",
        },
      ],
    })

    // commit: one commit holds sources and dist
    const commit = await api('POST', `${p}/sessions/${sid}/commit`, { message: 'Add revenue card' })
    expect(stable(commit)).toMatchInlineSnapshot(`
      {
        "json": {
          "ok": true,
          "sha": "<sha1>",
        },
        "status": 200,
      }
    `)
    const sha = commit.json.sha as string
    const log = await api('GET', `${p}/log`)
    expect(stable(log.json.map(({ time, ...c }: any) => c))).toMatchInlineSnapshot(`
      [
        {
          "author": {
            "id": "test-agent",
            "kind": "agent",
          },
          "message": "Add revenue card",
          "parents": [
            "<sha0>",
          ],
          "sha": "<sha1>",
        },
        {
          "author": {
            "id": "lovepack",
            "kind": "system",
          },
          "message": "Initialize project",
          "parents": [],
          "sha": "<sha0>",
        },
      ]
    `)

    // committed output is served by sha (immutable) and by branch
    const bySha = await fetch(`${URL_BASE}/p/${id}/r/${sha}/index.js`)
    expect({
      status: bySha.status,
      cache: bySha.headers.get('cache-control'),
      type: bySha.headers.get('content-type'),
    }).toMatchInlineSnapshot(`
      {
        "cache": "public, max-age=31536000, immutable",
        "status": 200,
        "type": "text/javascript; charset=utf-8",
      }
    `)
    const byBranch = await fetch(`${URL_BASE}/p/${id}/r/main/index.css`)
    expect({
      status: byBranch.status,
      cache: byBranch.headers.get('cache-control'),
      tailwind: (await byBranch.text()).includes('bg-blue-500'),
    }).toMatchInlineSnapshot(`
      {
        "cache": "no-store",
        "status": 200,
        "tailwind": true,
      }
    `)

    // the session ended; its id is gone
    expect((await api('POST', `${p}/sessions/${sid}/build`)).status).toMatchInlineSnapshot(`404`)

    // second session: replace, commit, then undo restores the previous sources
    const s2 = (await api('POST', `${p}/sessions`, { author })).json.sessionId as string
    const ambiguous = await api('POST', `${p}/sessions/${s2}/ops`, {
      ops: [{ op: 'replace', path: 'App.tsx', oldString: 'e', newString: 'E' }],
    })
    expect({ status: ambiguous.status, code: ambiguous.json.code }).toMatchInlineSnapshot(`
      {
        "code": "REPLACE_AMBIGUOUS",
        "status": 422,
      }
    `)
    await api('POST', `${p}/sessions/${s2}/ops`, {
      ops: [{ op: 'replace', path: 'App.tsx', oldString: 'Revenue', newString: 'Sales' }],
    })
    const second = await api('POST', `${p}/sessions/${s2}/commit`, { message: 'Rename card' })
    expect(second.json.ok).toMatchInlineSnapshot(`true`)
    expect(
      (await api('GET', `${p}/files?ref=main`)).json,
    ).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "Card.tsx",
        "lovepack.json",
      ]
    `)

    const undo = await api('POST', `${p}/undo`, {})
    expect(stable(undo)).toMatchInlineSnapshot(`
      {
        "json": {
          "ok": true,
          "sha": "<sha2>",
        },
        "status": 200,
      }
    `)
    const jsAfterUndo = await (await fetch(`${URL_BASE}/p/${id}/r/main/index.js`)).text()
    expect({ revenue: jsAfterUndo.includes('Revenue'), sales: jsAfterUndo.includes('Sales') }).toMatchInlineSnapshot(`
      {
        "revenue": true,
        "sales": false,
      }
    `)
    expect((await api('GET', `${p}/log`)).json.map((c: any) => c.message.replace(/[0-9a-f]{7}/, '<short>'))).toMatchInlineSnapshot(`
      [
        "Undo <short>: Rename card",
        "Rename card",
        "Add revenue card",
        "Initialize project",
      ]
    `)

    // branches: create, work on it, fast-forward merge
    expect((await api('POST', `${p}/branches`, { name: 'draft' })).json).toMatchInlineSnapshot(`
      {
        "ok": true,
      }
    `)
    expect((await api('GET', `${p}/branches`)).json).toMatchInlineSnapshot(`
      [
        "draft",
        "main",
      ]
    `)
    const s3 = (await api('POST', `${p}/sessions`, { author, branch: 'draft' })).json.sessionId as string
    await api('POST', `${p}/sessions/${s3}/ops`, {
      ops: [{ op: 'write', path: 'Extra.tsx', content: 'export const extra = 1' }],
    })
    expect((await api('POST', `${p}/sessions/${s3}/commit`, { message: 'Extra on draft' })).json.ok).toMatchInlineSnapshot(`true`)
    expect((await api('GET', `${p}/files?ref=main`)).json).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "Card.tsx",
        "lovepack.json",
      ]
    `)
    expect((await api('POST', `${p}/merge`, { branch: 'draft' })).status).toMatchInlineSnapshot(`200`)
    expect((await api('GET', `${p}/files?ref=main`)).json).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "Card.tsx",
        "Extra.tsx",
        "lovepack.json",
      ]
    `)
    expect((await api('DELETE', `${p}/branches/draft`)).json).toMatchInlineSnapshot(`
      {
        "ok": true,
      }
    `)

    // viewers saw drafts and commits in order
    await until((m) => m.type === 'update' && m.message === 'Merge draft')
    ws.close()
    expect(stable(messages.map(({ author, ...m }: any) => m))).toMatchInlineSnapshot(`
      [
        {
          "drafts": [],
          "heads": {
            "main": "<sha0>",
          },
          "type": "hello",
        },
        {
          "branch": "main",
          "build": 1,
          "session": "<session>",
          "type": "draft",
        },
        {
          "branch": "main",
          "message": "Add revenue card",
          "sha": "<sha1>",
          "type": "update",
        },
        {
          "outcome": "committed",
          "session": "<session>",
          "type": "draft-end",
        },
        {
          "branch": "main",
          "message": "Rename card",
          "sha": "<sha3>",
          "type": "update",
        },
        {
          "outcome": "committed",
          "session": "<session>",
          "type": "draft-end",
        },
        {
          "branch": "main",
          "message": "Undo <short>: Rename card",
          "sha": "<sha2>",
          "type": "update",
        },
        {
          "branch": "draft",
          "message": "Extra on draft",
          "sha": "<sha4>",
          "type": "update",
        },
        {
          "outcome": "committed",
          "session": "<session>",
          "type": "draft-end",
        },
        {
          "branch": "main",
          "message": "Merge draft",
          "sha": "<sha4>",
          "type": "update",
        },
      ]
    `)
  })
})

/** Server-side lines of a failed git command, without the random repo name */
function gitError(fn: () => unknown) {
  try {
    fn()
  } catch (e: any) {
    return String(e.stderr).split('\n').filter((l) => l.startsWith('remote:'))
  }
  return 'no error'
}

describe('git remote', () => {
  it('clone, push sources, dist is built on top', { timeout: 120_000 }, async () => {
    const id = `g-${Math.random().toString(36).slice(2, 10)}`
    const p = `/api/projects/${id}`
    await api('POST', p, {})

    const messages: any[] = []
    const waiters: Array<() => void> = []
    const ws = new WebSocket(`${URL_BASE.replace('https', 'wss')}/p/${id}/live`)
    ws.onmessage = (e) => {
      messages.push(JSON.parse(String(e.data)))
      waiters.splice(0).forEach((w) => w())
    }
    const until = (pred: (m: any) => boolean) =>
      new Promise<void>((resolve) => {
        const check = () => (messages.some(pred) ? resolve() : waiters.push(check))
        check()
      })
    await until((m) => m.type === 'hello')

    const write = (await api('POST', `${p}/git-access`, { scope: 'write' })).json
    const read = (await api('POST', `${p}/git-access`, { scope: 'read' })).json
    expect({ url: write.url.replace(URL_BASE, '<origin>'), scope: write.scope }).toMatchInlineSnapshot(`
      {
        "scope": "write",
        "url": "<origin>/git/g-whujm5y0.git",
      }
    `)

    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=Dev', '-c', 'user.email=dev@example.com', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    const root = mkdtempSync(join(tmpdir(), 'lp-git-'))
    git(root, 'clone', write.authenticatedUrl, 'w')
    const w = join(root, 'w')
    expect(git(w, 'ls-files').split('\n').filter((f) => !f.startsWith('dist/'))).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "lovepack.json",
        "",
      ]
    `)

    writeFileSync(join(w, 'App.tsx'), 'export default function App() { return <div className="p-4 bg-red-500">From git</div> }\n')
    git(w, 'commit', '-am', 'Edit from git')
    git(w, 'push', 'origin', 'main')
    await until((m) => m.type === 'update' && m.message === 'Build dist for pushed sources')

    const js = await (await fetch(`${URL_BASE}/p/${id}/r/main/index.js`)).text()
    const css = await (await fetch(`${URL_BASE}/p/${id}/r/main/index.css`)).text()
    expect({ js: js.includes('From git'), tailwind: css.includes('bg-red-500') }).toMatchInlineSnapshot(`
      {
        "js": true,
        "tailwind": true,
      }
    `)
    expect((await api('GET', `${p}/log`)).json.map((c: any) => c.message)).toMatchInlineSnapshot(`
      [
        "Build dist for pushed sources",
        "Edit from git",
        "Initialize project",
      ]
    `)

    // the user pulls the dist commit and keeps working
    git(w, 'pull', '--ff-only', 'origin', 'main')
    expect(existsSync(join(w, 'dist', 'index.js'))).toMatchInlineSnapshot(`true`)

    // a read token can clone but not push; a bad token is refused
    const r = join(root, 'r')
    git(root, 'clone', read.authenticatedUrl, 'r')
    writeFileSync(join(r, 'x.txt'), 'x')
    git(r, 'add', 'x.txt')
    git(r, 'commit', '-m', 'x')
    expect(gitError(() => git(r, 'push', 'origin', 'main'))).toMatchInlineSnapshot(`
      [
        "remote: Missing or invalid git token. Create one with POST /api/projects/:id/git-access",
      ]
    `)
    expect(gitError(() => git(root, 'clone', write.url.replace('://', '://x:bad@'), 'bad'))).toMatchInlineSnapshot(`
      [
        "remote: Missing or invalid git token. Create one with POST /api/projects/:id/git-access",
      ]
    `)
    ws.close()
  })
})
