// Plays the role of an agent: edits a project in two "messages", one commit each.
// Usage: MALLEABLE_API_KEY=... pnpm tsx examples/agent.ts <projectId> [endpoint]
import { Project } from '../src/client.ts'

const [projectId = 'example', endpoint = 'https://remote-bundler.fumabase.com'] = process.argv.slice(2)
const apiKey = process.env.MALLEABLE_API_KEY!
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const project = new Project({ endpoint, apiKey, id: projectId })
console.log('init', (await project.init()).heads)
console.log(`open ${endpoint}/view/${projectId}`)

async function message(text: string, files: Record<string, string>) {
  const session = await project.openSession({ author: { kind: 'agent', id: 'example-agent' } })
  for (const [path, content] of Object.entries(files)) {
    await session.apply({ ops: [{ op: 'write', path, content }] })
    console.log('draft', path, await session.build())
    await sleep(1500)
  }
  console.log('commit', await session.commit({ message: text }))
}

await message('Add revenue card', {
  'App.tsx': `import { useState } from 'react'
export default function App() {
  const [n, setN] = useState(0)
  return (
    <div className="p-8 space-y-4">
      <h1 data-testid="title" className="text-2xl font-bold">Revenue: $12,400</h1>
      <button data-testid="inc" className="px-3 py-1 rounded bg-blue-500 text-white" onClick={() => setN(n + 1)}>
        clicks {n}
      </button>
    </div>
  )
}`,
})

await sleep(2000)
await message('Make it green', {
  'App.tsx': `export default function App() {
  return <div className="p-8"><h1 data-testid="title" className="text-2xl font-bold text-green-600">Revenue: $13,900</h1></div>
}`,
})
