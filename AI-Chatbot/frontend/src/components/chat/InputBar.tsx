import { useRef, useState, useEffect } from 'react'
import { ArrowUp, Paperclip, Loader2, X, FileText, ImageIcon, FileVideo, Wand2, Code2, Sigma, Database } from 'lucide-react'

interface InputBarProps {
  onSend: (content: string, files?: File[], imageMode?: boolean, sqlMode?: boolean) => void
  threadId: string | null
  disabled?: boolean
  placeholder?: string
}

export function InputBar({ onSend, threadId, disabled, placeholder }: InputBarProps) {
  const [value, setValue] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [imageMode, setImageMode] = useState(false)
  const [sqlMode, setSqlMode] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clear attachments and image mode whenever the active thread changes
  useEffect(() => {
    setPendingFiles([])
    setImageMode(false)
    setSqlMode(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [threadId])

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }

  const handleSubmit = () => {
    const trimmed = value.trim()
    if ((!trimmed && pendingFiles.length === 0) || disabled) return
    onSend(trimmed, pendingFiles.length > 0 ? pendingFiles : undefined, imageMode, sqlMode)
    setValue('')
    setPendingFiles([])
    setImageMode(false)
    setSqlMode(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Deduplicate by name — ignore files already queued
    const existing = new Set(pendingFiles.map((f) => f.name))
    const newFiles = selected.filter((f) => !existing.has(f.name))
    if (newFiles.length === 0) return

    // Just queue locally — actual upload happens in ChatPage.handleSend
    // so we always have a thread_id and avoid double-uploading
    setPendingFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (name: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name))
  }

  function getFileIcon(file: File) {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5 shrink-0" />
    if (file.type.startsWith('video/')) return <FileVideo className="w-3.5 h-3.5 shrink-0" />
    if (
      file.name.match(/\.(py|js|jsx|ts|tsx|c|cpp|cc|h|java|cs|go|rb|rs|php|sh|bash|sql|html|htm|css|json|xml|yaml|yml|md)$/i)
    ) return <Code2 className="w-3.5 h-3.5 shrink-0" />
    if (file.name.match(/\.(tex|latex)$/i)) return <Sigma className="w-3.5 h-3.5 shrink-0" />
    return <FileText className="w-3.5 h-3.5 shrink-0" />
  }

  const canSend = (value.trim().length > 0 || pendingFiles.length > 0) && !disabled

  return (
    <div className="px-4 pb-5 pt-2 bg-[#0f0f0f] shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col rounded-2xl border border-white/[0.10] bg-[#1a1a1a] shadow-xl shadow-black/40 overflow-hidden focus-within:border-white/[0.18] transition-colors">

          {/* Image mode indicator */}
          {imageMode && (
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs">
                <Wand2 className="w-3.5 h-3.5 shrink-0" />
                <span>Image generation mode</span>
                <button
                  type="button"
                  onClick={() => setImageMode(false)}
                  className="ml-0.5 text-violet-400/60 hover:text-violet-200 transition-colors"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* SQL mode indicator */}
          {sqlMode && (
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>SQL query mode — ask questions about the database</span>
                <button
                  type="button"
                  onClick={() => setSqlMode(false)}
                  className="ml-0.5 text-cyan-400/60 hover:text-cyan-200 transition-colors"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Attached file chips */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-2.5">
              {pendingFiles.map((file) => {
                const isImage = file.type.startsWith('image/')
                const previewUrl = isImage ? URL.createObjectURL(file) : null
                return (
                  <div
                    key={file.name}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs"
                  >
                    {isImage && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="w-6 h-6 rounded object-cover shrink-0"
                        onLoad={() => URL.revokeObjectURL(previewUrl)}
                      />
                    ) : (
                      getFileIcon(file)
                    )}
                    <span className="truncate max-w-[160px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.name)}
                      className="ml-0.5 text-violet-400/60 hover:text-violet-200 transition-colors shrink-0"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

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
                disabled={disabled}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Attach files"
              >
                <Paperclip className={`w-4 h-4 ${pendingFiles.length > 0 ? 'text-violet-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setImageMode((m) => !m)}
                disabled={disabled}
                title={imageMode ? 'Image generation mode ON — click to turn off' : 'Image generation mode'}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  imageMode
                    ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/50'
                    : 'text-gray-600 hover:text-gray-300 hover:bg-white/8'
                }`}
              >
                <Wand2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSqlMode((m) => !m)}
                disabled={disabled}
                title={sqlMode ? 'SQL query mode ON — click to turn off' : 'SQL query mode — ask questions about the database'}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  sqlMode
                    ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50'
                    : 'text-gray-600 hover:text-gray-300 hover:bg-white/8'
                }`}
              >
                <Database className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept={[
                  // Images
                  'image/*',
                  // Videos
                  'video/mp4,video/webm',
                  // Documents & tables
                  'application/pdf,.xlsx,.xls,.csv,.txt',
                  // Code files
                  '.py,.js,.jsx,.ts,.tsx,.c,.cpp,.cc,.h,.java,.cs,.go,.rb,.rs,.php,.sh,.bash,.sql,.html,.htm,.css,.json,.xml,.yaml,.yml,.md',
                  // Formula / LaTeX
                  '.tex,.latex',
                ].join(',')}
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

