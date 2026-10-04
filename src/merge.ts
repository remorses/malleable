/**
 * Three-way merge of session trees. Overlapping edits become git-style conflict markers inside
 * the files, so agents fix them with their normal read/edit tools. Markers in a tree are the only
 * conflict state: `findConflicts` derives it, nothing else stores it.
 */

import { diff3Merge } from 'node-diff3'
import dedent from 'string-dedent'
import type { Conflict, LogEntry, SessionOp } from './api-types.ts'

type Tree = ReadonlyMap<string, string>

const START = '<<<<<<<'
const BASE = '|||||||'
const SEP = '======='
const END = '>>>>>>>'

export interface MergeLabels {
  /** the session's side, e.g. `yours (session s_1)` */
  mine: string
  /** the branch side, e.g. `main a1b2c3d` */
  theirs: string
}

function block(mine: string[], base: string[], theirs: string[], labels: MergeLabels): string[] {
  return [`${START} ${labels.mine}`, ...mine, `${BASE} base`, ...base, SEP, ...theirs, `${END} ${labels.theirs}`]
}

/** Line merge of one file both sides changed. `undefined` means the file is deleted on that side. */
function mergeFile(
  base: string | undefined,
  mine: string | undefined,
  theirs: string | undefined,
  labels: MergeLabels,
): string {
  // modify/delete: keep the surviving content inside one block, the agent decides
  if (mine === undefined || theirs === undefined) {
    const lines = (s: string | undefined, side: string) => (s === undefined ? [`(deleted in ${side})`] : s.split('\n'))
    return block(lines(mine, 'yours'), lines(base, 'base'), lines(theirs, labels.theirs), labels).join('\n')
  }
  const out: string[] = []
  const regions = diff3Merge(mine.split('\n'), (base ?? '').split('\n'), theirs.split('\n'))
  for (const r of regions) {
    if (r.ok) out.push(...r.ok)
    else if (r.conflict) out.push(...block(r.conflict.a, r.conflict.o, r.conflict.b, labels))
  }
  return out.join('\n')
}

/**
 * Merge the session tree `mine` and the branch head `theirs`, both derived from `base`.
 * Files changed on one side only take that side; files changed on both are line-merged.
 */
export function mergeTrees(opts: { base: Tree; mine: Tree; theirs: Tree; labels: MergeLabels }): Map<string, string> {
  const { base, mine, theirs, labels } = opts
  const out = new Map<string, string>()
  for (const path of new Set([...base.keys(), ...mine.keys(), ...theirs.keys()])) {
    const b = base.get(path)
    const m = mine.get(path)
    const t = theirs.get(path)
    const merged = m === b ? t : t === b || t === m ? m : mergeFile(b, m, t, labels)
    if (merged !== undefined) out.set(path, merged)
  }
  return out
}

/** Files that still contain conflict markers, with the 1-based line of each block start */
export function findConflicts(tree: Tree): Conflict[] {
  const out: Conflict[] = []
  for (const [path, content] of tree) {
    if (!content.includes(START)) continue
    const lines = content
      .split('\n')
      .flatMap((line, i) => (line.startsWith(`${START} `) || line === START ? [i + 1] : []))
    if (lines.length) out.push({ path, lines })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/** Ops that turn `from` into `to`. Used to compact a session's op log after a merge. */
export function treeOps(from: Tree, to: Tree): SessionOp[] {
  const ops: SessionOp[] = []
  for (const [path, content] of to) if (from.get(path) !== content) ops.push({ op: 'write', path, content })
  for (const path of from.keys()) if (!to.has(path)) ops.push({ op: 'delete', path })
  return ops
}

export function conflictErrorText(conflicts: Conflict[]): string {
  return conflicts
    .flatMap((c) => c.lines.map((l) => `${c.path}:${l}: unresolved merge conflict. Remove the markers before building.`))
    .join('\n')
}

/** Instructions for the agent whose commit hit conflicts */
export function conflictPrompt(opts: { branch: string; conflicts: Conflict[]; incoming: LogEntry[] }): string {
  const { branch, conflicts, incoming } = opts
  const files = conflicts.map((c) => `- ${c.path}: line${c.lines.length > 1 ? 's' : ''} ${c.lines.join(', ')}`).join('\n')
  const commits = incoming
    .map((c) => `- ${c.sha.slice(0, 7)} "${c.message.split('\n')[0]}" by ${c.author.kind} ${c.author.id}`)
    .join('\n')
  return dedent`
    Your commit was not saved: your changes conflict with ${branch}.

    Commits that landed on ${branch} while you worked:
    ${commits || '- none since your last commit attempt'}

    Your files now contain both versions, separated by conflict markers:
    ${files}

    Each conflict looks like this:

    ${START} yours
    (your version)
    ${BASE} base
    (the version you both started from)
    ${SEP}
    (the version now on ${branch})
    ${END} ${branch}

    Read each file. Replace every block, from the ${START} line to the ${END} line, with code that keeps
    both intents. Compare each side with the base to see what it changed. Keep the other change unless it
    contradicts what the user asked for. A side that says "(deleted in ...)" means that side deleted the
    file: to keep it deleted, delete the file instead of editing it. Then commit again.
  `
}
