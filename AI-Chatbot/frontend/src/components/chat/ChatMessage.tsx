import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { Check, Copy, Sparkles, RotateCcw, Share2, ThumbsUp, ThumbsDown, FileText, ImageIcon, FileVideo, Code2, Sigma, Pencil, X, Loader2, Download } from 'lucide-react'
import type { Message, UploadedFile } from '@/types'

// Extracts plain text from React children (code nodes)
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    return extractText((children as React.ReactElement).props.children)
  }
  return ''
}

function fileIcon(f: UploadedFile) {
  if (f.file_type === 'image') return <ImageIcon className="w-3.5 h-3.5 shrink-0" />
  if (f.file_type === 'video') return <FileVideo className="w-3.5 h-3.5 shrink-0" />
  if (f.file_type === 'code') return <Code2 className="w-3.5 h-3.5 shrink-0" />
  if (f.file_type === 'formula') return <Sigma className="w-3.5 h-3.5 shrink-0" />
  return <FileText className="w-3.5 h-3.5 shrink-0" />
}

function FileChips({ files }: { files: UploadedFile[] }) {
  if (!files.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/20 text-white/90 text-xs border border-white/20"
        >
          {fileIcon(f)}
          <span className="truncate max-w-[160px]">{f.original_filename}</span>
        </div>
      ))}
    </div>
  )
}

