import './globals.css'
import { validateUIMessages } from 'ai'
import { Spiceflow } from 'spiceflow'
import { Head, ProgressBar } from 'spiceflow/react'
import { z } from 'zod'
import { runAgent, type DashboardUIMessage } from './agent.ts'
import { getDb } from './db.ts'
import { EmptyState, MobileNav, Sidebar } from './sidebar.tsx'
import { ViewEditor } from './view-editor.tsx'

type ViewLoaderData = {
  view: { viewId: string; title: string; componentUrl: string | null } | null
  messages: DashboardUIMessage[]
}

export const app = new Spiceflow()
  .loader('/*', async () => {
    const views = await getDb().query.views.findMany({ orderBy: { createdAt: 'desc' } })
    return { views: views.map((v) => ({ viewId: v.viewId, title: v.title })) }
  })
  .layout('/*', async ({ children, request, response }) => {
    if (children == null) response.status = 404
    return (
      <html lang="en">
        <Head>
          <Head.Meta charSet="UTF-8" />
          <Head.Meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <Head.Title>Acme Analytics · Malleable UI demo</Head.Title>
          <Head.Meta name="description" content="A dashboard where an AI agent builds new screens from a prompt." />
        </Head>
        {/* h-dvh, not h-screen: on iOS 100vh includes the area under the toolbar, so the bottom was cut off */}
        <body className="h-dvh overflow-hidden bg-white text-neutral-900 antialiased">
          <ProgressBar />
          <div className="flex h-full flex-col md:flex-row">
            <Sidebar />
            <MobileNav />
            <main className="relative min-h-0 min-w-0 flex-1">
              {children ?? (
                <EmptyState title="Page not found" description={`${request.parsedUrl.pathname} does not exist.`} />
              )}
            </main>
          </div>
        </body>
      </html>
    )
  })
  .page('/', async ({ loaderData, redirect }) => {
    const [latest] = loaderData.views
    if (latest) throw redirect(`/views/${latest.viewId}`)
    return <EmptyState title="No views yet" description="Create a view and describe what you want to see." />
  })
  .loader('/views/:viewId', async ({ params }): Promise<ViewLoaderData> => {
    const view = await getDb().query.views.findFirst({
      where: { viewId: params.viewId },
      with: { messages: { orderBy: { position: 'asc' } } },
    })
    if (!view) return { view: null, messages: [] }
    // `parts` was saved from validated UI messages
    const messages = view.messages.map((m) => ({ id: m.messageId, role: m.role, parts: m.parts }) as DashboardUIMessage)
    return { view: { viewId: view.viewId, title: view.title, componentUrl: view.componentUrl }, messages }
  })
  .page('/views/:viewId', async ({ loaderData, response }) => {
    if (!loaderData.view) {
      response.status = 404
      return <EmptyState title="View not found" description="It may have been deleted." />
    }
    return <ViewEditor key={loaderData.view.viewId} />
  })
  .route({
    method: 'POST',
    path: '/api/views/:viewId/chat',
    request: z.object({ messages: z.array(z.unknown()) }),
    async handler({ request, params }) {
      const body = await request.json()
      const messages = await validateUIMessages<DashboardUIMessage>({ messages: body.messages })
      return runAgent({ viewId: params.viewId, messages })
    },
  })

declare module 'spiceflow/react' {
  interface SpiceflowRegister {
    app: typeof app
  }
}

export default {
  fetch(request: Request) {
    return app.handle(request)
  },
} satisfies ExportedHandler<Env>
