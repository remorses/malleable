---
title: Embed generated screens in your app
description: Let users add new screens to your dashboard with your own AI SDK agent loop. Tools edit a Malleable UI project, the browser imports each build, your database stores the committed url.
---

# Embed generated screens in your app

Your users describe a screen. **Your** agent loop writes the React code with `@malleable/ui`, and your app renders each build as soon as it exists.

```
your browser app                       your server (AI SDK)                    malleableui.dev
useChat ──── POST /chat ─────────────▶ streamText({ tools })
                                         write / edit tool:
                                           session.apply ──────────────────────▶ project
                                           session.build ◀──── { ok, url } ─────
tool output.url ◀──── SSE ──────────────┘
import(url) ─▶ render                   end of turn: session.commit ───────────▶ git commit
                                         save commit.url in your database
```

A working example is in [`dashboard-demo/`](../dashboard-demo), deployed at https://demo.malleableui.dev. It uses spiceflow, D1 and Workers AI.

## 1. Tools

Write the tools yourself; they are a few lines each. Every tool that changes files also builds, so its output carries the url of a draft the browser can import.

```ts
import { Project, type Session } from '@malleable/ui'
import { tool } from 'ai'
import { z } from 'zod'

async function applyAndBuild(session: Session, ops: Parameters<Session['apply']>[0]['ops']) {
  await session.apply({ ops })
  const result = await session.build()
  if (!result.ok) return { ok: false as const, errors: result.errorText }  // the model fixes these
  return { ok: true as const, url: result.url }                         // absolute, importable
}

export function createTools(session: Session) {
  return {
    write: tool({
      description: 'Create or overwrite a file, then build',
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: ({ path, content }) => applyAndBuild(session, [{ op: 'write', path, content }]),
    }),
    edit: tool({
      description: 'Replace one exact occurrence of oldString, then build',
      inputSchema: z.object({ path: z.string(), oldString: z.string(), newString: z.string() }),
      execute: (input) => applyAndBuild(session, [{ op: 'replace', ...input }]),
    }),
    read: tool({
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      execute: ({ path }) => session.read({ path }),
    }),
  }
}
```

An `edit` whose `oldString` is missing throws `REPLACE_NOT_FOUND`. The AI SDK gives that error to the model, and the client sees the part as `output-error`.

## 2. Agent route

One chat turn is one session. Commit at the end and store the url: it is immutable, so later page loads only need `import(componentUrl)`.

```ts
const project = new Project({ apiKey: env.MALLEABLE_API_KEY, id: view.projectId })
await project.init()                                     // idempotent
const session = await project.openSession({ author: { kind: 'agent', id: 'dashboard-agent' } })
await session.apply({
  ops: [{ op: 'write', path: 'malleable.json', content: JSON.stringify({ entry: 'App.tsx', externalPackages }) }],
})

const stream = createUIMessageStream({
  originalMessages: messages,
  async execute({ writer }) {
    const modelMessages = await convertToModelMessages(messages)   // model-only history
    for (let round = 0; ; round++) {
      const result = streamText({ model, instructions: SYSTEM_PROMPT, messages: modelMessages, tools, stopWhen: isStepCount(40) })
      const chunks = toUIMessageStream({ stream: result.stream, tools, sendStart: round === 0, sendFinish: false })
      for await (const chunk of chunks) writer.write(chunk)
      modelMessages.push(...(await result.responseMessages))

      const commit = await session.commit({ message: prompt })
      if (commit.ok) {
        writer.write({ type: 'data-commit', data: { url: commit.url } })   // drafts end with the session
        await db.views.update({ where: { id: viewId }, data: { componentUrl: commit.url } })
        break
      }
      const feedback = commit.reason === 'conflict' ? commit.prompt : commit.errorText
      if (round === 2) throw new Error(`Changes not saved:\n${feedback}`)
      // hidden from the chat: the model fixes conflicts or build errors, then we commit again
      modelMessages.push({ role: 'user', content: feedback })
    }
    writer.write({ type: 'finish' })
  },
})
return createUIMessageStreamResponse({ stream })
```

