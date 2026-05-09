import { useState, useEffect } from 'react'
import { LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, Code, FileText, Lightbulb, BookOpen, Loader2, X, Database } from 'lucide-react'
import { ThreadSidebar } from '@/components/chat/ThreadSidebar'
import { MessageList } from '@/components/chat/MessageList'
import { InputBar } from '@/components/chat/InputBar'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/hooks/useAuth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, chatApi, filesApi, imageApi, sqlApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import type { Message, Thread } from '@/types'

const IMAGE_INTENT_RE = /\b(generate|create|draw|paint|make|render|produce|design)\b.{0,60}\b(image|picture|photo|illustration|artwork|painting|portrait|logo|icon|poster|wallpaper|banner)\b|\b(image|picture|photo)\b.{0,30}\b(of|showing|depicting)\b/i

// Detects follow-up image editing requests (remove X, add X, change X, make it X, etc.)
const IMAGE_EDIT_RE = /\b(remove|add|insert|replace|change|make\s+it|turn\s+it|convert|edit|modify|update|without|with\s+(?:more|less|no))\b/i

function isImageRequest(text: string): boolean {
  return IMAGE_INTENT_RE.test(text)
}

function isImageEditRequest(text: string): boolean {
  return IMAGE_EDIT_RE.test(text)
}

const SUGGESTED_PROMPTS = [
  { icon: Lightbulb, label: 'Brainstorm ideas', text: 'Help me brainstorm creative ideas for ' },
  { icon: Code, label: 'Write code', text: 'Write a function that ' },
  { icon: FileText, label: 'Summarize text', text: 'Summarize the following text: ' },
  { icon: Sparkles, label: 'Explain a concept', text: 'Explain in simple terms: ' },
  { icon: Database, label: 'Query database', text: 'Show me all users who registered in the last 30 days', sqlMode: true },
]

const SQL_FORMAT_RE = /\b(show|display|convert|format|present|render|view|put)\b.{0,40}\b(table|tabular|grid|columns?|rows?)\b|\b(as|in|into)\s+(a\s+)?(table|tabular)\b/i

