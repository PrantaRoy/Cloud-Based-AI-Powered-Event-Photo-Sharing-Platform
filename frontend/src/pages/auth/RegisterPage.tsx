import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { ApiError } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { register } = useAuth()

  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from
  const redirectTo =
    from && from.pathname !== '/register' && from.pathname !== '/login'
      ? from.pathname + (from.search ?? '')
      : '/dashboard/events'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fieldError = (key: string) => fieldErrors[key]?.[0]

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: ['Passwords do not match.'] })
      return
    }

    setSubmitting(true)
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
      })
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm border border-gray-300 p-6">
        <h1 className="mb-1 text-lg font-semibold text-black">EventPro</h1>
        <p className="mb-6 text-sm text-gray-500">Create your account</p>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Name"
            type="text"
            name="name"
            autoComplete="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldError('name')}
          />
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError('email')}
          />
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldError('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            name="password_confirmation"
            autoComplete="new-password"
            required
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            error={fieldError('password_confirmation')}
          />
          <p className="text-xs text-gray-500">Use at least 12 characters, with uppercase, lowercase, a number, and a symbol.</p>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-black underline hover:no-underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
