// Shared TypeScript interfaces matching backend Pydantic schemas

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface Thread {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  token_count: number | null
  created_at: string
}

export interface UploadedFile {
  id: string
  original_filename: string
  mime_type: string
  file_type: 'image' | 'video' | 'pdf' | 'excel' | 'other'
  file_size: number
  created_at: string
}

export interface TokenResponse {
  message: string
  user: User
}

export interface FileUploadResponse {
  file: UploadedFile
  message: string
}

export interface ImageGenerateResponse {
  image_url: string
  thread_id: string
}

export interface SQLQueryResponse {
  answer: string
  generated_sql: string
  thread_id: string
}

export interface SheetsQueryResponse {
  answer: string
  thread_id: string
}

export interface ApiError {
  error: string
  message: string
}
