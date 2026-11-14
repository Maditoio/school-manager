import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

/**
 * Single-row toolbar: title left, controls right-aligned on one line.
 * Put search first, then the primary action so the button sits far right.
 */
export function DetailToolbar({
  title,
  children,
}: {
  title?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {title ? (
        <div className="min-w-0 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
          {title}
        </div>
      ) : null}
      {children ? (
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
      ) : null}
    </div>
  )
}

export function DetailSearchInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`ui-search-field flex-1 ${className || 'max-w-[280px]'}`}>
      <Search className="ui-search-field__icon" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ui-input ui-input-search w-full"
      />
    </label>
  )
}
