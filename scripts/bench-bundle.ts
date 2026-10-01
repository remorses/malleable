// Benchmark POST /api/bundle latency. Usage:
//   tsx scripts/bench-bundle.ts [--url https://remote-bundler.fumabase.com] [--runs 20] [--scenario small|multi|npm] [--vary]
// Prints per-run wall time + Server-Timing, then p50/p95 and per-metric medians.
import { parseArgs } from 'node:util'

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

const EXTERNAL = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]

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

function parseServerTiming(header: string | null) {
  const out: Record<string, number> = {}
  for (const part of (header ?? '').split(',')) {
    const m = part.trim().match(/^([^;]+);dur=([\d.]+)/)
    if (m) out[m[1]] = Number(m[2])
  }
  return out
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]
}

console.log(`bench url=${values.url} scenario=${values.scenario} runs=${runs}`)
const wall: number[] = []
const timings: Record<string, number[]> = {}

for (let i = 0; i < runs; i++) {
  const siteId = `bench-${Date.now()}-${i}`
  const start = performance.now()
  const res = await fetch(`${values.url}/api/bundle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId,
      files: values.vary
        ? files.map((f) => ({ ...f, content: `${f.content}\n// ${siteId}` }))
        : files,
      entryPoint: 'App.tsx',
      externalPackages: EXTERNAL,
      // push the container prerender far away so it does not skew results
      prerenderDebounceTime: 60_000,
    }),
  })
  const body: any = await res.json()
  const ms = performance.now() - start
  if (!res.ok || body.error) {
    console.error(`run ${i} FAILED ${res.status}`, body.error ?? '')
    process.exit(1)
  }
  const st = parseServerTiming(res.headers.get('server-timing'))
  wall.push(ms)
  for (const [k, v] of Object.entries(st)) (timings[k] ??= []).push(v)
  console.log(
    `run ${String(i).padStart(2)} wall=${ms.toFixed(0)}ms ${JSON.stringify(st)}`,
  )
}

console.log('\n--- summary (first run = cold-ish, excluded from warm stats) ---')
const warm = wall.slice(1)
console.log(`cold run : ${wall[0].toFixed(0)}ms`)
console.log(
  `warm wall: p50=${median(warm).toFixed(0)}ms p95=${pct(warm, 0.95).toFixed(0)}ms min=${Math.min(...warm).toFixed(0)}ms`,
)
for (const [k, v] of Object.entries(timings)) {
  console.log(`  ${k.padEnd(24)} warm p50=${median(v.slice(1))}ms cold=${v[0]}ms`)
}
