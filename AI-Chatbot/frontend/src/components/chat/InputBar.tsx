import { useRef, useState, useEffect } from 'react'
import { ArrowUp, Paperclip, Loader2, X, FileText, ImageIcon, FileVideo, Code2, Sigma, Database, Table2, FlaskConical } from 'lucide-react'

/** Extract the bare spreadsheet ID from a full Google Sheets URL or return the input as-is. */
function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : input.trim()
}

interface InputBarProps {
  onSend: (content: string, files?: File[], imageMode?: boolean, sqlMode?: boolean, sheetsMode?: boolean, spreadsheetId?: string, researchMode?: boolean) => void
  threadId: string | null
  disabled?: boolean
  placeholder?: string
}

export function InputBar({ onSend, threadId, disabled, placeholder }: InputBarProps) {
  const [value, setValue] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [imageMode, setImageMode] = useState(false)
  const [sqlMode, setSqlMode] = useState(false)
  const [sheetsMode, setSheetsMode] = useState(false)
  const [sheetsUrl, setSheetsUrl] = useState('')
  const [researchMode, setResearchMode] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clear attachments and modes whenever the active thread changes
  useEffect(() => {
    setPendingFiles([])
    setImageMode(false)
    setSqlMode(false)
    setSheetsMode(false)
    setSheetsUrl('')
    setResearchMode(false)
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
    const spreadsheetId = sheetsMode ? extractSheetId(sheetsUrl) : undefined
    onSend(trimmed, pendingFiles.length > 0 ? pendingFiles : undefined, imageMode, sqlMode, sheetsMode, spreadsheetId, researchMode)
    setValue('')
    setPendingFiles([])
    setSqlMode(false)
    setResearchMode(false)
    // Keep sheetsMode + sheetsUrl active so the next question stays in sheets mode
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
    <div className="px-4 pb-5 pt-2 bg-transparent shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col rounded-[28px] border border-slate-200/70 bg-white shadow-float overflow-hidden focus-within:border-blue-300 focus-within:shadow-glow-blue transition-all duration-200">

          {/* SQL mode indicator */}
          {sqlMode && (
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>SQL query mode — ask questions about the database</span>
                <button
                  type="button"
                  onClick={() => setSqlMode(false)}
                  className="ml-0.5 text-cyan-500/60 hover:text-cyan-700 transition-colors"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Sheets mode indicator */}
          {sheetsMode && (
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-xs w-full">
                <Table2 className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  placeholder="Paste Google Sheets URL or ID…"
                  className="flex-1 bg-transparent outline-none placeholder-violet-400 text-violet-700 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => { setSheetsMode(false); setSheetsUrl('') }}
                  className="ml-0.5 text-violet-400/60 hover:text-violet-700 transition-colors shrink-0"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Research mode indicator */}
          {researchMode && (
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                <span>Research mode — autonomously search and summarise arXiv papers</span>
                <button
                  type="button"
                  onClick={() => setResearchMode(false)}
                  className="ml-0.5 text-amber-500/60 hover:text-amber-700 transition-colors"
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
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 text-xs"
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
                      className="ml-0.5 text-blue-400/60 hover:text-blue-600 transition-colors shrink-0"
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
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50 leading-relaxed"
          />

          {/* Actions row */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                title="Attach files"
              >
                <Paperclip className={`w-4 h-4 ${pendingFiles.length > 0 ? 'text-blue-500' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setImageMode((m) => !m)}
                disabled={disabled}
                title={imageMode ? 'Image generation mode ON — click to turn off' : 'Image generation mode'}
                className={`p-1.5 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                  imageMode
                    ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSqlMode((m) => !m)}
                disabled={disabled}
                title={sqlMode ? 'SQL query mode ON — click to turn off' : 'SQL query mode — ask questions about the database'}
                className={`p-1.5 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                  sqlMode
                    ? 'bg-cyan-50 text-cyan-600 ring-1 ring-cyan-300'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Database className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSheetsMode((m) => !m)}
                disabled={disabled}
                title={sheetsMode ? 'Spreadsheet mode ON — click to turn off' : 'Query a Google Sheet or uploaded CSV/Excel file'}
                className={`p-1.5 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                  sheetsMode
                    ? 'bg-violet-50 text-violet-600 ring-1 ring-violet-300'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Table2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setResearchMode((m) => !m)}
                disabled={disabled}
                title={researchMode ? 'Research mode ON — click to turn off' : 'Research mode — autonomously search arXiv and generate a digest'}
                className={`p-1.5 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
                  researchMode
                    ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-300'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FlaskConical className="w-4 h-4" />
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
              <span className="text-[10px] text-slate-400 select-none">
                Shift+Enter for new line
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:via-sky-400 hover:to-cyan-300 text-white shadow-glow-blue hover:scale-[1.05] active:scale-95"
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

