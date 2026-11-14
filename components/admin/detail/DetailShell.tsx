import type { ReactNode } from 'react'
import Link from 'next/link'

/** Full-width stack matching other admin pages (`space-y-4`). */
export function DetailShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-4 ${className}`}>{children}</div>
}

export function DetailCard({
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

export function DetailMetaLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] leading-normal ui-text-secondary">
      {children}
    </p>
  )
}

export function DetailBreadcrumb({
  items,
  ariaLabel = 'Fil d\'Ariane',
}: {
  items: Array<{ label: string; href?: string }>
  ariaLabel?: string
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 ? <span className="ui-text-secondary">/</span> : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-medium text-[#635bff] transition-colors duration-150 hover:text-[#5146e8]"
              >
                {item.label} →
              </Link>
            ) : (
              <span className={isLast ? 'ui-text-primary' : 'ui-text-secondary'}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
