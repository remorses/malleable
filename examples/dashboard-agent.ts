// Richer agent demo: builds a shadcn-style dashboard in three commits.
// Many files with relative imports, cva/clsx/tailwind-merge bundled from esm.sh, React kept external.
// Usage: MALLEABLE_API_KEY=... pnpm tsx examples/dashboard-agent.ts <projectId> [endpoint]
import { Project } from '../src/client.ts'

const [projectId = 'dashboard', endpoint = 'https://remote-bundler.fumabase.com'] = process.argv.slice(2)
const apiKey = process.env.MALLEABLE_API_KEY!
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const project = new Project({ endpoint, apiKey, id: projectId })
console.log('init', (await project.init()).heads)
console.log(`open ${endpoint}/view/${projectId}`)

type Session = Awaited<ReturnType<typeof project.openSession>>

/** Draft build; stop the demo on failure instead of committing a broken tree. */
async function build(session: Session, label: string) {
  const result = await session.build()
  console.log('draft', label, result)
  if (!result.ok) throw new Error(result.errorText)
}

/** Write a batch of files, then run one draft build so viewers see the step. */
async function batch(session: Session, files: Record<string, string>) {
  await session.apply({ ops: Object.entries(files).map(([path, content]) => ({ op: 'write' as const, path, content })) })
  await build(session, Object.keys(files).join(', '))
  await sleep(2500)
}

async function message(text: string, run: (session: Session) => Promise<void>) {
  const session = await project.openSession({ author: { kind: 'agent', id: 'dashboard-agent' } })
  await run(session)
  const result = await session.commit({ message: text })
  console.log('commit', result)
  if (!result.ok) throw new Error(`commit failed: ${result.reason}`)
  await sleep(2000)
}

// ───────────────────────────── message 1: UI kit ─────────────────────────────

const utils = `import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
`

const button = `import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: { default: 'h-9 px-4 py-2', sm: 'h-8 px-3 text-xs', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
`

const badge = `import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      success: 'border-transparent bg-emerald-100 text-emerald-700',
      warning: 'border-transparent bg-amber-100 text-amber-700',
      danger: 'border-transparent bg-red-100 text-red-700',
      outline: 'border-border text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
`

const card = `import { cn } from '../../lib/utils'

type DivProps = React.HTMLAttributes<HTMLDivElement>

export const Card = ({ className, ...p }: DivProps) => (
  <div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...p} />
)
export const CardHeader = ({ className, ...p }: DivProps) => (
  <div className={cn('flex flex-col gap-1.5 p-6', className)} {...p} />
)
export const CardTitle = ({ className, ...p }: DivProps) => (
  <div className={cn('text-sm font-medium leading-none tracking-tight', className)} {...p} />
)
export const CardDescription = ({ className, ...p }: DivProps) => (
  <div className={cn('text-sm text-muted-foreground', className)} {...p} />
)
export const CardContent = ({ className, ...p }: DivProps) => (
  <div className={cn('p-6 pt-0', className)} {...p} />
)
`

const input = `import { cn } from '../../lib/utils'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary',
        className,
      )}
      {...props}
    />
  )
}
`

const progress = `import { cn } from '../../lib/utils'

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}>
      <div className="h-full bg-primary transition-all" style={{ width: value + '%' }} />
    </div>
  )
}
`

const avatar = `import { cn } from '../../lib/utils'

const palette = ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const color = palette[name.length % palette.length]
  return (
    <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', color, className)}>
      {initials}
    </span>
  )
}
`

const tabs = `import * as React from 'react'
import { cn } from '../../lib/utils'

const TabsContext = React.createContext<{ value: string; setValue: (v: string) => void }>({
  value: '',
  setValue: () => {},
})

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) {
  const [value, setValue] = React.useState(defaultValue)
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export const TabsList = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground', className)} {...p} />
)

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext)
  const active = ctx.value === value
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        'rounded-md px-3 py-1 text-sm font-medium transition-all',
        active ? 'bg-background text-foreground shadow' : 'hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function useTab() {
  return React.useContext(TabsContext).value
}
`

const table = `import { cn } from '../../lib/utils'

export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  <table className={cn('w-full caption-bottom text-sm', className)} {...p} />
)
export const TableHeader = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="[&_tr]:border-b [&_tr]:border-border" {...p} />
)
export const TableBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className="[&_tr:last-child]:border-0" {...p} />
)
export const TableRow = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b border-border transition-colors hover:bg-muted/50', className)} {...p} />
)
export const TableHead = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('h-10 px-2 text-left align-middle text-xs font-medium text-muted-foreground', className)} {...p} />
)
export const TableCell = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('p-2 align-middle', className)} {...p} />
)
`

