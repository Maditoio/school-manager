'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getClientLocale, translateText } from '@/lib/client-i18n'
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  MoreHorizontal,
  Search,
} from 'lucide-react'

type RowData = object

type TableColumn<T extends RowData = RowData> = {
  key: string
  label: string
  sortable?: boolean
  renderCell?: (row: T) => React.ReactNode
  exportValue?: (row: T) => string | number | boolean | null | undefined
}

type TableAction<T extends RowData = RowData> = {
  label: string
  danger?: boolean
  onClick?: (row: T) => void
}

type FilterOption = {
  value: string
  label: string
}

type TableProps<T extends RowData = RowData> = {
  title?: string
  columns?: TableColumn<T>[]
  data?: T[]
  onSort?: (key: string) => void
  onSearch?: (value: string) => void
  onPageChange?: (page: number) => void
  page?: number
  pageSize?: number
  totalCount?: number
  loading?: boolean
  emptyMessage?: string
  filterLabel?: string
  filterOptions?: FilterOption[]
  activeFilter?: string
  onFilterChange?: (value: string) => void
  onFilterClick?: () => void
  onExport?: () => void
  headerControls?: React.ReactNode
  getRowActions?: (row: T) => TableAction<T>[]
  rowKey?: string
  ariaLabel?: string
}

function buildPageWindow(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5]
  }

  if (currentPage >= totalPages - 2) {
    return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2]
}

function formatRange(startIndex: number, endIndex: number, totalCount: number, locale: ReturnType<typeof getClientLocale>) {
  const showing = translateText('Showing', locale)
  const ofWord = translateText('of', locale)
  const results = translateText('results', locale)
  if (totalCount === 0) return `${showing} 0 ${ofWord} 0 ${results}`
  return `${showing} ${startIndex + 1}–${Math.min(endIndex, totalCount)} ${ofWord} ${totalCount} ${results}`
}

function normalizeExportValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function escapeCsvCell(value: string): string {
  const escaped = value.replaceAll('"', '""')
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`
  }
  return escaped
}

export default function Table<T extends RowData = RowData>({
  title = 'Data Table',
  columns = [],
  data = [],
  onSort,
  onSearch,
  onPageChange,
  page = 1,
  pageSize = 10,
  totalCount,
  loading = false,
  emptyMessage = 'No records found.',
  filterLabel = 'Filter',
  filterOptions,
  activeFilter,
  onFilterChange,
  onFilterClick,
  onExport,
  headerControls,
  getRowActions,
  rowKey = 'id',
  ariaLabel,
}: TableProps<T>) {
  const locale = getClientLocale()
  const tTitle = translateText(title, locale)
  const tEmptyMessage = translateText(emptyMessage, locale)
  const tFilterLabel = translateText(filterLabel, locale)
  const tSearchPlaceholder = translateText('Search...', locale)

  const [searchValue, setSearchValue] = useState('')
  const [selectedRowKey, setSelectedRowKey] = useState<string | number | null>(null)
  const [openMenuState, setOpenMenuState] = useState<{
    key: string | number
    top: number
    left: number
    row: T
    actions: TableAction<T>[]
  } | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const menuContainerRef = useRef<HTMLDivElement | null>(null)
  const filterContainerRef = useRef<HTMLDivElement | null>(null)

  const resolvedTotal = Number.isFinite(totalCount) ? Number(totalCount) : data.length
  const resolvedPage = Math.max(1, Math.min(page, Math.max(1, Math.ceil(resolvedTotal / pageSize))))
  const startIndex = (resolvedPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const totalPages = Math.max(1, Math.ceil(resolvedTotal / pageSize))

  const visibleRows = Number.isFinite(totalCount) ? data : data.slice(startIndex, endIndex)

  const pageWindow = useMemo(() => buildPageWindow(resolvedPage, totalPages), [resolvedPage, totalPages])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedMenu = menuContainerRef.current?.contains(target)
      const clickedFilter = filterContainerRef.current?.contains(target)

      if (!clickedMenu) {
        setOpenMenuState(null)
      }

      if (!clickedFilter) {
        setIsFilterOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuState(null)
        setIsFilterOpen(false)
      }
    }

    const closeMenu = () => {
      setOpenMenuState(null)
    }

    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [])

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setSearchValue(next)
    onSearch?.(next)
    onPageChange?.(1)
  }

  const handlePageChange = (nextPage: number) => {
    const bounded = Math.max(1, Math.min(nextPage, totalPages))
    if (bounded === resolvedPage) return
    onPageChange?.(bounded)
  }

  const handleExport = () => {
    if (onExport) {
      onExport()
      return
    }

    const rowsForExport = visibleRows
    const csvHeader = columns.map((column) => escapeCsvCell(column.label)).join(',')
    const csvRows = rowsForExport.map((row) => {
      const rowRecord = row as Record<string, unknown>
      const cells = columns.map((column) => {
        const rawValue = column.exportValue ? column.exportValue(row) : rowRecord[column.key]
        return escapeCsvCell(normalizeExportValue(rawValue))
      })
      return cells.join(',')
    })

    const csvContent = [csvHeader, ...csvRows].join('\n')
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' })
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const slug = (title || 'table-data')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    link.href = blobUrl
    link.download = `${slug || 'table-data'}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }

  const renderHeaderCell = (column: TableColumn<T>) => {
    const sortable = Boolean(column.sortable)
    const tLabel = translateText(column.label, locale)

    if (!sortable) {
      return <span>{tLabel}</span>
    }

    return (
      <button
        type="button"
        onClick={() => onSort?.(column.key)}
        className="group inline-flex items-center gap-1.5 text-left text-inherit"
      >
        <span>{tLabel}</span>
        <ArrowDownUp className="h-3.5 w-3.5 opacity-0 transition-opacity duration-150 ease-in-out group-hover:opacity-70" />
      </button>
    )
  }

  const renderStatusPill = (value: unknown) => {
    const normalized = String(value || '').toUpperCase()

    if (normalized.includes('ACTIVE') || normalized.includes('PAID') || normalized.includes('GRADED') || normalized.includes('PRESENT')) {
      return (
        <span
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
          style={{
            color: '#059669',
            background: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.35)',
          }}
        >
          {String(value)}
        </span>
      )
    }

    if (normalized.includes('PENDING') || normalized.includes('PARTIAL') || normalized.includes('LATE') || normalized.includes('NOT GRADED')) {
      return (
        <span
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
          style={{
            color: '#b45309',
            background: 'rgba(245, 158, 11, 0.08)',
            borderColor: 'rgba(245, 158, 11, 0.35)',
          }}
        >
          {String(value)}
        </span>
      )
    }

    return (
      <span
        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
        style={{
          color: '#be123c',
          background: 'rgba(244, 63, 94, 0.08)',
          borderColor: 'rgba(244, 63, 94, 0.35)',
        }}
      >
        {String(value)}
      </span>
    )
  }

  return (
    <section
      className="relative overflow-visible rounded-2xl border"
      style={{
        background: 'color-mix(in srgb, var(--surface) 92%, #111420 8%)',
        borderColor: 'var(--border-subtle)',
        fontFamily: '"Plus Jakarta Sans", "DM Sans", system-ui, sans-serif',
      }}
      aria-label={ariaLabel || title || 'Data table'}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h3 className="truncate text-[15px] font-semibold ui-text-primary">{tTitle}</h3>

        <div className="flex items-center gap-2">
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ui-text-secondary" />
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={tSearchPlaceholder}
              className="h-8 w-40 rounded-lg border pl-8 pr-2.5 text-[12px] transition-all duration-200 ease-in-out focus:outline-none"
              style={{
                background: 'var(--field-bg)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'none',
              }}
              onFocus={(event) => {
                event.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 45%, transparent)'
                event.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'
                event.currentTarget.style.background = 'var(--field-focus-bg)'
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = 'var(--border-subtle)'
                event.currentTarget.style.boxShadow = 'none'
                event.currentTarget.style.background = 'var(--field-bg)'
              }}
              aria-label="Search table"
            />
          </label>

          {headerControls ? <div className="hidden sm:flex items-center">{headerControls}</div> : null}

          <div className="relative" ref={filterContainerRef}>
            <button
              type="button"
              onClick={() => {
                if (filterOptions?.length) {
                  setIsFilterOpen((prev) => !prev)
                } else {
                  onFilterClick?.()
                }
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/45"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--field-bg)',
                color: 'var(--text-primary)',
              }}
              aria-label="Filter table"
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--field-focus-bg)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'var(--field-bg)'
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{tFilterLabel}</span>
            </button>

            {filterOptions?.length && isFilterOpen ? (
              <div
                className="absolute right-0 z-90 mt-1.5 min-w-44 max-w-80 rounded-xl border border-white/15 bg-[#13151F]/85 p-1.5 backdrop-blur-xl"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'color-mix(in srgb, var(--surface) 92%, var(--background) 8%)',
                  width: 'max-content',
                  transform: 'translateY(0)',
                  opacity: 1,
                  transition: 'transform 150ms ease, opacity 150ms ease',
                }}
              >
                {filterOptions.map((option) => {
                  const active = option.value === activeFilter
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onFilterChange?.(option.value)
                        onPageChange?.(1)
                        setIsFilterOpen(false)
                      }}
                      className="flex w-full items-center whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ease-in-out"
                      style={{
                        background: active ? 'var(--accent-soft)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={(event) => {
                        if (!active) {
                          event.currentTarget.style.background = 'var(--field-bg)'
                          event.currentTarget.style.color = 'var(--text-primary)'
                        }
                      }}
                      onMouseLeave={(event) => {
                        if (!active) {
                          event.currentTarget.style.background = 'transparent'
                          event.currentTarget.style.color = 'var(--text-secondary)'
                        }
                      }}
                    >
                      {translateText(option.label, locale)}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/45"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--field-bg)',
              color: 'var(--text-primary)',
            }}
            aria-label="Export table data"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--field-focus-bg)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'var(--field-bg)'
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="text-left" style={{ background: 'color-mix(in srgb, var(--surface-soft) 88%, var(--background) 12%)' }}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] ui-text-secondary"
                >
                  {renderHeaderCell(column)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: Math.min(pageSize, 6) }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-b" style={{ borderColor: 'color-mix(in srgb, var(--border-subtle) 70%, transparent)' }}>
                    {columns.map((column) => (
                      <td key={`${column.key}-${index}`} className="px-4 py-3.5">
                        <div
                          className="h-4 w-full rounded-md"
                          style={{
                            background:
                              'linear-gradient(90deg, color-mix(in srgb, var(--text-secondary) 12%, transparent) 0%, color-mix(in srgb, var(--text-secondary) 24%, transparent) 50%, color-mix(in srgb, var(--text-secondary) 12%, transparent) 100%)',
                            backgroundSize: '200% 100%',
                            animation: 'table-shimmer 1.2s linear infinite',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : visibleRows.map((row, rowIndex) => {
                  const rowRecord = row as Record<string, unknown>
                  const key = (rowRecord[rowKey] ?? `${rowIndex}`) as string | number
                  const actions = getRowActions?.(row) ?? []
                  const isSelected = key === selectedRowKey
                  const striped = rowIndex % 2 === 1

                  return (
                    <tr
                      key={String(key)}
                      onClick={() => setSelectedRowKey(key)}
                      className="group border-b transition-all duration-150 ease-in-out"
                      style={{
                        borderColor: 'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                        background: isSelected
                          ? 'color-mix(in srgb, var(--accent-soft) 85%, transparent)'
                          : striped
                            ? 'color-mix(in srgb, var(--surface-soft) 65%, transparent)'
                            : 'transparent',
                        boxShadow: isSelected
                          ? 'inset 3px 0 0 var(--accent), inset 0 0 12px color-mix(in srgb, var(--accent) 16%, transparent)'
                          : 'none',
                      }}
                      onMouseEnter={(event) => {
                        if (!isSelected) {
                          event.currentTarget.style.background = 'color-mix(in srgb, var(--accent-soft) 70%, transparent)'
                          event.currentTarget.style.boxShadow = 'inset 3px 0 0 var(--accent)'
                        }
                      }}
                      onMouseLeave={(event) => {
                        if (!isSelected) {
                          event.currentTarget.style.background = striped
                            ? 'color-mix(in srgb, var(--surface-soft) 65%, transparent)'
                            : 'transparent'
                          event.currentTarget.style.boxShadow = 'none'
                        }
                      }}
                    >
                      {columns.map((column) => {
                        if (column.key === 'actions') {
                          return (
                            <td key={`${key}-${column.key}`} className="px-4 py-3 text-right">
                              <div className="relative inline-flex">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    const rect = event.currentTarget.getBoundingClientRect()
                                    const menuWidth = 176
                                    const viewportPadding = 8
                                    const left = Math.min(
                                      Math.max(viewportPadding, rect.right - menuWidth),
                                      window.innerWidth - menuWidth - viewportPadding
                                    )

                                    setOpenMenuState((prev) => {
                                      if (prev?.key === key) {
                                        return null
                                      }

                                      return {
                                        key,
                                        top: rect.bottom + 6,
                                        left,
                                        row,
                                        actions,
                                      }
                                    })
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 ease-in-out"
                                  style={{
                                    borderColor: 'var(--border-subtle)',
                                    background: 'var(--field-bg)',
                                    color: 'var(--text-secondary)',
                                  }}
                                  aria-label="Open row actions"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--field-focus-bg)'
                                    e.currentTarget.style.color = 'var(--text-primary)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--field-bg)'
                                    e.currentTarget.style.color = 'var(--text-secondary)'
                                  }}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )
                        }

                        const rendered: React.ReactNode = column.renderCell
                          ? column.renderCell(row)
                          : typeof rowRecord[column.key] === 'string' && column.key.toLowerCase().includes('status')
                            ? renderStatusPill(rowRecord[column.key])
                            : (rowRecord[column.key] as React.ReactNode) ?? '—'

                        return (
                          <td
                            key={`${key}-${column.key}`}
                            className="px-4 py-3 text-[13.5px] ui-text-primary"
                          >
                            {rendered}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

            {!loading && visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm ui-text-secondary">
                  {tEmptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div
        className="flex min-h-13 items-center justify-between border-t px-4 sm:px-5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <p className="text-[12px] ui-text-secondary">{formatRange(startIndex, endIndex, resolvedTotal, locale)}</p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(resolvedPage - 1)}
            disabled={resolvedPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--field-bg)',
              color: 'var(--text-secondary)',
            }}
            aria-label="Previous page"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = 'var(--field-focus-bg)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--field-bg)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageWindow.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => handlePageChange(pageNumber)}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-all duration-200 ease-in-out"
              style={
                pageNumber === resolvedPage
                  ? {
                      borderColor: 'color-mix(in srgb, var(--accent) 55%, transparent)',
                      background: 'var(--accent-soft)',
                      color: 'var(--text-primary)',
                    }
                  : {
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--field-bg)',
                      color: 'var(--text-secondary)',
                    }
              }
              aria-label={`Page ${pageNumber}`}
              aria-current={pageNumber === resolvedPage ? 'page' : undefined}
              onMouseEnter={(e) => {
                if (pageNumber !== resolvedPage) {
                  e.currentTarget.style.background = 'var(--field-focus-bg)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (pageNumber !== resolvedPage) {
                  e.currentTarget.style.background = 'var(--field-bg)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handlePageChange(resolvedPage + 1)}
            disabled={resolvedPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--field-bg)',
              color: 'var(--text-secondary)',
            }}
            aria-label="Next page"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = 'var(--field-focus-bg)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--field-bg)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes table-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>

      {openMenuState ? (
        <div
          ref={menuContainerRef}
          className="fixed z-120 min-w-44 rounded-xl border p-1.5 backdrop-blur-xl"
          style={{
            borderColor: 'var(--border-subtle)',
            background: 'color-mix(in srgb, var(--surface) 92%, var(--background) 8%)',
            top: openMenuState.top,
            left: openMenuState.left,
            transform: 'translateY(0)',
            opacity: 1,
            transition: 'transform 150ms ease, opacity 150ms ease',
          }}
        >
          {openMenuState.actions.length > 0 ? (
            openMenuState.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  action.onClick?.(openMenuState.row)
                  setOpenMenuState(null)
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                style={{ color: action.danger ? '#be123c' : 'var(--text-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = action.danger
                    ? 'rgba(244, 63, 94, 0.12)'
                    : 'var(--field-bg)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {translateText(action.label, locale)}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm ui-text-secondary">No actions</div>
          )}
        </div>
      ) : null}
    </section>
  )
}
