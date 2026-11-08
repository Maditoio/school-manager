'use client'

export type DetailTab<T extends string = string> = {
  key: T
  label: string
}

type DetailTabsProps<T extends string> = {
  tabs: Array<DetailTab<T>>
  active: T
  onChange: (key: T) => void
}

export function DetailTabs<T extends string>({ tabs, active, onChange }: DetailTabsProps<T>) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-(--border-subtle)" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
              isActive
                ? 'border-[#635bff] text-[#635bff]'
                : 'border-transparent ui-text-secondary hover:ui-text-primary'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
