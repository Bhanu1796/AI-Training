import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { useEffect } from 'react'

export function useAuth() {
  const { user, setUser } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (data) setUser(data)
    if (error) setUser(null)
  }, [data, error, setUser])

  return { user: data ?? user, isLoading, isAuthenticated: !!(data ?? user) }
}
