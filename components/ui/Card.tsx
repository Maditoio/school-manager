import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}

export function Card({ children, className = '', title, action }: CardProps) {
  return (
    <div
      className={`ui-surface ${className}`}
    >
      {(title || action) && (
        <div className="px-4 py-3 flex justify-between items-center">
          {title && <h3 className="text-base font-semibold ui-text-primary">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function StatCard({ title, value, icon, trend }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium ui-text-secondary">{title}</p>
          <p className="text-2xl font-semibold ui-text-primary mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}%
            </p>
          )}
        </div>
        {icon && (
          <div className="h-9 w-9 rounded-lg bg-(--surface-soft) ui-text-secondary flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
