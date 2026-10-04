'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowUp, Loader2, Square } from 'lucide-react'
import {
  Component,
  Suspense,
  use,
  useDeferredValue,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react'
import { router, useLoaderData } from 'spiceflow/react'
import type { DashboardUIMessage } from './agent.ts'
import { dashboardApi, type DashboardApi } from './dashboard-api.ts'

type ScreenModule = { default: ComponentType<{ api: DashboardApi }> }

// ── loading generated modules ──

// Generated modules import 'react', 'recharts'... bare. The import map spiceflow injects in the HTML
// (see vite.config.ts) resolves them to the host chunks. One promise per url, so Suspense can reuse it.
const modules = new Map<string, Promise<ScreenModule>>()
function loadScreen(url: string) {
  let promise = modules.get(url)
  if (!promise) {
    promise = import(/* @vite-ignore */ url) as Promise<ScreenModule>
    modules.set(url, promise)
  }
  return promise
}

function Screen({ url }: { url: string }) {
  const { default: View } = use(loadScreen(url))
  return <View api={dashboardApi} />
}

class ScreenErrorBoundary extends Component<
  { children: ReactNode; onFix: (error: string) => void },
  { error?: Error }
> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="mx-auto mt-24 max-w-lg px-6 text-sm">
        <p className="font-medium">This screen crashed</p>
        <pre className="mt-2 rounded-md bg-neutral-50 p-3 text-xs whitespace-pre-wrap text-neutral-600">{error.message}</pre>
        <button
          type="button"
          onClick={() => this.props.onFix(error.message)}
          className="mt-3 h-8 rounded-md bg-neutral-900 px-3 text-[13px] font-medium text-white hover:bg-neutral-700"
        >
          Ask the agent to fix it
        </button>
      </div>
    )
  }
}

// ── deriving state from the chat ──

const FILE_TOOLS = new Set(['tool-write', 'tool-edit', 'tool-delete'])

type PreviewEvent = { url?: string; error?: string; entry?: boolean }

/** File tool outputs carry a draft url or build errors; `data-commit` carries the committed url. */
function previewEvent(part: DashboardUIMessage['parts'][number]): PreviewEvent[] {
  if (part.type === 'data-commit') return [{ url: part.data.url, entry: true }]
  if (!FILE_TOOLS.has(part.type) || !('state' in part)) return []
  if (part.state === 'output-error') return [{ error: part.errorText ?? 'Tool failed' }]
  if (part.state !== 'output-available') return []
  const output = part.output as { ok: true; url: string } | { ok: false; errors: string }
  if (!output.ok) return [{ error: output.errors }]
  return [{ url: output.url, entry: (part.input as { path?: string }).path === 'App.tsx' }]
}

/**
 * Latest url that built, plus the error if the most recent event failed. Before anything was
 * committed, drafts show only once App.tsx was written: earlier builds still render the starter app.
 */
function previewState(messages: DashboardUIMessage[], committed: boolean) {
  const events = messages.flatMap((m) => m.parts.flatMap(previewEvent))
  const firstEntry = committed ? 0 : events.findIndex((e) => e.entry)
  const url = firstEntry === -1 ? undefined : events.slice(firstEntry).findLast((e) => e.url)?.url
  return { url, error: events.at(-1)?.error }
}

/** Short description of what the agent is doing, from the last part of the last message */
function activity(messages: DashboardUIMessage[]) {
  const last = messages.at(-1)
  if (last?.role !== 'assistant') return 'Thinking…'
  const part = last.parts.at(-1)
  if (!part) return 'Thinking…'
  if (part.type === 'text') return part.text.slice(-160) || 'Thinking…'
  if (part.type === 'reasoning') return 'Thinking…'
  if (part.type.startsWith('tool-') && 'input' in part) {
    const path = (part.input as { path?: string } | undefined)?.path ?? ''
    const verb = { 'tool-write': 'Writing', 'tool-edit': 'Editing', 'tool-delete': 'Deleting', 'tool-read': 'Reading' }[
      part.type
    ]
    if (verb) return part.state === 'output-available' && verb !== 'Reading' ? `Built ${path}` : `${verb} ${path}`
    return 'Looking at the files'
  }
  return 'Working…'
}

