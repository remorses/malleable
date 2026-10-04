import { defineRelations } from 'drizzle-orm'
import * as s from 'drizzle-orm/sqlite-core'
import { ulid } from 'ulid'

/** One dashboard screen. Its code lives in a Malleable UI project; `componentUrl` is the last committed build. */
export const views = s.sqliteTable('views', {
  viewId: s.text('view_id').primaryKey().$defaultFn(() => ulid()),
  title: s.text('title').notNull(),
  /** Malleable UI project id */
  projectId: s.text('project_id').notNull(),
  /** Immutable module url of the last commit, null until the agent commits once */
  componentUrl: s.text('component_url'),
  createdAt: s.integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: s.integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
})

/** AI SDK UI messages of the chat that edits a view. `parts` is the opaque UIMessage parts array. */
export const chatMessages = s.sqliteTable(
  'chat_messages',
  {
    messageId: s.text('message_id').primaryKey(),
    viewId: s
      .text('view_id')
      .notNull()
      .references(() => views.viewId, { onDelete: 'cascade' }),
    role: s.text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    parts: s.text('parts', { mode: 'json' }).notNull().$type<unknown[]>(),
    position: s.integer('position').notNull(),
    createdAt: s.integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [s.index('chat_messages_view_id_idx').on(table.viewId, table.position)],
)

export const relations = defineRelations({ views, chatMessages }, (r) => ({
  views: {
    messages: r.many.chatMessages(),
  },
  chatMessages: {
    view: r.one.views({ from: r.chatMessages.viewId, to: r.views.viewId }),
  },
}))
