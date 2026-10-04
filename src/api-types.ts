// Public wire types of the REST API and live WebSocket. No worker imports: the published client uses them.

export type Author = { kind: 'agent' | 'user' | 'system'; id: string }

export type SessionOp =
  | { op: 'write'; path: string; content: string }
  | { op: 'replace'; path: string; oldString: string; newString: string }
  | { op: 'delete'; path: string }

export type BuildError = { file?: string; line?: number; text: string }

/**
 * `url` is the entry module of the result, relative to the Worker origin. An agent can send it
 * to the user in its own response stream, so the client does not need `watch`.
 */
export type CommitResult =
  /** `merged`: the branch moved while the session was open and the changes merged cleanly */
  | { ok: true; sha: string; url: string; noop?: boolean; merged?: boolean }
  | { ok: false; reason: 'build-error'; errors: BuildError[]; errorText: string }
  /**
   * The session now sits on `head` and its files contain conflict markers. Give `prompt` to the
   * agent: it edits the marked blocks with its normal tools, then commits again.
   */
  | { ok: false; reason: 'conflict'; head: string; conflicts: Conflict[]; prompt: string }

/** A file with unresolved conflict markers. `lines` are the 1-based lines of each `<<<<<<<`. */
export interface Conflict {
  path: string
  lines: number[]
}

export interface SessionStatus {
  branch: string
  /** commit the session is based on; it moves to the branch head on every commit attempt */
  base: string
  conflicts: Conflict[]
}

export type BuildResult =
  | { ok: true; build: number; url: string; files: string[] }
  | { ok: false; errors: BuildError[]; errorText: string }

export type GitScope = 'read' | 'write'

/** A git token as listed. The secret itself is never stored, only its SHA-256. */
export interface GitTokenInfo {
  id: string
  scope: GitScope
  label: string
  /** Unix ms */
  createdAt: number
  /** Unix ms, null when the token never expires */
  expiresAt: number | null
  /** Unix ms of the last accepted git request, null when never used */
  lastUsedAt: number | null
}

/** A new git token with ready-to-use remote urls. `token` is returned only here. */
export interface CreatedGitToken extends GitTokenInfo {
  token: string
  /** `https://<worker>/git/<projectId>.git` */
  url: string
  /** `url` with the token embedded. Git saves it in .git/config. */
  authenticatedUrl: string
  username: string
}

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

export interface DraftInfo {
  url: string
  session: string
  branch: string
  build: number
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
  | { type: 'conflict'; session: string; conflicts: Conflict[] }
  | { type: 'draft-end'; session: string; outcome: 'committed' | 'discarded' }
