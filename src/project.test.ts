import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MalleableError, Project, type Author, type LiveMessage } from './client.ts'

// Runs against the deployed worker: deploy first (`pnpm deployment`)
const endpoint = 'https://malleableui.dev'
const apiKey =
  process.env.MALLEABLE_API_KEY ??
  /MALLEABLE_API_KEY=(\S+)/.exec(readFileSync('.dev.vars', 'utf8'))![1]

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
      .replace(/\b[0-9a-f]{7}\b/g, '<short>')
      .replace(/[tgm]-[a-z0-9]{8}/g, '<project>'),
  )
}

/** Error of a rejected client call, as plain data */
function failure(promise: Promise<unknown>) {
  return promise.then(
    () => 'no error',
    (e: MalleableError) => ({ status: e.status, code: e.code, message: e.message }),
  )
}

/** Collects every live message of a project */
function watchLive(project: Project) {
  const messages: LiveMessage[] = []
  const waiters: Array<() => void> = []
  const live = project.watch({
    onMessage(m) {
      messages.push(m)
      waiters.splice(0).forEach((w) => w())
    },
  })
  const until = (pred: (m: LiveMessage) => boolean) =>
    new Promise<void>((resolve) => {
      const check = () => (messages.some(pred) ? resolve() : waiters.push(check))
      check()
    })
  return { messages, until, close: live.close }
}

const newProject = (prefix: string) =>
  new Project({ endpoint, apiKey, id: `${prefix}-${Math.random().toString(36).slice(2, 10)}` })

const author: Author = { kind: 'agent', id: 'test-agent' }

