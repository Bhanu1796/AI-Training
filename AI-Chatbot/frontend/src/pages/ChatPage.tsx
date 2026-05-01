import { useState, useEffect } from 'react'
import { LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, Code, FileText, Lightbulb } from 'lucide-react'
import { ThreadSidebar } from '@/components/chat/ThreadSidebar'
import { MessageList } from '@/components/chat/MessageList'
import { InputBar } from '@/components/chat/InputBar'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/hooks/useAuth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, chatApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import type { Thread } from '@/types'

const SUGGESTED_PROMPTS = [
  { icon: Lightbulb, label: 'Brainstorm ideas', text: 'Help me brainstorm creative ideas for ' },
  { icon: Code, label: 'Write code', text: 'Write a function that ' },
  { icon: FileText, label: 'Summarize text', text: 'Summarize the following text: ' },
  { icon: Sparkles, label: 'Explain a concept', text: 'Explain in simple terms: ' },
]

export default function ChatPage() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()

  const { messages, streamingContent, sendMessage } = useChat(activeThreadId)
  const [isSending, setIsSending] = useState(false)

  const { data: threads = [] } = useQuery<Thread[]>({ queryKey: ['threads'], queryFn: chatApi.listThreads, staleTime: 30_000 })
  useEffect(() => {
    if (activeThreadId && threads.length > 0 && !threads.find((t) => t.id === activeThreadId)) {
      setActiveThreadId(null)
      setShowInput(false)
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
    setShowInput(true)
    try {
      const title = content.length > 40 ? content.slice(0, 40).trimEnd() + '\u2026' : content
      if (!activeThreadId) {
        const thread = await chatApi.createThread(title)
        queryClient.setQueryData<Thread[]>(['threads'], (prev) => [thread, ...(prev ?? [])])
        setActiveThreadId(thread.id)
        await sendMessage(content, thread.id)
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

  const userInitial = (user?.full_name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const isWelcome = !activeThreadId && !showInput

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${sidebarOpen ? 'w-64' : 'w-0'}`}>
        <ThreadSidebar
          activeThreadId={activeThreadId}
          onSelectThread={(id) => { setActiveThreadId(id); setShowInput(id !== null) }}
          onNewChat={() => { setActiveThreadId(null); setShowInput(true) }}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] shrink-0 bg-[#0f0f0f]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-colors"
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            {!sidebarOpen && (
              <div className="flex items-center gap-2 ml-1">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold">Amzur AI</span>
              </div>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/[0.08]">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
                  {userInitial}
                </div>
                <span className="text-sm text-gray-400 max-w-[160px] truncate">{user.full_name ?? user.email}</span>
              </div>
              <button
                onClick={() => logout.mutate()}
                className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        {activeThreadId ? (
          <MessageList messages={messages} streamingContent={streamingContent} userInitial={userInitial} onRetry={handleSend} />
        ) : isWelcome ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-28">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-100 tracking-tight mb-2">How can I help?</h1>
            <p className="text-gray-500 text-sm mb-10 text-center">Powered by Amzur AI · Ask anything or pick a suggestion below</p>
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-md">
              {SUGGESTED_PROMPTS.map(({ icon: Icon, label, text }) => (
                <button
                  key={label}
                  onClick={() => handleSend(text)}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.16] transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-violet-400" />
                  </div>
                  <span className="text-sm text-gray-300">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Input — always visible */}
        <InputBar
          onSend={handleSend}
          threadId={activeThreadId}
          disabled={isSending}
          placeholder={isWelcome ? 'Ask me anything\u2026' : 'Message Amzur AI\u2026'}
        />
      </div>
    </div>
  )
}
