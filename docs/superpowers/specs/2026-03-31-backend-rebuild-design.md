# Backend Rebuild Design

**Date:** 2026-03-31
**Status:** Approved

## Summary

Rebuild the Express/Bun backend from scratch to remove dead LangChain code, fix the broken provider setup, and add multi-turn conversation history with a rolling 10-turn window. The E2B sandbox template (`my-app`) is left untouched — it is already correctly configured with Vite + React + TailwindCSS v4 + shadcn.

---

## 1. Dependencies & Environment

### Remove from `package.json`
- `@langchain/anthropic`, `@langchain/google-genai`, `@langchain/openai`, `@langchain/core`, `@langchain/langgraph`
- `langchain`, `langsmith`, `@ai-sdk/langchain`
- `@e2b/code-interpreter` (unused; plain `e2b` is sufficient)

### Keep
- `ai` — Vercel AI SDK
- `zhipu-ai-provider` — z.ai provider
- `e2b` — sandbox management
- `express`, `cors`, `dotenv`, `uuid`, `zod`

### Required environment variables (`backend/.env`)
- `ZAI_API_KEY` — z.ai API key (required)
- `E2B_API_KEY` — E2B sandbox API key (required)
- `E2B_TEMPLATE_ID` — E2B sandbox template name/ID (optional, defaults to `"lovable-clone-dev"`)
- `PORT` — optional, defaults to 3001

All other previously documented env vars (`GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `LANGSMITH_API_KEY`) are removed.

---

## 2. AI Orchestration (`src/graph.ts`)

Two-phase approach using Vercel AI SDK only. No LangGraph.

### Phase 1 — Planning (stateless)
`generateText` with `planningPrompt` → JSON array of up to 8 steps. No history passed; planning is per-request stateless.

### Phase 2 — Execution (stateful)

Updated `streamChat` signature:
```ts
export async function* streamChat(
  message: string,
  projectId: string,
  sandbox: Sandbox,
  history: CoreMessage[]   // replaces isFirstMessage; passed from index.ts via getHistory()
): AsyncGenerator<StreamEvent>
```

`streamText` call:
- `system`: the existing `prompt` constant
- `messages`: `[...history, { role: "user", content: message }]` — `streamChat` constructs this internally. The stored `history` contains at most 20 entries (10 pairs); appending the new user message makes at most 21 passed to the model. This is intentional.
- `tools`: `{ write_file, read_file, run_command, list_files }` from `src/tools.ts`
- `maxSteps: 20`

### After streaming completes (inside `streamChat`)
After the `for await` loop over `result.fullStream`, call `const finalText = await result.text` (`result.text` is a Promise on `StreamTextResult` — must be awaited). Yield the `done` event with the text included:
```ts
yield { type: "done", data: { text: finalText } };
```

`index.ts` captures the final text by inspecting the yielded `done` event:
```ts
let finalText = "";
for await (const event of streamChat(message, projectId, sandbox, history)) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (event.type === "done") finalText = event.data?.text ?? "";
}
addMessage(projectId, body.message, finalText);
```

Tool call/result details are **not** stored in history — only the final text response. This keeps history compact and avoids tool schema drift between turns.

### Streaming events emitted (unchanged)
`thinking` → `plan` → `step` (per tool-call) → `file_start` / `file_complete` (per write) → `done` → `preview_ready` (if files changed)

### Removed
- The non-streaming `chat()` export is removed entirely.
- `isFirstMessage` parameter removed from `streamChat`.

---

## 3. Project Service (`src/project-service.ts`)

### Message history
- `Project.messages` type changes from custom `ChatMessage[]` to `CoreMessage[]` from the `ai` package (`{ role: "user" | "assistant", content: string }`)
- `addMessage(projectId: string, userContent: string, assistantContent: string): void` — appends `{ role: "user", content: userContent }` and `{ role: "assistant", content: assistantContent }` to the project's message array, then trims the array to the last 20 entries. Always call this *after* streaming completes, not before.
- `getHistory(projectId: string): CoreMessage[]` — returns the stored `project.messages` array (at most 20 entries). Called in `index.ts` before invoking `streamChat`; `streamChat` appends the new user message internally.

### Restart behavior
On `restartProject`, the project's `messages` history is preserved in memory. The new sandbox is a fresh Vite environment. The LLM will have history referencing files it wrote in the prior session, which no longer exist. This is an accepted limitation — history is not cleared on restart.

### Removed functions
- `updateProjectFiles` — file list is refreshed on every `getProject` call via `listSandboxFiles`; the duplicate update in the chat route is dead code
- `updateProjectContext` — the `hasReceivedMessage` / `isFirstMessage` tracking is removed along with the `isFirstMessage` parameter in `streamChat`

### Everything else unchanged
- `createProject`, `getProject`, `getAllProjects`, `getSandbox`, `stopProject`, `restartProject`
- In-memory `Map` storage (no database)
- Retry logic for sandbox creation

---

## 4. Types (`src/types.ts`)

### Remove
- `ChatMessage` — replaced by `CoreMessage` from `ai`
- `ChatResponse` — streaming route doesn't return a structured response body

### Keep
- `Project` — updated: `messages: CoreMessage[]`
- `CreateProjectRequest`
- `ApiResponse<T>`

---

## 5. Express Server (`index.ts`)

### Environment validation
Only check for `ZAI_API_KEY` and `E2B_API_KEY`.

### Route changes
- `POST /project`: Remove the premature `addMessage` call. Message is only stored after the AI processes it.
- `POST /project/chat/:id`:
  - Remove non-streaming branch entirely
  - Remove `isFirstMessage` logic and `updateProjectContext` calls
  - Call `getHistory(projectId)` before streaming; pass to `streamChat`
  - Consume generator with `for await`; capture `finalText` from the `done` event's `data.text`
  - After generator exits: call `addMessage(projectId, body.message, finalText)`
  - Remove `updateProjectFiles` call
- All other routes unchanged.

### Route surface (no frontend changes required)
```
POST   /project
GET    /project/:id
GET    /projects
POST   /project/chat/:id   (streaming only)
GET    /project/:id/files
GET    /project/:id/file
GET    /health
```

---

## 6. Deleted Files

- `backend/src/schema.ts` — already deleted in git. Was a LangGraph state schema (`LovableState`). Fully superseded by `src/types.ts`. No remaining imports reference it.

---

## 7. Files Not Touched

- `backend/e2b.Dockerfile` — sandbox image is correct
- `backend/e2b.toml` — template config is correct
- `backend/my-app/` — Vite + React + TailwindCSS v4 + shadcn template is solid
- `backend/src/tools.ts` — tool definitions are correct
- `backend/src/prompt.ts` — system prompt and planning prompt are correct
- `frontend/` — zero frontend changes required

---

## Key Constraints (unchanged)

- No database — all state is in-memory
- E2B sandbox = one per project
- Backend restart loses all projects and history