function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [codeCopied, setCodeCopied] = useState(false)

  const handleCopy = () => {
    const text = extractText(children)
    navigator.clipboard.writeText(text)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  return (
    <div className="relative group/code not-prose my-3">
      <pre className="bg-[#0f172a] border border-white/[0.06] rounded-2xl p-4 overflow-x-auto text-sm" {...props}>
        {children}
      </pre>
      <button
        onClick={handleCopy}
        title={codeCopied ? 'Copied!' : 'Copy code'}
        className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.08] border border-white/[0.12] text-[11px] text-slate-400 hover:text-white hover:bg-white/[0.14] transition-all duration-200"
      >
        {codeCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        {codeCopied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

interface ChatMessageProps {
  message: Message
  userInitial: string
  isGenerating?: boolean
  onRetry?: () => void
  onEdit?: (newContent: string) => void
}

export function ChatMessage({ message, userInitial, isGenerating, onRetry, onEdit }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [liked, setLiked] = useState<'up' | 'down' | null>(null)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)

  const copyContent = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareContent = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: message.content })
        return
      } catch {
        // user cancelled or API not available — fall through to clipboard
      }
    }
    // Fallback: copy to clipboard and show confirmation
    await navigator.clipboard.writeText(message.content)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  if (isUser) {
    return (
      <div className="flex items-center justify-end gap-3 animate-fade-in group/user">
        <div className="flex flex-col items-end gap-1 max-w-[75%]">
          {editing ? (
            <div className="w-full flex flex-col gap-2">
              <textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (editValue.trim() && onEdit) {
                      onEdit(editValue.trim())
                      setEditing(false)
                    }
                  }
                  if (e.key === 'Escape') setEditing(false)
                }}
                rows={3}
                className="w-full resize-none rounded-2xl px-4 py-3 text-sm text-slate-800 border border-blue-300 bg-white outline-none focus:ring-2 focus:ring-blue-400/30 leading-relaxed"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={() => {
                    if (editValue.trim() && onEdit) {
                      onEdit(editValue.trim())
                      setEditing(false)
                    }
                  }}
                  disabled={!editValue.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
                >
                  <Check className="w-3 h-3" /> Send
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-[24px] rounded-br-lg bg-white text-slate-800 text-sm leading-relaxed shadow-sm border border-slate-200/60">
              {message.files && message.files.length > 0 && <FileChips files={message.files} />}
              {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
            </div>
          )}
          {!editing && onEdit && (
            <button
              onClick={() => { setEditValue(message.content); setEditing(true) }}
              className="opacity-0 group-hover/user:opacity-100 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
              title="Edit message"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 select-none shadow-glow-blue">
          {userInitial}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 group animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0 mt-0.5 shadow-glow-blue">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="max-w-[85%] min-w-0 w-full">
        <div className="px-4 py-3 rounded-[24px] rounded-tl-lg bg-white border border-slate-200/60 text-sm leading-relaxed shadow-panel">
          <div className="prose prose-slate prose-sm max-w-none
            prose-p:my-2 prose-headings:text-slate-900 prose-strong:text-slate-900
            prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline
            prose-li:text-slate-700 prose-code:text-blue-600 prose-code:bg-transparent
            prose-blockquote:border-blue-400/40 prose-blockquote:text-slate-500
            prose-table:text-sm prose-th:text-slate-700 prose-td:text-slate-600">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={{
                hr() {
                  return <hr className="my-3 border-slate-200" />
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3 not-prose rounded-2xl border border-slate-200 shadow-panel">
                      <table className="w-full text-sm border-collapse">
                        {children}
                      </table>
                    </div>
                  )
                },
                thead({ children }) {
                  return <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>
                },
                tbody({ children }) {
                  return <tbody className="divide-y divide-slate-100">{children}</tbody>
                },
                tr({ children }) {
                  return <tr className="hover:bg-blue-50/40 transition-colors">{children}</tr>
                },
                th({ children }) {
                  return (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-r border-slate-200 last:border-r-0 whitespace-nowrap">
                      {children}
                    </th>
                  )
                },
                td({ children }) {
                  return (
                    <td className="px-4 py-2.5 text-slate-700 text-xs border-r border-slate-100 last:border-r-0 align-top max-w-xs truncate">
                      {children}
                    </td>
                  )
                },
                code({ className, children, ...props }) {
                  const isBlock = className?.includes('language-')
                  if (isBlock) {
                    return (
                      <code className={`${className ?? ''} text-[0.8em]`} {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code className="bg-blue-50 text-blue-600 rounded-lg px-1.5 py-0.5 text-[0.82em] font-mono not-prose" {...props}>
                      {children}
                    </code>
                  )
                },
                pre({ children, ...props }) {
                  return <CodeBlock {...props}>{children}</CodeBlock>
                },
                img({ src, alt }) {
                  const handleDownload = async () => {
                    if (!src) return
                    try {
                      const res = await fetch(src)
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'generated-image.png'
                      a.click()
                      URL.revokeObjectURL(url)
                    } catch {
                      window.open(src, '_blank')
                    }
                  }
                  return (
                    <span className="relative inline-block group/img not-prose">
                      <img
                        src={src}
                        alt={alt ?? 'generated image'}
                        className="rounded-2xl max-w-full mt-2 border border-slate-200 shadow-panel block"
                        style={{ maxHeight: '480px' }}
                      />
                      <button
                        onClick={handleDownload}
                        title="Download image"
                        className="absolute top-4 right-2 opacity-0 group-hover/img:opacity-100 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/50 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/70 transition-all duration-200"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </span>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 ml-0.5">
          <button
            onClick={copyContent}
            title={copied ? 'Copied!' : 'Copy'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all duration-200"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setLiked(liked === 'up' ? null : 'up')}
            title="Good response"
            className={`p-1.5 rounded-lg transition-all duration-200 hover:bg-blue-50 ${
              liked === 'up' ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLiked(liked === 'down' ? null : 'down')}
            title="Bad response"
            className={`p-1.5 rounded-lg transition-all duration-200 hover:bg-red-50 ${
              liked === 'down' ? 'text-red-400' : 'text-slate-400 hover:text-red-400'
            }`}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
          <button
            onClick={shareContent}
            title={shared ? 'Copied to clipboard!' : 'Share'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all duration-200"
          >
            {shared ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onRetry}
            disabled={isGenerating}
            title={isGenerating ? 'Generating…' : 'Retry'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isGenerating
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RotateCcw className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

