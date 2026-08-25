import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`border px-3 py-2 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black disabled:bg-gray-50 disabled:text-gray-500 ${
          error ? 'border-gray-900' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-gray-700">{error}</p>}
    </div>
  )
}
