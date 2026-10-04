import React, { useEffect, useRef } from 'react'
import { LiveAPIClient } from '../src/liveapi/live-api-client'
import { callableToolsFromObject } from '../src/liveapi/ai-tool-to-genai'
import { LiveMessageAssembler } from '../src/liveapi/genai-to-ui-message'
import { tool } from 'ai'
import { z } from 'zod'
import { useStore, type PreviewModule } from './store'
import { Project, type Session } from '../src/client'
import type { UIMessage } from 'ai'
import type { LiveServerMessage } from '@google/genai'
import importMap from 'virtual:importmap'
import { Modality } from '@google/genai'

// Setup import map in the document
function setupImportMap() {
  const existing = document.querySelector('script[type="importmap"]')
  if (!existing) {
    const mapScript = document.createElement('script')
    mapScript.type = 'importmap'
    mapScript.textContent = JSON.stringify(importMap, null, 2)
    document.head.append(mapScript as any)
  }
}

// Project on the Malleable UI worker. Files live in an Artifacts git repo, one commit per agent message.
const ENDPOINT = 'https://malleableui.dev'
const projectId =
  localStorage.getItem('malleable-project') ||
  (() => {
    const id = `demo-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem('malleable-project', id)
    return id
  })()
const malleableKey =
  localStorage.getItem('malleable-key') ||
  (() => {
    const key = window.prompt('Please enter your Malleable UI API key:') || ''
    localStorage.setItem('malleable-key', key)
    return key
  })()
const project = new Project({ endpoint: ENDPOINT, apiKey: malleableKey, id: projectId })

const projectReady = project.init()

// One open session per agent message: opened on the first edit, committed when the turn completes
let session: Promise<Session> | undefined
function getSession() {
  session ??= projectReady.then(() =>
    project.openSession({ author: { kind: 'agent', id: 'gemini-live' } }),
  )
  return session
}

async function refreshHistory() {
  useStore.setState({ history: await project.log({ limit: 20 }) })
}

async function commitTurn() {
  if (!session) return
  const s = await session
  session = undefined
  const res = await s.commit({ message: `AI edit ${new Date().toLocaleTimeString()}` })
  if (!res.ok && res.reason === 'build-error') {
    console.error('commit blocked by build error', res.errorText)
    await s.discard()
  }
  await refreshHistory()
}

// ── preview: keep the last working version when a new one fails to import or render ──

/** A new module replaces the shown one; the shown one becomes the fallback unless it failed */
function showModule(next: PreviewModule) {
  useStore.setState(({ preview }) => {
    const shownWorks = preview.shown && preview.shown.url !== preview.error?.url
    return { preview: { shown: next, fallback: shownWorks ? preview.shown : preview.fallback, error: null } }
  })
}

/** The module at `url` threw while importing or rendering: go back to the fallback */
function previewFailed(url: string, error: Error) {
  console.error(`preview ${url} failed`, error)
  useStore.setState(({ preview }) => {
    const failed = { url, message: error.message }
    // an import error of a module never shown leaves the preview as is
    if (preview.shown?.url !== url) return { preview: { ...preview, error: failed } }
    // the fallback itself failed: nothing safe is left to show
    const fallback = preview.fallback?.url === url ? null : preview.fallback
    return { preview: { shown: fallback, fallback, error: failed } }
  })
}

/** Catches render and effect errors of one module. Keyed by url so every module starts clean. */
class PreviewBoundary extends React.Component<
  { module: PreviewModule },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    previewFailed(this.props.module.url, error)
  }
  render() {
    const { Component } = this.props.module
    return this.state.failed ? null : <Component />
  }
}

// Viewers render whatever the project socket says: drafts while the agent works, commits after.
// The same socket would update any other open tab.
project.watch({
  onMessage: async (msg) => {
    const show = async (url: string) => {
      // module urls are relative to the Worker origin
      const mod = await import(/* @vite-ignore */ new URL(url, ENDPOINT).href).catch((e: Error) => e)
      if (mod instanceof Error) return previewFailed(url, mod)
      showModule({ url, Component: mod.default })
    }
    if (msg.type === 'hello') {
      if (msg.heads.main) await show(`/p/${projectId}/r/${msg.heads.main}/index.js`)
    } else if (msg.type === 'update') {
      await show(msg.url)
    } else if (msg.type === 'build-error') {
      console.error(msg.errors.map((e) => e.text).join('\n'))
    }
  },
})
projectReady.then(refreshHistory)

// Tools definition
const tools = {
  edit_file: tool({
    description: 'Edit or create a file. Pass empty string as oldString to replace entire file content. Use content parameter to create new file or replace existing one.',
    inputSchema: z.object({
      path: z.string().describe('The file path (e.g., App.tsx, Button.tsx, utils.ts). App.tsx is the main entry point.'),
      content: z.string().optional().describe('Full content for creating new file or replacing existing one entirely'),
      oldString: z.string().optional().describe('String to find and replace. Pass empty string "" to replace entire file content with newString'),
      newString: z.string().optional().describe('String to replace with. When oldString is empty "", this becomes the entire file content'),
    }),
    execute: async ({ path, content, oldString, newString }) => {
      useStore.setState({ isGenerating: true })
      const s = await getSession()

      if (content !== undefined || (oldString === '' && newString !== undefined)) {
        await s.apply({ ops: [{ op: 'write', path, content: (content ?? newString)! }] })
      } else if (oldString !== undefined && newString !== undefined) {
        await s.apply({ ops: [{ op: 'replace', path, oldString, newString }] })
      } else {
        throw new Error('Either content or both oldString and newString must be provided')
      }

      if (path === 'App.tsx') useStore.setState({ code: (await s.read({ path })) ?? '' })

      // Draft build: viewers (this page included) get an `update` message from the socket
      const build = await s.build()
      useStore.setState({ isGenerating: false })
      if (!build.ok) return { success: false, error: build.errorText }
      return { success: true, files: await s.list() }
    },
  }),
}

// Ask for API key and create LiveAPI client at global scope
let apiKey = localStorage.getItem('google-api-key') || ''

if (!apiKey) {
  const key = window.prompt('Please enter your Google API key:')
  if (key) {
    apiKey = key
    useStore.setState({ apiKey: key })
  }
}

declare global {
  // Add LiveAPIClient to globalThis for TypeScript
  // eslint-disable-next-line no-var
  var client: LiveAPIClient | undefined
  // eslint-disable-next-line no-var
  var messageAssembler: LiveMessageAssembler | undefined
  // eslint-disable-next-line no-var
  var allMessages: LiveServerMessage[] | undefined
}

// Create message assembler instance
const messageAssembler = globalThis.messageAssembler || new LiveMessageAssembler()
globalThis.messageAssembler = messageAssembler

// Initialize global messages array
globalThis.allMessages = globalThis.allMessages || []

const liveClient =
  globalThis.client ||
  new LiveAPIClient({
    apiKey,

    onMessage: (message: LiveServerMessage) => {
      // Store message in global variable
      globalThis.allMessages = globalThis.allMessages || []
      globalThis.allMessages.push(message)
      
      if (message.serverContent?.turnComplete) void commitTurn()

      // Process the message and get all current UI messages
      const allMessages = messageAssembler.processMessage(message)

      // Set the complete message history (not accumulating with previous state)
      useStore.setState({
        uiMessages: [...allMessages]
      })
    },

    config: {
      tools: callableToolsFromObject(tools),
      responseModalities: [Modality.AUDIO],
      systemInstruction: {
        parts: [
          {
            text: `You are an expert React developer. You can create and edit files using the edit_file tool.

IMPORTANT FILE STRUCTURE:
- App.tsx is the MAIN ENTRY POINT and must ALWAYS have a default export
- Other files (Button.tsx, Card.tsx, utils.ts, etc.) can contain helper components and utilities
- App.tsx can import and use components from other files

For creating a new file or replacing entire content:
- Use the 'content' parameter with the full file content
- OR use oldString="" (empty string) and newString with the full content

For editing an existing file:
- Use 'oldString' and 'newString' parameters for string replacement
- Make sure the oldString exactly matches what's in the file
- Pass oldString="" (empty string) to replace the entire file with newString

App.tsx Requirements:
- MUST always have a default export
- Should be the main component that renders the application
- Can import and compose other components from separate files
- Use functional components with hooks
- Use Tailwind CSS classes for styling
- Use modern React patterns

Examples:

1. Creating the main App.tsx:
\`\`\`
print(
    default_api.edit_file(
        path="App.tsx",
        content="""
import React from 'react';
import Button from './Button';

const App = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">My App</h1>
      <Button />
    </div>
  );
};

export default App;
"""
    )
)
\`\`\`

2. Creating a separate component file:
\`\`\`
print(
    default_api.edit_file(
        path="Button.tsx",
        content="""
import React from 'react';

const Button = () => {
  return (
    <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
      Click me
    </button>
  );
};

export default Button;
"""
    )
)
\`\`\`

3. Replacing entire file content using empty oldString:
\`\`\`
print(
    default_api.edit_file(
        path="App.tsx",
        oldString="",
        newString="""
import React from 'react';

const App = () => {
  return <div>New content</div>;
};

export default App;
"""
    )
)
\`\`\`

4. Editing part of a file:
\`\`\`
print(
    default_api.edit_file(
        path="App.tsx",
        oldString="Click me",
        newString="Submit"
    )
)
\`\`\`

Remember: Always ensure App.tsx has a default export as it's the entry point!
`,
          },
        ],
      },
    },
    onStateChange: (state) => {
      // Update zustand store with LiveAPI state (excluding volumes)
      useStore.setState({
        connected: state.connected,
        muted: state.muted,
        logs: state.logs,
      })
    },
  })
