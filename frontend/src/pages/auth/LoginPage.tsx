import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { checkEmail } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

type Step = 'email' | 'password'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleEmailSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await checkEmail(email.trim())
      if (result.exists) {
        setStep('password')
      } else {
        setError('No account found with that email.')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/dashboard/events', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleChangeEmail() {
    setStep('email')
    setPassword('')
    setError(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm border border-gray-300 p-6">
        <h1 className="mb-1 text-lg font-semibold text-black">EventPro</h1>
        <p className="mb-6 text-sm text-gray-500">Sign in to your account</p>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" name="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" value={email} readOnly disabled />
            <button
              type="button"
              onClick={handleChangeEmail}
              className="self-start text-xs text-gray-600 underline hover:no-underline"
            >
              Change email
            </button>
            <Input
              label="Password"
              type="password"
              name="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
