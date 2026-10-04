'use server'

import { redirect } from 'spiceflow'
import { ulid } from 'ulid'
import { getDb, schema } from './db.ts'

// Demo without auth: anyone with the url can create views. A real app checks the session here.
export async function createView() {
  const viewId = ulid()
  await getDb()
    .insert(schema.views)
    .values({ viewId, title: 'Untitled view', projectId: `dash-${viewId.toLowerCase()}` })
  throw redirect(`/views/${viewId}`)
}
