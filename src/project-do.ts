import { DurableObject } from 'cloudflare:workers'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import dedent from 'string-dedent'
import { buildFiles, createKvBuildCache, type BuildFile } from './build.ts'
import { MemoryFS } from './memory-fs.ts'
import type {
  Author,
  BuildError,
  BuildResult,
  CommitResult,
  CreatedGitToken,
  DraftInfo,
  GitScope,
  GitTokenInfo,
  LiveMessage,
  LogEntry,
  ProjectInfo,
  SessionOp,
  SessionStatus,
} from './api-types.ts'
import { conflictErrorText, conflictPrompt, findConflicts, mergeTrees, treeOps } from './merge.ts'
import {
  applyOp,
  DIST_DIR,
  ProjectStore,
  type LoadedSession,
  type SessionOutcome,
  type Tree,
} from './project-store.ts'

export { DIST_DIR } from './project-store.ts'

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

export const CONFIG_PATH = 'malleable.json'

const projectIdRegex = /^[a-zA-Z0-9_-]{1,40}$/

/** Artifacts repo name for a project id */
export function repoNameFor(projectId: string): string {
  if (!projectIdRegex.test(projectId)) {
    throw new Error(`INVALID_PROJECT_ID: ${projectId}`)
  }
  return `p-${projectId}`
}

// ───────────────────────── internals ─────────────────────────

interface Env {
  ARTIFACTS: Artifacts
  jsCache: KVNamespace
  PUBLIC_URL: string
}

const WORKDIR = '/w'
/** Sessions idle longer than this are discarded when any session opens */
const STALE_SESSION_MS = 24 * 60 * 60 * 1000

const STARTER_APP = dedent`
  export default function App() {
    return <div className="p-8 text-xl">Hello from Malleable UI</div>
  }
`

function parseConfig(tree: Tree): ProjectConfig {
  const raw = tree.get(CONFIG_PATH)
  if (!raw) return DEFAULT_CONFIG
  const parsed = JSON.parse(raw) as Partial<ProjectConfig>
  return { ...DEFAULT_CONFIG, ...parsed }
}

function authorToGit(author: Author) {
  return { name: author.id, email: `${author.kind}@malleable.local` }
}

function authorFromGit(a: { name: string; email: string }): Author {
  const kind = a.email.split('@')[0]
  return {
    kind: kind === 'agent' || kind === 'user' ? kind : 'system',
    id: a.name,
  }
}

function sameTree(a: Tree, b: Tree) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
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

// ───────────────────────── the Durable Object ─────────────────────────

/**
 * One instance per project. Single writer for the project's Artifacts repo.
 * Agents call its methods over RPC; viewers connect with a WebSocket.
 *
 *   openSession -> write/replace/delete -> build (draft) -> commit (build + git push)
 */
