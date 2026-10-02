import { waitUntil } from 'cloudflare:workers'
import { Spiceflow } from 'spiceflow'
import { cors } from 'spiceflow/cors'
import { z } from 'zod'
import { viewPage } from './view-page.js'
import { repoNameFor, DIST_DIR, type ProjectDO } from './project-do.js'

export interface ProjectsEnv {
  ARTIFACTS: Artifacts
  PROJECT: DurableObjectNamespace<ProjectDO>
  MALLEABLE_API_KEY: string
}

const authorSchema = z.object({
  kind: z.enum(['agent', 'user', 'system']),
  id: z.string().min(1).max(100),
})

const opSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('write'), path: z.string(), content: z.string() }),
  z.object({
    op: z.literal('replace'),
    path: z.string(),
    oldString: z.string(),
    newString: z.string(),
  }),
  z.object({ op: z.literal('delete'), path: z.string() }),
])

const statusByCode: Record<string, number> = {
  INVALID_PROJECT_ID: 400,
  INVALID_PATH: 400,
  NOT_INITIALIZED: 404,
  SESSION_NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  BRANCH_NOT_FOUND: 404,
  REF_NOT_FOUND: 404,
  NOTHING_TO_UNDO: 409,
  REPLACE_NOT_FOUND: 422,
  REPLACE_AMBIGUOUS: 422,
  SESSION_ACTIVE: 409,
  NOT_FAST_FORWARD: 409,
  CANNOT_DELETE_DEFAULT_BRANCH: 400,
  GIT_TOKEN_NOT_FOUND: 404,
}

/** Errors thrown by the DO start with a `CODE:` prefix. Map them to HTTP statuses. */
function errorResponse(error: Error) {
  const code = /^([A-Z_]+):/.exec(error.message)?.[1]
  const status = (code && statusByCode[code]) || 500
  return Response.json({ message: error.message, code }, { status })
}

async function keyMatches(given: string, expected: string) {
  if (!expected) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

const contentTypes: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  html: 'text/html; charset=utf-8',
}

