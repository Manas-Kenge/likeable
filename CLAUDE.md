# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An AI-powered web app builder ("Lovable clone") where users describe an app in natural language and get a live, editable React application. The AI generates code that runs in an isolated E2B cloud sandbox with Vite HMR.

## Development Commands

### Backend (`backend/`)
```bash
bun run dev     # Watch mode
bun run start   # Production
```

### Frontend (`frontend/`)
```bash
npm run dev     # Dev server on :3000
npm run build   # Production build
npm run lint    # ESLint
```

### E2B Sandbox (when changing the sandbox template)
```bash
e2b template build   # Rebuild sandbox Docker image — only needed when modifying e2b.Dockerfile
```

No automated test suite — verify manually and with the linter.

## Required Environment Variables

**`backend/.env`**
- `GOOGLE_API_KEY` — Google Gemini API key (primary LLM)
- `E2B_API_KEY` — E2B sandbox API key
- `ANTHROPIC_API_KEY` — Optional; enables Claude as LLM
- `PORT` — Optional; defaults to 3001

**`frontend/.env.local`**
- `BACKEND_URL` — URL of the backend (e.g., `http://localhost:3001`)

## Architecture

### Request Flow
```
User → Next.js frontend (:3000)
     → Next.js API routes (/api/project/*) [proxy to avoid CORS]
     → Express backend (:3001, Bun runtime)
     → LangGraph agent (Google Gemini flash)
     → E2B sandbox (Vite + React, :5173)
```

Responses stream back via Server-Sent Events. The frontend processes ~10 distinct event types (`thinking`, `plan`, `step`, `file_start`, `file_complete`, `done`, `preview_ready`, `error`, etc.) in `use-workspace.ts:processStream()`.

### Backend: AI Orchestration (`backend/src/graph.ts`)

The core is a LangGraph `StateGraph` with two nodes in a loop:
1. **`plan_node`** — LLM breaks the user request into an ordered list of steps (JSON array)
2. **`execute_node`** — LLM iterates through steps, emitting file write / shell command operations

State is typed in `backend/src/schema.ts` (`LovableState`). The graph runs up to 20 iterations (`iterationCount` guard). File writes go directly to the E2B sandbox filesystem; Vite HMR picks up changes automatically. After writes, `graph.ts` touches a file to force HMR reload.

Streaming uses config writers passed through LangGraph's `configurable` field — not standard LangChain callbacks.

### Backend: Project/Sandbox Lifecycle (`backend/src/project-service.ts`)

Projects and active E2B sandboxes are stored **in-memory** (plain `Map`s). There is no database. Sandboxes are created with retry logic for transient network errors. On creation, the service starts `npm run dev` inside the sandbox with `--host 0.0.0.0` so the iframe preview works.

### Frontend: Workspace State (`frontend/src/components/chat-workspace/use-workspace.ts`)

Single hook managing the entire chat+editor+preview state. Key behaviors:
- `sessionStorage` is used to pass the initial prompt from the landing page to the chat page immediately on project creation
- File tree is built client-side from a flat list of file paths returned by the backend
- `selectFile()` fetches file content on demand (not pre-loaded)
- The preview iframe URL is the E2B sandbox public URL; a cache-busting query param is appended on reload

### Frontend: API Client (`frontend/src/lib/api.ts`)

`ApiClient` talks to `/api/project/*` (Next.js routes), which proxy to the backend. `streamMessage()` returns an `AsyncGenerator<StreamEvent>` — consume with `for await`.

## Code Conventions

- **TypeScript strict mode everywhere.** Use `import type` for type-only imports.
- **Formatting:** double quotes, semicolons, 2-space indent, trailing commas.
- **Naming:** `camelCase` variables/functions, `PascalCase` components/types, `UPPER_CASE` constants.
- **React:** `'use client'` directive required for any component using hooks or browser APIs. Functional components only.
- **Path aliases:** `@/` resolves to `frontend/src/`; backend uses relative paths from `src/`.
- **Async patterns:** `async/await` everywhere; `for await` for generators/streams.
- **Error handling:** always check `error instanceof Error`; backend returns `ApiResponse<T>` shaped `{ success, data, error }`.
- **Logging:** prefix with context, e.g. `[ProjectService] Creating sandbox...`.
- **File extensions:** `.tsx` for React components, `.ts` for everything else.

## Key Constraints

- **No database** — all project/sandbox state is in-memory; restarting the backend loses all projects.
- **E2B sandbox = one per project** — creating many projects burns E2B quota quickly in development.
- **AI model** — primary model is Google Gemini Flash (configured in `graph.ts`). Changing models requires updating the `ChatGoogleGenerativeAI` instantiation there.
- **Sandbox template** — defined by `backend/e2b.toml` + `backend/e2b.Dockerfile`. Rebuilding (`e2b template build`) is slow; avoid unless changing the base environment.
