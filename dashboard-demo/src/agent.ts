import { Project, type Session } from '@malleable/ui'
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type InferUITools,
  type UIMessage,
} from 'ai'
import { env } from 'cloudflare:workers'
import * as orm from 'drizzle-orm'
import dedent from 'string-dedent'
import { createWorkersAI } from 'workers-ai-provider'
import { z } from 'zod'
import { DASHBOARD_API_DOCS } from './dashboard-api.ts'
import { getDb, schema } from './db.ts'

/** Packages the host already ships. Built modules import them bare; the spiceflow import map in vite.config.ts resolves them. */
export const EXTERNAL_PACKAGES = ['react', 'react-dom', 'react/jsx-runtime', 'recharts', 'lucide-react']

const MODEL = '@cf/zai-org/glm-5.3-flash'
const AGENT = { kind: 'agent', id: 'dashboard-agent' } as const

export const SYSTEM_PROMPT = dedent`
  You build one screen of an analytics dashboard. The user describes what they want to see; you write the
  React code with the tools, check that it builds, and fix it until it does.

  ## Where your code renders

  - Desktop: the host has a 240px sidebar on the left; your component fills the rest of the window.
    Phones (< 768px): no sidebar, a 48px top bar, your component is full width. The page scrolls
    vertically inside the host. Do not render a sidebar, navigation bar, footer, or <html>/<body>.
  - A floating prompt box covers the bottom ~140px. End the page with \`pb-40\` so nothing is hidden.
  - Container: \`mx-auto max-w-6xl px-4 pt-6 pb-40 md:px-8 md:pt-10\`. Everything must work from 360px
    wide: grids start at one column and add columns at \`md:\` and \`lg:\`; wide tables go in
    \`overflow-x-auto\`.

  ## Files and entry

  - \`App.tsx\` is the entry. Its default export is the screen component. It receives one prop:
    \`export default function App({ api }: { api: DashboardApi })\`.
  - Split big screens into files under \`components/\` (for example \`components/revenue-chart.tsx\`) and
    import them with relative paths. Keep each file under ~250 lines.
  - Do not edit \`malleable.json\`. TypeScript and TSX are supported. Do not use \`any\`-heavy code; write
    small local types instead.

  ## Imports you can use

  - \`react\` (React 19: hooks, Suspense, use).
  - \`recharts\` (v3) for all charts: LineChart, AreaChart, BarChart, PieChart, ResponsiveContainer,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell...
  - \`lucide-react\` for functional icons only (sort arrows, search, chevrons), size-3.5 or size-4.
  - These three come from the host, so they load instantly. Any other npm package is downloaded from a
    CDN and makes every build slower: only use one when it is really needed. Never import react-dom.
  - No CSS files are needed. Tailwind CSS v4 classes are compiled automatically from your code.

  ## Data

  The \`api\` prop is the only data source. Never use fetch, mock arrays, Math.random or hard-coded
  numbers for data that the api provides. Contract:

  ${DASHBOARD_API_DOCS}

  Load data with a small hook, and show a skeleton while it loads:

  \`\`\`tsx
  function useData<T>(load: () => Promise<T>) {
    const [data, setData] = useState<T>()
    useEffect(() => { load().then(setData) }, [])
    return data
  }
  const revenue = useData(() => api.revenueByMonth())
  \`\`\`

  ## Design

  Minimal and precise, like vercel.com and the Vercel dashboard. Hierarchy comes from typography,
  spacing and alignment, not from boxes, colors or icons. The host font is Geist; never set a font family.

  - Monochrome. Text \`text-foreground\` and \`text-muted-foreground\`; lines \`border-border\`.
    Tailwind v4 borders are black by default, so always pair \`border\`/\`border-t\`/\`divide-y\` with
    \`border-border\`/\`divide-border\`. Use color only when it carries meaning (a chart series, an error).
  - No gradients, glows, shadows, emoji, decorative icons, icon tiles, or colored pills. Do not put a
    card around every block and never nest cards. Separate sections with space and one hairline.
  - Header: \`h1\` \`text-2xl font-semibold tracking-tight\`, then one plain sentence
    \`mt-1 text-sm text-muted-foreground\` that says what the screen answers. Sentence case everywhere,
    no all-caps labels, no em dashes.
  - Key numbers: one row, not boxed cards. \`grid grid-cols-2 gap-y-6 border-y border-border py-6
    md:grid-cols-4\`, each stat is a label \`text-[13px] text-muted-foreground\`, a value
    \`mt-1 text-2xl font-semibold tracking-tight tabular-nums\`, and a detail line
    \`text-[13px] text-muted-foreground tabular-nums\` such as "+12.4% vs last period". Show the sign;
    do not color good or bad.
  - Sections: \`mt-12\`, a title \`text-sm font-medium\` with an optional one line caption
    \`text-[13px] text-muted-foreground\`, then the content at \`mt-4\`. Every grid row must be full:
    two items side by side share the row (\`lg:grid-cols-3\` with \`lg:col-span-2\` + one), a single
    chart or table takes the full width. Never leave an empty column or a tall empty area in a block.
  - Charts (recharts): \`<div className="h-64 md:h-72"><ResponsiveContainer width="100%" height="100%">\`
    (the parent needs a fixed height). One series is \`#171717\` (lines \`strokeWidth={1.5}\`, areas with
    \`fillOpacity={0.06}\`, bars \`radius={[3,3,0,0]}\` and \`maxBarSize={32}\`). A second series is
    \`#a3a3a3\`. More than two series only when needed: #171717, #2563eb, #a3a3a3, #f59e0b, #10b981.
    \`CartesianGrid vertical={false} stroke="#f0f0f0"\`, axes \`axisLine={false} tickLine={false}\` with
    \`tick={{ fontSize: 12, fill: '#737373' }}\`, \`dot={false}\`. Tooltip with
    \`contentStyle={{ borderRadius: 8, border: '1px solid #ebebeb', fontSize: 12, boxShadow: 'none' }}\`.
    Prefer direct labels or a small text legend over the recharts Legend. Format axis ticks.
  - Tables: full width of their section, \`w-full text-sm\`. Header cells
    \`py-2 text-left text-[13px] font-normal text-muted-foreground\`, rows \`border-t border-border\`,
    cells \`py-3\`. Numeric columns and their headers \`text-right tabular-nums\`. Ids in \`font-mono
    text-[13px]\`. Status as plain text with a 6px dot (\`inline-block size-1.5 rounded-full\`:
    paid \`bg-emerald-500\`, pending \`bg-amber-500\`, refunded \`bg-red-500\`).
  - Controls: segmented buttons \`h-8 rounded-md px-3 text-[13px]\`, selected \`bg-foreground
    text-background\`, others \`text-muted-foreground hover:text-foreground\`. Inputs \`h-8 rounded-md border
    border-border px-3 text-[13px]\`. Interactivity is welcome when it helps the user explore: range or
    metric switches, sortable headers, a search filter. Keep state local with useState.
  - Format with Intl: \`new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    maximumFractionDigits: 0 })\`, compact numbers with \`notation: 'compact'\`, dates with
    \`toLocaleDateString('en-US', { month: 'short', day: 'numeric' })\`.
  - Loading: gray blocks \`animate-pulse rounded-md bg-muted\` with the final size, never a spinner.

  ## Tools and workflow

  - \`write\` creates or replaces a whole file. \`edit\` replaces one exact, unique snippet of a file;
    use it for small changes to existing files. \`read\` and \`list\` show the current files.
  - Every \`write\`, \`edit\` and \`delete\` builds the project and returns \`{ ok: true }\` or the build
    errors. The user sees each successful build at once. If the build fails, fix it right away.
  - Write files bottom-up: components first, \`App.tsx\` last, so every build succeeds.
  - On follow-up requests, change only what the user asked for. Read a file before you edit it if you
    are not sure of its current content.
  - Do not ask questions. Make reasonable choices and build.
  - When you are done, reply with one or two short sentences about what the screen shows. Do not paste
    code in the reply.
`

