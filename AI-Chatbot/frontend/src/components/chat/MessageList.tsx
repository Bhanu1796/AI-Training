import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import type { Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  streamingContent: string | null
  isSqlQuerying?: boolean
  userInitial: string
  onRetry: (userContent: string) => void
}

export function MessageList({ messages, streamingContent, isSqlQuerying, userInitial, onRetry }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, isSqlQuerying])

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="px-6 py-8 space-y-4 max-w-5xl mx-auto w-full">
        {messages.map((msg, idx) => {
          // Find the user message that preceded this AI message (for retry)
          const prevUserMsg = msg.role === 'assistant'
            ? messages.slice(0, idx).reverse().find((m) => m.role === 'user')
            : undefined
          return (
            <ChatMessage
              key={msg.id}
              message={msg}
              userInitial={userInitial}
              onRetry={prevUserMsg ? () => onRetry(prevUserMsg.content) : undefined}
            />
          )
        })}

        {streamingContent !== null && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[#1e1a2e] border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
            </div>
            <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-[#1c1c1c] border border-white/[0.06] text-sm text-gray-200 leading-relaxed">
              <p className="whitespace-pre-wrap">{streamingContent || '\u2026'}</p>
            </div>
          </div>
        )}

        {isSqlQuerying && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[#0e1a2e] border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-[#1c1c1c] border border-cyan-500/10 text-sm text-cyan-300 leading-relaxed flex items-center gap-2.5">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:300ms]" />
              </span>
              Querying database…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

