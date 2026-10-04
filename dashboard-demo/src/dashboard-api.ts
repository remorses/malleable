import dedent from 'string-dedent'

// Data API the host passes to generated views as the `api` prop. Values are seeded, so every
// reload shows the same numbers. In a real app these functions would call the host backend.

export interface Kpis {
  revenue: number
  revenueChange: number
  orders: number
  ordersChange: number
  customers: number
  customersChange: number
  conversionRate: number
  conversionRateChange: number
}
export interface MonthlyRevenue {
  month: string
  revenue: number
  expenses: number
  profit: number
}
export interface DailyActiveUsers {
  date: string
  users: number
  sessions: number
}
export interface TrafficSource {
  source: string
  visitors: number
  conversions: number
}
export interface ProductSales {
  product: string
  category: string
  units: number
  revenue: number
}
export interface Order {
  id: string
  customer: string
  email: string
  product: string
  amount: number
  status: 'paid' | 'pending' | 'refunded'
  date: string
}
export interface CountryCustomers {
  country: string
  customers: number
}

export interface DashboardApi {
  kpis(): Promise<Kpis>
  revenueByMonth(): Promise<MonthlyRevenue[]>
  dailyActiveUsers(opts?: { days?: number }): Promise<DailyActiveUsers[]>
  trafficBySource(): Promise<TrafficSource[]>
  productSales(): Promise<ProductSales[]>
  orders(opts?: { limit?: number; status?: Order['status'] }): Promise<Order[]>
  customersByCountry(): Promise<CountryCustomers[]>
}

/** Same contract as above, as text for the agent system prompt. Keep in sync with `DashboardApi`. */
export const DASHBOARD_API_DOCS = dedent`
  interface DashboardApi {
    kpis(): Promise<{
      revenue: number; revenueChange: number          // USD, change in % vs previous period (e.g. 12.4)
      orders: number; ordersChange: number
      customers: number; customersChange: number
      conversionRate: number; conversionRateChange: number // conversionRate is a % (e.g. 3.2)
    }>
    revenueByMonth(): Promise<Array<{ month: string; revenue: number; expenses: number; profit: number }>> // 12 rows, month like "Jan 2026"
    dailyActiveUsers(opts?: { days?: number }): Promise<Array<{ date: string; users: number; sessions: number }>> // default 30 days, date "2026-09-01"
    trafficBySource(): Promise<Array<{ source: string; visitors: number; conversions: number }>> // ~6 rows
    productSales(): Promise<Array<{ product: string; category: string; units: number; revenue: number }>> // ~10 rows
    orders(opts?: { limit?: number; status?: 'paid' | 'pending' | 'refunded' }): Promise<Array<{
      id: string; customer: string; email: string; product: string
      amount: number; status: 'paid' | 'pending' | 'refunded'; date: string // ISO date
    }>> // newest first, default limit 50, max 200
    customersByCountry(): Promise<Array<{ country: string; customers: number }>> // ~8 rows
  }
`

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PRODUCTS = [
  ['Aurora Desk Lamp', 'Home'],
  ['Nimbus Headphones', 'Audio'],
  ['Pulse Smartwatch', 'Wearables'],
  ['Atlas Backpack', 'Accessories'],
  ['Echo Speaker', 'Audio'],
  ['Glide Keyboard', 'Computing'],
  ['Orbit Mouse', 'Computing'],
  ['Zen Yoga Mat', 'Fitness'],
  ['Flux Power Bank', 'Accessories'],
  ['Lumen Monitor', 'Computing'],
] as const
const CUSTOMERS = [
  'Olivia Martin', 'Jackson Lee', 'Isabella Nguyen', 'William Kim', 'Sofia Davis', 'Liam Johnson',
  'Emma Brown', 'Noah Wilson', 'Ava Garcia', 'Lucas Rossi', 'Mia Schmidt', 'Ethan Moore',
]
const STATUSES: Order['status'][] = ['paid', 'paid', 'paid', 'paid', 'pending', 'refunded']
const round = (n: number, digits = 0) => Number(n.toFixed(digits))

export const dashboardApi: DashboardApi = {
  async kpis() {
    return {
      revenue: 482_310,
      revenueChange: 12.4,
      orders: 6_284,
      ordersChange: 8.1,
      customers: 2_917,
      customersChange: -2.3,
      conversionRate: 3.4,
      conversionRateChange: 0.6,
    }
  },
  async revenueByMonth() {
    const rand = seeded(7)
    return MONTHS.map((m, i) => {
      const revenue = round(28_000 + i * 2_100 + rand() * 9_000)
      const expenses = round(revenue * (0.48 + rand() * 0.15))
      return { month: `${m} 2026`, revenue, expenses, profit: revenue - expenses }
    })
  },
  async dailyActiveUsers({ days = 30 } = {}) {
    const rand = seeded(11)
    const start = Date.UTC(2026, 8, 30) - (days - 1) * 86_400_000
    return Array.from({ length: days }, (_, i) => {
      const weekend = new Date(start + i * 86_400_000).getUTCDay() % 6 === 0
      const users = round((weekend ? 1_400 : 2_100) + i * 18 + rand() * 400)
      return {
        date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
        users,
        sessions: round(users * (1.6 + rand() * 0.5)),
      }
    })
  },
  async trafficBySource() {
    return [
      { source: 'Organic search', visitors: 48_210, conversions: 1_874 },
      { source: 'Direct', visitors: 31_402, conversions: 1_402 },
      { source: 'Social', visitors: 22_815, conversions: 611 },
      { source: 'Email', visitors: 12_390, conversions: 902 },
      { source: 'Referral', visitors: 9_874, conversions: 388 },
      { source: 'Paid ads', visitors: 18_106, conversions: 712 },
    ]
  },
  async productSales() {
    const rand = seeded(23)
    return PRODUCTS.map(([product, category]) => {
      const units = round(120 + rand() * 900)
      return { product, category, units, revenue: round(units * (25 + rand() * 180)) }
    }).sort((a, b) => b.revenue - a.revenue)
  },
  async orders({ limit = 50, status } = {}) {
    const rand = seeded(42)
    const all = Array.from({ length: 200 }, (_, i): Order => {
      const customer = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)]!
      const [product] = PRODUCTS[Math.floor(rand() * PRODUCTS.length)]!
      return {
        id: `ORD-${(10_480 - i).toString()}`,
        customer,
        email: `${customer.toLowerCase().replace(' ', '.')}@example.com`,
        product,
        amount: round(19 + rand() * 480, 2),
        status: STATUSES[Math.floor(rand() * STATUSES.length)]!,
        date: new Date(Date.UTC(2026, 8, 30, 18) - i * 3.7 * 3_600_000).toISOString(),
      }
    })
    return all.filter((o) => !status || o.status === status).slice(0, Math.min(limit, 200))
  },
  async customersByCountry() {
    return [
      { country: 'United States', customers: 1_102 },
      { country: 'Germany', customers: 412 },
      { country: 'United Kingdom', customers: 388 },
      { country: 'France', customers: 271 },
      { country: 'Italy', customers: 236 },
      { country: 'Canada', customers: 198 },
      { country: 'Japan', customers: 174 },
      { country: 'Brazil', customers: 136 },
    ]
  },
}