// ───────────────────────────── message 2: dashboard ─────────────────────────────

const icons = `const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const DollarIcon = () => (
  <svg {...base}><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
)
export const UsersIcon = () => (
  <svg {...base}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
)
export const CardIcon = () => (
  <svg {...base}><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
)
export const ActivityIcon = () => (
  <svg {...base}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
)
export const SearchIcon = () => (
  <svg {...base}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
)
`

const data = `export type Order = {
  id: string
  customer: string
  email: string
  amount: number
  status: 'paid' | 'pending' | 'refunded'
}

export const orders: Order[] = [
  { id: 'ORD-1042', customer: 'Olivia Martin', email: 'olivia@acme.io', amount: 1999, status: 'paid' },
  { id: 'ORD-1041', customer: 'Jackson Lee', email: 'jackson@globex.com', amount: 390, status: 'pending' },
  { id: 'ORD-1040', customer: 'Isabella Nguyen', email: 'isabella@initech.dev', amount: 2990, status: 'paid' },
  { id: 'ORD-1039', customer: 'William Kim', email: 'will@umbrella.co', amount: 990, status: 'refunded' },
  { id: 'ORD-1038', customer: 'Sofia Davis', email: 'sofia@hooli.xyz', amount: 3900, status: 'paid' },
  { id: 'ORD-1037', customer: 'Liam Carter', email: 'liam@stark.org', amount: 1290, status: 'pending' },
]

export const monthly = [
  { month: 'Jan', value: 4200 }, { month: 'Feb', value: 5100 }, { month: 'Mar', value: 4800 },
  { month: 'Apr', value: 6200 }, { month: 'May', value: 7400 }, { month: 'Jun', value: 6900 },
  { month: 'Jul', value: 8800 }, { month: 'Aug', value: 9600 }, { month: 'Sep', value: 9100 },
  { month: 'Oct', value: 11200 }, { month: 'Nov', value: 12400 }, { month: 'Dec', value: 13900 },
]

export const team = [
  { name: 'Ada Lovelace', role: 'Design', done: 82 },
  { name: 'Grace Hopper', role: 'Engineering', done: 64 },
  { name: 'Alan Turing', role: 'Research', done: 91 },
  { name: 'Margaret Hamilton', role: 'Infra', done: 47 },
]
`

const statCard = `import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { cn } from '../lib/utils'

export function StatCard({ title, value, delta, icon }: { title: string; value: string; delta: number; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={cn('mt-1 text-xs', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {delta >= 0 ? '+' : ''}{delta}% from last month
        </p>
      </CardContent>
    </Card>
  )
}
`

const chart = `import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { monthly } from '../data/orders'
import { cn, money } from '../lib/utils'

export function RevenueChart() {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...monthly.map((m) => m.value))
  const active = hover === null ? monthly[monthly.length - 1] : monthly[hover]
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
        <CardDescription>
          {active.month}: <span className="font-semibold text-foreground">{money(active.value)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-2" onMouseLeave={() => setHover(null)}>
          {monthly.map((m, i) => (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" onMouseEnter={() => setHover(i)}>
              <div
                className={cn('w-full rounded-t-md transition-colors', hover === i ? 'bg-primary' : 'bg-primary/30')}
                style={{ height: (m.value / max) * 100 + '%' }}
              />
              <span className="text-[10px] text-muted-foreground">{m.month}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
`

const recentOrders = `import { useState } from 'react'
import { Avatar } from './ui/avatar'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Tabs, TabsList, TabsTrigger, useTab } from './ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { SearchIcon } from './icons'
import { orders } from '../data/orders'
import type { Order } from '../data/orders'
import { money } from '../lib/utils'

const variant = { paid: 'success', pending: 'warning', refunded: 'danger' } as const

function OrdersTable({ query }: { query: string }) {
  const tab = useTab()
  const rows = orders.filter(
    (o: Order) =>
      (tab === 'all' || o.status === tab) &&
      (o.customer + o.email + o.id).toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((o) => (
          <TableRow key={o.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar name={o.customer} />
                <div>
                  <div className="font-medium">{o.customer}</div>
                  <div className="text-xs text-muted-foreground">{o.email}</div>
                </div>
              </div>
            </TableCell>
            <TableCell><Badge variant={variant[o.status]}>{o.status}</Badge></TableCell>
            <TableCell className="text-right font-medium">{money(o.amount)}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No orders</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function RecentOrders() {
  const [query, setQuery] = useState('')
  return (
    <Card className="col-span-4">
      <Tabs defaultValue="all">
        <CardHeader className="gap-4">
          <CardTitle>Recent orders</CardTitle>
          <div className="flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="refunded">Refunded</TabsTrigger>
            </TabsList>
            <div className="relative w-56">
              <span className="absolute left-2.5 top-2.5 text-muted-foreground"><SearchIcon /></span>
              <Input className="pl-8" placeholder="Search orders" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent><OrdersTable query={query} /></CardContent>
      </Tabs>
    </Card>
  )
}
`

