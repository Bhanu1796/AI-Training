import { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { ThreadSidebar } from '@/components/chat/ThreadSidebar'
import { MessageList } from '@/components/chat/MessageList'
import { InputBar } from '@/components/chat/InputBar'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/hooks/useAuth'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, chatApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import type { Thread } from '@/types'

export default function ChatPage() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const { user } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()

  const { messages, streamingContent, sendMessage } = useChat(activeThreadId)
  const [isSending, setIsSending] = useState(false)

  // Clear active thread if it was deleted
  const threads = queryClient.getQueryData<Thread[]>(['threads']) ?? []
  useEffect(() => {
    if (activeThreadId && threads.length > 0 && !threads.find((t) => t.id === activeThreadId)) {
      setActiveThreadId(null)
    }
  }, [threads, activeThreadId])

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setUser(null)
      queryClient.clear()
    },
  })

  const handleSend = async (content: string) => {
    setIsSending(true)
    try {
      const title = content.length > 40 ? content.slice(0, 40).trimEnd() + '\u2026' : content
      if (!activeThreadId) {
        const thread = await chatApi.createThread(title)
        queryClient.setQueryData<Thread[]>(['threads'], (prev) => [thread, ...(prev ?? [])])
        setActiveThreadId(thread.id)
        await sendMessage(content, thread.id)
        // Sync sidebar with server
        queryClient.invalidateQueries({ queryKey: ['threads'] })
      } else {
        const threads = queryClient.getQueryData<Thread[]>(['threads']) ?? []
        const current = threads.find((t) => t.id === activeThreadId)
        if (current?.title === 'New Chat') {
          chatApi.renameThread(activeThreadId, title).then((updated) => {
            queryClient.setQueryData<Thread[]>(['threads'], (prev) =>
              (prev ?? []).map((t) => (t.id === activeThreadId ? updated : t))
            )
          }).catch(() => {})
        }
        await sendMessage(content)
      }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <ThreadSidebar
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <h1 className="text-lg font-semibold tracking-tight">Amzur AI Chat</h1>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold select-none">
                    {(user.full_name ?? user.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                    {user.full_name ?? user.email}
                  </span>
                </div>
                <button
                  onClick={() => logout.mutate()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            )}
          </div>
        </header>

        {/* Messages */}
        {activeThreadId ? (
          <MessageList messages={messages} streamingContent={streamingContent} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg font-medium">Welcome to Amzur AI Chat</p>
              <p className="text-sm mt-1">Select a chat or create a new one to get started.</p>
            </div>
          </div>
        )}

        {/* Input */}
        <InputBar
          onSend={handleSend}
          threadId={activeThreadId}
          disabled={isSending}
          placeholder={activeThreadId ? 'Type a message… (Enter to send)' : 'Type a message to start a new chat…'}
        />
      </div>
    </div>
  )
}