globalThis.client = liveClient

export default function App() {
  const {
    connected,
    logs,
    code,
    isGenerating,
    preview,
    history,
    uiMessages,
  } = useStore()

  useEffect(() => {
    setupImportMap()
  }, [])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check for Cmd+C (Mac) or Ctrl+C (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        // Check if something is selected (to not interfere with normal copy)
        const selection = window.getSelection()
        if (!selection || selection.toString().length === 0) {
          e.preventDefault()
          
          // Clone messages and remove base64 data
          const messagesToCopy = globalThis.allMessages?.map(msg => {
            const cloned = JSON.parse(JSON.stringify(msg))
            
            // Remove base64 data from serverContent
            if (cloned.serverContent?.modelTurn?.parts) {
              cloned.serverContent.modelTurn.parts = cloned.serverContent.modelTurn.parts.map((part: any) => {
                if (part.inlineData?.data) {
                  return {
                    ...part,
                    inlineData: {
                      ...part.inlineData,
                      data: '[BASE64_DATA_REMOVED]'
                    }
                  }
                }
                return part
              })
            }
            
            return cloned
          }) || []
          
          // Copy to clipboard
          navigator.clipboard.writeText(JSON.stringify(messagesToCopy, null, 2))
            .then(() => {
              console.log('Messages copied to clipboard (base64 data removed)')
              // Add a temporary log entry to show it was copied
              useStore.setState(state => ({ 
                logs: [...state.logs, `[${new Date().toLocaleTimeString()}] Messages copied to clipboard`]
              }))
            })
            .catch(err => {
              console.error('Failed to copy messages:', err)
            })
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const handleConnect = async () => {
    await liveClient.connect()
  }

  const handleDisconnect = () => {
    liveClient.disconnect()
  }

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto p-4'>
        <h1 className='text-3xl font-bold mb-6 text-foreground'>
          AI Component Builder (Live API)
        </h1>

        {/* Connection Status */}
        <div className='mb-4 flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <div
              className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className='text-sm text-muted-foreground'>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {!connected ? (
            <button
              onClick={handleConnect}
              className='px-3 py-1 bg-primary text-primary-foreground rounded text-sm'
            >
              Connect
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className='px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm'
            >
              Disconnect
            </button>
          )}
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Input Section - takes 1/3 */}
          <div className='space-y-4'>
            {/* Generated Code */}
            <div>
              <h3 className='text-lg font-semibold mb-2 text-foreground'>
                Generated Code
              </h3>
              <textarea
                value={code}
                onChange={(e) => useStore.setState({ code: e.target.value })}
                className='w-full h-48 p-3 border border-input rounded-md bg-muted font-mono text-sm'
                placeholder='Generated code will appear here...'
              />
            </div>

            {/* Logs */}
            <div>
              <div className='flex justify-between items-center mb-2'>
                <h3 className='text-lg font-semibold text-foreground'>
                  Live API Logs
                </h3>
                <button
                  onClick={() => useStore.setState({ logs: [] })}
                  className='text-xs text-muted-foreground hover:text-foreground'
                >
                  Clear
                </button>
              </div>
              <pre className='p-3 bg-muted rounded-md overflow-auto h-48 text-xs font-mono'>
                {logs.length > 0 ? logs.join('\n') : 'No logs yet...'}
              </pre>
            </div>

            {/* UI Messages */}
            <div>
              <div className='flex justify-between items-center mb-2'>
                <h3 className='text-lg font-semibold text-foreground'>
                  UI Messages
                </h3>
                <button
                  onClick={() => {
                    messageAssembler.clear()
                    useStore.setState({ uiMessages: [] })
                  }}
                  className='text-xs text-muted-foreground hover:text-foreground'
                >
                  Clear
                </button>
              </div>
              <pre className='p-3 bg-muted rounded-md overflow-auto h-48 text-xs font-mono'>
                {uiMessages.length > 0
                  ? JSON.stringify(uiMessages, null, 2)
                  : 'No UI messages yet...'}
              </pre>
            </div>
          </div>

          {/* Preview Section - takes 2/3 */}
          <div className='space-y-4 lg:col-span-2'>
            <div>
              <h3 className='text-lg font-semibold mb-2 text-foreground'>
                Preview
              </h3>

              <div className='border border-border rounded-md p-4 min-h-[500px] bg-card flex flex-col items-center justify-center'>
                {preview.error && (
                  <p className='text-sm text-destructive mb-2'>
                    Latest version failed, showing the previous one: {preview.error.message}
                  </p>
                )}
                {preview.shown && <PreviewBoundary key={preview.shown.url} module={preview.shown} />}
              </div>
            </div>

            {/* History: every agent message is one commit */}
            <div>
              <div className='flex justify-between items-center mb-2'>
                <h3 className='text-lg font-semibold text-foreground'>History</h3>
                <button
                  onClick={async () => {
                    await project.undo()
                    await refreshHistory()
                  }}
                  className='px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm'
                >
                  Undo last change
                </button>
              </div>
              <ul className='text-sm space-y-1'>
                {history.map((c) => (
                  <li key={c.sha} className='flex justify-between gap-2'>
                    <span className='truncate'>{c.message}</span>
                    <button
                      className='text-xs text-muted-foreground hover:text-foreground'
                      onClick={async () => {
                        await project.restore({ sha: c.sha })
                        await refreshHistory()
                      }}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