**Two chats can edit the same view at once.** If another one committed first, `commit` merges. Overlapping edits come back as `{ reason: 'conflict', prompt }`; the session files then hold conflict markers. The AI SDK has no hidden user messages, so the prompt goes only into `modelMessages` and the user never sees it. The model fixes the markers with its `read` and `edit` tools.

Tell the model in the system prompt where its component renders (layout around it, overlays, padding), which props it gets, which imports exist, and your design rules. See `SYSTEM_PROMPT` in [`dashboard-demo/src/agent.ts`](../dashboard-demo/src/agent.ts).

## 3. Pass data as props

Generated code should not call your APIs directly. Pass a typed client as a prop and describe it in the system prompt:

```tsx
<Screen api={dashboardApi} />   // App.tsx: export default function App({ api }) { ... }
```

## 4. Share React through an import map

Built modules import externals bare (`import { useState } from 'react'`). The page needs a `<script type="importmap">` that points them to **your** bundled copies, or hooks break with two Reacts.

| Package | In `externalPackages` | In the import map |
|---|---|---|
| `react`, `react-dom`, `react/jsx-runtime` | yes | always |
| libraries you already ship (charts, icons) | optional, makes builds faster | yes, if external |

With spiceflow, React is in the map already. Add your libraries with `importMap`:

```ts
// vite.config.ts
spiceflow({
  entry: './src/app.tsx',
  importMap: {
    recharts: './src/import-map/recharts.ts',        // export * from 'recharts'
    'lucide-react': './src/import-map/lucide-react.ts',
  },
})
```

Every package in `externalPackages` must be in the import map, or `import()` fails with "Failed to resolve module specifier".

## 5. Render the latest build

Derive the url from the chat messages. No effects: the latest successful tool output or `data-commit` part wins.

```tsx
function previewUrl(messages: UIMessage[]) {
  const urls = messages.flatMap((m) => m.parts).flatMap((part) => {
    if (part.type === 'data-commit') return [part.data.url]
    if (['tool-write', 'tool-edit'].includes(part.type) && part.state === 'output-available' && part.output.ok)
      return [part.output.url]
    return []
  })
  return urls.at(-1)
}

const modules = new Map<string, Promise<{ default: ComponentType<{ api: Api }> }>>()
const load = (url: string) => modules.get(url) ?? modules.set(url, import(/* @vite-ignore */ url)).get(url)!

function Screen({ url }: { url: string }) {
  const View = use(load(url)).default
  return <View api={dashboardApi} />
}

// in the editor component
const url = useDeferredValue(previewUrl(messages) ?? view.componentUrl)  // old screen stays while the new one loads
return (
  <ErrorBoundary key={url}>
    <Suspense fallback={<Spinner />}>{url && <Screen url={url} />}</Suspense>
  </ErrorBoundary>
)
```

Render `<Screen>` only in the browser: the import map does not exist during SSR.

## Gotchas

- **Builds check syntax, not types.** A missing import builds fine and throws at render. Key the error boundary by url so the next build retries, and offer a "fix it" message to the agent.
- **Drafts disappear when the session ends.** Store and reload the commit url, not draft urls.
- **The generated CSS is scoped.** It sits in `@scope ([data-malleable-root])`, and the entry wraps the component in a `display: contents` element with that attribute. Utilities never touch host elements, and theme variables live on the scope root, not `:root`. Needs Safari 17.4, Chrome 118, Firefox 146. Inside the view, generated utilities beat host utilities with the same name.
- **Theme the views from the host** with the shadcn variables on `:root` (`--background`, `--foreground`, `--border`, `--muted-foreground`, `--primary`... as `h s% l%`). Set fonts on `body`: the generated `--font-sans` exists only inside the view.
- **Mobile Safari:** use `h-dvh`, not `h-screen`, for a full-height shell, and pad fixed bottom UI with `env(safe-area-inset-bottom)`. Inputs under 16px make iOS zoom on focus.
- **Tailwind v4 borders are `currentColor`.** Tell the model to pair `border` with a color class (`border-border`).
- **`import()` runs the agent's code in your page.** Fine for trusted admins. For untrusted prompts, render in a sandboxed iframe.
