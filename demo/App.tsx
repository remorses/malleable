import React, { useState, useRef, useEffect } from 'react'
import importMap from 'virtual:importmap'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'

// Setup import map in the document
function setupImportMap() {
  const existing = document.querySelector('script[type="importmap"]')
  if (!existing) {
    const mapScript = document.createElement('script')
    mapScript.type = 'importmap'
    mapScript.textContent = JSON.stringify(importMap, null, 2)
    document.head.append(mapScript)
  }
}

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [bundledCode, setBundledCode] = useState('')
  const [css, setCss] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai-api-key') || '')
  const previewRef = useRef<HTMLDivElement>(null)

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
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          apiKey: apiKey || localStorage.getItem('openai-api-key')
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate component')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullCode = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          fullCode += chunk
          setCode(fullCode)
        }
      }

      // Bundle the generated code
      await bundleAndRender(fullCode)
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

        // Create a function that returns the component
        const moduleCode = `
          ${result.code}
          return exports.default || exports;
        `

        try {
          // Evaluate the bundled code to get the component
          const ComponentModule = new Function('React', 'require', moduleCode)
          const Component = ComponentModule(React, (id: string) => {
            if (id === 'react') return React
            throw new Error(`Module ${id} not found`)
          })

          // Render the component in preview
          if (previewRef.current) {
            const root = ReactDOM.createRoot(previewRef.current)
            root.render(React.createElement(Component))
          }
        } catch (evalError) {
          console.error('Eval error:', evalError)
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
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
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
                <div ref={previewRef} />
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

// Import ReactDOM for rendering preview
import ReactDOM from 'react-dom/client'