export class ProjectDO extends DurableObject<Env> {
  /** All persistent state. Never use `ctx.storage` directly. */
  private store: ProjectStore
  /** Git clone, memory only. `sync()` re-fetches it after hibernation. */
  private fs = new MemoryFS()
  private token: { secret: string; expiresAt: number } | undefined
  private queue: Promise<unknown> = Promise.resolve()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.store = new ProjectStore(ctx.storage)
  }

  // ── lifecycle ──

  /** Idempotent. Forks `template` into a new repo, or creates an empty repo with a starter app. */
  async init(opts: { projectId: string; template?: string }): Promise<ProjectInfo> {
    return this.serial(async () => {
      const repo = repoNameFor(opts.projectId)
      if (this.store.meta.get()) return this.info()
      this.store.meta.set({ projectId: opts.projectId, repo })
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
        this.store.meta.delete()
        throw e
      }
      return this.info()
    })
  }

  async info(): Promise<ProjectInfo> {
    const meta = this.meta()
    return {
      projectId: meta.projectId,
      repo: meta.repo,
      defaultBranch: 'main',
      heads: { ...this.store.heads() },
    }
  }

  // ── sessions ──

  /**
   * Any number of sessions can be open on a branch. Each one edits its own tree; `commit` merges
   * it with whatever landed on the branch meanwhile. Pass `id` to reattach to an open session.
   */
  async openSession(opts: {
    branch?: string
    author: Author
    id?: string
  }): Promise<{ sessionId: string; base: string; branch: string }> {
    const branch = opts.branch ?? 'main'
    return this.serial(async () => {
      for (const open of this.store.sessions.open()) {
        if (Date.now() - open.updatedAt > STALE_SESSION_MS) this.endSession(open.id, 'discarded')
      }
      if (opts.id && this.store.sessions.get(opts.id)) {
        const s = await this.rebuildSession(opts.id)
        return { sessionId: s.id, base: s.base, branch: s.branch }
      }
      const head = await this.sync(branch)
      const s = this.store.sessions.create({
        id: opts.id ?? `s_${crypto.randomUUID().slice(0, 12)}`,
        branch,
        base: head,
        author: opts.author,
        tree: await this.readSources(),
      })
      return { sessionId: s.id, base: s.base, branch }
    })
  }

  /** Apply ops atomically: nothing is applied if one fails. */
  async apply(opts: { sessionId: string; ops: SessionOp[] }) {
    // serial: a commit in flight works on a snapshot of the tree, an edit landing mid-commit would be lost
    await this.serial(async () => {
      await this.rebuildSession(opts.sessionId)
      this.store.sessions.apply(opts.sessionId, opts.ops)
    })
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
    const base = await this.readSourcesAt(s.base)
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
    // serial: a commit could rebase the session mid-build, and the old tree would go out as the latest draft
    return this.serial(async () => {
      const s = await this.rebuildSession(opts.sessionId)
      const built = await this.runBuild(s.tree)
      if (!built.ok) {
        this.broadcast({ type: 'build-error', session: s.id, errors: built.errors })
        return built
      }
      const build = this.store.sessions.addDraft(s.id, built.dist)
      const url = this.moduleUrl(`d/${encodeURIComponent(s.id)}/${build}`)
      this.broadcast({ type: 'update', kind: 'draft', url, session: s.id, branch: s.branch, build })
      return { ok: true, build, url, files: [...built.dist.keys()] }
    })
  }

  /** Output file of a draft build, served by the Worker at /d/:session/:build/* */
  async draftFile(opts: {
    sessionId: string
    build: number
    path: string
  }): Promise<string | null> {
    return this.store.sessions.draftFiles(opts.sessionId, opts.build)?.get(opts.path) ?? null
  }

  /**
   * Build, commit and push. If the branch moved since the session's base, the session is first
   * three-way merged onto the new head (and stays there). Overlapping edits become conflict markers
   * in the session files; the result then carries a `prompt` that tells the agent how to fix them.
   * Fails, keeping the session open, on conflicts and build errors.
   */
  async commit(opts: { sessionId: string; message: string }): Promise<CommitResult> {
    return this.serial(async () => {
      let s = await this.rebuildSession(opts.sessionId)
      const previousBase = s.base
      const head = await this.sync(s.branch)
      const headTree = await this.readSources()
      const moved = head !== previousBase
      if (moved) {
        const tree = mergeTrees({
          base: await this.readSourcesAt(previousBase),
          mine: s.tree,
          theirs: headTree,
          labels: { mine: `yours (session ${s.id})`, theirs: `${s.branch} ${head.slice(0, 7)}` },
        })
        s = this.store.sessions.rebase(s.id, { base: head, tree, ops: treeOps(headTree, tree) })
      }
      const conflicts = findConflicts(s.tree)
      if (conflicts.length) {
        const incoming = moved ? await this.commitsSince({ branch: s.branch, base: previousBase }) : []
        this.broadcast({ type: 'conflict', session: s.id, conflicts })
        const prompt = conflictPrompt({ branch: s.branch, conflicts, incoming })
        return { ok: false, reason: 'conflict', head, conflicts, prompt }
      }
      if (sameTree(s.tree, headTree)) {
        this.endSession(s.id, 'committed')
        return { ok: true, sha: head, url: this.moduleUrl(`r/${head}`), noop: true }
      }
      const res = await this.commitTree(s.branch, s.tree, opts.message, s.author)
      if (!res.ok) return res
      this.endSession(s.id, 'committed')
      return moved ? { ...res, merged: true } : res
    })
  }

  /** Branch, base and unresolved conflicts of a session */
  async status(opts: { sessionId: string }): Promise<SessionStatus> {
    const s = await this.loadSession(opts.sessionId)
    return { branch: s.branch, base: s.base, conflicts: findConflicts(s.tree) }
  }

  async discard(opts: { sessionId: string }) {
    await this.serial(async () => this.endSession(opts.sessionId, 'discarded'))
  }

  async sessionsOpen(): Promise<Array<{ id: string; branch: string; author: Author }>> {
    return this.store.sessions.open().map((s) => ({ id: s.id, branch: s.branch, author: s.author }))
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
      this.store.setHead(name, sha)
    })
  }

  /** Fast-forward `branch` into `into`. */
  async merge(opts: { branch: string; into?: string }): Promise<{ sha: string; url: string }> {
    const { branch, into = 'main' } = opts
    return this.serial(async () => {
      const sha = await this.sync(branch)
      const target = await this.sync(into)
      if (sha !== target) {
        using repo = await this.repo()
        const history = await repo.log({ ref: branch, limit: 1000 })
        if (!history.some((c) => c.hash === target)) {
          throw new Error(`NOT_FAST_FORWARD: ${branch} does not contain ${into}`)
        }
        await this.push(branch, into)
        this.store.setHead(into, sha)
        this.announceCommit({
          branch: into,
          sha,
          message: `Merge ${branch}`,
          author: { kind: 'system', id: 'malleable' },
        })
      }
      return { sha, url: this.moduleUrl(`r/${sha}`) }
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
      this.store.deleteHead(name)
    })
  }

  // ── git remote tokens ──

  /** Revocable token for the git remote. Without `ttl` (seconds) it never expires. */
  async createGitToken(opts: { scope?: GitScope; label?: string; ttl?: number } = {}): Promise<CreatedGitToken> {
    const { projectId } = this.meta()
    const created = await this.store.gitTokens.create({
      scope: opts.scope ?? 'write',
      label: opts.label ?? '',
      ttlMs: opts.ttl && opts.ttl * 1000,
    })
    const url = `${this.env.PUBLIC_URL}/git/${projectId}.git`
    return {
      ...created,
      url,
      authenticatedUrl: url.replace('://', `://x:${created.token}@`),
      username: 'x',
    }
  }

  async gitTokens(): Promise<GitTokenInfo[]> {
    return this.store.gitTokens.list()
  }

  async revokeGitToken(opts: { id: string }) {
    this.store.gitTokens.revoke(opts.id)
  }

  /** Called by the Worker on every git request. Undefined means refuse. */
  async verifyGitToken(opts: { token: string }): Promise<GitScope | undefined> {
    return this.store.gitTokens.verify(opts.token)
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
    const heads = this.store.heads()
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
        this.announceCommit({
          branch,
          sha: head,
          message: 'Pushed with git',
          author: { kind: 'user', id: 'git' },
        })
        return { ok: true, upToDate: true }
      }
      return this.commitTree(branch, sources, 'Build dist for pushed sources', {
        kind: 'system',
        id: 'malleable',
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
      heads: { ...this.store.heads() },
      drafts: this.store.sessions.drafts().map((d) => ({
        url: this.moduleUrl(`d/${encodeURIComponent(d.session)}/${d.build}`),
        session: d.session,
        branch: d.branch,
        build: d.build,
      })),
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
  private moduleUrl(route: string) {
    const { projectId } = this.meta()
    return `/p/${projectId}/${route}/index.js`
  }

  private announceCommit(commit: {
    branch: string
    sha: string
    message: string
    author: Author
  }) {
    const url = this.moduleUrl(`r/${commit.sha}`)
    this.broadcast({ type: 'update', kind: 'commit', url, ...commit })
    return url
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

  /** In-memory session, or rebuilt from head + the stored op log after hibernation */
  private async loadSession(id: string): Promise<LoadedSession> {
    return this.store.sessions.loaded(id) ?? this.serial(() => this.rebuildSession(id))
  }

  /** Must run inside `serial`. Replays the op log over the session base. */
  private async rebuildSession(id: string): Promise<LoadedSession> {
    const cached = this.store.sessions.loaded(id)
    if (cached) return cached
    const record = this.store.sessions.get(id)
    if (!record) throw new Error(`SESSION_NOT_FOUND: ${id}`)
    const tree = await this.readSourcesAt(record.base)
    for (const op of this.store.sessions.ops(id)) applyOp(tree, op)
    return this.store.sessions.restoreTree(id, tree)
  }

  /** Commits on `branch` after `base`, newest first */
  private async commitsSince(opts: { branch: string; base: string }): Promise<LogEntry[]> {
    const log = await this.log({ branch: opts.branch, limit: 50 })
    const end = log.findIndex((c) => c.sha === opts.base)
    return end === -1 ? log : log.slice(0, end)
  }

  private endSession(id: string, outcome: SessionOutcome) {
    this.store.sessions.end(id, outcome)
    this.broadcast({ type: 'draft-end', session: id, outcome })
  }

  // ───────────────────────── private: build ─────────────────────────

  private async runBuild(tree: Tree): Promise<
    | { ok: true; dist: Map<string, string> }
    | { ok: false; errors: BuildError[]; errorText: string }
  > {
    const conflicts = findConflicts(tree)
    if (conflicts.length) {
      const errors = conflicts.flatMap((c) => c.lines.map((line) => ({ file: c.path, line, text: 'unresolved merge conflict' })))
      return { ok: false, errors, errorText: conflictErrorText(conflicts) }
    }
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

  private meta() {
    const meta = this.store.meta.get()
    if (!meta) throw new Error('NOT_INITIALIZED: call init() first')
    return meta
  }

  /** Handle on the Artifacts repo. Waits while a fork or import is in progress. */
  private async repo(): Promise<ArtifactsRepo> {
    const { repo } = this.meta()
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.env.ARTIFACTS.get(repo)
      } catch (e) {
        const inProgress = /IN_PROGRESS/.test(`${(e as any)?.code ?? ''} ${(e as any)?.message ?? ''}`)
        if (!inProgress || attempt >= 20) throw e
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  }

  private async remote(): Promise<{ url: string }> {
    const cached = this.store.remote.get()
    if (cached) return { url: cached }
    using repo = await this.repo()
    const { remote } = await repo.info()
    this.store.remote.set(remote)
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
    this.store.setHead(branch, remoteSha)
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
    sources: Tree,
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
    this.store.setHead(branch, sha)
    const url = this.announceCommit({ branch, sha, message, author })
    return { ok: true, sha, url }
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
      id: 'malleable',
    })
    if (!res.ok) throw new Error(`SEED_FAILED: ${JSON.stringify(res)}`)
  }
}
