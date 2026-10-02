/**
 * Typed persistence for ProjectDO. The only code that touches `ctx.storage`.
 *
 * Every write goes to SQLite first, then to the in-memory cache, so the two never drift.
 * Caches load lazily: after hibernation the DO is a new instance with empty caches and
 * reads storage again. Session working trees are not stored; they are derived from the
 * branch head plus the op log, and only `ProjectDO` can derive them (it needs git).
 */

import type { Author, GitScope, GitTokenInfo, SessionOp } from './api-types.js'

export type Tree = ReadonlyMap<string, string>
export type SessionOutcome = 'committed' | 'discarded'

export interface SessionRecord {
  id: string
  branch: string
  base: string
  author: Author
  updatedAt: number
}

/** An open session whose working tree is in memory */
export interface LoadedSession extends SessionRecord {
  tree: Tree
}

export interface ProjectMeta {
  projectId: string
  repo: string
}

export interface Draft {
  branch: string
  build: number
  /** Output of the last builds, oldest first */
  files: Tree[]
}

export const DIST_DIR = 'dist'
const MAX_DRAFTS_KEPT = 3

export function normalizePath(path: string): string {
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

export function applyOp(tree: Map<string, string>, op: SessionOp) {
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

// ───────────────────────── key-value fields ─────────────────────────

interface KvSchema {
  meta: ProjectMeta
  heads: Readonly<Record<string, string>>
  remote: string
}

/** Write-through cache of one key in the DO sync KV. Values are frozen so the cache can't be mutated. */
class KvField<K extends keyof KvSchema> {
  private loaded = false
  private value: Readonly<KvSchema[K]> | undefined

  constructor(
    private kv: SyncKvStorage,
    private key: K,
  ) {}

  get(): Readonly<KvSchema[K]> | undefined {
    if (!this.loaded) {
      this.value = freeze(this.kv.get<KvSchema[K]>(this.key))
      this.loaded = true
    }
    return this.value
  }

  set(value: KvSchema[K]) {
    this.kv.put(this.key, value)
    this.value = freeze(value)
    this.loaded = true
  }

  delete() {
    this.kv.delete(this.key)
    this.value = undefined
    this.loaded = true
  }
}

function freeze<T>(value: T): Readonly<T> {
  return typeof value === 'object' && value !== null ? Object.freeze(value) : value
}

// ───────────────────────── sessions ─────────────────────────

type SessionRow = {
  id: string
  branch: string
  base: string
  author: string
  updated_at: number
}

/**
 * Open sessions, their op logs, working trees and draft builds.
 * The DO is the only writer of its SQLite, so after the first load the `open` map is complete.
 */
class SessionStore {
  private openCache: Map<string, SessionRecord> | undefined
  private trees = new Map<string, Tree>()
  /** Memory only by design: a DO restart drops drafts */
  private draftsById = new Map<string, Draft>()

  constructor(private storage: DurableObjectStorage) {}

  private get sql() {
    return this.storage.sql
  }

  private get openMap(): Map<string, SessionRecord> {
    if (!this.openCache) {
      const rows = this.sql
        .exec<SessionRow>(`SELECT id, branch, base, author, updated_at FROM sessions WHERE status = 'open'`)
        .toArray()
      this.openCache = new Map(
        rows.map((r) => [
          r.id,
          { id: r.id, branch: r.branch, base: r.base, author: JSON.parse(r.author), updatedAt: r.updated_at },
        ]),
      )
    }
    return this.openCache
  }

  /** Open sessions, optionally only those on `branch` */
  open(branch?: string): SessionRecord[] {
    const all = [...this.openMap.values()]
    return branch === undefined ? all : all.filter((s) => s.branch === branch)
  }

  get(id: string): SessionRecord | undefined {
    return this.openMap.get(id)
  }

  /** Open session with its working tree, or undefined when the tree must be rebuilt */
  loaded(id: string): LoadedSession | undefined {
    const record = this.get(id)
    const tree = this.trees.get(id)
    return record && tree ? { ...record, tree } : undefined
  }

  create(opts: { id: string; branch: string; base: string; author: Author; tree: Tree }): LoadedSession {
    const record: SessionRecord = {
      id: opts.id,
      branch: opts.branch,
      base: opts.base,
      author: opts.author,
      updatedAt: Date.now(),
    }
    this.sql.exec(
      `INSERT INTO sessions (id, branch, base, author, status, updated_at) VALUES (?, ?, ?, ?, 'open', ?)`,
      record.id,
      record.branch,
      record.base,
      JSON.stringify(record.author),
      record.updatedAt,
    )
    this.openMap.set(record.id, record)
    this.trees.set(record.id, opts.tree)
    return { ...record, tree: opts.tree }
  }

  /** Cache a tree rebuilt from head + `ops(id)` after hibernation */
  restoreTree(id: string, tree: Tree): LoadedSession {
    const record = this.get(id)
    if (!record) throw new Error(`SESSION_NOT_FOUND: ${id}`)
    this.trees.set(id, tree)
    return { ...record, tree }
  }

  ops(id: string): SessionOp[] {
    return this.sql
      .exec<{ op: string }>(`SELECT op FROM ops WHERE session_id = ? ORDER BY seq`, id)
      .toArray()
      .map((r) => JSON.parse(r.op))
  }

  /** Apply ops atomically: logs them and updates the tree, or changes nothing if one fails */
  apply(id: string, ops: SessionOp[]): LoadedSession {
    if (!this.get(id)) throw new Error(`SESSION_NOT_FOUND: ${id}`)
    const current = this.loaded(id)
    // ProjectDO must call restoreTree() first
    if (!current) throw new Error(`SESSION_NOT_LOADED: ${id}`)
    const tree = new Map(current.tree)
    for (const op of ops) applyOp(tree, op)
    const updatedAt = Date.now()
    this.storage.transactionSync(() => {
      for (const op of ops) {
        this.sql.exec(`INSERT INTO ops (session_id, op) VALUES (?, ?)`, id, JSON.stringify(op))
      }
      this.sql.exec(`UPDATE sessions SET updated_at = ? WHERE id = ?`, updatedAt, id)
    })
    const record = { ...this.get(id)!, updatedAt }
    this.openMap.set(id, record)
    this.trees.set(id, tree)
    return { ...record, tree }
  }

  end(id: string, outcome: SessionOutcome) {
    this.storage.transactionSync(() => {
      this.sql.exec(`UPDATE sessions SET status = ? WHERE id = ?`, outcome, id)
      this.sql.exec(`DELETE FROM ops WHERE session_id = ?`, id)
    })
    this.openMap.delete(id)
    this.trees.delete(id)
    this.draftsById.delete(id)
  }

  /** Record a draft build of an open session. Returns its build number. */
  addDraft(id: string, dist: Tree): number {
    const record = this.get(id)
    if (!record) throw new Error(`SESSION_NOT_FOUND: ${id}`)
    const prev = this.draftsById.get(id)
    const build = (prev?.build ?? 0) + 1
    const files = [...(prev?.files ?? []), dist].slice(-MAX_DRAFTS_KEPT)
    this.draftsById.set(id, { branch: record.branch, build, files })
    return build
  }

  /** Output of build number `build`, if it is still kept */
  draftFiles(id: string, build: number): Tree | undefined {
    const d = this.draftsById.get(id)
    if (!d) return undefined
    return d.files[d.files.length - 1 - (d.build - build)]
  }

  drafts(): Array<{ session: string } & Draft> {
    return [...this.draftsById].map(([session, d]) => ({ session, ...d }))
  }
}

// ───────────────────────── git tokens ─────────────────────────

type GitTokenRow = {
  id: string
  scope: GitScope
  label: string
  created_at: number
  expires_at: number | null
  last_used_at: number | null
}

const toTokenInfo = (r: GitTokenRow): GitTokenInfo => ({
  id: r.id,
  scope: r.scope,
  label: r.label,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  lastUsedAt: r.last_used_at,
})

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function sha256(text: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/** Revocable git remote tokens of one project */
class GitTokenStore {
  constructor(private sql: SqlStorage) {}

  /** Returns the secret once; only its hash is stored */
  async create(opts: { scope: GitScope; label: string; ttlMs?: number }): Promise<GitTokenInfo & { token: string }> {
    const id = `gt_${hex(crypto.getRandomValues(new Uint8Array(6)))}`
    const token = `lpgit_${hex(crypto.getRandomValues(new Uint8Array(24)))}`
    const now = Date.now()
    const row: GitTokenRow = {
      id,
      scope: opts.scope,
      label: opts.label,
      created_at: now,
      expires_at: opts.ttlMs ? now + opts.ttlMs : null,
      last_used_at: null,
    }
    this.sql.exec(
      `INSERT INTO git_tokens (id, hash, scope, label, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      row.id,
      await sha256(token),
      row.scope,
      row.label,
      row.created_at,
      row.expires_at,
    )
    return { ...toTokenInfo(row), token }
  }

  list(): GitTokenInfo[] {
    return this.sql
      .exec<GitTokenRow>(
        `SELECT id, scope, label, created_at, expires_at, last_used_at FROM git_tokens ORDER BY created_at`,
      )
      .toArray()
      .map(toTokenInfo)
  }

  revoke(id: string) {
    const { rowsWritten } = this.sql.exec(`DELETE FROM git_tokens WHERE id = ?`, id)
    if (!rowsWritten) throw new Error(`GIT_TOKEN_NOT_FOUND: ${id}`)
  }

  /** Scope of a valid token, undefined when unknown, revoked or expired. Records the use. */
  async verify(token: string): Promise<GitScope | undefined> {
    const now = Date.now()
    const [row] = this.sql
      .exec<{ id: string; scope: GitScope; expires_at: number | null }>(
        `SELECT id, scope, expires_at FROM git_tokens WHERE hash = ?`,
        await sha256(token),
      )
      .toArray()
    if (!row || (row.expires_at !== null && row.expires_at < now)) return undefined
    this.sql.exec(`UPDATE git_tokens SET last_used_at = ? WHERE id = ?`, now, row.id)
    return row.scope
  }
}

// ───────────────────────── project store ─────────────────────────

export class ProjectStore {
  readonly meta: KvField<'meta'>
  /** Git remote url of the Artifacts repo */
  readonly remote: KvField<'remote'>
  readonly sessions: SessionStore
  readonly gitTokens: GitTokenStore
  private headsField: KvField<'heads'>

  constructor(storage: DurableObjectStorage) {
    storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, branch TEXT NOT NULL, base TEXT NOT NULL,
        author TEXT NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ops (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, op TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS git_tokens (
        id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL, label TEXT NOT NULL,
        created_at INTEGER NOT NULL, expires_at INTEGER, last_used_at INTEGER
      );
    `)
    this.meta = new KvField(storage.kv, 'meta')
    this.remote = new KvField(storage.kv, 'remote')
    this.headsField = new KvField(storage.kv, 'heads')
    this.sessions = new SessionStore(storage)
    this.gitTokens = new GitTokenStore(storage.sql)
  }

  /** Last known remote sha per branch */
  heads(): Readonly<Record<string, string>> {
    return this.headsField.get() ?? {}
  }

  setHead(branch: string, sha: string) {
    const heads = this.heads()
    if (heads[branch] === sha) return
    this.headsField.set({ ...heads, [branch]: sha })
  }

  deleteHead(branch: string) {
    const { [branch]: _, ...rest } = this.heads()
    this.headsField.set(rest)
  }
}
