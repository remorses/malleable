import { DurableObject } from 'cloudflare:workers'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import dedent from 'string-dedent'
import { buildFiles, createKvBuildCache, type BuildFile } from './build.js'
import { MemoryFS } from './memory-fs.js'

// ───────────────────────── public types (RPC-safe plain data) ─────────────────────────

export type Author = { kind: 'agent' | 'user' | 'system'; id: string }
export type BuildError = { file?: string; line?: number; text: string }

export type SessionOp =
  | { op: 'write'; path: string; content: string }
  | { op: 'replace'; path: string; oldString: string; newString: string }
  | { op: 'delete'; path: string }

export type CommitResult =
  | { ok: true; sha: string; noop?: boolean }
  | { ok: false; reason: 'build-error'; errors: BuildError[]; errorText: string }
  | { ok: false; reason: 'conflict'; head: string }

export type BuildResult =
  | { ok: true; build: number; files: string[] }
  | { ok: false; errors: BuildError[]; errorText: string }

export interface LogEntry {
  sha: string
  message: string
  author: Author
  time: number
  parents: string[]
}

export interface ProjectInfo {
  projectId: string
  repo: string
  defaultBranch: string
  heads: Record<string, string>
}

/**
 * Messages sent to every WebSocket viewer of a project.
 * Every `update` carries the `url` of the new module, relative to the Worker origin.
 */
export type LiveMessage =
  | { type: 'hello'; heads: Record<string, string>; drafts: DraftInfo[] }
  | ({ type: 'update'; kind: 'draft' } & DraftInfo)
  | {
      type: 'update'
      kind: 'commit'
      url: string
      branch: string
      sha: string
      message: string
      author: Author
    }
  | { type: 'build-error'; session: string; errors: BuildError[] }
  | { type: 'draft-end'; session: string; outcome: 'committed' | 'discarded' }

export interface DraftInfo {
  url: string
  session: string
  branch: string
  build: number
}

export interface ProjectConfig {
  /** Entry file, its default export is the component */
  entry: string
  externalPackages: string[]
}

export const DEFAULT_CONFIG: ProjectConfig = {
  entry: 'App.tsx',
  externalPackages: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
  ],
}

export const CONFIG_PATH = 'lovepack.json'
export const DIST_DIR = 'dist'

const projectIdRegex = /^[a-zA-Z0-9_-]{1,40}$/

/** Artifacts repo name for a project id */
export function repoNameFor(projectId: string): string {
  if (!projectIdRegex.test(projectId)) {
    throw new Error(`INVALID_PROJECT_ID: ${projectId}`)
  }
  return `p-${projectId}`
}

export function getProject({
  namespace,
  projectId,
}: {
  namespace: DurableObjectNamespace<ProjectDO>
  projectId: string
}) {
  repoNameFor(projectId)
  return namespace.get(namespace.idFromName(projectId))
}

// ───────────────────────── internals ─────────────────────────

interface Env {
  ARTIFACTS: Artifacts
  jsCache: KVNamespace
}

interface Session {
  id: string
  branch: string
  base: string
  author: Author
  tree: Map<string, string>
}

const WORKDIR = '/w'
const STALE_SESSION_MS = 10 * 60 * 1000
const MAX_DRAFTS_KEPT = 3

const STARTER_APP = dedent`
  export default function App() {
    return <div className="p-8 text-xl">Hello from lovepack</div>
  }
`

function normalizePath(path: string): string {
  const parts = path.split('/')
  const bad =
    !path ||
    path.startsWith('/') ||
    parts.some((p) => p === '' || p === '.' || p === '..') ||
    parts[0] === '.git' ||
    parts[0] === DIST_DIR
  if (bad) throw new Error(`INVALID_PATH: ${path}`)
  return path
}

function applyOp(tree: Map<string, string>, op: SessionOp) {
  const path = normalizePath(op.path)
  if (op.op === 'write') {
    tree.set(path, op.content)
  } else if (op.op === 'delete') {
    tree.delete(path)
  } else {
    const current = tree.get(path)
    if (current === undefined) throw new Error(`FILE_NOT_FOUND: ${path}`)
    const first = current.indexOf(op.oldString)
    if (first === -1 || op.oldString === '') {
      throw new Error(`REPLACE_NOT_FOUND: ${path}`)
    }
    if (current.indexOf(op.oldString, first + 1) !== -1) {
      throw new Error(`REPLACE_AMBIGUOUS: ${path}`)
    }
    tree.set(path, current.replace(op.oldString, () => op.newString))
  }
}

