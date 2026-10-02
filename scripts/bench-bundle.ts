// Benchmark draft build latency (`session.build()`) of one project. Usage:
//   MALLEABLE_API_KEY=... tsx scripts/bench-bundle.ts [--url https://remote-bundler.fumabase.com] [--runs 20] [--scenario small|multi|npm] [--vary]
// Prints per-run wall time, then p50/p95. The files are written before the timer starts.
import { parseArgs } from 'node:util'
import { Project } from '../src/client.ts'

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://remote-bundler.fumabase.com' },
    runs: { type: 'string', default: '20' },
    scenario: { type: 'string', default: 'multi' },
    // change the source every run so source-keyed caches always miss
    vary: { type: 'boolean', default: false },
  },
})
const runs = Number(values.runs)

const small = [
  {
    path: 'App.tsx',
    content: `import React from 'react'
export default function App() {
  return <div className="p-4 text-lg font-bold hover:bg-blue-500">hello</div>
}`,
  },
]

const multi = [
  {
    path: 'utils.ts',
    content: `export const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)`,
  },
  {
    path: 'components/Button.tsx',
    content: `import React from 'react'
export const Button = ({ children, onClick }: any) => (
  <button className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600" onClick={onClick}>{children}</button>
)`,
  },
  {
    path: 'components/Card.tsx',
    content: `import React from 'react'
import { fmt } from '../utils'
export const Card = ({ n }: { n: number }) => (
  <div className="rounded-xl border p-6 shadow-md md:p-8"><span className="text-2xl font-semibold">{fmt(n)}</span></div>
)`,
  },
  {
    path: 'Lazy.tsx',
    content: `import React from 'react'
export default () => <p className="mt-4 text-gray-500">lazy chunk</p>`,
  },
  {
    path: 'App.tsx',
    content: `import React, { useState, lazy, Suspense } from 'react'
import { Button } from './components/Button'
import { Card } from './components/Card'
const Lazy = lazy(() => import('./Lazy'))
export default function App() {
  const [n, setN] = useState(0)
  return (
    <div className="mx-auto max-w-xl space-y-4 p-8">
      <Card n={n} />
      <Button onClick={() => setN(n + 1)}>inc</Button>
      <Suspense fallback="..."><Lazy /></Suspense>
    </div>
  )
}`,
  },
]

// non-external npm import: exercises the CDN fetch path
const npm = [
  {
    path: 'App.tsx',
    content: `import React from 'react'
import { format } from 'date-fns'
export default function App() {
  return <div className="p-4 text-lg">{format(new Date(), 'yyyy')}</div>
}`,
  },
]

const files = { small, multi, npm }[values.scenario!] ?? multi

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]
}

const project = new Project({
  endpoint: values.url!,
  apiKey: process.env.MALLEABLE_API_KEY!,
  id: `bench-${Date.now()}`,
})
console.log(`bench url=${values.url} project=${project.id} scenario=${values.scenario} runs=${runs}`)
await project.init()
console.log('project initialized')
const session = await project.openSession({ author: { kind: 'agent', id: 'bench' } })
console.log(`session ${session.id} opened`)

const wall: number[] = []
try {
  for (let i = 0; i < runs; i++) {
    await session.apply({
      ops: files.map(({ path, content }) => ({
        op: 'write' as const,
        path,
        content: values.vary ? `${content}\n// run ${Date.now()}-${i}` : content,
      })),
    })
    const start = performance.now()
    const result = await session.build()
    const ms = performance.now() - start
    if (!result.ok) throw new Error(`run ${i} failed:\n${result.errorText}`)
    wall.push(ms)
    console.log(`run ${String(i).padStart(2)} wall=${ms.toFixed(0)}ms build=${result.build}`)
  }
} finally {
  await session.discard()
  console.log('session discarded')
}

console.log('\n--- summary (first run = cold-ish, excluded from warm stats) ---')
const warm = wall.slice(1)
console.log(`cold run : ${wall[0].toFixed(0)}ms`)
console.log(
  `warm wall: p50=${median(warm).toFixed(0)}ms p95=${pct(warm, 0.95).toFixed(0)}ms min=${Math.min(...warm).toFixed(0)}ms`,
)
