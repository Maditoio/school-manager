import type { ReactNode } from 'react'
import { DetailMetaLabel } from './DetailShell'

export type KpiItem = {
  id: string
  label: string
  value: ReactNode
  hint?: ReactNode
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  if (items.length === 0) return null

  const cols =
    items.length >= 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : items.length === 3
        ? 'sm:grid-cols-3'
        : items.length === 2
          ? 'sm:grid-cols-2'
          : 'sm:grid-cols-1'

  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-[10px] border border-(--border-subtle) bg-(--surface) px-4 py-3.5"
        >
          <DetailMetaLabel>{item.label}</DetailMetaLabel>
          <p className="mt-2 text-[1.25rem] font-semibold leading-tight tracking-[-0.01em] ui-text-primary">
            {item.value}
          </p>
          {item.hint ? <p className="mt-1 text-[0.75rem] leading-snug ui-text-secondary">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}