function parseConfig(tree: Map<string, string>): ProjectConfig {
  const raw = tree.get(CONFIG_PATH)
  if (!raw) return DEFAULT_CONFIG
  const parsed = JSON.parse(raw) as Partial<ProjectConfig>
  return { ...DEFAULT_CONFIG, ...parsed }
}

function authorToGit(author: Author) {
  return { name: author.id, email: `${author.kind}@lovepack.local` }
}

function authorFromGit(a: { name: string; email: string }): Author {
  const kind = a.email.split('@')[0]
  return {
    kind: kind === 'agent' || kind === 'user' ? kind : 'system',
    id: a.name,
  }
}

function sameTree(a: Map<string, string>, b: Map<string, string>) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

function isInProgress(e: any) {
  return /IN_PROGRESS/.test(`${e?.code ?? ''} ${e?.message ?? ''}`)
}

/** isomorphic-git drops the response body of failed requests. Keep it, it holds the server's reason. */
const gitHttp: typeof http = {
  async request(req) {
    const res = await http.request(req)
    if (res.statusCode >= 500 && res.body) {
      let text = ''
      const dec = new TextDecoder()
      for await (const chunk of res.body) text += dec.decode(chunk, { stream: true })
      throw new Error(`HTTP ${res.statusCode} ${req.method} ${req.url}: ${text.slice(0, 500)}`)
    }
    return res
  },
}

/** Adds the failing git step to errors, since isomorphic-git messages say little */
async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    const data = e?.data ? ` ${JSON.stringify(e.data)}` : ''
    throw Object.assign(new Error(`GIT_ERROR: ${label}: ${e?.message}${data}`, { cause: e }), {
      gitCode: e?.code as string | undefined,
    })
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ───────────────────────── the Durable Object ─────────────────────────

/**
 * One instance per project. Single writer for the project's Artifacts repo.
 * Agents call its methods over RPC; viewers connect with a WebSocket.
 *
 *   openSession -> write/replace/delete -> build (draft) -> commit (build + git push)
 */
