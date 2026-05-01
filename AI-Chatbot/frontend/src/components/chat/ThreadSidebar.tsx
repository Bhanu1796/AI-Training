import { useState, useRef, useEffect } from 'react'
import { SquarePen, Pencil, Trash2, Loader2, Sparkles, MessageSquare, MoreHorizontal } from 'lucide-react'
import { useThreadList } from '@/hooks/useThreadList'
import type { Thread } from '@/types'

interface ThreadSidebarProps {
  activeThreadId: string | null
  onSelectThread: (id: string | null) => void
  onNewChat: () => void
}

function groupThreadsByDate(threads: Thread[]): { label: string; threads: Thread[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const lastWeek = new Date(today.getTime() - 7 * 86_400_000)

  const groups: { label: string; threads: Thread[] }[] = [
    { label: 'Today', threads: [] },
    { label: 'Yesterday', threads: [] },
    { label: 'Last 7 days', threads: [] },
    { label: 'Older', threads: [] },
  ]

  for (const t of threads) {
    const d = new Date(t.updated_at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (day >= today) groups[0].threads.push(t)
    else if (day >= yesterday) groups[1].threads.push(t)
    else if (day >= lastWeek) groups[2].threads.push(t)
    else groups[3].threads.push(t)
  }

  return groups.filter((g) => g.threads.length > 0)
}

export function ThreadSidebar({ activeThreadId, onSelectThread, onNewChat }: ThreadSidebarProps) {
  const { threads, isLoading, deleteThread, renameThread } = useThreadList()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const startRename = (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(thread.id)
    setEditValue(thread.title)
  }

  const commitRename = (threadId: string) => {
    const trimmed = editValue.trim()
    if (trimmed) renameThread.mutate({ threadId, title: trimmed })
    setEditingId(null)
  }

  const groups = groupThreadsByDate(threads)

  return (
    <div className="w-64 h-full flex flex-col bg-[#0f0f0f] border-r border-white/[0.08]">
      {/* Header row: brand */}
      <div className="flex items-center px-4 py-2.5 shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 h-9 px-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-100">Amzur AI</span>
        </div>
      </div>

      {/* New Chat button */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.09] text-sm text-gray-300 hover:text-gray-100 transition-colors"
        >
          <SquarePen className="w-4 h-4 text-violet-400" />
          New chat
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageSquare className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-600 leading-relaxed">
              No conversations yet. Start a new chat!
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-gray-700 px-2 py-1">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.threads.map((thread: Thread) => (
                  <div
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer text-sm transition-all ${
                      activeThreadId === thread.id
                        ? 'bg-white/[0.09] text-gray-100'
                        : 'hover:bg-white/[0.05] text-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {/* Active indicator */}
                    {activeThreadId === thread.id && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-full" />
                    )}

                    <MessageSquare className={`w-4 h-4 shrink-0 ${activeThreadId === thread.id ? 'text-violet-400' : 'text-gray-700 group-hover:text-gray-500'}`} />

                    {editingId === thread.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitRename(thread.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(thread.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-white/10 border border-violet-500/50 rounded px-1.5 py-0.5 text-xs outline-none text-gray-100"
                      />
                    ) : (
                      <span className="flex-1 truncate text-sm">{thread.title}</span>
                    )}

                    {editingId !== thread.id && (
                      <div className="relative shrink-0" ref={menuOpenId === thread.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (menuOpenId === thread.id) {
                              setMenuOpenId(null)
                              setMenuPos(null)
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 })
                              setMenuOpenId(thread.id)
                            }
                          }}
                          className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-colors"
                          title="Options"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fixed dropdown — renders outside overflow scroll */}
      {menuOpenId && menuPos && (
        <div
          ref={menuRef}
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed w-36 rounded-xl bg-[#1e1e1e] border border-white/[0.09] shadow-xl shadow-black/50 overflow-hidden z-[9999]"
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              const thread = threads.find((t) => t.id === menuOpenId)
              if (thread) startRename(thread, e)
              setMenuOpenId(null)
              setMenuPos(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.07] hover:text-gray-100 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-500" />
            Rename
          </button>
          <div className="h-px bg-white/[0.06] mx-2" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteThread.mutate(menuOpenId)
              setMenuOpenId(null)
              setMenuPos(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}




