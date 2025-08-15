import React, { useEffect } from 'react'
import { LiveAPIClient } from '../src/liveapi/live-api-client'
import { callableToolsFromObject } from '../src/liveapi/ai-tool-to-genai'
import { tool } from 'ai'
import { z } from 'zod'
import { useStore } from './store'
import type { BundleResult } from '../src/types.js'
import type { BundleInput } from '../src/worker.js'
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

// Tools definition
const tools = {
  generate_component: tool({
    description: 'Generate a React component with TypeScript and Tailwind CSS',
    inputSchema: z.object({
      code: z
        .string()
        .describe(
          'The complete React component code with TypeScript and Tailwind CSS',
        ),
    }),
    execute: async ({ code }) => {
      // Set isGenerating to true when tool is called
      useStore.setState({ code, isGenerating: true })
      console.log(`llm triggered generate code tool`, code)
      await bundleAndRender(code)
      // Set isGenerating to false after bundling
      useStore.setState({ isGenerating: false })
      return { success: true }
    },
  }),
}

// Bundle and render function
const bundleAndRender = async (componentCode: string) => {
  try {
    const response = await fetch(
      'https://remote-bundler.fumabase.com/api/bundle',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [
            {
              path: 'Component.tsx',
              content: componentCode,
            },
          ],
          externalPackages: ['react', 'react-dom', 'react/jsx-runtime'],
          siteId: 'example',
          prerenderDebounceTime: 1000 * 5,
        } satisfies BundleInput),
      },
    )

    const result = (await response.json()) as BundleResult

    if (result.success) {
      try {
        const importUrl = result.jsUrl

        // Dynamically import the module
        // Add a timestamp query to bust cache
        const urlWithTimestamp = new URL(importUrl)
        urlWithTimestamp.searchParams.set('t', Date.now().toString())
        const module = await import(/* @vite-ignore */ urlWithTimestamp.toString())
        const Component = module.default

        // Set the component to render in preview
        if (Component) {
          useStore.setState({ previewComponent: Component })
        }
      } catch (evalError) {
        console.error('Import error:', evalError)
      }
    } else {
      console.error('Bundle error:', result.error)
    }
  } catch (error) {
    console.error('Bundle request error:', error)
  }
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
}

const liveClient =
  globalThis.client ||
  new LiveAPIClient({
    apiKey,

    config: {
      tools: callableToolsFromObject(tools),
      responseModalities: [Modality.AUDIO],
            systemInstruction: {
              parts: [
                {
                  text: `You are an expert React developer. When asked to create a component, use the generate_component tool to output the code.
      The component MUST:
      - Use functional components with hooks
      - Use Tailwind CSS classes for styling (including shadcn/ui theme colors like bg-primary, text-foreground, etc.)
      - ALWAYS export the component as default with: export default ComponentName. do not use any props
      - Use js or typescript
      - Be self-contained
      - Use modern React patterns
      - Import React at the top if needed

      do not use props. create a modern styled and rich component

      the goal is to create beautiful components following user query. do not create too simple components`,
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
    previewComponent: PreviewComponent,
  } = useStore()

  useEffect(() => {
    setupImportMap()
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

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {/* Input Section */}
          <div className='space-y-4'>
            {/* Status indicator */}
            {isGenerating && (
              <div className='p-3 bg-primary/10 rounded-md'>
                <span className='text-sm text-primary'>
                  Generating component...
                </span>
              </div>
            )}

            {/* Generated Code */}
            <div>
              <h3 className='text-lg font-semibold mb-2 text-foreground'>
                Generated Code
              </h3>
              <textarea
                value={code}
                onChange={(e) => useStore.setState({ code: e.target.value })}
                className='w-full h-64 p-3 border border-input rounded-md bg-muted font-mono text-sm'
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
          </div>

          {/* Preview Section */}
          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-semibold mb-2 text-foreground'>
                Preview
              </h3>

              <div className='border border-border rounded-md p-4 min-h-[400px] bg-card flex flex-col items-center justify-center'>
                {PreviewComponent && <PreviewComponent />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