export class ProjectDO extends DurableObject<Env> {
  private fs = new MemoryFS()
  private sessions = new Map<string, Session>()
  private drafts = new Map<
    string,
    { branch: string; build: number; files: Map<string, string>[] }
  >()
  private token: { secret: string; expiresAt: number } | undefined
  private queue: Promise<unknown> = Promise.resolve()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // the DO is reset if this throws
    void ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY, branch TEXT NOT NULL, base TEXT NOT NULL,
          author TEXT NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ops (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, op TEXT NOT NULL
        );
      `)
    })
  }

  // ── lifecycle ──

  /** Idempotent. Forks `template` into a new repo, or creates an empty repo with a starter app. */
  async init(opts: { projectId: string; template?: string }): Promise<ProjectInfo> {
    return this.serial(() => this.initLocked(opts))
  }

  private async initLocked(opts: { projectId: string; template?: string }): Promise<ProjectInfo> {
    const repo = repoNameFor(opts.projectId)
    const existing = await this.ctx.storage.get<{ projectId: string }>('meta')
    if (existing) return this.info()
    await this.ctx.storage.put('meta', { projectId: opts.projectId, repo })
    try {
      try {
        if (opts.template) {
          using template = await this.env.ARTIFACTS.get(opts.template)
          await template.fork(repo, { defaultBranchOnly: true })
        } else {
          await this.env.ARTIFACTS.create(repo, { setDefaultBranch: 'main' })
        }
      } catch (e: any) {
        // A previous init may have created the repo and failed before the first commit
        if (!/ALREADY_EXISTS/.test(`${e?.code} ${e?.message}`)) throw e
      }
      using handle = await this.repo()
      const empty = (await handle.log({ ref: 'main', limit: 1 })).length === 0
      if (empty && !opts.template) await this.seed()
      else await this.sync('main')
    } catch (e) {
      await this.ctx.storage.delete('meta')
      throw e
    }
    return this.info()
  }

  async info(): Promise<ProjectInfo> {
    const meta = await this.meta()
    return {
      projectId: meta.projectId,
      repo: meta.repo,
      defaultBranch: 'main',
      heads: await this.heads(),
    }
  }

  // ── sessions ──

  async openSession(opts: {
    branch?: string
    author: Author
    id?: string
  }): Promise<{ sessionId: string; base: string; branch: string }> {
    const branch = opts.branch ?? 'main'
    return this.serial(async () => {
      const rows = this.ctx.storage.sql
        .exec(
          `SELECT id, updated_at FROM sessions WHERE branch = ? AND status = 'open'`,
          branch,
        )
        .toArray() as { id: string; updated_at: number }[]
      for (const row of rows) {
        if (row.id === opts.id) {
          const s = this.sessions.get(row.id) ?? (await this.rebuildSession(row.id))
          return { sessionId: s.id, base: s.base, branch }
        }
        if (Date.now() - row.updated_at < STALE_SESSION_MS) {
          throw new Error(`SESSION_ACTIVE: ${row.id} on branch ${branch}`)
        }
        this.endSession(row.id, 'discarded')
      }
      const head = await this.sync(branch)
      const id = opts.id ?? `s_${crypto.randomUUID().slice(0, 12)}`
      this.ctx.storage.sql.exec(
        `INSERT INTO sessions (id, branch, base, author, status, updated_at) VALUES (?, ?, ?, ?, 'open', ?)`,
        id,
        branch,
        head,
        JSON.stringify(opts.author),
        Date.now(),
      )
      this.sessions.set(id, {
        id,
        branch,
        base: head,
        author: opts.author,
        tree: await this.readSources(),
      })
      return { sessionId: id, base: head, branch }
    })
  }

  async write(opts: { sessionId: string; path: string; content: string }) {
    const { sessionId, path, content } = opts
    await this.mutate(sessionId, { op: 'write', path, content })
  }

  async replace(opts: {
    sessionId: string
    path: string
    oldString: string
    newString: string
  }) {
    const { sessionId, path, oldString, newString } = opts
    await this.mutate(sessionId, { op: 'replace', path, oldString, newString })
  }

  async remove(opts: { sessionId: string; path: string }) {
    await this.mutate(opts.sessionId, { op: 'delete', path: opts.path })
  }

  /** Apply several ops atomically: nothing is applied if one fails. */
  async apply(opts: { sessionId: string; ops: SessionOp[] }) {
    const s = await this.loadSession(opts.sessionId)
    const next = new Map(s.tree)
    for (const op of opts.ops) applyOp(next, op)
    for (const op of opts.ops) this.logOp(opts.sessionId, op)
    s.tree = next
  }

  async read(opts: { sessionId: string; path: string }): Promise<string | null> {
    const s = await this.loadSession(opts.sessionId)
    return s.tree.get(opts.path) ?? null
  }

  async list(opts: { sessionId: string }): Promise<string[]> {
    const s = await this.loadSession(opts.sessionId)
    return [...s.tree.keys()].sort()
  }

  /** Paths changed against the session base: [status, path] */
  async diff(opts: {
    sessionId: string
  }): Promise<Array<['added' | 'modified' | 'deleted', string]>> {
    const s = await this.loadSession(opts.sessionId)
    const base = await this.serial(async () => {
      await this.sync(s.branch)
      return this.readSources()
    })
    const out: Array<['added' | 'modified' | 'deleted', string]> = []
    for (const [p, c] of s.tree) {
      if (!base.has(p)) out.push(['added', p])
      else if (base.get(p) !== c) out.push(['modified', p])
    }
    for (const p of base.keys()) if (!s.tree.has(p)) out.push(['deleted', p])
    return out
  }

  /** Draft build. Never touches git. Viewers get an `update` message of kind `draft`. */
  async build(opts: { sessionId: string }): Promise<BuildResult> {
    const s = await this.loadSession(opts.sessionId)
    const built = await this.runBuild(s.tree)
    if (!built.ok) {
      this.broadcast({ type: 'build-error', session: s.id, errors: built.errors })
      return built
    }
    const prev = this.drafts.get(s.id)
    const build = (prev?.build ?? 0) + 1
    const files = [...(prev?.files ?? []), built.dist].slice(-MAX_DRAFTS_KEPT)
    this.drafts.set(s.id, { branch: s.branch, build, files })
    this.broadcast({
      type: 'update',
      kind: 'draft',
      url: await this.draftUrl(s.id, build),
      session: s.id,
      branch: s.branch,
      build,
    })
    return { ok: true, build, files: [...built.dist.keys()] }
  }

  /** Output file of a draft build, served by the Worker at /d/:session/:build/* */
  async draftFile(opts: {
    sessionId: string
    build: number
    path: string
  }): Promise<string | null> {
    const d = this.drafts.get(opts.sessionId)
    if (!d) return null
    const index = d.files.length - 1 - (d.build - opts.build)
    return d.files[index]?.get(opts.path) ?? null
  }

  /** Build, commit and push. Fails (and keeps the session open) when the build fails. */
  async commit(opts: {
    sessionId: string
    message: string
    rebase?: boolean
  }): Promise<CommitResult> {
    const s = await this.loadSession(opts.sessionId)
    return this.serial(async () => {
      const head = await this.sync(s.branch)
      const headTree = await this.readSources()
      let tree = s.tree
      if (head !== s.base) {
        if (!opts.rebase) return { ok: false, reason: 'conflict', head }
        try {
          tree = new Map(headTree)
          for (const op of this.sessionOps(s.id)) applyOp(tree, op)
        } catch {
          return { ok: false, reason: 'conflict', head }
        }
      }
      if (sameTree(tree, headTree)) {
        this.endSession(s.id, 'committed')
        return { ok: true, sha: head, noop: true }
      }
      const res = await this.commitTree(s.branch, tree, opts.message, s.author)
      if (!res.ok) return res
      this.endSession(s.id, 'committed')
      return res
    })
  }

  async discard(opts: { sessionId: string }) {
    await this.serial(async () => this.endSession(opts.sessionId, 'discarded'))
  }

  async sessionsOpen(): Promise<Array<{ id: string; branch: string; author: Author }>> {
    const rows = this.ctx.storage.sql
      .exec(`SELECT id, branch, author FROM sessions WHERE status = 'open'`)
      .toArray() as { id: string; branch: string; author: string }[]
    return rows.map((r) => ({ id: r.id, branch: r.branch, author: JSON.parse(r.author) }))
  }

  // ── history ──

  async log(opts: { branch?: string; limit?: number } = {}): Promise<LogEntry[]> {
    using repo = await this.repo()
    const commits = await repo.log({ ref: opts.branch ?? 'main', limit: opts.limit ?? 50 })
    return commits.map((c) => ({
      sha: c.hash,
      message: c.message,
      author: authorFromGit(c.author),
      time: c.authoredAt,
      parents: c.parents,
    }))
  }

  /** New commit whose sources equal the first parent of the head. Calling it twice undoes the undo. */
  async undo(opts: { branch?: string; author?: Author } = {}): Promise<CommitResult> {
    const branch = opts.branch ?? 'main'
    const [head] = await this.log({ branch, limit: 1 })
    const parent = head?.parents[0]
    if (!parent) throw new Error('NOTHING_TO_UNDO')
    return this.restore({
      sha: parent,
      branch,
      author: opts.author,
      message: `Undo ${head.sha.slice(0, 7)}: ${head.message.split('\n')[0]}`,
    })
  }

  /** New commit whose sources equal those of `sha`. History is never rewritten. */
  async restore(opts: {
    sha: string
    branch?: string
    author?: Author
    message?: string
  }): Promise<CommitResult> {
    const { sha } = opts
    const branch = opts.branch ?? 'main'
    const sources = await this.readSourcesAt(sha)
    return this.serial(async () => {
      this.assertNoOpenSession(branch)
      await this.sync(branch)
      const res = await this.commitTree(
        branch,
        sources,
        opts.message ?? `Restore ${sha.slice(0, 7)}`,
        opts.author ?? { kind: 'user', id: 'user' },
      )
      return res
    })
  }

  async files(opts: { ref: string }): Promise<string[]> {
    return [...(await this.readSourcesAt(opts.ref)).keys()].sort()
  }

  // ── branches ──

  async branches(): Promise<string[]> {
    const { url } = await this.remote()
    const refs = await git.listServerRefs({
      http: gitHttp,
      url,
      prefix: 'refs/heads/',
      onAuth: await this.onAuth(),
    })
    return refs.map((r) => r.ref.replace('refs/heads/', '')).sort()
  }

  async createBranch(opts: { name: string; from?: string }) {
    const { name, from = 'main' } = opts
    await this.serial(async () => {
      const sha = await this.sync(from)
      await git.branch({ fs: this.fs, dir: WORKDIR, ref: name, object: sha })
      await this.push(name)
      await this.setHead(name, sha)
    })
  }

  /** Fast-forward `branch` into `into`. */
  async merge(opts: { branch: string; into?: string }): Promise<{ sha: string }> {
    const { branch, into = 'main' } = opts
    return this.serial(async () => {
      this.assertNoOpenSession(into)
      const sha = await this.sync(branch)
      const target = await this.sync(into)
      if (sha !== target) {
        using repo = await this.repo()
        const history = await repo.log({ ref: branch, limit: 1000 })
        if (!history.some((c) => c.hash === target)) {
          throw new Error(`NOT_FAST_FORWARD: ${branch} does not contain ${into}`)
        }
        await this.push(branch, into)
        await this.setHead(into, sha)
        await this.announceCommit({
          branch: into,
          sha,
          message: `Merge ${branch}`,
          author: { kind: 'system', id: 'lovepack' },
        })
      }
      return { sha }
    })
  }

  async deleteBranch(opts: { name: string }) {
    const { name } = opts
    if (name === 'main') throw new Error('CANNOT_DELETE_DEFAULT_BRANCH')
    await this.serial(async () => {
      const { url } = await this.remote()
      await git.push({
        fs: this.fs,
        http: gitHttp,
        dir: WORKDIR,
        url,
        remoteRef: name,
        delete: true,
        onAuth: await this.onAuth(),
      })
      const heads = await this.heads()
      delete heads[name]
      await this.ctx.storage.put('heads', heads)
    })
  }

  // ── external pushes (git remote proxied by the Worker) ──

  /** Called by the Worker after any successful `git push`. Handles every branch whose head moved. */
  async afterGitPush(): Promise<void> {
    const { url } = await this.remote()
    const refs = await git.listServerRefs({
      http: gitHttp,
      url,
      prefix: 'refs/heads/',
      onAuth: await this.onAuth(),
    })
    const heads = await this.heads()
    for (const ref of refs) {
      const branch = ref.ref.replace('refs/heads/', '')
      if (heads[branch] !== ref.oid) await this.afterPush(branch)
    }
  }

  /**
   * Called after a user pushed sources with git. Builds them and, when `dist/` is stale,
   * adds a follow-up commit so the pushed version goes live. Users `git pull` to get it.
   */
  private async afterPush(branch: string): Promise<CommitResult | { ok: true; upToDate: true }> {
    return this.serial(async () => {
      const head = await this.sync(branch)
      const sources = await this.readSources()
      const built = await this.runBuild(sources)
      if (!built.ok) {
        this.broadcast({ type: 'build-error', session: 'git-push', errors: built.errors })
        return { ok: false, reason: 'build-error', errors: built.errors, errorText: built.errorText }
      }
      const expected = new Map([...built.dist].map(([p, c]) => [`${DIST_DIR}/${p}`, c]))
      if (sameTree(expected, await this.readDist())) {
        // The push already carries a matching dist: just tell viewers
        await this.announceCommit({
          branch,
          sha: head,
          message: 'Pushed with git',
          author: { kind: 'user', id: 'git' },
        })
        return { ok: true, upToDate: true }
      }
      return this.commitTree(branch, sources, 'Build dist for pushed sources', {
        kind: 'system',
        id: 'lovepack',
      })
    })
  }

  // ── WebSocket (hibernatable) ──

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    const hello: LiveMessage = {
      type: 'hello',
      heads: await this.heads(),
      drafts: await Promise.all(
        [...this.drafts].map(async ([session, d]) => ({
          url: await this.draftUrl(session, d.build),
          session,
          branch: d.branch,
          build: d.build,
        })),
      ),
    }
    pair[1].send(JSON.stringify(hello))
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  override webSocketMessage() {}

  override webSocketClose(ws: WebSocket) {
    try {
      ws.close(1000)
    } catch {}
  }

  /** Module url relative to the Worker origin, served by `projectsPublic` */
  private async moduleUrl(route: string) {
    const { projectId } = await this.meta()
    return `/p/${projectId}/${route}/index.js`
  }

  private draftUrl(session: string, build: number) {
    return this.moduleUrl(`d/${encodeURIComponent(session)}/${build}`)
  }

  private async announceCommit(commit: {
    branch: string
    sha: string
    message: string
    author: Author
  }) {
    this.broadcast({
      type: 'update',
      kind: 'commit',
      url: await this.moduleUrl(`r/${commit.sha}`),
      ...commit,
    })
  }

  private broadcast(msg: LiveMessage) {
    const data = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data)
      } catch {}
    }
  }

  // ───────────────────────── private: sessions ─────────────────────────

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => {})
    return run
  }

  private sessionOps(id: string): SessionOp[] {
    const rows = this.ctx.storage.sql
      .exec(`SELECT op FROM ops WHERE session_id = ? ORDER BY seq`, id)
      .toArray() as { op: string }[]
    return rows.map((r) => JSON.parse(r.op))
  }

  private logOp(id: string, op: SessionOp) {
    this.ctx.storage.sql.exec(`INSERT INTO ops (session_id, op) VALUES (?, ?)`, id, JSON.stringify(op))
    this.ctx.storage.sql.exec(`UPDATE sessions SET updated_at = ? WHERE id = ?`, Date.now(), id)
  }

  private async mutate(sessionId: string, op: SessionOp) {
    const s = await this.loadSession(sessionId)
    applyOp(s.tree, op)
    this.logOp(sessionId, op)
  }

  /** In-memory session, or rebuilt from head + the stored op log after hibernation */
  private async loadSession(id: string): Promise<Session> {
    return this.sessions.get(id) ?? this.serial(() => this.rebuildSession(id))
  }

  /** Must run inside `serial`. Replays the op log over the current head. */
  private async rebuildSession(id: string): Promise<Session> {
    const cached = this.sessions.get(id)
    if (cached) return cached
    const row = this.ctx.storage.sql
      .exec(`SELECT branch, base, author, status FROM sessions WHERE id = ?`, id)
      .toArray()[0] as
      | { branch: string; base: string; author: string; status: string }
      | undefined
    if (!row || row.status !== 'open') throw new Error(`SESSION_NOT_FOUND: ${id}`)
    await this.sync(row.branch)
    const tree = await this.readSources()
    for (const op of this.sessionOps(id)) applyOp(tree, op)
    // A head that moved since `base` is reported by commit() as a conflict
    const s: Session = { id, branch: row.branch, base: row.base, author: JSON.parse(row.author), tree }
    this.sessions.set(id, s)
    return s
  }

  private endSession(id: string, outcome: 'committed' | 'discarded') {
    this.ctx.storage.sql.exec(`UPDATE sessions SET status = ? WHERE id = ?`, outcome, id)
    this.ctx.storage.sql.exec(`DELETE FROM ops WHERE session_id = ?`, id)
    this.sessions.delete(id)
    this.drafts.delete(id)
    this.broadcast({ type: 'draft-end', session: id, outcome })
  }

  private assertNoOpenSession(branch: string) {
    const rows = this.ctx.storage.sql
      .exec(`SELECT id FROM sessions WHERE branch = ? AND status = 'open'`, branch)
      .toArray()
    if (rows.length) throw new Error(`SESSION_ACTIVE: ${(rows[0] as any).id} on branch ${branch}`)
  }

  // ───────────────────────── private: build ─────────────────────────

  private async runBuild(tree: Map<string, string>): Promise<
    | { ok: true; dist: Map<string, string> }
    | { ok: false; errors: BuildError[]; errorText: string }
  > {
    const config = parseConfig(tree)
    if (!tree.has(config.entry)) {
      const text = `Entry point "${config.entry}" not found`
      return { ok: false, errors: [{ text }], errorText: text }
    }
    const files: BuildFile[] = [...tree].map(([path, content]) => ({ path, content }))
    const built = await buildFiles({
      files,
      entryPoint: config.entry,
      externalPackages: config.externalPackages,
      cache: createKvBuildCache(this.env.jsCache, (p) => this.ctx.waitUntil(p)),
    })
    if (!built.ok) return { ok: false, errors: built.errors, errorText: built.errorText }
    const dist = new Map<string, string>(built.outputs.map((o) => [o.path, o.text]))
    dist.set('index.css', built.css)
    return { ok: true, dist }
  }

  // ───────────────────────── private: git ─────────────────────────

  private async meta() {
    const meta = await this.ctx.storage.get<{ projectId: string; repo: string }>('meta')
    if (!meta) throw new Error('NOT_INITIALIZED: call init() first')
    return meta
  }

  private async heads(): Promise<Record<string, string>> {
    return (await this.ctx.storage.get<Record<string, string>>('heads')) ?? {}
  }

  private async setHead(branch: string, sha: string) {
    const heads = await this.heads()
    heads[branch] = sha
    await this.ctx.storage.put('heads', heads)
  }

  /** Handle on the Artifacts repo. Waits while a fork or import is in progress. */
  private async repo(): Promise<ArtifactsRepo> {
    const { repo } = await this.meta()
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.env.ARTIFACTS.get(repo)
      } catch (e) {
        if (!isInProgress(e) || attempt >= 20) throw e
        await sleep(500)
      }
    }
  }

  private async remote(): Promise<{ url: string }> {
    const cached = await this.ctx.storage.get<string>('remote')
    if (cached) return { url: cached }
    using repo = await this.repo()
    const { remote } = await repo.info()
    await this.ctx.storage.put('remote', remote)
    return { url: remote }
  }

  private async onAuth() {
    const now = Date.now() / 1000
    if (!this.token || this.token.expiresAt - now < 120) {
      using repo = await this.repo()
      const t = await repo.createToken('write', 3600)
      // plaintext looks like `art_v1_<secret>?expires=<unix>`; Basic auth wants only the secret
      this.token = { secret: t.plaintext.split('?expires=')[0], expiresAt: now + 3600 }
    }
    const password = this.token.secret
    return () => ({ username: 'x', password })
  }

  /** Check out the remote head of `branch` in the in-memory repo. Returns its sha. */
  private async sync(branch: string): Promise<string> {
    const { url } = await this.remote()
    const dir = WORKDIR
    const fs = this.fs
    await git.init({ fs, dir, defaultBranch: 'main' })
    await git.addRemote({ fs, dir, remote: 'origin', url, force: true })
    const onAuth = await this.onAuth()
    const fetched = await step(`fetch ${branch}`, () =>
      git.fetch({ fs, http: gitHttp, dir, url, ref: branch, singleBranch: true, depth: 1, tags: false, onAuth }),
    ).catch((e: Error & { gitCode?: string }) => {
      if (e.gitCode === 'NotFoundError') throw new Error(`BRANCH_NOT_FOUND: ${branch}`, { cause: e })
      throw e
    })
    const remoteSha = fetched.fetchHead
    if (!remoteSha) throw new Error(`BRANCH_NOT_FOUND: ${branch}`)
    await git.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: remoteSha, force: true })
    await git.checkout({ fs, dir, ref: branch, force: true })
    await this.setHead(branch, remoteSha)
    return remoteSha
  }

  private async push(ref: string, remoteRef?: string) {
    const { url } = await this.remote()
    const res = await step(`push ${ref}`, async () =>
      git.push({
        fs: this.fs,
        http: gitHttp,
        dir: WORKDIR,
        url,
        ref,
        remoteRef,
        onAuth: await this.onAuth(),
      }),
    )
    const failed = !res.ok || Object.values(res.refs ?? {}).some((r) => !r.ok)
    if (failed) throw new Error(`PUSH_FAILED: ${JSON.stringify(res)}`)
  }

  /** Source files of the checked out tree. Excludes dist/ and .git/ */
  private async readSources(): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const walk = async (rel: string) => {
      const abs = rel ? `${WORKDIR}/${rel}` : WORKDIR
      for (const name of await this.fs.promises.readdir(abs)) {
        const child = rel ? `${rel}/${name}` : name
        if (child === '.git' || child === DIST_DIR) continue
        const st = await this.fs.promises.stat(`${WORKDIR}/${child}`)
        if (st.isDirectory()) await walk(child)
        else out.set(child, (await this.fs.promises.readFile(`${WORKDIR}/${child}`, 'utf8')) as string)
      }
    }
    await walk('')
    return out
  }

  /** Files under dist/ of the checked out tree, keyed by repo path */
  private async readDist(): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const walk = async (rel: string): Promise<void> => {
      for (const name of await this.fs.promises.readdir(`${WORKDIR}/${rel}`).catch(() => [])) {
        const child = `${rel}/${name}`
        const st = await this.fs.promises.stat(`${WORKDIR}/${child}`)
        if (st.isDirectory()) await walk(child)
        else out.set(child, (await this.fs.promises.readFile(`${WORKDIR}/${child}`, 'utf8')) as string)
      }
    }
    await walk(DIST_DIR)
    return out
  }

  /** Source files at any commit/branch, read through the Artifacts binding (no checkout) */
  private async readSourcesAt(ref: string): Promise<Map<string, string>> {
    using repo = await this.repo()
    const commit = /^[0-9a-f]{40}$/.test(ref)
      ? await repo.readCommit(ref)
      : (await repo.log({ ref, limit: 1 }))[0]
    if (!commit) throw new Error(`REF_NOT_FOUND: ${ref}`)
    const out = new Map<string, string>()
    const walk = async (treeHash: string, prefix: string): Promise<void> => {
      const entries = await repo.readTree(treeHash)
      if (!entries) throw new Error(`TREE_NOT_FOUND: ${treeHash}`)
      await Promise.all(
        entries.map(async (e) => {
          const path = prefix ? `${prefix}/${e.name}` : e.name
          if (path === DIST_DIR || path === '.git') return
          if (e.type === 'tree') return walk(e.hash, path)
          const blob = await repo.readBlob(e.hash)
          if (blob) out.set(path, await blob.text())
        }),
      )
    }
    await walk(commit.treeHash, '')
    return out
  }

  /** Build `sources`, write sources + dist into the working tree, commit and push. */
  private async commitTree(
    branch: string,
    sources: Map<string, string>,
    message: string,
    author: Author,
  ): Promise<CommitResult> {
    const built = await this.runBuild(sources)
    if (!built.ok) {
      return { ok: false, reason: 'build-error', errors: built.errors, errorText: built.errorText }
    }
    const fs = this.fs
    const dir = WORKDIR
    const next = new Map(sources)
    for (const [p, c] of built.dist) next.set(`${DIST_DIR}/${p}`, c)

    // Replace the working tree: drop tracked files that disappeared, write the rest
    const tracked = await git.listFiles({ fs, dir })
    for (const f of tracked) {
      if (!next.has(f)) {
        await git.remove({ fs, dir, filepath: f })
        await fs.promises.unlink(`${dir}/${f}`).catch(() => {})
      }
    }
    for (const [p, c] of next) await fs.promises.writeFile(`${dir}/${p}`, c)
    await git.add({ fs, dir, filepath: [...next.keys()] })

    const sha = await git.commit({
      fs,
      dir,
      // commit() wants the full ref; a short name writes a stray ref file
      ref: `refs/heads/${branch}`,
      message,
      author: authorToGit(author),
    })
    await this.push(branch)
    await this.setHead(branch, sha)
    await this.announceCommit({ branch, sha, message, author })
    return { ok: true, sha }
  }

  /** First commit for a project created without a template */
  private async seed() {
    const fs = this.fs
    await git.init({ fs, dir: WORKDIR, defaultBranch: 'main' })
    const sources = new Map([
      [CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2)],
      [DEFAULT_CONFIG.entry, STARTER_APP],
    ])
    const res = await this.commitTree('main', sources, 'Initialize project', {
      kind: 'system',
      id: 'lovepack',
    })
    if (!res.ok) throw new Error(`SEED_FAILED: ${JSON.stringify(res)}`)
  }
}
