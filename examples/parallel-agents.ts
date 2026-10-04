// Two agents edit the same screen at once. Disjoint edits merge on commit; the overlapping one comes
// back as a conflict with a prompt, and the agent resolves the markers with a normal `replace` op.
// Usage: MALLEABLE_API_KEY=... pnpm tsx examples/parallel-agents.ts <projectId> [endpoint]
import { Project, type Session } from '../src/client.ts'

const [projectId = 'parallel', endpoint = 'https://malleableui.dev'] = process.argv.slice(2)
const apiKey = process.env.MALLEABLE_API_KEY!

const project = new Project({ endpoint, apiKey, id: projectId })
console.log('init', (await project.init()).heads)
console.log(`open ${endpoint}/view/${projectId}`)

const app = `export default function App() {
  return (
    <div className="p-8 space-y-2">
      <h1 className="text-2xl font-bold">Revenue</h1>
      <p className="text-sm text-gray-500">Monthly totals</p>
    </div>
  )
}
`
const seed = await project.openSession({ author: { kind: 'agent', id: 'seed' } })
await seed.apply({ ops: [{ op: 'write', path: 'App.tsx', content: app }] })
console.log('seed', await seed.commit({ message: 'Seed screen' }))

const agent = (id: string) => project.openSession({ author: { kind: 'agent', id } })
const [designer, writer] = await Promise.all([agent('designer'), agent('copywriter')])

async function edit(session: Session, oldString: string, newString: string) {
  await session.apply({ ops: [{ op: 'replace', path: 'App.tsx', oldString, newString }] })
  console.log(session.id, 'draft', await session.build())
}

// both work on the same line of App.tsx in parallel
await Promise.all([
  edit(designer, 'text-sm text-gray-500">Monthly totals', 'text-base text-emerald-600">Monthly totals'),
  edit(writer, 'Monthly totals', 'Totals per month, in USD'),
])

console.log('designer commit', await designer.commit({ message: 'Green subtitle' }))

const result = await writer.commit({ message: 'Clearer subtitle' })
if (result.ok || result.reason !== 'conflict') throw new Error(`expected a conflict: ${JSON.stringify(result)}`)
console.log(`\n${result.prompt}\n`)

// an LLM agent would get `result.prompt` and fix the block with its edit tool; here we do it by hand
const marked = (await writer.read({ path: 'App.tsx' }))!
const block = marked.slice(marked.indexOf('<<<<<<<'), marked.indexOf('\n', marked.indexOf('>>>>>>>')))
await writer.apply({
  ops: [
    {
      op: 'replace',
      path: 'App.tsx',
      oldString: block,
      newString: '      <p className="text-base text-emerald-600">Totals per month, in USD</p>',
    },
  ],
})
console.log('writer commit', await writer.commit({ message: 'Clearer subtitle' }))
console.log((await project.log({ limit: 3 })).map((c) => `${c.sha.slice(0, 7)} ${c.message} (${c.author.id})`))
