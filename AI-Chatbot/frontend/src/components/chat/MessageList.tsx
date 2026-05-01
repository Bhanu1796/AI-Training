import { useEffect, useRef } from 'react'
import { ChatMessage } from './ChatMessage'
import type { Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  streamingContent: string | null
}

export function MessageList({ messages, streamingContent }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {streamingContent !== null && (
        <div className="flex justify-start mb-4">
          <div className="max-w-3xl px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-justify">
            <p className="whitespace-pre-wrap">{streamingContent || '...'}</p>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
