# Amzur AI Chat — Issues Faced & Fixes Applied

## Issue 1: Chat Memory Returning 10 Conversations Instead of 5

**Project:** Project 4 — Conversation Memory  
**Symptom:** The chat was fetching 20 messages (10 conversation pairs) when the requirement was 5 previous conversations.  
**Root Cause:** `load_history()` had a default `limit=20` and was called without specifying a limit, so it fetched double the required amount.  
**Fix:** Called `load_history(db, thread_id, limit=10)` explicitly — 10 messages = 5 user + 5 assistant exchanges.  
**File:** `backend/app/services/chat_service.py`

---

## Issue 2: Table Responses Displaying as Raw Markdown Text

**Project:** Project 5 — Multi-format Display  
**Symptom:** When the AI responded with a markdown table (e.g. "convert to tabular format"), the table was shown as raw `|` pipe characters instead of a rendered visual table.  
**Root Cause:** `ReactMarkdown` with `remarkGfm` was present but had no custom table component renderers — the default Tailwind `prose` classes applied minimal table styling with no visible borders or structure.  
**Fix:** Added custom `table`, `thead`, `tbody`, `tr`, `th`, `td` component renderers to `ChatMessage.tsx` with explicit Tailwind border, background, and padding styles.  
**File:** `frontend/src/components/chat/ChatMessage.tsx`

---

## Issue 3: Attached Images Could Not Be Described by the AI

**Project:** Project 5 — Image Attachments  
**Symptom:** Attaching an image and asking "describe the image" resulted in the AI saying it cannot access attachments.  
**Root Cause:** `_extract_file_text()` returned `None` for `file_type == "image"` — images were silently skipped and never passed to the LLM. The text-only `chat_chain` was used for all messages regardless of attachment type.  
**Fix:** Added a separate **multimodal execution path** in `stream_chat_response()`. When image files are attached, they are read from disk, base64-encoded, and passed as `image_url` content parts inside a `HumanMessage` directly to the LLM — bypassing the text-only LCEL chain.  
**File:** `backend/app/services/chat_service.py`

---

## Issue 4: Attached Videos Could Not Be Described by the AI

**Project:** Project 5 — Video Attachments  
**Symptom:** Same as Issue 3 but for video files — AI said it could not access the video.  
**Root Cause:** The multimodal path introduced for images only handled `file_type == "image"`. Videos were still falling through to the text-only chain.  
**Fix:** Extended the multimodal path to handle both `image` and `video` file types. Images use `image_url` content parts; videos use `video_url` content parts (Gemini vision API format).  
**File:** `backend/app/services/chat_service.py`

---

## Issue 5: Generated Images Displaying as Broken Image Icon

**Project:** Project 6 — Image Generation  
**Symptom:** After generating an image, a broken image icon appeared instead of the actual image.  
**Root Cause:** Gemini/Imagen returns a **temporary signed URL** that expires within seconds. By the time the browser rendered the `<img>` tag, the URL was already dead.  
**Fix:**  
- Backend downloads the image server-side immediately using `httpx` and saves it to `uploads/generated/{uuid}.png`  
- Returns a stable local URL: `/api/image/serve/{filename}`  
- Added `GET /api/image/serve/{filename}` endpoint that serves the file from disk  
**Files:** `backend/app/services/image_service.py`, `backend/app/api/image.py`

---

## Issue 6: Generated Image Disappearing After Next Message

**Project:** Project 6 — Image Generation  
**Symptom:** The generated image was visible, but after sending the next message it disappeared completely.  
**Root Cause:** The generated image was only added **optimistically to React's in-memory cache** — neither the user prompt nor the assistant image message were saved to the database. When the next message triggered a DB re-fetch, the messages were gone.  
**Fix:**  
- Backend `image.py` now calls `save_message()` for both the user prompt and the assistant image response before returning  
- Frontend invalidates `['messages', tid]` after generation so DB messages are loaded  
- Optimistic message only shown if DB re-fetch hasn't already provided it  
**Files:** `backend/app/api/image.py`, `frontend/src/pages/ChatPage.tsx`

---

## Issue 7: Image Edit Commands (e.g. "remove trees") Producing Broken Images