describe('projects: session, draft, commit, undo, branches', () => {
  it('runs the full flow', { timeout: 180_000 }, async () => {
    const project = newProject('t')
    expect(stable(await project.init())).toMatchInlineSnapshot(`
      {
        "defaultBranch": "main",
        "heads": {
          "main": "<sha0>",
        },
        "projectId": "<project>",
        "repo": "p-<project>",
      }
    `)

    const live = watchLive(project)
    await live.until((m) => m.type === 'hello')

    const unauthorized = new Project({ endpoint, apiKey: 'wrong', id: project.id })
    expect(await failure(unauthorized.info())).toMatchInlineSnapshot(`
      {
        "code": undefined,
        "message": "Missing or invalid API key. Send \`Authorization: Bearer <MALLEABLE_API_KEY>\`.",
        "status": 401,
      }
    `)

    const session = await project.openSession({ author })
    expect(stable(session.base)).toMatchInlineSnapshot(`"<sha0>"`)
    expect(stable(await project.sessions())).toMatchInlineSnapshot(`
      [
        {
          "author": {
            "id": "test-agent",
            "kind": "agent",
          },
          "branch": "main",
          "id": "<session>",
        },
      ]
    `)

    // ops are atomic: a failing op applies nothing
    const bad = session.apply({
      ops: [
        { op: 'write', path: 'Card.tsx', content: 'export const x = 1' },
        { op: 'replace', path: 'App.tsx', oldString: 'nope', newString: 'x' },
      ],
    })
    expect(await failure(bad)).toMatchInlineSnapshot(`
      {
        "code": "REPLACE_NOT_FOUND",
        "message": "REPLACE_NOT_FOUND: App.tsx",
        "status": 422,
      }
    `)
    expect(await session.list()).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "malleable.json",
      ]
    `)

    await session.apply({
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
          content: "import Card from './Card'\nexport default function App() { return <Card title=\"Revenue\" /> }",
        },
      ],
    })
    expect(await session.read({ path: 'Card.tsx' })).toMatchInlineSnapshot(`"export default function Card({ title }: { title: string }) { return <div className="rounded border p-4 bg-blue-500">{title}</div> }"`)
    expect(await session.diff()).toMatchInlineSnapshot(`
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
    const build = await session.build()
    expect(stable(build)).toMatchInlineSnapshot(`
      {
        "build": 1,
        "files": [
          "index.js",
          "index.css",
        ],
        "ok": true,
        "url": "https://malleableui.dev/p/<project>/d/<session>/1/index.js",
      }
    `)
    // the agent gets the module url back, no socket needed
    if (!build.ok) throw new Error(build.errorText)
    const draftJs = await fetch(new URL(build.url, endpoint))
    expect(draftJs.status).toMatchInlineSnapshot(`200`)
    expect((await draftJs.text()).includes('Revenue')).toMatchInlineSnapshot(`true`)
    const draftCss = await (await fetch(new URL('index.css', new URL(build.url, endpoint)))).text()
    expect(draftCss.includes('bg-blue-500')).toMatchInlineSnapshot(`true`)
    // viewers get the same url over the socket
    await live.until((m) => m.type === 'update' && m.kind === 'draft' && m.url === build.url)
    expect((await project.log()).length).toMatchInlineSnapshot(`1`)

    // a broken build blocks the commit and keeps the session open
    await session.apply({
      ops: [
        { op: 'write', path: 'Broken.tsx', content: 'export default <div' },
        { op: 'write', path: 'App.tsx', content: "import B from './Broken'\nexport default function App() { return <B /> }" },
      ],
    })
    const failed = await session.commit({ message: 'broken' })
    expect(failed.ok === false && failed.reason === 'build-error' && failed.errorText).toMatchInlineSnapshot(`
      "✘ [ERROR] [plugin local-files] Broken.tsx (1:19): Unexpectedly reached the end of input.

          /Broken.tsx:1:19:
      1: export default <div
                            ^
      "
    `)
    await session.apply({
      ops: [
        { op: 'delete', path: 'Broken.tsx' },
        {
          op: 'write',
          path: 'App.tsx',
          content: "import Card from './Card'\nexport default function App() { return <Card title=\"Revenue\" /> }",
        },
      ],
    })

    // commit: one commit holds sources and dist
    const commit = await session.commit({ message: 'Add revenue card' })
    expect(stable(commit)).toMatchInlineSnapshot(`
      {
        "ok": true,
        "sha": "<sha1>",
        "url": "https://malleableui.dev/p/<project>/r/<sha1>/index.js",
      }
    `)
    if (!commit.ok) throw new Error('commit failed')
    expect((await fetch(new URL(commit.url, endpoint))).status).toMatchInlineSnapshot(`200`)
    expect(stable((await project.log()).map(({ time, ...c }) => c))).toMatchInlineSnapshot(`
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
            "id": "malleable",
            "kind": "system",
          },
          "message": "Initialize project",
          "parents": [],
          "sha": "<sha0>",
        },
      ]
    `)

    // committed output is served by sha (immutable) and by branch
    const bySha = await fetch(new URL(commit.url, endpoint))
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
    const byBranch = await fetch(`${endpoint}/p/${project.id}/r/main/index.css`)
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
    expect(stable(await failure(session.build()))).toMatchInlineSnapshot(`
      {
        "code": "SESSION_NOT_FOUND",
        "message": "SESSION_NOT_FOUND: <session>",
        "status": 404,
      }
    `)

    // second session: replace, commit, then undo restores the previous sources
    const s2 = await project.openSession({ author })
    const ambiguous = s2.apply({ ops: [{ op: 'replace', path: 'App.tsx', oldString: 'e', newString: 'E' }] })
    expect(await failure(ambiguous)).toMatchInlineSnapshot(`
      {
        "code": "REPLACE_AMBIGUOUS",
        "message": "REPLACE_AMBIGUOUS: App.tsx",
        "status": 422,
      }
    `)
    await s2.apply({ ops: [{ op: 'replace', path: 'App.tsx', oldString: 'Revenue', newString: 'Sales' }] })
    expect((await s2.commit({ message: 'Rename card' })).ok).toMatchInlineSnapshot(`true`)
    expect(await project.files()).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "Card.tsx",
        "malleable.json",
      ]
    `)

    expect(stable(await project.undo())).toMatchInlineSnapshot(`
      {
        "ok": true,
        "sha": "<sha2>",
        "url": "https://malleableui.dev/p/<project>/r/<sha2>/index.js",
      }
    `)
    const jsAfterUndo = await (await fetch(`${endpoint}/p/${project.id}/r/main/index.js`)).text()
    expect({ revenue: jsAfterUndo.includes('Revenue'), sales: jsAfterUndo.includes('Sales') }).toMatchInlineSnapshot(`
      {
        "revenue": true,
        "sales": false,
      }
    `)
    expect(stable((await project.log()).map((c) => c.message))).toMatchInlineSnapshot(`
      [
        "Undo <short>: Rename card",
        "Rename card",
        "Add revenue card",
        "Initialize project",
      ]
    `)

    // branches: create, work on it, fast-forward merge
    await project.createBranch({ name: 'draft' })
    expect(await project.branches()).toMatchInlineSnapshot(`
      [
        "draft",
        "main",
      ]
    `)
    const s3 = await project.openSession({ author, branch: 'draft' })
    await s3.apply({ ops: [{ op: 'write', path: 'Extra.tsx', content: 'export const extra = 1' }] })
    expect((await s3.commit({ message: 'Extra on draft' })).ok).toMatchInlineSnapshot(`true`)
    expect(await project.files()).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "Card.tsx",
        "malleable.json",
      ]
    `)
    expect(stable(await project.merge({ branch: 'draft' }))).toMatchInlineSnapshot(`
      {
        "sha": "<sha3>",
        "url": "https://malleableui.dev/p/<project>/r/<sha3>/index.js",
      }
    `)
    expect(await project.files()).toMatchInlineSnapshot(`
      [
        "App.tsx",
        "Card.tsx",
        "Extra.tsx",
        "malleable.json",
      ]
    `)
    await project.deleteBranch({ name: 'draft' })
    expect(await project.branches()).toMatchInlineSnapshot(`
      [
        "main",
      ]
    `)

    // viewers saw drafts and commits in order
    await live.until((m) => m.type === 'update' && m.kind === 'commit' && m.message === 'Merge draft')
    live.close()
    const commitUrls = live.messages.flatMap((m) => (m.type === 'update' && m.kind === 'commit' ? [m.url] : []))
    expect(
      await Promise.all(commitUrls.map(async (url) => (await fetch(url)).status)),
    ).toMatchInlineSnapshot(`
      [
        200,
        200,
        200,
        200,
        200,
      ]
    `)
    expect(stable(live.messages.map((m) => ({ ...m, author: undefined })))).toMatchInlineSnapshot(`
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
          "kind": "draft",
          "session": "<session>",
          "type": "update",
          "url": "https://malleableui.dev/p/<project>/d/<session>/1/index.js",
        },
        {
          "branch": "main",
          "kind": "commit",
          "message": "Add revenue card",
          "sha": "<sha1>",
          "type": "update",
          "url": "https://malleableui.dev/p/<project>/r/<sha1>/index.js",
        },
        {
          "outcome": "committed",
          "session": "<session>",
          "type": "draft-end",
        },
        {
          "branch": "main",
          "kind": "commit",
          "message": "Rename card",
          "sha": "<sha4>",
          "type": "update",
          "url": "https://malleableui.dev/p/<project>/r/<sha4>/index.js",
        },
        {
          "outcome": "committed",
          "session": "<session>",
          "type": "draft-end",
        },
        {
          "branch": "main",
          "kind": "commit",
          "message": "Undo <short>: Rename card",
          "sha": "<sha2>",
          "type": "update",
          "url": "https://malleableui.dev/p/<project>/r/<sha2>/index.js",
        },
        {
          "branch": "draft",
          "kind": "commit",
          "message": "Extra on draft",
          "sha": "<sha3>",
          "type": "update",
          "url": "https://malleableui.dev/p/<project>/r/<sha3>/index.js",
        },
        {
          "outcome": "committed",
          "session": "<session>",
          "type": "draft-end",
        },
        {
          "branch": "main",
          "kind": "commit",
          "message": "Merge draft",
          "sha": "<sha3>",
          "type": "update",
          "url": "https://malleableui.dev/p/<project>/r/<sha3>/index.js",
        },
      ]
    `)
  })
})