function fileResponse(body: BodyInit, path: string, immutable: boolean) {
  const ext = path.split('.').pop() ?? ''
  return new Response(body, {
    headers: {
      'Content-Type': contentTypes[ext] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// ── git remote tokens: stored per project in the DO, see GitTokenStore ──

/** Password of a Basic auth header, empty when missing */
function basicPassword(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ')) return ''
  return atob(header.slice('Basic '.length)).split(':').slice(1).join(':')
}

// Upstream (Artifacts) remote and write token, cached per isolate
const upstreamCache = new Map<string, { remote: string; secret: string; expiresAt: number }>()

async function upstreamFor(env: ProjectsEnv, projectId: string) {
  const cached = upstreamCache.get(projectId)
  if (cached && cached.expiresAt - Date.now() / 1000 > 300) return cached
  using repo = await env.ARTIFACTS.get(repoNameFor(projectId))
  const [{ remote }, token] = await Promise.all([repo.info(), repo.createToken('write', 3600)])
  const entry = {
    remote,
    secret: token.plaintext.split('?expires=')[0],
    expiresAt: Date.now() / 1000 + 3600,
  }
  upstreamCache.set(projectId, entry)
  return entry
}

const gitPaths = {
  'info/refs': { method: 'GET' },
  'git-upload-pack': { method: 'POST' },
  'git-receive-pack': { method: 'POST' },
} as const

/** Durable Object stub of a project. Throws INVALID_PROJECT_ID for malformed ids. */
const stubFor = (env: ProjectsEnv, projectId: string) => {
  repoNameFor(projectId)
  return env.PROJECT.get(env.PROJECT.idFromName(projectId))
}

/**
 * Management API: REST wrapper over the ProjectDO RPC methods.
 * Requires `Authorization: Bearer $MALLEABLE_API_KEY`.
 */
export const projectsApi = new Spiceflow()
  .state('env', {} as ProjectsEnv)
  .use(cors())
  .use(async ({ request, state }, next) => {
    if (!new URL(request.url).pathname.startsWith('/api/projects')) return next()
    if (request.method === 'OPTIONS') return next()
    const given = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '')
    if (!(await keyMatches(given, state.env.MALLEABLE_API_KEY))) {
      return Response.json(
        { message: 'Missing or invalid API key. Send `Authorization: Bearer <MALLEABLE_API_KEY>`.' },
        { status: 401 },
      )
    }
    return next()
  })
  .onError(({ error }) => errorResponse(error))
  .route({
    method: 'POST',
    path: '/api/projects/:id',
    request: z.object({ template: z.string().optional() }),
    async handler({ request, params, state }) {
      const { template } = await request.json()
      return stubFor(state.env, params.id).init({ projectId: params.id, template })
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id',
    handler: ({ params, state }) => stubFor(state.env, params.id).info(),
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/sessions',
    request: z.object({
      author: authorSchema,
      branch: z.string().optional(),
      id: z.string().optional(),
    }),
    async handler({ request, params, state }) {
      return stubFor(state.env, params.id).openSession(await request.json())
    },
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/git-tokens',
    request: z.object({
      scope: z.enum(['read', 'write']).default('write'),
      label: z.string().max(100).default(''),
      /** Seconds until expiry. Omit for a token that never expires. */
      ttl: z.number().int().min(60).optional(),
    }),
    async handler({ request, params, state }) {
      return stubFor(state.env, params.id).createGitToken(await request.json())
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/git-tokens',
    handler: ({ params, state }) => stubFor(state.env, params.id).gitTokens(),
  })
  .route({
    method: 'DELETE',
    path: '/api/projects/:id/git-tokens/:tokenId',
    async handler({ params, state }) {
      await stubFor(state.env, params.id).revokeGitToken({ id: params.tokenId })
      return { ok: true }
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/sessions',
    handler: ({ params, state }) => stubFor(state.env, params.id).sessionsOpen(),
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/sessions/:sid/ops',
    request: z.object({ ops: z.array(opSchema).min(1) }),
    async handler({ request, params, state }) {
      const { ops } = await request.json()
      await stubFor(state.env, params.id).apply({ sessionId: params.sid, ops })
      return { ok: true }
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/sessions/:sid/files',
    handler: ({ params, state }) => stubFor(state.env, params.id).list({ sessionId: params.sid }),
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/sessions/:sid/file',
    async handler({ params, request, state }) {
      const path = new URL(request.url).searchParams.get('path') ?? ''
      return { path, content: await stubFor(state.env, params.id).read({ sessionId: params.sid, path }) }
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/sessions/:sid/diff',
    handler: ({ params, state }) => stubFor(state.env, params.id).diff({ sessionId: params.sid }),
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/sessions/:sid/build',
    handler: ({ params, state }) => stubFor(state.env, params.id).build({ sessionId: params.sid }),
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/sessions/:sid/commit',
    request: z.object({ message: z.string().min(1), rebase: z.boolean().optional() }),
    async handler({ request, params, state }) {
      return stubFor(state.env, params.id).commit({ sessionId: params.sid, ...(await request.json()) })
    },
  })
  .route({
    method: 'DELETE',
    path: '/api/projects/:id/sessions/:sid',
    async handler({ params, state }) {
      await stubFor(state.env, params.id).discard({ sessionId: params.sid })
      return { ok: true }
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/log',
    handler({ params, request, state }) {
      const q = new URL(request.url).searchParams
      return stubFor(state.env, params.id).log({
        branch: q.get('branch') ?? undefined,
        limit: q.has('limit') ? Number(q.get('limit')) : undefined,
      })
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/files',
    handler({ params, request, state }) {
      return stubFor(state.env, params.id).files({
        ref: new URL(request.url).searchParams.get('ref') ?? 'main',
      })
    },
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/undo',
    request: z.object({ branch: z.string().optional(), author: authorSchema.optional() }),
    async handler({ request, params, state }) {
      return stubFor(state.env, params.id).undo(await request.json())
    },
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/restore',
    request: z.object({
      sha: z.string(),
      branch: z.string().optional(),
      message: z.string().optional(),
      author: authorSchema.optional(),
    }),
    async handler({ request, params, state }) {
      return stubFor(state.env, params.id).restore(await request.json())
    },
  })
  .route({
    method: 'GET',
    path: '/api/projects/:id/branches',
    handler: ({ params, state }) => stubFor(state.env, params.id).branches(),
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/branches',
    request: z.object({ name: z.string(), from: z.string().optional() }),
    async handler({ request, params, state }) {
      await stubFor(state.env, params.id).createBranch(await request.json())
      return { ok: true }
    },
  })
  .route({
    method: 'POST',
    path: '/api/projects/:id/merge',
    request: z.object({ branch: z.string(), into: z.string().optional() }),
    async handler({ request, params, state }) {
      return stubFor(state.env, params.id).merge(await request.json())
    },
  })
  .route({
    method: 'DELETE',
    path: '/api/projects/:id/branches/:name',
    async handler({ params, state }) {
      await stubFor(state.env, params.id).deleteBranch({ name: params.name })
      return { ok: true }
    },
  })

/**
 * Public read routes. Meant to be loaded by the browser: `import()` of built modules and the live socket.
 * Access is by project id.
 */
export const projectsPublic = new Spiceflow()
  .state('env', {} as ProjectsEnv)
  .onError(({ error }) => errorResponse(error))
  // Built output of a branch or an immutable commit sha
  .route({
    method: 'GET',
    path: '/p/:id/r/:ref/*',
    async handler({ params, state }) {
      const rest = params['*']
      using repo = await state.env.ARTIFACTS.get(repoNameFor(params.id))
      const file = await repo.readFile({ ref: params.ref, path: `${DIST_DIR}/${rest}` })
      if (!file) return new Response('Not found', { status: 404 })
      return fileResponse(file, rest, /^[0-9a-f]{40}$/.test(params.ref))
    },
  })
  // Output of an uncommitted draft build
  .route({
    method: 'GET',
    path: '/p/:id/d/:sid/:build/*',
    async handler({ params, state }) {
      const rest = params['*']
      const text = await stubFor(state.env, params.id).draftFile({
        sessionId: params.sid,
        build: Number(params.build),
        path: rest,
      })
      if (text === null) return new Response('Not found', { status: 404 })
      return fileResponse(text, rest, false)
    },
  })
  // Demo viewer: follows the project live
  .route({
    method: 'GET',
    path: '/view/:id',
    handler({ params }) {
      repoNameFor(params.id)
      return new Response(viewPage(params.id), { headers: { 'content-type': 'text/html; charset=utf-8' } })
    },
  })
  // Live updates: hello, update (draft or commit), build-error, draft-end
  .route({
    method: 'GET',
    path: '/p/:id/live',
    handler({ request, params, state }) {
      return stubFor(state.env, params.id).fetch(request)
    },
  })
  // Git smart HTTP remote. Pushes go to Artifacts, then the DO builds the pushed sources.
  .route({
    method: '*',
    path: '/git/:repo/*',
    async handler({ request, params, state }) {
      const projectId = params.repo.replace(/\.git$/, '')
      const rest = params['*'] as keyof typeof gitPaths
      const allowed = gitPaths[rest]
      if (!allowed || allowed.method !== request.method) {
        return new Response('Not found', { status: 404 })
      }
      const url = new URL(request.url)
      const service = rest === 'info/refs' ? url.searchParams.get('service') : `git-${rest.replace('git-', '')}`
      if (service !== 'git-upload-pack' && service !== 'git-receive-pack') {
        return new Response('Unsupported service', { status: 403 })
      }

      const password = basicPassword(request)
      const scope = password ? await stubFor(state.env, projectId).verifyGitToken({ token: password }) : undefined
      if (!scope || (service === 'git-receive-pack' && scope !== 'write')) {
        return new Response('Missing or invalid git token. Create one with POST /api/projects/:id/git-tokens', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="malleable"' },
        })
      }

      const upstream = await upstreamFor(state.env, projectId)
      const headers = new Headers({ authorization: `Basic ${btoa(`x:${upstream.secret}`)}` })
      for (const name of ['content-type', 'content-encoding', 'git-protocol', 'accept']) {
        const v = request.headers.get(name)
        if (v) headers.set(name, v)
      }
      const res = await fetch(`${upstream.remote}/${rest}${url.search}`, {
        method: request.method,
        headers,
        body: request.method === 'POST' ? request.body : undefined,
      })
      if (service === 'git-receive-pack' && request.method === 'POST' && res.ok) {
        waitUntil(
          stubFor(state.env, projectId)
            .afterGitPush()
            .catch((e) => console.error(`afterGitPush ${projectId}:`, e)),
        )
      }
      return new Response(res.body, {
        status: res.status,
        headers: {
          'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
          'cache-control': 'no-cache',
        },
      })
    },
  })
