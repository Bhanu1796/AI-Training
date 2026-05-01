import axios from 'axios'
import type {
  FileUploadResponse,
  ImageGenerateResponse,
  Message,
  SheetsQueryResponse,
  SQLQueryResponse,
  Thread,
  TokenResponse,
  User,
} from '@/types'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly cookies on every request
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string, full_name?: string) =>
    api.post<TokenResponse>('/auth/register', { email, password, full_name }).then((r) => r.data),

  login: (email: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { email, password }).then((r) => r.data),

  logout: () => api.post('/auth/logout').then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),

  providers: () => api.get<{ google: boolean }>('/auth/providers').then((r) => r.data),

  googleLoginUrl: () => api.get<{ redirect_url: string }>('/auth/google').then((r) => r.data),
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export const chatApi = {
  createThread: (title = 'New Chat') =>
    api.post<Thread>('/chat/threads', { title }).then((r) => r.data),

  listThreads: () => api.get<Thread[]>('/chat/threads').then((r) => r.data),

  getThread: (threadId: string) =>
    api.get<Thread>(`/chat/threads/${threadId}`).then((r) => r.data),

  renameThread: (threadId: string, title: string) =>
    api.patch<Thread>(`/chat/threads/${threadId}`, { title }).then((r) => r.data),

  deleteThread: (threadId: string) => api.delete(`/chat/threads/${threadId}`),

  listMessages: (threadId: string) =>
    api.get<Message[]>(`/chat/threads/${threadId}/messages`).then((r) => r.data),

  /** Returns a ReadableStream for SSE streaming */
  sendMessage: (threadId: string, content: string): Promise<ReadableStream<Uint8Array>> =>
    fetch(`/api/chat/threads/${threadId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, thread_id: threadId }),
    }).then((res) => {
      if (!res.ok) throw new Error('Failed to send message')
      return res.body!
    }),
}

// ── Files ─────────────────────────────────────────────────────────────────────

export const filesApi = {
  upload: (file: File, threadId?: string, ingest = false) => {
    const form = new FormData()
    form.append('file', file)
    if (threadId) form.append('thread_id', threadId)
    form.append('ingest', String(ingest))
    return api
      .post<FileUploadResponse>('/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}

// ── RAG ───────────────────────────────────────────────────────────────────────

export const ragApi = {
  query: (threadId: string, query: string): Promise<ReadableStream<Uint8Array>> =>
    fetch('/api/rag/query', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: threadId, query }),
    }).then((res) => {
      if (!res.ok) throw new Error('RAG query failed')
      return res.body!
    }),
}

// ── Image generation ──────────────────────────────────────────────────────────

export const imageApi = {
  generate: (prompt: string, threadId: string) =>
    api
      .post<ImageGenerateResponse>('/image/generate', { prompt, thread_id: threadId })
      .then((r) => r.data),
}

// ── SQL ───────────────────────────────────────────────────────────────────────

export const sqlApi = {
  query: (question: string, threadId: string) =>
    api
      .post<SQLQueryResponse>('/sql/query', { question, thread_id: threadId })
      .then((r) => r.data),
}

// ── Google Sheets ─────────────────────────────────────────────────────────────

export const sheetsApi = {
  query: (spreadsheetId: string, question: string, threadId: string) =>
    api
      .post<SheetsQueryResponse>('/sheets/query', {
        spreadsheet_id: spreadsheetId,
        question,
        thread_id: threadId,
      })
      .then((r) => r.data),
}

export default api