function lastAssistantText(messages: DashboardUIMessage[]) {
  const last = messages.findLast((m) => m.role === 'assistant')
  return last?.parts.findLast((p) => p.type === 'text')?.text
}

// The module import only works in the browser, where the import map exists
const subscribeNever = () => () => {}
function useIsBrowser() {
  return useSyncExternalStore(subscribeNever, () => true, () => false)
}

// ── UI ──

function PromptBox({
  onSubmit,
  onStop,
  busy,
  placeholder,
  autoFocus,
}: {
  onSubmit: (text: string) => void
  onStop: () => void
  busy: boolean
  placeholder: string
  autoFocus?: boolean
}) {
  const [text, setText] = useState('')
  const submit = () => {
    const value = text.trim()
    if (!value || busy) return
    onSubmit(value)
    setText('')
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-end gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 pl-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-within:border-neutral-400"
    >
      <textarea
        data-testid="prompt"
        value={text}
        autoFocus={autoFocus}
        rows={1}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-neutral-400 md:text-sm"
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
        >
          <Square className="size-3.5 fill-current" />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim()}
          className="flex size-8 items-center justify-center rounded-lg bg-neutral-900 text-white transition-colors hover:bg-neutral-700 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          <ArrowUp className="size-4" />
        </button>
      )}
    </form>
  )
}

const SUGGESTIONS = [
  'Revenue overview with KPIs, monthly revenue vs expenses chart and recent orders',
  'Traffic sources: visitors and conversion rate by channel, with a pie chart',
  'Product performance table, sortable, with a bar chart of top products',
]

export function ViewEditor() {
  const { view, messages: initialMessages } = useLoaderData('/views/:viewId')
  if (!view) throw new Error('ViewEditor needs a view')
  const { messages, sendMessage, status, stop, error } = useChat<DashboardUIMessage>({
    id: view.viewId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: `/api/views/${view.viewId}/chat` }),
    // The server renamed the view and saved the commit: reload loader data for the sidebar
    onFinish: () => router.refresh(),
  })

  const isBrowser = useIsBrowser()
  const busy = status === 'submitted' || status === 'streaming'
  const preview = previewState(messages, view.componentUrl !== null)
  const url = useDeferredValue(preview.url ?? view.componentUrl ?? undefined)
  const send = (text: string) => sendMessage({ text })

  // Empty view: centered prompt
  if (!url && messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 md:px-8">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">What do you want to see?</h1>
            <p className="mt-2 text-sm text-neutral-500">Describe a screen. An agent builds it from your data.</p>
          </div>
          <PromptBox onSubmit={send} onStop={stop} busy={busy} placeholder="Describe a new view…" autoFocus />
          <div className="mt-6 flex flex-col divide-y divide-neutral-100">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="py-2.5 text-left text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const status_ = busy ? activity(messages) : (error?.message ?? preview.error ?? lastAssistantText(messages))

  // First prompt sent, no component yet: spinner
  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center md:px-8">
        {busy ? (
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        ) : null}
        <p data-testid="agent-status" className="max-w-md text-sm text-neutral-500">
          {busy ? status_ : (status_ ?? 'The agent stopped before building a screen.')}
        </p>
        {!busy && (
          <div className="w-full max-w-2xl">
            <PromptBox onSubmit={send} onStop={stop} busy={busy} placeholder="Try again…" />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="h-full overflow-y-auto" data-testid="screen">
        {isBrowser && (
          <ScreenErrorBoundary key={url} onFix={(e) => send(`The screen crashed with this error, fix it:\n${e}`)}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-neutral-400" />
                </div>
              }
            >
              <Screen url={url} />
            </Suspense>
          </ScreenErrorBoundary>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8 md:pb-6">
        {status_ && (
          <div
            data-testid="agent-status"
            className={`pointer-events-auto flex w-full max-w-2xl items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              !busy && (error || preview.error)
                ? 'border-red-200 bg-white text-red-700'
                : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            {busy && <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />}
            <span className="line-clamp-3 whitespace-pre-wrap">{status_}</span>
          </div>
        )}
        <div className="pointer-events-auto w-full max-w-2xl">
          <PromptBox onSubmit={send} onStop={stop} busy={busy} placeholder="Ask for a change…" />
        </div>
      </div>
    </>
  )
}
