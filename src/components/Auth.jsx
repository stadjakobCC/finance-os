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
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-[2rem] p-10 shadow-sm border border-outline-variant/10">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface mb-1">FinanceOS</h1>
          <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
            Premium Member
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex mb-8 bg-surface-container-low p-1 rounded-xl">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {error && (
            <div className="text-tertiary text-sm py-2 px-4 bg-tertiary/5 rounded-xl border border-tertiary/10">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Email</label>
            <input
              type="email"
              className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/40 text-on-surface"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Password</label>
            <input
              type="password"
              className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/40 text-on-surface"
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
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-95 duration-200 mt-2"
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
