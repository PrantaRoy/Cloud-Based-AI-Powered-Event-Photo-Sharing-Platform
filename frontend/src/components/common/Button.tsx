import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-black text-white border border-black hover:bg-gray-800 disabled:bg-gray-300 disabled:border-gray-300',
  secondary: 'bg-white text-black border border-gray-400 hover:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200',
  danger:
    'bg-white text-black border border-gray-900 hover:bg-gray-900 hover:text-white disabled:text-gray-400 disabled:border-gray-200',
  ghost: 'bg-transparent text-black border border-transparent hover:bg-gray-100 disabled:text-gray-400',
  success:
    'bg-green-600 text-white border border-green-600 hover:bg-green-600 disabled:bg-green-600 disabled:border-green-600 disabled:opacity-100 disabled:cursor-default',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
