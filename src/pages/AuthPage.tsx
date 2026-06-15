import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        if (data.session && data.user) {
          // Email confirmation disabled — user is immediately authenticated
          const { error: insertError } = await supabase
            .from('users')
            .insert({ id: data.user.id, name: '' })
          // Ignore unique-violation if row already exists
          if (insertError && insertError.code !== '23505') throw insertError
          navigate('/profile')
        } else {
          setError('Check your email to confirm your account, then log in.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        // Check whether profile setup is complete
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', data.user.id)
          .single()

        navigate(!profile?.name ? '/profile' : '/rooms')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-700 mb-1">שותפים</h1>
          <p className="text-sm text-gray-500">מצא את הדירה המושלמת לידך</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-700 text-white text-sm font-medium rounded-xl hover:bg-purple-800 active:bg-purple-900 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loading…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