const teamActivity = `import { Avatar } from './ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { team } from '../data/orders'

export function TeamActivity() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Team sprint</CardTitle>
        <CardDescription>Tasks completed this cycle</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {team.map((m) => (
          <div key={m.name} className="flex items-center gap-3">
            <Avatar name={m.name} />
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">{m.done}%</span>
              </div>
              <Progress value={m.done} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
`

const showcaseApp = (extra: string) => `import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
${extra}
export default function App() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-bold tracking-tight">UI kit</h1>
      <Card>
        <CardHeader>
          <CardTitle>Buttons and badges</CardTitle>
          <CardDescription>cva variants, merged with tailwind-merge</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive" size="sm">Delete</Button>
          <Badge>New</Badge>
          <Badge variant="success">Paid</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="outline">Outline</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
`

const dashboardApp = (title: string, badge: string, withOrders: boolean) => `import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { ActivityIcon, CardIcon, DollarIcon, UsersIcon } from './components/icons'
${withOrders ? "import { RecentOrders } from './components/recent-orders'\n" : ''}import { RevenueChart } from './components/revenue-chart'
import { StatCard } from './components/stat-card'
import { TeamActivity } from './components/team-activity'

export default function App() {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">${title}</h1>
          ${badge}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Export</Button>
          <Button size="sm">New order</Button>
        </div>
      </header>
      <main className="space-y-4 p-8">
        <div className="grid grid-cols-4 gap-4">
          <StatCard title="Total revenue" value="$45,231" delta={20.1} icon={<DollarIcon />} />
          <StatCard title="Subscriptions" value="+2,350" delta={180.1} icon={<UsersIcon />} />
          <StatCard title="Sales" value="+12,234" delta={19} icon={<CardIcon />} />
          <StatCard title="Active now" value="573" delta={-2.4} icon={<ActivityIcon />} />
        </div>
        <div className="grid grid-cols-7 gap-4">
          <RevenueChart />
          <TeamActivity />
        </div>
${withOrders ? '        <div className="grid grid-cols-4 gap-4">\n          <RecentOrders />\n        </div>\n' : ''}      </main>
    </div>
  )
}
`

await message('Add UI kit', async (s) => {
  await batch(s, {
    'lib/utils.ts': utils,
    'components/ui/button.tsx': button,
    'components/ui/badge.tsx': badge,
    'components/ui/card.tsx': card,
    'App.tsx': showcaseApp(''),
  })
  await batch(s, {
    'components/ui/input.tsx': input,
    'components/ui/progress.tsx': progress,
    'components/ui/avatar.tsx': avatar,
    'components/ui/tabs.tsx': tabs,
    'components/ui/table.tsx': table,
  })
})

await message('Add dashboard with orders, chart and team widgets', async (s) => {
  await batch(s, {
    'components/icons.tsx': icons,
    'data/orders.ts': data,
    'components/stat-card.tsx': statCard,
    'components/revenue-chart.tsx': chart,
    'components/team-activity.tsx': teamActivity,
    'App.tsx': dashboardApp('Dashboard', '', false),
  })
  await batch(s, {
    'components/recent-orders.tsx': recentOrders,
    'App.tsx': dashboardApp('Dashboard', '', true),
  })
})

await message('Add live badge to header', async (s) => {
  // two exact one-line edits instead of one whitespace-dependent multi-line match
  await s.apply({
    ops: [
      {
        op: 'replace',
        path: 'App.tsx',
        oldString: '<h1 className="text-xl font-bold tracking-tight">Dashboard</h1>',
        newString: '<h1 className="text-xl font-bold tracking-tight">Acme Dashboard</h1><Badge variant="success">Live</Badge>',
      },
    ],
  })
  await build(s, 'App.tsx')
})