describe('parallel sessions', () => {
  it('merges disjoint edits; overlapping edits become markers the agent resolves', { timeout: 180_000 }, async () => {
    const project = newProject('m')
    await project.init()
    const seed = await project.openSession({ author })
    await seed.apply({
      ops: [
        {
          op: 'write',
          path: 'App.tsx',
          content: [
            'export default function App() {',
            '  return (',
            '    <div className="p-4">',
            '      <h1 className="text-2xl">Revenue</h1>',
            '      <p className="text-sm">Monthly totals</p>',
            '    </div>',
            '  )',
            '}',
            '',
          ].join('\n'),
        },
      ],
    })
    expect((await seed.commit({ message: 'Seed' })).ok).toMatchInlineSnapshot(`true`)

    // three agents open sessions on main at the same time
    const [a, b, c] = await Promise.all(
      ['agent-a', 'agent-b', 'agent-c'].map((id) => project.openSession({ author: { kind: 'agent', id } })),
    )
    await a.apply({ ops: [{ op: 'replace', path: 'App.tsx', oldString: 'Monthly totals', newString: 'Weekly totals' }] })
    await b.apply({ ops: [{ op: 'replace', path: 'App.tsx', oldString: 'p-4', newString: 'p-8' }] })
    await c.apply({ ops: [{ op: 'replace', path: 'App.tsx', oldString: 'Monthly totals', newString: 'Totals per month' }] })

    // a lands first; b changed another line, so it merges cleanly
    expect(stable(await a.commit({ message: 'Weekly totals' }))).toMatchInlineSnapshot(`
      {
        "ok": true,
        "sha": "<sha5>",
        "url": "https://malleableui.dev/p/<project>/r/<sha5>/index.js",
      }
    `)
    expect(stable(await b.commit({ message: 'More padding' }))).toMatchInlineSnapshot(`
      {
        "merged": true,
        "ok": true,
        "sha": "<sha6>",
        "url": "https://malleableui.dev/p/<project>/r/<sha6>/index.js",
      }
    `)

    // c changed the same line as a: its session moves onto main with markers, commit returns a prompt
    const conflict = await c.commit({ message: 'Reword totals' })
    if (conflict.ok || conflict.reason !== 'conflict') throw new Error(`expected a conflict: ${JSON.stringify(conflict)}`)
    expect(stable(conflict.conflicts)).toMatchInlineSnapshot(`
      [
        {
          "lines": [
            5,
          ],
          "path": "App.tsx",
        },
      ]
    `)
    expect('\n' + stable(conflict.prompt)).toMatchInlineSnapshot(`
      "
      Your commit was not saved: your changes conflict with main.

      Commits that landed on main while you worked:
      - <short> "More padding" by agent agent-b
      - <short> "Weekly totals" by agent agent-a

      Your files now contain both versions, separated by conflict markers:
      - App.tsx: line 5

      Each conflict looks like this:

      <<<<<<< yours
      (your version)
      ||||||| base
      (the version you both started from)
      =======
      (the version now on main)
      >>>>>>> main

      Read each file. Replace every block, from the <<<<<<< line to the >>>>>>> line, with code that keeps
      both intents. Compare each side with the base to see what it changed. Keep the other change unless it
      contradicts what the user asked for. Then commit again."
    `)
    const marked = (await c.read({ path: 'App.tsx' }))!
    expect('\n' + stable(marked)).toMatchInlineSnapshot(`
      "
      export default function App() {
        return (
          <div className="p-8">
            <h1 className="text-2xl">Revenue</h1>
      <<<<<<< yours (session <session>)
            <p className="text-sm">Totals per month</p>
      ||||||| base
            <p className="text-sm">Monthly totals</p>
      =======
            <p className="text-sm">Weekly totals</p>
      >>>>>>> main <short>
          </div>
        )
      }
      "
    `)
    expect(stable(await c.status())).toMatchInlineSnapshot(`
      {
        "base": "<sha6>",
        "branch": "main",
        "conflicts": [
          {
            "lines": [
              5,
            ],
            "path": "App.tsx",
          },
        ],
      }
    `)
    const blocked = await c.build()
    expect(blocked.ok === false && blocked.errorText).toMatchInlineSnapshot(`"App.tsx:5: unresolved merge conflict. Remove the markers before building."`)

    // the agent replaces the block with its normal edit tool and commits again
    const start = marked.indexOf('<<<<<<<')
    const block = marked.slice(start, marked.indexOf('\n', marked.indexOf('>>>>>>>')))
    await c.apply({
      ops: [{ op: 'replace', path: 'App.tsx', oldString: block, newString: '      <p className="text-sm">Weekly totals per month</p>' }],
    })
    expect(stable(await c.commit({ message: 'Reword totals' }))).toMatchInlineSnapshot(`
      {
        "ok": true,
        "sha": "<sha7>",
        "url": "https://malleableui.dev/p/<project>/r/<sha7>/index.js",
      }
    `)

    const check = await project.openSession({ author })
    expect('\n' + (await check.read({ path: 'App.tsx' }))).toMatchInlineSnapshot(`
      "
      export default function App() {
        return (
          <div className="p-8">
            <h1 className="text-2xl">Revenue</h1>
            <p className="text-sm">Weekly totals per month</p>
          </div>
        )
      }
      "
    `)
    expect((await project.log()).map((l) => l.message)).toMatchInlineSnapshot(`
      [
        "Reword totals",
        "More padding",
        "Weekly totals",
        "Seed",
        "Initialize project",
      ]
    `)
    await check.discard()
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
    const project = newProject('g')
    await project.init()
    const live = watchLive(project)
    await live.until((m) => m.type === 'hello')

    // tokens never expire by default; a ttl sets an expiry
    const write = await project.createGitToken({ label: 'laptop' })
    const read = await project.createGitToken({ scope: 'read', ttl: 3600 })
    expect({
      url: stable(write.url.replace(endpoint, '<origin>')),
      expires: [write.expiresAt, read.expiresAt! - read.createdAt],
    }).toMatchInlineSnapshot(`
      {
        "expires": [
          null,
          3600000,
        ],
        "url": "<origin>/git/<project>.git",
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
        "malleable.json",
        "",
      ]
    `)

    writeFileSync(join(w, 'App.tsx'), 'export default function App() { return <div className="p-4 bg-red-500">From git</div> }\n')
    git(w, 'commit', '-am', 'Edit from git')
    git(w, 'push', 'origin', 'main')
    await live.until((m) => m.type === 'update' && m.kind === 'commit' && m.message === 'Build dist for pushed sources')

    const js = await (await fetch(`${endpoint}/p/${project.id}/r/main/index.js`)).text()
    const css = await (await fetch(`${endpoint}/p/${project.id}/r/main/index.css`)).text()
    expect({ js: js.includes('From git'), tailwind: css.includes('bg-red-500') }).toMatchInlineSnapshot(`
      {
        "js": true,
        "tailwind": true,
      }
    `)
    expect((await project.log()).map((c) => c.message)).toMatchInlineSnapshot(`
      [
        "Build dist for pushed sources",
        "Edit from git",
        "Initialize project",
      ]
    `)

    // the user pulls the dist commit and keeps working
    git(w, 'pull', '--ff-only', 'origin', 'main')
    expect(existsSync(join(w, 'dist', 'index.js'))).toMatchInlineSnapshot(`true`)

    // listing shows usage but never the secret
    expect(
      (await project.gitTokens()).map(({ id, createdAt, expiresAt, lastUsedAt, ...t }) => ({
        ...t,
        expires: expiresAt !== null,
        used: lastUsedAt !== null,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "expires": false,
          "label": "laptop",
          "scope": "write",
          "used": true,
        },
        {
          "expires": true,
          "label": "",
          "scope": "read",
          "used": false,
        },
      ]
    `)

    // a read token can clone but not push; a bad token is refused
    const r = join(root, 'r')
    git(root, 'clone', read.authenticatedUrl, 'r')
    writeFileSync(join(r, 'x.txt'), 'x')
    git(r, 'add', 'x.txt')
    git(r, 'commit', '-m', 'x')
    expect(gitError(() => git(r, 'push', 'origin', 'main'))).toMatchInlineSnapshot(`
      [
        "remote: Missing or invalid git token. Create one with POST /api/projects/:id/git-tokens",
      ]
    `)
    expect(gitError(() => git(root, 'clone', write.url.replace('://', '://x:bad@'), 'bad'))).toMatchInlineSnapshot(`
      [
        "remote: Missing or invalid git token. Create one with POST /api/projects/:id/git-tokens",
      ]
    `)

    // a revoked token stops working at once
    await project.revokeGitToken({ id: write.id })
    expect(gitError(() => git(w, 'fetch', 'origin'))).toMatchInlineSnapshot(`
      [
        "remote: Missing or invalid git token. Create one with POST /api/projects/:id/git-tokens",
      ]
    `)
    expect((await project.gitTokens()).map((t) => t.scope)).toMatchInlineSnapshot(`
      [
        "read",
      ]
    `)
    live.close()
  })
})
