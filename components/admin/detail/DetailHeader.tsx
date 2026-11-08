import type { ReactNode } from 'react'

type DetailHeaderProps = {
  title: ReactNode
  badges?: ReactNode
  meta?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export function DetailHeader({ title, badges, meta, subtitle, actions }: DetailHeaderProps) {
  return (
    <div className="rounded-[10px] border border-(--border-subtle) bg-(--surface) p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] ui-text-primary">
              {title}
            </h1>
            {badges}
          </div>
          {meta ? <div className="text-[13px] leading-snug ui-text-secondary">{meta}</div> : null}
          {subtitle ? <div className="text-[12px] ui-text-secondary">{subtitle}</div> : null}
        </div>
        {actions ? <div className="shrink-0 self-start">{actions}</div> : null}
      </div>
    </div>
  )
}

export function StatusPill({
  tone,
  children,
}: {
  tone: 'success' | 'pending' | 'danger' | 'neutral'
  children: ReactNode
}) {
  const toneClass =
    tone === 'success'
      ? 'ui-status-success'
      : tone === 'pending'
        ? 'ui-status-pending'
        : tone === 'danger'
          ? 'ui-status-danger'
          : 'ui-status-neutral'

  return <span className={`ui-status ${toneClass}`}>{children}</span>
}