**Project:** Project 6 — Image Editing  
**Symptom:** After generating an image, typing an edit command like "remove trees" resulted in a broken image icon rather than a regenerated image.  
**Root Cause (multiple):**  
1. `imageMode` resets to `false` after each send — "remove trees" didn't match `IMAGE_INTENT_RE` so it fell through to regular text chat  
2. Gemini saw `![generated image](...)` in history and hallucinated a fake image URL → broken image  
3. The serve endpoint required auth cookies which `<img>` tags don't always send correctly through the Vite proxy  
**Fix:**  
- Added `IMAGE_EDIT_RE` regex to detect edit intent ("remove", "add", "change", "make it", etc.)  
- Edit detection only triggers when there's a previously generated image in the thread (`hasImageHistory`)  
- Combined original prompt + edit instruction: `"himalayan mountains with trees, but remove trees"`  
- Removed auth requirement from `/api/image/serve/{filename}` (UUID filenames are unguessable)  
**Files:** `frontend/src/pages/ChatPage.tsx`, `backend/app/api/image.py`

---

## Issue 8: PDF RAG — No Response After Attaching PDF and Asking Question

**Project:** Project 7 — PDF RAG Chat  
**Symptom:** After attaching a PDF and typing a question in the same send, the ingestion banner appeared briefly then disappeared with no AI response.  
**Root Cause:** React `setState` is asynchronous — `setRagFileIds(...)` was called to track the new PDF IDs, but `ragFileIds[tid]` was read immediately after in the same function before the state update was applied. The RAG file ID list was still empty, so the message fell through to the regular chat chain (which knew nothing about the PDF).  
**Fix:**  
- Introduced `justIngestedPdfIds` as a **local variable** within the same call to capture newly uploaded PDF IDs synchronously  
- RAG routing checks `[...ragFileIds[tid], ...justIngestedPdfIds]` — merges persisted state with freshly ingested IDs  
- All ingestion/upload errors are now caught and shown as error messages in the chat  
**File:** `frontend/src/pages/ChatPage.tsx`

---

## Issue 9: RAG Returning Empty Responses (Silent Failure)

**Project:** Project 7 — PDF RAG Chat  
**Symptom:** After the RAG routing fix (Issue 8), questions still produced no response — the stream completed with empty content.  
**Root Cause (two bugs):**  
1. **`{history}` conflict in `rag.txt`:** The system prompt contained `{history}` as a literal placeholder, but `rag_chain.py` also declared `MessagesPlaceholder(variable_name="history")`. LangChain's string formatter tried to insert the list of `BaseMessage` objects as a string into `{history}` in the system prompt — producing garbage that caused the LLM to silently fail or return empty  
2. **ChromaDB filter syntax:** Single file_id filter used `{"file_id": value}` (plain dict) instead of the required explicit operator `{"file_id": {"$eq": value}}`  
**Fix:**  
- Removed `{history}` from `rag.txt` — history is already handled by the `MessagesPlaceholder` in the chain definition  
- Fixed ChromaDB filter to use `{"$eq": value}` operator syntax  
- Empty stream now shows `⚠️ Sorry, something went wrong` instead of silently resetting  
**Files:** `backend/app/ai/prompts/rag.txt`, `backend/app/ai/rag/retrieval.py`, `frontend/src/hooks/useChat.ts`

---

## Summary Table

| # | Issue | Project | Layer | Status |
|---|---|---|---|---|
| 1 | Memory limit returning 10 conversations instead of 5 | P4 | Backend | ✅ Fixed |
| 2 | Tables rendering as raw markdown | P5 | Frontend | ✅ Fixed |
| 3 | Image attachments not described by AI | P5 | Backend | ✅ Fixed |
| 4 | Video attachments not described by AI | P5 | Backend | ✅ Fixed |
| 5 | Generated images showing as broken icon (expired URL) | P6 | Backend | ✅ Fixed |
| 6 | Generated image disappearing after next message | P6 | Backend + Frontend | ✅ Fixed |
| 7 | Image edit commands producing broken images | P6 | Frontend + Backend | ✅ Fixed |
| 8 | PDF RAG — no response due to React state timing bug | P7 | Frontend | ✅ Fixed |
| 9 | RAG silent failure due to `{history}` conflict + ChromaDB filter | P7 | Backend | ✅ Fixed |