const writeInput = z.object({
  path: z.string().describe('File path, for example App.tsx or components/revenue-chart.tsx'),
  content: z.string().describe('Full file content'),
})
const editInput = z.object({
  path: z.string(),
  oldString: z.string().describe('Exact text to replace. Must occur exactly once in the file.'),
  newString: z.string(),
})
const pathInput = z.object({ path: z.string() })

// Applies ops and builds. The output url is a live draft the client imports at once.
async function applyAndBuild(session: Session, ops: Parameters<Session['apply']>[0]['ops']) {
  await session.apply({ ops })
  const result = await session.build()
  if (!result.ok) return { ok: false as const, errors: result.errorText }
  return { ok: true as const, url: result.url }
}

export function createTools(session: Session) {
  return {
    write: tool({
      description: 'Create or overwrite a file, then build. Returns { ok, url } or the build errors.',
      inputSchema: writeInput,
      execute: ({ path, content }) => applyAndBuild(session, [{ op: 'write', path, content }]),
    }),
    edit: tool({
      description: 'Replace one exact occurrence of oldString in a file, then build.',
      inputSchema: editInput,
      execute: (input) => applyAndBuild(session, [{ op: 'replace', ...input }]),
    }),
    delete: tool({
      description: 'Delete a file, then build.',
      inputSchema: pathInput,
      execute: ({ path }) => applyAndBuild(session, [{ op: 'delete', path }]),
    }),
    read: tool({
      description: 'Read a file. Returns null if it does not exist.',
      inputSchema: pathInput,
      execute: ({ path }) => session.read({ path }),
    }),
    list: tool({
      description: 'List all project files.',
      inputSchema: z.object({}),
      execute: () => session.list(),
    }),
  }
}

