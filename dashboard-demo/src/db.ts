import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from './schema.ts'

export { schema }

// sqlite-proxy instead of drizzle-orm/d1: the d1 driver crashes on empty findFirst in batch.
// https://github.com/drizzle-team/drizzle-orm/issues/2721
function d1ToRawRows(results: Record<string, unknown>[]) {
  return results.map((row) => Object.keys(row).map((k) => row[k]))
}

export function getDb(d1: D1Database = env.DB) {
  return drizzle(
    async (sql, params, method) => {
      const stmt = d1.prepare(sql).bind(...params)
      if (method === 'run') {
        await stmt.run()
        return { rows: [] as any[] }
      }
      const rows = await stmt.raw()
      // sqlite-proxy needs a falsy value for no-row `get`. https://github.com/drizzle-team/drizzle-orm/issues/5461
      if (method === 'get') return { rows: rows[0] as any }
      return { rows: rows as any[] }
    },
    async (queries) => {
      const stmts = queries.map((q) => d1.prepare(q.sql).bind(...q.params))
      const results = await d1.batch(stmts)
      return results.map((r, i) => {
        const rows = d1ToRawRows(r.results as Record<string, unknown>[])
        if (queries[i]!.method === 'get') return { rows: rows[0] as any }
        return { rows: rows as any[] }
      })
    },
    { relations: schema.relations },
  )
}
