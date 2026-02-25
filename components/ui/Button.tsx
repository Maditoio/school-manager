import React from 'react'
import { getClientLocale, translateNode } from '@/lib/client-i18n'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  const locale = getClientLocale()

  const baseClasses = 'ui-button inline-flex items-center justify-center focus:outline-none shadow-[0_2px_10px_rgba(15,23,42,0.06)]'

  const variantClasses = {
    primary: 'ui-button-primary focus:shadow-[0_0_0_3px_var(--accent-soft)]',
    secondary: 'ui-button-secondary focus:shadow-[0_0_0_3px_var(--accent-soft)]',
    danger: 'bg-[var(--danger)] text-white hover:brightness-95 hover:-translate-y-0.5 focus:shadow-[0_0_0_3px_rgba(225,29,72,0.18)]',
    ghost: 'bg-transparent text-[var(--text-secondary)] shadow-none hover:bg-[var(--surface-soft)] border border-transparent',
  }

  const sizeClasses = {
    sm: 'h-7 px-3 text-[13px]',
    md: 'h-8 px-3.5 text-[13px]',
    lg: 'h-8 px-4 text-[13px]',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${
        (disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {translateNode(children, locale)}
    </button>
  )
}
