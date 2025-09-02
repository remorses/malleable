import React, { useEffect, useRef } from 'react'
import { LiveAPIClient } from '../src/liveapi/live-api-client'
import { callableToolsFromObject } from '../src/liveapi/ai-tool-to-genai'
import { LiveMessageAssembler } from '../src/liveapi/genai-to-ui-message'
import { tool } from 'ai'
import { z } from 'zod'
import { useStore } from './store'
import type { BundleResult } from '../src/types.js'
import type { BundleInput } from '../src/worker.js'
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

// File storage in memory
const fileStorage: Record<string, string> = {
  'App.tsx': ''
}

// Tools definition
const tools = {
  edit_file: tool({
    description: 'Edit or create a file in memory. Pass empty string as oldString to replace entire file content. Use content parameter to create new file or replace existing one.',
    inputSchema: z.object({
      path: z.string().describe('The file path (e.g., App.tsx, Button.tsx, utils.ts). App.tsx is the main entry point.'),
      content: z.string().optional().describe('Full content for creating new file or replacing existing file entirely'),
      oldString: z.string().optional().describe('String to find and replace. Pass empty string "" to replace entire file content with newString'),
      newString: z.string().optional().describe('String to replace with. When oldString is empty "", this becomes the entire file content'),
    }),
    execute: async ({ path, content, oldString, newString }) => {
      // Set isGenerating to true when tool is called
      useStore.setState({ isGenerating: true })
      
      // Handle file creation or full replacement
      if (content !== undefined) {
        fileStorage[path] = content
        console.log(`File created/replaced: ${path}`)
      } 
      // Handle string replacement
      else if (oldString !== undefined && newString !== undefined) {
        // Empty oldString means replace entire file content
        if (oldString === '') {
          fileStorage[path] = newString
          console.log(`File content replaced: ${path}`)
        } else {
          if (!fileStorage[path]) {
            throw new Error(`File ${path} does not exist`)
          }
          if (!fileStorage[path].includes(oldString)) {
            throw new Error(`String not found in ${path}`)
          }
          fileStorage[path] = fileStorage[path].replace(oldString, newString)
          console.log(`String replaced in ${path}`)
        }
      } else {
        throw new Error('Either content or both oldString and newString must be provided')
      }
      
      // Update the code display if it's the main app
      if (path === 'App.tsx') {
        useStore.setState({ code: fileStorage[path] })
      }
      
      // Bundle all files after edit
      await bundleAndRender()
      
      // Set isGenerating to false after bundling
      useStore.setState({ isGenerating: false })
      return { success: true, files: Object.keys(fileStorage) }
    },
  }),
}

// Bundle and render function
const bundleAndRender = async () => {
  // Convert fileStorage to files array
  const files = Object.entries(fileStorage)
    .filter(([_, content]) => content.trim() !== '')
    .map(([path, content]) => ({ path, content }))
  
  if (files.length === 0) {
    console.log('No files to bundle')
    return
  }
  
  const response = await fetch(
    'https://remote-bundler.fumabase.com/api/bundle',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files,
        entryPoint: 'App.tsx',
        externalPackages: ['react', 'react-dom', 'react/jsx-runtime'],
        siteId: 'example',
        prerenderDebounceTime: 1000 * 5,
      } satisfies BundleInput),
    },
  )

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const result = (await response.json()) as BundleResult

  if (result.success) {
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
    previewComponent: PreviewComponent,
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
                {PreviewComponent && <PreviewComponent />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
