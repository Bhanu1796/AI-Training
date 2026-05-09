# Project 7: PDF RAG Chat

## Overview
Upload a PDF into a chat thread and ask natural-language questions about it. The system uses **Retrieval-Augmented Generation (RAG)** — it retrieves the most relevant passages from the document before answering, grounding responses in the actual file content.

**Stack:**
- **Vector DB:** ChromaDB (persistent, local)
- **Embeddings:** OpenAI `text-embedding-3-large` via LiteLLM proxy
- **LLM:** Gemini 2.5 Flash (grounded answers)
- **Document loader:** LangChain `PyPDFLoader`
- **Text splitter:** `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=150)

---

## Architecture & Flow

```
User attaches PDF → Upload → Ingest → [ChromaDB]
                                           │
User types question ──────────────── Retrieve top-5 chunks
                                           │
                              Build RAG prompt (context + history)
                                           │
                                    Gemini 2.5 Flash
                                           │
                              Stream answer back to UI
```

### Step-by-step

#### 1. PDF Upload & Ingestion
- User clicks the paperclip, selects a PDF
- Frontend calls `POST /api/files/upload` with `ingest=true` (automatically set for PDFs)
- Backend saves the file to `uploads/{user_id}/`
- `ingest_document()` loads the PDF with `PyPDFLoader`, splits into ~1000-char chunks with 150-char overlap
- Each chunk is embedded using `text-embedding-3-large` and stored in ChromaDB
  - Metadata: `{ file_id, user_id, thread_id }` for thread-scoped retrieval
- A green "Document mode" banner appears in the UI — all subsequent messages in this thread use RAG

#### 2. Question Answering (RAG)
- User types a question and sends
- Frontend detects active RAG file IDs → calls `POST /api/rag/query` with `{ thread_id, query, file_ids }`
- Backend retrieves the top-5 most relevant chunks from ChromaDB, **filtered to only the PDFs in this thread**
- The chunks are formatted as a context block and injected into the RAG prompt:
  ```
  Answer using ONLY the context provided below.
  Context: [retrieved chunks]
  History: [last 5 exchanges]
  Human: [user question]
  ```
- Gemini streams the grounded answer back to the UI

#### 3. Conversation Memory
- The last 5 exchanges (10 messages) from the thread are included for follow-up questions
- E.g. "What does section 3 say?" → "Summarise that" — the AI knows what "that" refers to

---

## Key Files

| File | Purpose |
|---|---|
| `backend/app/ai/rag/ingestion.py` | PDF loading, chunking, embedding into ChromaDB |
| `backend/app/ai/rag/retrieval.py` | Similarity search with `file_ids` filter |
| `backend/app/ai/rag/chroma_client.py` | Per-user ChromaDB collection |
| `backend/app/ai/chains/rag_chain.py` | RAG LCEL chain (context + history → LLM) |
| `backend/app/services/rag_service.py` | Orchestrates retrieval + streaming |
| `backend/app/api/rag.py` | `POST /api/rag/query` endpoint |
| `frontend/src/hooks/useChat.ts` | `sendMessage(ragFileIds?)` routes to RAG stream |
| `frontend/src/pages/ChatPage.tsx` | Auto-ingest PDFs, track `ragFileIds` per thread |

---

## UI Behaviour

| Event | UI |
|---|---|
| PDF attached | Purple chip with FileText icon |
| Ingesting into ChromaDB | "Ingesting PDF into vector store…" spinner banner |
| Ingestion complete | Green "Document mode — answering from N ingested PDFs" banner |
| User asks a question | RAG chain used automatically |
| User clicks ✕ on banner | Exits document mode; reverts to regular chat |

---

## Thread Scoping
Each chunk stored in ChromaDB carries a `file_id` and `thread_id` in its metadata. Retrieval always filters by the specific `file_ids` that were ingested in the current thread — so if you have multiple threads with different PDFs, they never cross-contaminate.

---

## Configuration
```env
CHROMA_PERSIST_DIR=./chroma_db          # where ChromaDB stores vectors
LITELLM_EMBEDDING_MODEL=text-embedding-3-large
```
