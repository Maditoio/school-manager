import React from 'react'
import { getClientLocale, translateNode, translateText } from '@/lib/client-i18n'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  const locale = getClientLocale()

  const translatedLabel = label ? translateText(label, locale) : label
  const translatedPlaceholder =
    typeof props.placeholder === 'string' ? translateText(props.placeholder, locale) : props.placeholder

  return (
    <div className="w-full">
      {translatedLabel && (
        <label className="block text-sm font-medium ui-text-secondary mb-2">
          {translatedLabel}
        </label>
      )}
      <input
        className={`ui-input ${
          error ? 'border-rose-400 bg-rose-50' : ''
        } ${className}`}
        {...props}
        placeholder={translatedPlaceholder}
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
  const locale = getClientLocale()
  const translatedLabel = label ? translateText(label, locale) : label

  return (
    <div className="w-full">
      {translatedLabel && (
        <label className="block text-sm font-medium ui-text-secondary mb-2">
          {translatedLabel}
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
            {translateText(option.label, locale)}
          </option>
        )) : translateNode(children, locale)}
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
  const locale = getClientLocale()
  const translatedLabel = label ? translateText(label, locale) : label
  const translatedPlaceholder =
    typeof props.placeholder === 'string' ? translateText(props.placeholder, locale) : props.placeholder

  return (
    <div className="w-full">
      {translatedLabel && (
        <label className="block text-sm font-medium ui-text-secondary mb-2">
          {translatedLabel}
        </label>
      )}
      <textarea
        className={`ui-textarea ${
          error ? 'border-rose-400 bg-rose-50' : ''
        } ${className}`}
        {...props}
        placeholder={translatedPlaceholder}
      />
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  )
}
