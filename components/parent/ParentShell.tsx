'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

/** Full-width parent page stack matching admin detail spacing. */
export function ParentShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-4 ${className}`}>{children}</div>
}

export function ParentCard({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-[10px] border border-(--border-subtle) bg-(--surface) ${
        padded ? 'p-4 sm:p-5' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function ParentPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.25rem] font-semibold leading-tight tracking-[-0.01em] ui-text-primary">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm ui-text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function ParentSectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: ReactNode
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
        {title}
      </h2>
      {href && linkLabel ? (
        <Link href={href} className="ui-table-link text-xs">
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  )
}

export function ChildSelect({
  childrenOptions,
  value,
  onChange,
  label = 'Child',
}: {
  childrenOptions: Array<{ id: string; label: string }>
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  if (childrenOptions.length === 0) return null

  return (
    <label className="flex min-w-[200px] flex-col gap-1">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
        {label}
      </span>
      <select
        className="ui-select h-8 min-h-8 py-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {childrenOptions.map((child) => (
          <option key={child.id} value={child.id}>
            {child.label}
          </option>
        ))}
      </select>
    </label>
  )
}
