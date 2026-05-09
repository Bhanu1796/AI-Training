import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { Check, Copy, Sparkles, RotateCcw, Share2, ThumbsUp, ThumbsDown, FileText, ImageIcon, FileVideo, Code2, Sigma } from 'lucide-react'
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
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-xs"
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
      <pre className="bg-[#16162a] border border-white/8 rounded-xl p-4 overflow-x-auto text-sm" {...props}>
        {children}
      </pre>
      <button
        onClick={handleCopy}
        title={codeCopied ? 'Copied!' : 'Copy code'}
        className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.07] border border-white/[0.10] text-[11px] text-gray-400 hover:text-gray-100 hover:bg-white/[0.12] transition-colors"
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
  onRetry?: () => void
}

export function ChatMessage({ message, userInitial, onRetry }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [liked, setLiked] = useState<'up' | 'down' | null>(null)

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
      <div className="flex items-end justify-end gap-3">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-sm leading-relaxed shadow-lg shadow-violet-500/10">
          {message.files && message.files.length > 0 && <FileChips files={message.files} />}
          {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
        </div>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5 select-none">
          {userInitial}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 group">
      <div className="w-7 h-7 rounded-full bg-[#1e1a2e] border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
      </div>
      <div className="max-w-[85%] min-w-0 w-full">
        <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-[#1c1c1c] border border-white/[0.06] text-sm leading-relaxed">
          <div className="prose prose-invert prose-sm max-w-none text-gray-200
            prose-p:my-2 prose-headings:text-gray-100 prose-strong:text-gray-100
            prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
            prose-li:text-gray-200 prose-code:text-violet-300 prose-code:bg-transparent
            prose-blockquote:border-violet-500/40 prose-blockquote:text-gray-400
            prose-table:text-sm prose-th:text-gray-300 prose-td:text-gray-400">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={{
                hr() {
                  return <hr className="my-3 border-white/10" />
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3 not-prose rounded-xl border border-white/10 shadow-sm">
                      <table className="w-full text-sm border-collapse">
                        {children}
                      </table>
                    </div>
                  )
                },
                thead({ children }) {
                  return <thead className="bg-[#1a2030] border-b border-white/10">{children}</thead>
                },
                tbody({ children }) {
                  return <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
                },
                tr({ children }) {
                  return <tr className="hover:bg-white/[0.04] transition-colors">{children}</tr>
                },
                th({ children }) {
                  return (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-cyan-300 uppercase tracking-wider border-r border-white/[0.06] last:border-r-0 whitespace-nowrap">
                      {children}
                    </th>
                  )
                },
                td({ children }) {
                  return (
                    <td className="px-4 py-2.5 text-gray-300 text-xs border-r border-white/[0.06] last:border-r-0 align-top max-w-xs truncate">
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
                    <code className="bg-violet-500/15 text-violet-300 rounded-md px-1.5 py-0.5 text-[0.82em] font-mono not-prose" {...props}>
                      {children}
                    </code>
                  )
                },
                pre({ children, ...props }) {
                  return <CodeBlock {...props}>{children}</CodeBlock>
                },
                img({ src, alt }) {
                  return (
                    <img
                      src={src}
                      alt={alt ?? 'generated image'}
                      className="rounded-xl max-w-full mt-2 border border-white/10 shadow-lg"
                      style={{ maxHeight: '480px' }}
                    />
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
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/[0.07] transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setLiked(liked === 'up' ? null : 'up')}
            title="Good response"
            className={`p-1.5 rounded-md transition-colors hover:bg-white/[0.07] ${
              liked === 'up' ? 'text-violet-400' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLiked(liked === 'down' ? null : 'down')}
            title="Bad response"
            className={`p-1.5 rounded-md transition-colors hover:bg-white/[0.07] ${
              liked === 'down' ? 'text-red-400' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
          <button
            onClick={shareContent}
            title={shared ? 'Copied to clipboard!' : 'Share'}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/[0.07] transition-colors"
          >
            {shared ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onRetry}
            title="Retry"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/[0.07] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

