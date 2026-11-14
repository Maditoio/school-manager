'use client'

export type TrendPoint = {
  assessmentId: string
  title: string
  type: string
  date: string
  percent: number
}

export type TrendType = 'QUIZ' | 'EXAM' | 'ASSIGNMENT'

export const TREND_TYPE_COLOR: Record<TrendType, string> = {
  QUIZ: '#635bff',
  EXAM: '#3ecf8e',
  ASSIGNMENT: '#fa755a',
}

type ByType = Partial<Record<TrendType, TrendPoint[]>>
type TypeAverages = Partial<Record<TrendType, number | null>>

function buildLinePath(points: TrendPoint[], width: number, height: number, padX: number, padY: number) {
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  if (points.length === 0) return { path: '', dots: [] as Array<{ x: number; y: number; point: TrendPoint }> }

  const xs = points.map((_, index) =>
    points.length === 1 ? padX + innerW / 2 : padX + (index / (points.length - 1)) * innerW
  )
  const ys = points.map(
    (point) => padY + innerH - (Math.min(100, Math.max(0, point.percent)) / 100) * innerH
  )
  const path = points
    .map((_, index) => `${index === 0 ? 'M' : 'L'} ${xs[index].toFixed(1)} ${ys[index].toFixed(1)}`)
    .join(' ')
  const dots = points.map((point, index) => ({ x: xs[index], y: ys[index], point }))
  return { path, dots }
}

export function PerformanceTrendChart({
  byType,
  typeAverages,
  enabledTypes,
  onToggleType,
  typeLabels,
  emptyLabel = 'No graded results yet for this selection.',
  categoryAveragesLabel = 'Category averages',
  trendsLabel = 'Trends over time',
}: {
  byType: ByType
  typeAverages: TypeAverages
  enabledTypes: TrendType[]
  onToggleType: (type: TrendType) => void
  typeLabels: Record<TrendType, string>
  emptyLabel?: string
  categoryAveragesLabel?: string
  trendsLabel?: string
}) {
  const allTypes: TrendType[] = ['QUIZ', 'EXAM', 'ASSIGNMENT']
  const enabledSet = new Set(enabledTypes)
  const hasAnyData = allTypes.some((type) => (byType[type]?.length || 0) > 0)

  const width = 640
  const height = 220
  const padX = 32
  const padY = 20
  const innerH = height - padY * 2

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Result types">
        {allTypes.map((type) => {
          const active = enabledSet.has(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggleType(type)}
              className={`inline-flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ease ${
                active
                  ? 'border-[#635bff] bg-[#f0effe] text-[#635bff]'
                  : 'border-(--border-subtle) bg-(--surface) ui-text-secondary hover:bg-(--field-bg)'
              }`}
              aria-pressed={active}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: active ? TREND_TYPE_COLOR[type] : 'var(--text-secondary)' }}
              />
              {typeLabels[type]}
            </button>
          )
        })}
      </div>

      {!hasAnyData ? (
        <p className="py-8 text-center text-sm ui-text-secondary">{emptyLabel}</p>
      ) : (
        <>
          <div>
            <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
              {categoryAveragesLabel}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {allTypes.map((type) => {
                if (!enabledSet.has(type)) return null
                const value = typeAverages[type]
                const pct = value == null ? 0 : Math.min(100, Math.max(0, value))
                return (
                  <div
                    key={type}
                    className="rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) px-3 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium ui-text-primary">{typeLabels[type]}</span>
                      <span className="text-sm font-semibold ui-text-primary">
                        {value == null ? '—' : `${value}%`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-[6px] bg-(--surface) border border-(--border-subtle)">
                      <div
                        className="h-full rounded-[6px] transition-all duration-150 ease"
                        style={{
                          width: `${pct}%`,
                          background: TREND_TYPE_COLOR[type],
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
              {trendsLabel}
            </p>
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[320px]" role="img">
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = padY + innerH - (tick / 100) * innerH
                  return (
                    <g key={tick}>
                      <line
                        x1={padX}
                        x2={width - padX}
                        y1={y}
                        y2={y}
                        stroke="var(--border-subtle)"
                        strokeWidth="1"
                      />
                      <text
                        x={padX - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="var(--text-secondary)"
                      >
                        {tick}
                      </text>
                    </g>
                  )
                })}

                {allTypes.map((type) => {
                  if (!enabledSet.has(type)) return null
                  const series = byType[type] || []
                  if (series.length === 0) return null
                  const { path, dots } = buildLinePath(series, width, height, padX, padY)
                  return (
                    <g key={type}>
                      <path
                        d={path}
                        fill="none"
                        stroke={TREND_TYPE_COLOR[type]}
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      {dots.map(({ x, y, point }) => (
                        <circle
                          key={point.assessmentId}
                          cx={x}
                          cy={y}
                          r="3.5"
                          fill={TREND_TYPE_COLOR[type]}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        >
                          <title>
                            {point.title} · {typeLabels[type]} · {point.percent}%
                          </title>
                        </circle>
                      ))}
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
