import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium ui-text-secondary mb-2">
          {label}
        </label>
      )}
      <input
        className={`ui-input ${
          error ? 'border-rose-400 bg-rose-50' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options?: { value: string; label: string }[]
  children?: React.ReactNode
}

export function Select({ label, error, options, children, className = '', ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium ui-text-secondary mb-2">
          {label}
        </label>
      )}
      <select
        className={`ui-select ${
          error ? 'border-rose-400 bg-rose-50' : ''
        } ${className}`}
        {...props}
      >
        {options ? options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        )) : children}
      </select>
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  )
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function TextArea({ label, error, className = '', ...props }: TextAreaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium ui-text-secondary mb-2">
          {label}
        </label>
      )}
      <textarea
        className={`ui-textarea ${
          error ? 'border-rose-400 bg-rose-50' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  )
}
