import { useRef, useState } from 'react'
import { ArrowUp, Paperclip, Loader2 } from 'lucide-react'
import { filesApi } from '@/lib/api'

interface InputBarProps {
  onSend: (content: string) => void
  threadId: string | null
  disabled?: boolean
  placeholder?: string
}

export function InputBar({ onSend, threadId, disabled, placeholder }: InputBarProps) {
  const [value, setValue] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isUploading) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !threadId) return
    setIsUploading(true)
    try {
      await filesApi.upload(file, threadId, true)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const canSend = value.trim().length > 0 && !disabled && !isUploading

  return (
    <div className="px-4 pb-5 pt-2 bg-[#0f0f0f] shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col rounded-2xl border border-white/[0.10] bg-[#1a1a1a] shadow-xl shadow-black/40 overflow-hidden focus-within:border-white/[0.18] transition-colors">
          {/* Textarea row */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder ?? 'Message Amzur AI\u2026'}
            rows={1}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm text-gray-200 placeholder-gray-600 outline-none disabled:opacity-50 leading-relaxed"
          />

          {/* Actions row */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!threadId || isUploading}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Attach file"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,video/mp4,video/webm,application/pdf,.xlsx,.xls,.csv,.txt"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-700 select-none">
                Shift+Enter for new line
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 active:scale-95"
              >
                {disabled ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

