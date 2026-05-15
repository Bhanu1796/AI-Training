import { useEffect, useRef } from 'react'
import { Sparkles, ImageIcon, Table2 } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import type { Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  streamingContent: string | null
  isSqlQuerying?: boolean
  isDataQuerying?: boolean
  isImageGenerating?: boolean
  isGenerating?: boolean
  userInitial: string
  onRetry: (userContent: string, assistantMsgId: string) => void
}

export function MessageList({ messages, streamingContent, isSqlQuerying, isDataQuerying, isImageGenerating, isGenerating, userInitial, onRetry }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, isSqlQuerying, isDataQuerying])

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
              isGenerating={isGenerating}
              onRetry={prevUserMsg ? () => onRetry(prevUserMsg.content, msg.id) : undefined}
              onEdit={msg.role === 'user' ? (newContent) => onRetry(newContent, '') : undefined}
            />
          )
        })}

        {streamingContent !== null && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0 mt-0.5 shadow-glow-blue">
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            </div>
            <div className="max-w-[75%] px-4 py-3 rounded-[24px] rounded-tl-lg bg-white border border-slate-200/60 text-sm text-slate-700 leading-relaxed shadow-panel">
              <p className="whitespace-pre-wrap">{streamingContent || '\u2026'}</p>
            </div>
          </div>
        )}

        {isSqlQuerying && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-400 flex items-center justify-center shrink-0 mt-0.5 shadow-glow-cyan">
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            </div>
            <div className="px-4 py-3 rounded-[24px] rounded-tl-lg bg-white border border-cyan-200/60 text-sm text-cyan-700 leading-relaxed flex items-center gap-2.5 shadow-panel">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:300ms]" />
              </span>
              Querying database…
            </div>
          </div>
        )}

        {isDataQuerying && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shrink-0 mt-0.5">
              <Table2 className="w-3.5 h-3.5 text-white animate-pulse" />
            </div>
            <div className="px-4 py-3 rounded-[24px] rounded-tl-lg bg-white border border-violet-200/60 text-sm text-violet-700 leading-relaxed flex items-center gap-2.5 shadow-panel">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
              </span>
              Analysing data…
            </div>
          </div>
        )}

        {isImageGenerating && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-400 flex items-center justify-center shrink-0 mt-0.5">
              <ImageIcon className="w-3.5 h-3.5 text-white animate-pulse" />
            </div>
            <div className="px-4 py-3 rounded-[24px] rounded-tl-lg bg-white border border-violet-200/60 text-sm text-violet-700 leading-relaxed flex items-center gap-2.5 shadow-panel">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
              </span>
              Generating image…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

