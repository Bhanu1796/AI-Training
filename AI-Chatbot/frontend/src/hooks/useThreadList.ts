import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/lib/api'
import type { Thread } from '@/types'

export function useThreadList() {
  const queryClient = useQueryClient()

  const { data: threads = [], isLoading } = useQuery<Thread[]>({
    queryKey: ['threads'],
    queryFn: chatApi.listThreads,
    staleTime: 30_000,
  })

  const createThread = useMutation({
    mutationFn: (title?: string) => chatApi.createThread(title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['threads'] }),
  })

  const deleteThread = useMutation({
    mutationFn: (threadId: string) => chatApi.deleteThread(threadId),
    onMutate: async (threadId) => {
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      const previous = queryClient.getQueryData<Thread[]>(['threads'])
      queryClient.setQueryData<Thread[]>(['threads'], (prev) =>
        (prev ?? []).filter((t) => t.id !== threadId)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['threads'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['threads'] }),
  })

  const renameThread = useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      chatApi.renameThread(threadId, title),
    onMutate: async ({ threadId, title }) => {
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      const previous = queryClient.getQueryData<Thread[]>(['threads'])
      queryClient.setQueryData<Thread[]>(['threads'], (prev) =>
        (prev ?? []).map((t) => (t.id === threadId ? { ...t, title } : t))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['threads'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['threads'] }),
  })

  return { threads, isLoading, createThread, deleteThread, renameThread }
}
