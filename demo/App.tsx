import React, { useState, useRef, useEffect } from 'react'
import importMap from 'virtual:importmap'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { z } from 'zod'

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

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [bundledCode, setBundledCode] = useState('')
  const [css, setCss] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai-api-key') || '')
  const [PreviewComponent, setPreviewComponent] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    setupImportMap()
  }, [])

  const generateComponent = async () => {
    if (!apiKey) {
      const key = window.prompt('Please enter your OpenAI API key:')
      if (!key) return
      setApiKey(key)
      localStorage.setItem('openai-api-key', key)
    }

    setIsGenerating(true)
    try {
      const openai = createOpenAI({
        apiKey: apiKey || localStorage.getItem('openai-api-key')!,
      })

      const { textStream } = await streamText({
        model: openai('gpt-4o'),
        system: `You are an expert React developer. When asked to create a component, use the generate_component tool to output the code.
The component MUST:
- Use functional components with hooks
- Use Tailwind CSS classes for styling (including shadcn/ui theme colors like bg-primary, text-foreground, etc.)
- ALWAYS export the component as default with: export default ComponentName
- Include TypeScript types
- Be self-contained
- Use modern React patterns
- Import React at the top if needed`,
        prompt: prompt,
        tools: {
          generate_component: tool({
            description: 'Generate a React component with TypeScript and Tailwind CSS',
            inputSchema: z.object({
              code: z.string().describe('The complete React component code with TypeScript and Tailwind CSS')
            }),
            execute: async ({ code }) => {
              setCode(code)
              // Bundle the generated code
              await bundleAndRender(code)
              return { success: true }
            }
          })
        },
        toolChoice: 'required',
      })

      // Process the stream
      for await (const chunk of textStream) {
        // Tool calls are handled automatically by the execute function
        console.log('Streaming:', chunk)
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert('Error generating component. Please check your API key and try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const bundleAndRender = async (componentCode: string) => {
    try {
      const response = await fetch('https://remote-bundler.fumabase.com/api/bundle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{
            path: 'Component.tsx',
            content: componentCode
          }],
          externalPackages: ['react', 'react-dom', 'react/jsx-runtime']
        })
      })

      const result = await response.json() as any

      if (result.success) {
        setBundledCode(result.code)
        setCss(result.css)

        try {
          // Create a data URL for the module
          const moduleCode = result.code
          const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleCode)}`
          
          // Dynamically import the module
          const module = await import(/* @vite-ignore */ dataUrl)
          const Component = module.default
          
          // Set the component to render in preview
          if (Component) {
            setPreviewComponent(() => Component)
          }
        } catch (evalError) {
          console.error('Import error:', evalError)
          console.log('Bundled code:', result.code)
        }
      } else {
        console.error('Bundle error:', result.error)
      }
    } catch (error) {
      console.error('Bundle request error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-foreground">AI Component Builder</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Describe your component
                <span className="text-xs text-muted-foreground ml-2">(⌘+Enter to submit)</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    if (!isGenerating && prompt) {
                      generateComponent()
                    }
                  }
                }}
                className="w-full h-32 p-3 border border-input rounded-md bg-background text-foreground"
                placeholder="A beautiful card component with a title, description, and action button..."
              />
            </div>

            <button
              onClick={generateComponent}
              disabled={isGenerating || !prompt}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate Component'}
            </button>

            {code && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Generated Code</h3>
                <pre className="p-4 bg-muted rounded-md overflow-auto max-h-96">
                  <code className="text-sm text-muted-foreground">{code}</code>
                </pre>
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Preview</h3>
              <div className="border border-border rounded-md p-4 min-h-[400px] bg-card">
                {css && (
                  <style dangerouslySetInnerHTML={{ __html: css }} />
                )}
                {PreviewComponent && <PreviewComponent />}
              </div>
            </div>

            {bundledCode && (
              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Bundled Code
                </summary>
                <pre className="p-4 bg-muted rounded-md overflow-auto max-h-64 mt-2">
                  <code className="text-xs">{bundledCode}</code>
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
