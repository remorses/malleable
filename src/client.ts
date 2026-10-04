import type {
  Author,
  BuildError,
  BuildResult,
  CommitResult,
  Conflict,
  CreatedGitToken,
  GitScope,
  GitTokenInfo,
  DraftInfo,
  LiveMessage,
  LogEntry,
  ProjectInfo,
  SessionOp,
  SessionStatus,
} from './api-types.ts'

export type {
  Author,
  BuildError,
  BuildResult,
  CommitResult,
  Conflict,
  CreatedGitToken,
  GitScope,
  GitTokenInfo,
  DraftInfo,
  LiveMessage,
  LogEntry,
  ProjectInfo,
  SessionOp,
  SessionStatus,
}

export class MalleableError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

/** Hosted worker. Self-hosted deployments pass their own `endpoint`. */
export const DEFAULT_ENDPOINT = 'https://malleableui.dev'

export interface ClientOptions {
  /** Worker origin. Defaults to `DEFAULT_ENDPOINT`; set it when you self-host. */
  endpoint?: string
  apiKey: string
}

type ResolvedOptions = Required<ClientOptions>

/**
 * HTTP client for the Malleable UI REST API. Mirrors the ProjectDO RPC methods:
 *
 *   const project = new Project({ apiKey, id: 'u123' }) // or { endpoint: 'https://my-worker.dev', ... }
 *   await project.init()
 *   const session = await project.openSession({ author })
 *   await session.apply({ ops: [{ op: 'write', path: 'App.tsx', content: code }] })
 *   await session.build()                          // draft, viewers see it live
 *   await session.commit({ message: 'Add chart' }) // one commit per agent message
 */
async function call<T>(
  options: ResolvedOptions,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${options.endpoint}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await res.json()) as any
  if (!res.ok) {
    throw new MalleableError(json.message ?? res.statusText, res.status, json.code)
  }
  return withAbsoluteUrl(options.endpoint, json) as T
}

/** Module urls from the worker are origin-relative. Make them absolute so they can be stored and imported anywhere. */
function withAbsoluteUrl<T>(endpoint: string, value: T): T {
  if (!value || typeof value !== 'object' || !('url' in value)) return value
  const url = value.url
  if (typeof url !== 'string' || !url.startsWith('/')) return value
  return { ...value, url: `${endpoint}${url}` }
}

export class Project {
  private options: ResolvedOptions
  readonly id: string

  constructor({ id, endpoint = DEFAULT_ENDPOINT, apiKey }: ClientOptions & { id: string }) {
    this.options = { endpoint: endpoint.replace(/\/+$/, ''), apiKey }
    this.id = id
  }

  /** Worker origin. Module `url`s in results are already absolute. */
  get endpoint() {
    return this.options.endpoint
  }

  private path(suffix = '') {
    return `/api/projects/${encodeURIComponent(this.id)}${suffix}`
  }

  /** Idempotent. With `template`, forks that repo instead of creating a starter app. */
  init(opts: { template?: string } = {}) {
    return call<ProjectInfo>(this.options, 'POST', this.path(), opts)
  }

  info() {
    return call<ProjectInfo>(this.options, 'GET', this.path())
  }

  async openSession(opts: { author: Author; branch?: string; id?: string }) {
    const s = await call<{ sessionId: string; base: string; branch: string }>(
      this.options,
      'POST',
      this.path('/sessions'),
      opts,
    )
    return new Session(this.options, this, s.sessionId, s.branch, s.base)
  }

  /** Open sessions. Many agents can work on the same branch at once. */
  sessions() {
    return call<Array<{ id: string; branch: string; author: Author }>>(this.options, 'GET', this.path('/sessions'))
  }

  /**
   * Token for the git remote, revocable with `revokeGitToken`. `scope` defaults to write.
   * Without `ttl` (seconds) it never expires. The secret is returned only once.
   */
  createGitToken(opts: { scope?: GitScope; label?: string; ttl?: number } = {}) {
    return call<CreatedGitToken>(this.options, 'POST', this.path('/git-tokens'), opts)
  }

  /** Tokens of this project, without their secrets */
  gitTokens() {
    return call<GitTokenInfo[]>(this.options, 'GET', this.path('/git-tokens'))
  }

  async revokeGitToken(opts: { id: string }) {
    await call(this.options, 'DELETE', this.path(`/git-tokens/${encodeURIComponent(opts.id)}`))
  }