export type DashboardUIMessage = UIMessage<
  unknown,
  { commit: { url: string } },
  InferUITools<ReturnType<typeof createTools>>
>

/** Model runs per chat turn: the first one, plus retries after a failed commit */
const MAX_COMMIT_ROUNDS = 3

const commitErrorPrompt = (errorText: string) => dedent`
  Your changes were not saved: the project does not build.

  ${errorText}

  Fix the errors with your tools. The changes are saved when the build passes.
`

function textOf(message: DashboardUIMessage | undefined) {
  return (message?.parts ?? []).flatMap((p) => (p.type === 'text' ? [p.text] : [])).join(' ')
}

/**
 * One chat turn: the agent edits the view's project with tools, each edit builds a draft the client
 * shows at once. At the end the session is committed and the immutable url is saved on the view.
 */
export async function runAgent({ viewId, messages }: { viewId: string; messages: DashboardUIMessage[] }) {
  const db = getDb()
  const view = await db.query.views.findFirst({ where: { viewId } })
  if (!view) return Response.json({ message: 'View not found' }, { status: 404 })

  const project = new Project({ endpoint: env.MALLEABLE_ENDPOINT, apiKey: env.MALLEABLE_API_KEY, id: view.projectId })
  await project.init()
  // one session per chat turn: parallel chats on the same view merge on commit
  const session = await project.openSession({ author: AGENT })
  await session.apply({
    ops: [
      {
        op: 'write',
        path: 'malleable.json',
        content: JSON.stringify({ entry: 'App.tsx', externalPackages: EXTERNAL_PACKAGES }, null, 2),
      },
    ],
  })

  const prompt = textOf(messages.findLast((m) => m.role === 'user'))
  if (view.title === 'Untitled view' && prompt) {
    await db
      .update(schema.views)
      .set({ title: prompt.slice(0, 60), updatedAt: new Date() })
      .where(orm.eq(schema.views.viewId, viewId))
      .limit(1)
  }

  const workersai = createWorkersAI({ binding: env.AI })
  const tools = createTools(session)

  const stream = createUIMessageStream<DashboardUIMessage>({
    originalMessages: messages,
    onError: (error) => (error instanceof Error ? error.message : String(error)),
    async execute({ writer }) {
      // Model-only history. Commit feedback (conflicts, build errors) goes here, never into the visible chat.
      const modelMessages = await convertToModelMessages(messages)
      for (let round = 0; ; round++) {
        const result = streamText({
          model: workersai(MODEL, { sessionAffinity: viewId }),
          instructions: SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
          reasoning: 'low',
          stopWhen: isStepCount(40),
        })
        // Every round extends the same assistant message: one start, one finish at the end
        const chunks = toUIMessageStream<typeof tools, DashboardUIMessage>({
          stream: result.stream,
          tools,
          sendStart: round === 0,
          sendFinish: false,
        })
        for await (const chunk of chunks) {
          writer.write(chunk)
        }
        modelMessages.push(...(await result.responseMessages))

        const commit = await session.commit({ message: prompt.slice(0, 200) || 'Update view' })
        if (commit.ok) {
          // also on noop: the session's draft urls die with it, the commit url does not
          writer.write({ type: 'data-commit', data: { url: commit.url } })
          await db
            .update(schema.views)
            .set({ componentUrl: commit.url, updatedAt: new Date() })
            .where(orm.eq(schema.views.viewId, viewId))
            .limit(1)
          break
        }
        const feedback = commit.reason === 'conflict' ? commit.prompt : commitErrorPrompt(commit.errorText)
        if (round === MAX_COMMIT_ROUNDS - 1) throw new Error(`Changes not saved:\n${feedback}`)
        // Another chat committed to this view meanwhile, or the merged code does not build: let the model fix it
        modelMessages.push({ role: 'user', content: feedback })
      }
      writer.write({ type: 'finish' })
    },
    // Save only this turn, appended after what other chats saved meanwhile. Rewriting the whole history
    // from this client's copy would erase turns of parallel chats on the same view.
    async onEnd({ responseMessage }) {
      const turn = [messages.findLast((m) => m.role === 'user'), responseMessage].flatMap((m) => (m ? [m] : []))
      const nextPosition = orm.sql<number>`(SELECT COALESCE(MAX(${schema.chatMessages.position}), -1) + 1 FROM ${schema.chatMessages} WHERE ${schema.chatMessages.viewId} = ${viewId})`
      const [first, ...rest] = turn.map((m) =>
        db
          .insert(schema.chatMessages)
          .values({ messageId: m.id, viewId, role: m.role, parts: m.parts, position: nextPosition })
          .onConflictDoUpdate({ target: schema.chatMessages.messageId, set: { parts: m.parts } }),
      )
      if (first) await db.batch([first, ...rest])
    },
  })
  return createUIMessageStreamResponse({ stream })
}
