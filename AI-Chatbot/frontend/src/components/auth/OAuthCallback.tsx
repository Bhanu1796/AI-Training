import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

export function OAuthCallback() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    authApi
      .me()
      .then((user) => {
        setUser(user)
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
        navigate('/')
      })
      .catch(() => navigate('/login'))
  }, [navigate, queryClient, setUser])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Completing sign-in…</p>
    </div>
  )
}
