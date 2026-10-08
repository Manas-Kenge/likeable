# Likeable frontend

The builder interface uses Next.js 16, React 19, Tailwind CSS 4, shadcn/Radix components, assistant-ui, and Monaco. assistant-ui provides the chat thread and project composer; an external-store adapter connects it to the backend's existing SSE events.

## Run locally

Start the backend using the [repository setup guide](../README.md), then run these commands from `frontend/` in another terminal:

```bash
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

Open `http://localhost:3000`. `BACKEND_URL` in `.env.local` defaults to `http://localhost:3001`. It is a server-side setting used by Next.js API proxies; E2B and Z.ai credentials are configured in the backend.

## Interface and routing

- `/` contains the project composer, prompt suggestions, saved project previews, and SVG footer.
- `/chat/:id` contains the assistant-ui conversation and resizable preview/code workspace. Code inspection is read-only; refinement happens through chat.
- `/api/project` creates and lists projects. Routes under `/api/project/:id` proxy project details, chat streaming, files, sandbox recovery, and ZIP export to the backend.

Saved project thumbnails use live sandbox previews when available. An expired sandbox shows a fallback; opening the project allows recovery from saved source.

## Development

| Command | Purpose |
| --- | --- |
| `bun run dev` | Next.js development server |
| `bun run test` | Chat rendering, adapter, project creation and preview tests |
| `bun run lint` | ESLint |
| `bun x tsc --noEmit` | TypeScript checks |
| `bun run build` | Production build |
| `bun run start` | Serve a completed production build |

Inter and Geist Mono are loaded through `next/font/google`, which downloads them during a build. Instrument Serif is bundled locally for the landing page. The builder uses shadcn preset `b1VlIttI` (Radix Luma, neutral, Inter).

## Code map

| Location | Responsibility |
| --- | --- |
| `src/app/page.tsx`, `page.module.css` | Landing page and layout |
| `src/app/api/project/` | Server-side backend proxies |
| `src/components/assistant-ui/` | Chat thread and Markdown rendering |
| `src/components/chat-workspace/` | Workspace state, preview, code viewer and header |
| `src/lib/api.ts` | Typed API client and SSE parsing |
| `../shared/types.ts` | API and stream contracts shared with the backend |

Serving this frontend requires a running backend for project operations. See the [backend guide](../backend/README.md) for storage, credentials and sandbox behavior.