export default function ChatPage() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Map of threadId → ingested PDF file IDs for RAG routing
  const [ragFileIds, setRagFileIds] = useState<Record<string, string[]>>({})
  // Set of threadIds where SQL query mode is active
  const [sqlThreadIds, setSqlThreadIds] = useState<Set<string>>(new Set())
  // True while waiting for a SQL query response
  const [isSqlQuerying, setIsSqlQuerying] = useState(false)
  const { user } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()

  const { messages, streamingContent, sendMessage } = useChat(activeThreadId)
  const [isSending, setIsSending] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)

  const { data: threads = [] } = useQuery<Thread[]>({ queryKey: ['threads'], queryFn: chatApi.listThreads, staleTime: 30_000 })
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

  const handleSend = async (content: string, files?: File[], imageMode?: boolean, sqlMode?: boolean) => {
    setIsSending(true)
    try {
      const rawTitle = content.trim() || (files?.[0]?.name ?? 'New Chat')
      const title = rawTitle.length > 40 ? rawTitle.slice(0, 40).trimEnd() + '\u2026' : rawTitle

      // Ensure we have a thread
      let tid = activeThreadId
      if (!tid) {
        const thread = await chatApi.createThread(title)
        queryClient.setQueryData<Thread[]>(['threads'], (prev) => [thread, ...(prev ?? [])])
        setActiveThreadId(thread.id)
        tid = thread.id
      } else {
        const allThreads = queryClient.getQueryData<Thread[]>(['threads']) ?? []
        const current = allThreads.find((t) => t.id === tid)
        if (current?.title === 'New Chat') {
          chatApi.renameThread(tid, title).then((updated) => {
            queryClient.setQueryData<Thread[]>(['threads'], (prev) =>
              (prev ?? []).map((t) => (t.id === tid ? updated : t))
            )
          }).catch(() => {})
        }
      }

      // Upload files — PDFs are auto-ingested into ChromaDB for RAG
      let uploadedFiles
      let justIngestedPdfIds: string[] = []
      if (files?.length) {
        setIsIngesting(true)
        try {
          const responses = await Promise.all(
            files.map((f) => {
              const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
              return filesApi.upload(f, tid!, isPdf)  // ingest=true for PDFs
            })
          )
          uploadedFiles = responses.map((r) => r.file)

          // Track ingested PDF file IDs per thread for RAG routing
          const newPdfIds = responses
            .filter((r) => r.file.file_type === 'pdf')
            .map((r) => r.file.id)
          if (newPdfIds.length > 0) {
            justIngestedPdfIds = newPdfIds
            setRagFileIds((prev) => ({
              ...prev,
              [tid!]: [...(prev[tid!] ?? []), ...newPdfIds],
            }))
          }
        } catch (uploadErr: unknown) {
          const msg = (uploadErr as { response?: { data?: { detail?: { message?: string } } } })
            ?.response?.data?.detail?.message ?? 'Failed to upload or ingest the file.'
          // Show error as an assistant message
          queryClient.setQueryData<Message[]>(['messages', tid!], (prev) => [
            ...(prev ?? []),
            { id: crypto.randomUUID(), thread_id: tid!, role: 'assistant', content: `⚠️ ${msg}`, token_count: null, created_at: new Date().toISOString() },
          ])
          return
        } finally {
          setIsIngesting(false)
        }

        // If no text was provided, show user message with file chips + assistant confirmation
        if (!content.trim()) {
          const userFileMsg: Message = {
            id: crypto.randomUUID(),
            thread_id: tid!,
            role: 'user',
            content: '',
            token_count: null,
            created_at: new Date().toISOString(),
            files: uploadedFiles,
          }
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            thread_id: tid!,
            role: 'assistant',
            content: `✅ **${files.map((f) => f.name).join(', ')}** uploaded and ready. You can now ask me anything about it.`,
            token_count: null,
            created_at: new Date().toISOString(),
          }
          queryClient.setQueryData<Message[]>(['messages', tid!], (prev) => [
            ...(prev ?? []),
            userFileMsg,
            assistantMsg,
          ])
          queryClient.invalidateQueries({ queryKey: ['threads'] })
          return
        }
      }

      // ── SQL query path ────────────────────────────────────────────────────────
      // Activated when the user toggled SQL mode in the InputBar.
      // Enables SQL mode for this thread so the banner persists across messages.
      if (sqlMode) {
        setSqlThreadIds((prev) => new Set([...prev, tid]))
      }
      const isSqlOp = sqlMode || sqlThreadIds.has(tid)

      if (isSqlOp && content.trim()) {
        // ── Format-only request: "show in table format", "convert to table", etc. ──
        // These are display requests, not SQL questions — route through streaming chat
        // with the last assistant answer injected so the LLM can reformat it.
        const currentMsgs = queryClient.getQueryData<Message[]>(['messages', tid]) ?? []
        const lastAssistant = [...currentMsgs].reverse().find((m) => m.role === 'assistant')

        if (SQL_FORMAT_RE.test(content) && lastAssistant) {
          const reformatPrompt = `The user wants to see the previous answer formatted as a markdown table.\n\nPrevious answer:\n${lastAssistant.content}\n\nPlease reformat all the data above into a clean GitHub-flavored markdown table with proper column headers. Do not re-run any SQL — just reformat the data already returned.`
          try {
            await sendMessage(reformatPrompt, tid)
          } catch {
            queryClient.setQueryData<Message[]>(['messages', tid], (prev) => [
              ...(prev ?? []),
              { id: crypto.randomUUID(), thread_id: tid, role: 'assistant', content: '⚠️ Failed to reformat. Please try again.', token_count: null, created_at: new Date().toISOString() },
            ])
          }
          queryClient.invalidateQueries({ queryKey: ['threads'] })
          return
        }

        // Show optimistic user message immediately
        const tempUserMsg: Message = {
          id: 'temp-user-' + crypto.randomUUID(),
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
        setIsSqlQuerying(true)

        try {
          const result = await sqlApi.query(content, tid)
          console.log('[SQL] result from API:', result)
          // result.answer already contains the full formatted content built server-side:
          // "Generated SQL" code block + separator + formatted result.
          // Display it directly — no client-side rebuilding needed.
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            thread_id: tid,
            role: 'assistant',
            content: result.answer,
            token_count: null,
            created_at: new Date().toISOString(),
          }
          queryClient.setQueryData<Message[]>(['messages', tid], (prev) =>
            [...(prev ?? []).filter((m) => !m.id.startsWith('temp-user-')), { ...tempUserMsg, id: crypto.randomUUID() }, assistantMsg]
          )
          // No invalidateQueries here — it was causing messages to disappear.
          // The DB is already committed before the response arrives.
        } catch (err: unknown) {
          setIsSqlQuerying(false)
          const detail = (err as { response?: { data?: { detail?: { message?: string } } } })
            ?.response?.data?.detail?.message
          const errContent = detail ?? 'SQL query failed. Please rephrase your question or check that the feature is configured.'
          queryClient.setQueryData<Message[]>(['messages', tid], (prev) => [
            ...(prev ?? []).filter((m) => !m.id.startsWith('temp-user-')),
            { id: crypto.randomUUID(), thread_id: tid, role: 'user', content, token_count: null, created_at: new Date().toISOString() },
            { id: crypto.randomUUID(), thread_id: tid, role: 'assistant', content: `⚠️ ${errContent}`, token_count: null, created_at: new Date().toISOString() },
          ])
        } finally {
          setIsSqlQuerying(false)
        }
        queryClient.invalidateQueries({ queryKey: ['threads'] })
        return
      }

      // Image generation intent — explicit mode OR heuristic detection OR follow-up edit
      const currentMessages = queryClient.getQueryData<Message[]>(['messages', tid]) ?? []
      const lastImageMsg = [...currentMessages].reverse().find(
        (m) => m.role === 'assistant' && m.content.includes('![generated image]')
      )
      const hasImageHistory = !!lastImageMsg

      // Detect the image prompt used to produce the last image so we can combine it with the edit
      const lastImagePrompt = (() => {
        if (!lastImageMsg) return ''
        const idx = currentMessages.indexOf(lastImageMsg)
        // The user message immediately before the image is the original prompt
        const prev = [...currentMessages].slice(0, idx).reverse().find((m) => m.role === 'user')
        return prev?.content ?? ''
      })()

      const isImageOp = imageMode || isImageRequest(content) || (hasImageHistory && isImageEditRequest(content))

      if (isImageOp && !files?.length) {
        // For edit commands, combine original prompt + edit instruction
        const effectivePrompt =
          hasImageHistory && isImageEditRequest(content) && lastImagePrompt
            ? `${lastImagePrompt}, but ${content}`
            : content

        // Optimistically show user message while generation runs
        const tempUserMsg: Message = {
          id: 'temp-user-' + crypto.randomUUID(),
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

        try {
          const result = await imageApi.generate(effectivePrompt, tid)
          // Invalidate so the persisted messages are loaded from the DB
          queryClient.invalidateQueries({ queryKey: ['messages', tid] })
          // Also show optimistically in case invalidation is slow
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            thread_id: tid,
            role: 'assistant',
            content: `![generated image](${result.image_url})`,
            token_count: null,
            created_at: new Date().toISOString(),
          }
          queryClient.setQueryData<Message[]>(['messages', tid], (prev) => {
            // Only add optimistically if not already present from DB refetch
            const already = (prev ?? []).some((m) => m.content.includes(result.image_url))
            return already ? (prev ?? []) : [...(prev ?? []), assistantMsg]
          })
        } catch {
          // Remove the optimistic temp user message on failure
          queryClient.setQueryData<Message[]>(['messages', tid], (prev) =>
            (prev ?? []).filter((m) => !m.id.startsWith('temp-user-'))
          )
          const errMsg: Message = {
            id: crypto.randomUUID(),
            thread_id: tid,
            role: 'assistant',
            content: 'Sorry, image generation failed. Please try again.',
            token_count: null,
            created_at: new Date().toISOString(),
          }
          queryClient.setQueryData<Message[]>(['messages', tid], (prev) => [
            ...(prev ?? []),
            errMsg,
          ])
        }
        queryClient.invalidateQueries({ queryKey: ['threads'] })
        return
      }

      // RAG path — thread has ingested PDF(s), route through RAG chain
      // Merge already-tracked IDs with any just ingested in this call (state update is async)
      const threadRagFileIds = [...new Set([...(ragFileIds[tid] ?? []), ...justIngestedPdfIds])]
      if (threadRagFileIds.length > 0 && !isImageOp) {
        try {
          await sendMessage(content, tid, uploadedFiles, threadRagFileIds)
        } catch {
          queryClient.setQueryData<Message[]>(['messages', tid], (prev) => [
            ...(prev ?? []),
            { id: crypto.randomUUID(), thread_id: tid, role: 'assistant', content: '⚠️ Failed to query your document. Please try again.', token_count: null, created_at: new Date().toISOString() },
          ])
        }
        queryClient.invalidateQueries({ queryKey: ['threads'] })
        return
      }

      // Regular chat
      try {
        await sendMessage(content, tid, uploadedFiles)
      } catch {
        queryClient.setQueryData<Message[]>(['messages', tid], (prev) => [
          ...(prev ?? []),
          { id: crypto.randomUUID(), thread_id: tid, role: 'assistant', content: '⚠️ Something went wrong. Please try again.', token_count: null, created_at: new Date().toISOString() },
        ])
      }
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    } finally {
      setIsSending(false)
    }
  }

  const userInitial = (user?.full_name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const isWelcome = !activeThreadId

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${sidebarOpen ? 'w-64' : 'w-0'}`}>
        <ThreadSidebar
          activeThreadId={activeThreadId}
          onSelectThread={(id) => { setActiveThreadId(id) }}
          onNewChat={() => { setActiveThreadId(null) }}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
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
          <MessageList messages={messages} streamingContent={streamingContent} isSqlQuerying={isSqlQuerying} userInitial={userInitial} onRetry={handleSend} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-28">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-100 tracking-tight mb-2">How can I help?</h1>
            <p className="text-gray-500 text-sm mb-10 text-center">Powered by Amzur AI · Ask anything or pick a suggestion below</p>
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-md">
              {SUGGESTED_PROMPTS.map(({ icon: Icon, label, text, sqlMode: promptSqlMode }) => (
                <button
                  key={label}
                  onClick={() => handleSend(text, undefined, false, promptSqlMode)}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.16] transition-all text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${promptSqlMode ? 'bg-cyan-500/15' : 'bg-violet-500/15'}`}>
                    <Icon className={`w-4 h-4 ${promptSqlMode ? 'text-cyan-400' : 'text-violet-400'}`} />
                  </div>
                  <span className="text-sm text-gray-300">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input — always visible */}
        {/* RAG mode banner */}
        {activeThreadId && (ragFileIds[activeThreadId] ?? []).length > 0 && (
          <div className="flex items-center justify-between gap-2 mx-4 mb-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Document mode — answering from {(ragFileIds[activeThreadId] ?? []).length} ingested PDF{(ragFileIds[activeThreadId] ?? []).length > 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => setRagFileIds((prev) => ({ ...prev, [activeThreadId]: [] }))}
              className="text-emerald-400/60 hover:text-emerald-200 transition-colors"
              title="Exit document mode"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {/* SQL mode banner */}
        {activeThreadId && sqlThreadIds.has(activeThreadId) && (
          <div className="flex items-center justify-between gap-2 mx-4 mb-1 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>SQL query mode — ask anything about the database in plain English</span>
            </div>
            <button
              onClick={() => setSqlThreadIds((prev) => { const next = new Set(prev); next.delete(activeThreadId); return next })}
              className="text-cyan-400/60 hover:text-cyan-200 transition-colors"
              title="Exit SQL mode"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {isIngesting && (
          <div className="flex items-center gap-2 mx-4 mb-1 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Ingesting PDF into vector store…</span>
          </div>
        )}
        <InputBar
          onSend={handleSend}
          threadId={activeThreadId}
          disabled={isSending || isIngesting}
          placeholder={isWelcome ? 'Ask me anything…' : sqlThreadIds.has(activeThreadId ?? '') ? 'Ask about the database…' : (ragFileIds[activeThreadId ?? ''] ?? []).length > 0 ? 'Ask about your documents…' : 'Message Amzur AI…'}
        />
      </div>
    </div>
  )
}
