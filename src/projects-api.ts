import { waitUntil } from 'cloudflare:workers'
import { Spiceflow } from 'spiceflow'
import { cors } from 'spiceflow/cors'
import { z } from 'zod'
import { viewPage } from './view-page.js'
import { getProject, repoNameFor, DIST_DIR, type ProjectDO } from './project-do.js'

export interface ProjectsEnv {
  ARTIFACTS: Artifacts
  PROJECT: DurableObjectNamespace<ProjectDO>
  LOVEPACK_API_KEY: string
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

// ── git access tokens: stateless, `lp_<scope>_<expiry>_<hmac(projectId.scope.expiry)>` ──

type GitScope = 'read' | 'write'

async function hmacHex(secret: string, data: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function mintGitToken(env: ProjectsEnv, projectId: string, scope: GitScope, ttl: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttl
  const mac = await hmacHex(env.LOVEPACK_API_KEY, `${projectId}.${scope}.${expiresAt}`)
  return { token: `lp_${scope}_${expiresAt}_${mac}`, expiresAt }
}

/** Returns the granted scope, or undefined when the token is invalid, expired or for another project */
async function checkGitToken(env: ProjectsEnv, projectId: string, token: string): Promise<GitScope | undefined> {
  const [prefix, scope, expiry, mac] = token.split('_')
  if (prefix !== 'lp' || (scope !== 'read' && scope !== 'write') || !mac) return undefined
  if (Number(expiry) < Date.now() / 1000) return undefined
  const expected = await hmacHex(env.LOVEPACK_API_KEY, `${projectId}.${scope}.${expiry}`)
  return (await keyMatches(mac, expected)) ? scope : undefined
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

const stubFor = (env: ProjectsEnv, projectId: string) =>
  getProject({ namespace: env.PROJECT, projectId })

/**
 * Management API: REST wrapper over the ProjectDO RPC methods.
 * Requires `Authorization: Bearer $LOVEPACK_API_KEY`.
 */
export const projectsApi = new Spiceflow()
  .state('env', {} as ProjectsEnv)
  .use(cors())
  .use(async ({ request, state }, next) => {
    if (!new URL(request.url).pathname.startsWith('/api/projects')) return next()
    if (request.method === 'OPTIONS') return next()
    const given = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '')
    if (!(await keyMatches(given, state.env.LOVEPACK_API_KEY))) {
      return Response.json(
        { message: 'Missing or invalid API key. Send `Authorization: Bearer <LOVEPACK_API_KEY>`.' },
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
    path: '/api/projects/:id/git-access',
    request: z.object({
      scope: z.enum(['read', 'write']).default('write'),
      ttl: z.number().int().min(60).max(86400).default(3600),
    }),
    async handler({ request, params, state }) {
      const { scope, ttl } = await request.json()
      repoNameFor(params.id)
      const { token, expiresAt } = await mintGitToken(state.env, params.id, scope, ttl)
      const origin = new URL(request.url).origin
      const url = `${origin}/git/${params.id}.git`
      return {
        url,
        // `git clone` URL with the token embedded; use only for short-lived commands
        authenticatedUrl: url.replace('://', `://x:${token}@`),
        username: 'x',
        password: token,
        scope,
        expiresAt,
      }
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
 * Access is by project id, like the old /bundle/* routes.
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

      const password = Buffer.from((request.headers.get('authorization') ?? '').replace(/^Basic /, ''), 'base64')
        .toString()
        .split(':')
        .slice(1)
        .join(':')
      const scope = await checkGitToken(state.env, projectId, password)
      if (!scope || (service === 'git-receive-pack' && scope !== 'write')) {
        return new Response('Missing or invalid git token. Create one with POST /api/projects/:id/git-access', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="lovepack"' },
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
