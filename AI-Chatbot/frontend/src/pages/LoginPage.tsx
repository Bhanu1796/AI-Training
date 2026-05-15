import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

export default function LoginPage() {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: providers } = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: authApi.providers,
    staleTime: Infinity,
  })

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? authApi.login(email, password)
        : authApi.register(email, password, fullName || undefined),
    onSuccess: (data) => {
      setUser(data.user)
      queryClient.setQueryData(['auth', 'me'], data.user)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data
          ?.detail?.message ?? 'An error occurred'
      setError(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  const handleGoogleLogin = async () => {
    try {
      const { redirect_url } = await authApi.googleLoginUrl()
      window.location.href = redirect_url
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data
          ?.detail?.message ?? 'Google OAuth is not configured on this server.'
      setError(msg)
    }
  }

  const inputClass =
    'w-full px-4 h-12 rounded-2xl bg-white/60 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200'

  return (
    <div className="min-h-screen flex items-center justify-center ai-bg px-4">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-blue-500/[0.07] blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-cyan-400/[0.07] blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-sky-400/[0.04] blur-[80px]" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 blur-xl opacity-40" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 flex items-center justify-center shadow-glow-blue">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Amzur AI</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[32px] p-7 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
          {/* Mode toggle */}
          <div className="flex rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 p-1 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  mode === m
                    ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <input
                type="text"
                placeholder="Full name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-2xl bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:via-sky-400 hover:to-cyan-300 text-white text-sm font-semibold disabled:opacity-60 transition-all duration-200 shadow-glow-blue hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-4"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mutation.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {providers?.google && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white/80 text-xs text-slate-400 rounded-full">or continue with</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl border border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300 text-sm font-medium text-slate-700 transition-all duration-200 hover:shadow-panel active:scale-[0.99]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
