import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) setError(error.message)
    setLoading(false)
  }

  function switchMode(next) {
    setMode(next)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface-container-low p-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="serif-italic text-4xl text-primary mb-2">FinanceOS</h1>
          <p className="label-caps text-on-surface-variant opacity-60 tracking-widest">
            Sovereign Curator
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex mb-8 border-b border-outline-variant">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 pb-3 label-caps text-sm transition-colors ${
              mode === 'login'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchMode('register')}
            className={`flex-1 pb-3 label-caps text-sm transition-colors ${
              mode === 'register'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {error && (
            <div className="text-error text-sm py-2 border-b border-error/30">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1">
            <label className="label-caps text-on-surface-variant text-xs">Email</label>
            <input
              type="email"
              className="w-full bg-transparent border-b border-outline focus:border-primary text-sm py-2 text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="label-caps text-on-surface-variant text-xs">Password</label>
            <input
              type="password"
              className="w-full bg-transparent border-b border-outline focus:border-primary text-sm py-2 text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-b from-primary to-primary-container text-on-primary label-caps font-bold py-4 mt-4 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading
              ? 'Loading...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-on-surface-variant/40 text-xs mt-10 label-caps">
          FinanceOS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