  log(opts: { branch?: string; limit?: number } = {}) {
    const q = new URLSearchParams()
    if (opts.branch) q.set('branch', opts.branch)
    if (opts.limit) q.set('limit', String(opts.limit))
    return call<LogEntry[]>(this.options, 'GET', this.path(`/log?${q}`))
  }

  /** Source files at a branch or commit */
  files({ ref = 'main' }: { ref?: string } = {}) {
    return call<string[]>(this.options, 'GET', this.path(`/files?ref=${encodeURIComponent(ref)}`))
  }

  /** New commit with the sources of the previous commit. Call twice to undo the undo. */
  undo(opts: { branch?: string; author?: Author } = {}) {
    return call<CommitResult>(this.options, 'POST', this.path('/undo'), opts)
  }

  restore(opts: { sha: string; branch?: string; author?: Author; message?: string }) {
    return call<CommitResult>(this.options, 'POST', this.path('/restore'), opts)
  }

  branches() {
    return call<string[]>(this.options, 'GET', this.path('/branches'))
  }

  async createBranch(opts: { name: string; from?: string }) {
    await call(this.options, 'POST', this.path('/branches'), opts)
  }

  /** Fast-forward only */
  merge(opts: { branch: string; into?: string }) {
    return call<{ sha: string; url: string }>(this.options, 'POST', this.path('/merge'), opts)
  }

  async deleteBranch({ name }: { name: string }) {
    await call(this.options, 'DELETE', this.path(`/branches/${encodeURIComponent(name)}`))
  }

  /** Live updates of this project. Reconnects with backoff until `close()`. */
  watch({ onMessage }: { onMessage: (msg: LiveMessage) => void }) {
    const wsUrl = `${this.options.endpoint.replace(/^http/, 'ws')}/p/${encodeURIComponent(this.id)}/live`
    let closed = false
    let ws: WebSocket | undefined
    let attempt = 0
    const connect = () => {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => (attempt = 0)
      ws.onmessage = (e) => {
        const msg: LiveMessage = withAbsoluteUrl(this.options.endpoint, JSON.parse(String(e.data)))
        if (msg.type !== 'hello') return onMessage(msg)
        onMessage({ ...msg, drafts: msg.drafts.map((d) => withAbsoluteUrl(this.options.endpoint, d)) })
      }
      // 1006 is a dropped connection or a DO restart: always reconnect
      ws.onclose = () => {
        if (closed) return
        setTimeout(connect, Math.min(30_000, 500 * 2 ** attempt++))
      }
    }
    connect()
    return {
      close() {
        closed = true
        ws?.close()
      },
    }
  }
}

export class Session {
  constructor(
    private options: ResolvedOptions,
    readonly project: Project,
    readonly id: string,
    readonly branch: string,
    readonly base: string,
  ) {}

  private path(suffix = '') {
    return `/api/projects/${encodeURIComponent(this.project.id)}/sessions/${this.id}${suffix}`
  }

  async apply({ ops }: { ops: SessionOp[] }) {
    await call(this.options, 'POST', this.path('/ops'), { ops })
  }

  async read({ path }: { path: string }) {
    const r = await call<{ content: string | null }>(
      this.options,
      'GET',
      this.path(`/file?path=${encodeURIComponent(path)}`),
    )
    return r.content
  }

  list() {
    return call<string[]>(this.options, 'GET', this.path('/files'))
  }

  diff() {
    return call<Array<['added' | 'modified' | 'deleted', string]>>(this.options, 'GET', this.path('/diff'))
  }

  /** Draft build. Never committed; viewers get an `update` message of kind `draft`. */
  build() {
    return call<BuildResult>(this.options, 'POST', this.path('/build'))
  }

  /**
   * Build, commit and push. Merges with commits that landed on the branch meanwhile. Resolves with
   * `{ ok: false }` on build errors, or on conflicts: then pass `prompt` to the agent, let it edit
   * the conflict markers out of the files, and commit again.
   */
  commit(opts: { message: string }) {
    return call<CommitResult>(this.options, 'POST', this.path('/commit'), opts)
  }

  /** Base commit and unresolved conflicts */
  status() {
    return call<SessionStatus>(this.options, 'GET', this.path('/status'))
  }

  async discard() {
    await call(this.options, 'DELETE', this.path())
  }
}
