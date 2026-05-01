import { useState } from 'react'
import { MessageSquare, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useThreadList } from '@/hooks/useThreadList'
import type { Thread } from '@/types'

interface ThreadSidebarProps {
  activeThreadId: string | null
  onSelectThread: (id: string | null) => void
}

export function ThreadSidebar({ activeThreadId, onSelectThread }: ThreadSidebarProps) {
  const { threads, isLoading, deleteThread, renameThread } = useThreadList()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleNewChat = () => onSelectThread(null)

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

  return (
    <div className="w-64 flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo + New Chat */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Amzur AI</span>
        </div>
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 px-4">No chats yet. Start a conversation!</p>
        ) : (
          threads.map((thread: Thread) => (
            <div
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                activeThreadId === thread.id
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />

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
                  className="flex-1 min-w-0 bg-white dark:bg-gray-700 border border-blue-400 rounded px-1.5 py-0.5 text-sm outline-none text-gray-900 dark:text-gray-100"
                />
              ) : (
                <span className="flex-1 truncate">{thread.title}</span>
              )}

              {editingId !== thread.id && (
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => startRename(thread, e)}
                    className="p-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread.mutate(thread.id) }}
                    className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
