import { useCallback, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/lib/api'
import type { Message } from '@/types'

export function useChat(threadId: string | null) {
  const queryClient = useQueryClient()
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const justCreatedRef = useRef(false)

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['messages', threadId],
    queryFn: () => chatApi.listMessages(threadId!),
    enabled: !!threadId && !justCreatedRef.current,
    staleTime: Infinity,
  })

  const sendMessage = useCallback(
    async (content: string, overrideThreadId?: string) => {
      const tid = overrideThreadId ?? threadId
      if (!tid) return

      // Optimistically show user message
      const tempUserMsg: Message = {
        id: crypto.randomUUID(),
        thread_id: tid,
        role: 'user',
        content,
        token_count: null,
        created_at: new Date().toISOString(),
      }
      queryClient.setQueryData<Message[]>(['messages', tid], (prev) => [
        ...(prev ?? []),
        tempUserMsg,
      ])

      setStreamingContent('')

      try {
        const stream = await chatApi.sendMessage(tid, content)
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        let assembled = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          assembled += chunk
          setStreamingContent(assembled)
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          thread_id: tid,
          role: 'assistant',
          content: assembled,
          token_count: null,
          created_at: new Date().toISOString(),
        }
        queryClient.setQueryData<Message[]>(['messages', tid], (prev) => [
          ...(prev ?? []),
          assistantMsg,
        ])
        setStreamingContent(null)

        // Background sync to get real DB ids (1s delay ensures commit is done)
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['messages', tid] })
        }, 1500)
      } catch (err) {
        setStreamingContent(null)
        throw err
      }
    },
    [threadId, queryClient]
  )

  return { messages, isLoading, streamingContent, sendMessage }
}
