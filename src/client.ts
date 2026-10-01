import type {
  Author,
  BuildResult,
  CommitResult,
  LiveMessage,
  LogEntry,
  ProjectInfo,
  SessionOp,
} from './project-do.js'

export type {
  Author,
  BuildResult,
  CommitResult,
  LiveMessage,
  LogEntry,
  ProjectInfo,
  SessionOp,
}

export class LovepackError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

export interface ClientOptions {
  /** Worker origin, e.g. https://remote-bundler.fumabase.com */
  endpoint: string
  apiKey: string
}

/**
 * HTTP client for the lovepack REST API. Mirrors the ProjectDO RPC methods:
 *
 *   const project = new Lovepack({ endpoint, apiKey }).project({ id: 'u123' })
 *   await project.init()
 *   const session = await project.openSession({ author })
 *   await session.write({ path: 'App.tsx', content: code })
 *   await session.build()                          // draft, viewers see it live
 *   await session.commit({ message: 'Add chart' }) // one commit per agent message
 */
export class Lovepack {
  constructor(private options: ClientOptions) {}

  project({ id }: { id: string }) {
    return new Project(this.options, id)
  }
}

async function call<T>(
  options: ClientOptions,
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
    throw new LovepackError(json.message ?? res.statusText, res.status, json.code)
  }
  return json as T
}

export class Project {
  constructor(
    private options: ClientOptions,
    readonly id: string,
  ) {}

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
    return call<{ sha: string }>(this.options, 'POST', this.path('/merge'), opts)
  }

  async deleteBranch({ name }: { name: string }) {
    await call(this.options, 'DELETE', this.path(`/branches/${encodeURIComponent(name)}`))
  }

  /** Public URL of a built file. `ref` is a branch (mutable) or a commit sha (immutable). */
  fileUrl({ ref, file = 'index.js' }: { ref: string; file?: string }) {
    return `${this.options.endpoint}/p/${encodeURIComponent(this.id)}/r/${encodeURIComponent(ref)}/${file}`
  }

  /**
   * Import the default export (the entry component) of a build.
   * Use the `url` of an `update` message: every draft and commit has its own url,
   * so the browser module cache never returns an older build. Branch urls are mutable.
   */
  async load({ url }: { url: string }) {
    const mod = await import(/* @vite-ignore */ new URL(url, this.options.endpoint).href)
    return mod.default
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
      ws.onmessage = (e) => onMessage(JSON.parse(String(e.data)))
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
    private options: ClientOptions,
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

  write({ path, content }: { path: string; content: string }) {
    return this.apply({ ops: [{ op: 'write', path, content }] })
  }

  /** Fails unless `oldString` occurs exactly once */
  replace({ path, oldString, newString }: { path: string; oldString: string; newString: string }) {
    return this.apply({ ops: [{ op: 'replace', path, oldString, newString }] })
  }

  remove({ path }: { path: string }) {
    return this.apply({ ops: [{ op: 'delete', path }] })
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

  /** Build, commit and push. Resolves with `{ ok: false }` when the build fails or the branch moved. */
  commit(opts: { message: string; rebase?: boolean }) {
    return call<CommitResult>(this.options, 'POST', this.path('/commit'), opts)
  }

  async discard() {
    await call(this.options, 'DELETE', this.path())
  }
}
