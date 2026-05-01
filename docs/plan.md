# Amzur AI Chat — Implementation Plan

This plan provides a comprehensive blueprint for implementing the Amzur AI Chat platform, strictly following the conventions, architecture, and security guidelines from copilot-instructions.md.

---

## 1. Project Setup & Structure
- Scaffold repository as per documented structure (frontend/backend separation).
- Define all environment variables in .env files—never hardcoded.

## 2. Backend Implementation

### A. API Layer
- Place all FastAPI route handlers in backend/app/api/.
- Route handlers must:
  - Be async.
  - Use Depends() for DB, auth, and shared services.
  - Declare explicit response_model.
  - Contain no business logic or DB access (delegate to services).

### B. Service Layer
- Implement all business logic in backend/app/services/.
- Ensure all service functions are unit-testable and framework-agnostic.
- Handle AI orchestration, file management, and RAG logic here.

### C. Models & Schemas
- Define SQLAlchemy ORM models in backend/app/models/ (UUID PKs, DateTime(timezone=True)).
- Define Pydantic schemas in backend/app/schemas/ (never mix with ORM models).

### D. AI Integration
- All AI calls route through backend/app/ai/llm.py using the LiteLLM proxy.
- Always include user email for usage tracking.
- Use LCEL syntax for LangChain chains.
- Store all prompt templates in backend/app/ai/prompts/.
- Stream all LLM responses.

### E. File Handling
- Save files to disk (UPLOAD_DIR), never as DB blobs.
- Validate MIME type server-side.
- Record file metadata in DB.

### F. Auth
- Implement both email/password and Google OAuth 2.0.
- Use JWT in httpOnly cookies only.
- Use get_current_user via Depends() for all protected routes.

### G. Database
- Use SQLAlchemy 2.0 style.
- All schema changes via Alembic migrations.
- Use selectinload/joinedload to avoid N+1 queries.

## 3. Frontend Implementation

### A. Component Structure
- Use functional components and hooks only.
- Place components in frontend/src/components/ by feature.
- Use PascalCase for components, camelCase for hooks.

### B. State Management
- Use TanStack Query for server state.
- Use useState/useReducer for local state.
- Use Zustand or React Context for global/auth state.

### C. API Integration
- All API calls through frontend/src/lib/api.ts.
- Define all response shapes in frontend/src/types/.
- Use zod for runtime validation where needed.

### D. UI/UX
- Use Tailwind CSS utility classes inline.
- Render markdown (react-markdown), code blocks, and LaTeX in chat.
- Stream message output token-by-token.
- Enforce text-justify for chat bubbles.

### E. File Uploads
- Enforce MAX_UPLOAD_MB on both frontend and backend.
- Accept only allowed MIME types.

## 4. Testing
- Backend: pytest, pytest-asyncio, httpx.AsyncClient, isolated test DB.
- Frontend: Vitest, React Testing Library.
- Mock all AI and RAG calls in tests.
- Every service function and chain must have a unit test.

## 5. Security & Quality
- No secrets or keys in code.
- Validate all user input with Pydantic.
- Enforce NL-to-SQL keyword block (INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER).
- Use pre-commit hooks for linting and formatting.
- Follow Conventional Commits for all git messages.

---

## Relevant Files
- copilot-instructions.md — Source of all conventions and architecture decisions.
- backend/app/api/ — Route handlers.
- backend/app/services/ — Business logic.
- backend/app/models/ — ORM models.
- backend/app/schemas/ — Pydantic schemas.
- backend/app/ai/llm.py — LiteLLM client.
- backend/app/ai/prompts/ — Prompt templates.
- frontend/src/components/ — UI components.
- frontend/src/lib/api.ts — API client.
- frontend/src/types/ — TypeScript interfaces.

---

## Verification
1. Run all backend and frontend tests (pytest, Vitest).
2. Lint and format code (ruff, eslint, prettier).
3. Manual verification of:
   - Auth flows (email/password, Google OAuth).
   - AI chat, streaming, and RAG features.
   - File upload and retrieval.
   - JWT handling (httpOnly cookie).
4. Confirm all AI calls route through LiteLLM proxy and include user email.
5. Check for absence of hardcoded secrets, direct provider calls, or logic in routers.

---

## Architecture Decisions
- All AI calls centralized via LiteLLM proxy.
- JWT stored in httpOnly cookie only.
- Two-strategy auth with unified JWT.
- Per-user ChromaDB collections.
- Conversational memory from DB, not in-process.
- Synchronous driver for LangChain SQL agent.

---

## Further Considerations
1. For new features, always check if logic belongs in service, not router.
2. For new AI models or providers, update env vars only—no code changes.
3. For new file types, update accepted MIME types in settings, not in code.

---

This plan ensures all implementation aligns with the architecture, security, and quality standards defined in the project documentation. For feature-specific plans, specify the feature or module.