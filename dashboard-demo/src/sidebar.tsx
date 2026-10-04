'use client'

import { Loader2, Plus } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { Link, router, useLoaderData, useRouterState } from 'spiceflow/react'
import { createView } from './actions.ts'

function NewViewButton({ className, label = 'New view' }: { className?: string; label?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="New view"
      className={`flex h-8 items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 ${className ?? ''}`}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
      {label}
    </button>
  )
}

function Brand() {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <span className="size-3.5 rounded-full bg-neutral-900" />
      Acme
    </span>
  )
}

function useViewLinks() {
  const { views } = useLoaderData('/*')
  const { pathname } = useRouterState()
  return views.map((view) => {
    const href = router.href('/views/:viewId', { viewId: view.viewId })
    return { ...view, href, active: pathname === href }
  })
}

export function Sidebar() {
  const links = useViewLinks()
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 md:flex">
      <div className="flex h-14 items-center px-5">
        <Brand />
      </div>
      <div className="px-5 pt-4 pb-2 text-[13px] text-neutral-500">Views</div>
      <nav className="flex-1 space-y-px overflow-y-auto px-3" data-testid="views-list">
        {links.map((view) => (
          <Link
            key={view.viewId}
            href={view.href}
            className={`block truncate rounded-md px-2 py-1.5 text-[13px] transition-colors ${
              view.active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {view.title}
          </Link>
        ))}
      </nav>
      <form action={createView} className="p-3">
        <NewViewButton className="w-full" />
      </form>
    </aside>
  )
}

/** Phones: a top bar with the views as a horizontal list */
export function MobileNav() {
  const links = useViewLinks()
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 py-2 pl-4 md:hidden">
      <Brand />
      <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {links.map((view) => (
          <Link
            key={view.viewId}
            href={view.href}
            className={`max-w-40 shrink-0 truncate rounded-md px-2 py-1 text-[13px] ${
              view.active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600'
            }`}
          >
            {view.title}
          </Link>
        ))}
      </nav>
      <form action={createView} className="pr-3">
        <NewViewButton label="New" />
      </form>
    </header>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-sm text-sm text-neutral-500">{description}</p>
      <form action={createView} className="mt-4">
        <NewViewButton />
      </form>
    </div>
  )
}
