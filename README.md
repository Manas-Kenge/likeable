# AI Web App Builder

An AI-powered web application builder that generates working React apps from natural language descriptions. Describe what you want to build, and watch as the AI creates a fully functional application in real-time.

## Demo

https://github.com/user-attachments/assets/f7f36797-dd1d-4649-a69b-d97263d7a25a

## Features

- **Natural Language to Code** - Describe your app in plain English, AI generates the code
- **Real-Time Preview** - See your application update live as code is generated
- **Isolated Sandboxes** - Each project runs in its own secure E2B cloud environment
- **Streaming Responses** - Watch AI reasoning and code generation step-by-step
- **Code Inspection** - Read-only Monaco viewer with file explorer and links to changed files
- **Saved Projects** - Local SQLite persistence for conversations and source files, with sandbox recovery
- **Source Export** - Download project source as a ZIP
- **Build Validation** - Check generated code before reporting success; retain failed changes for retry

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│    Frontend     │────▶│       Backend        │────▶│    E2B Sandbox      │
│   (Next.js)     │◀────│   (Bun + Express)    │◀────│   (Vite + React)    │
│   Port 3000     │ SSE │      Port 3001       │     │   Live Preview      │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
                               │
                        ┌──────────────┐
                        │  AI SDK v7   │
                        │  + GLM-4.7   │
                        └──────────────┘
```

**Flow:**
1. User submits a prompt describing what to build
2. Backend creates an E2B sandbox with Vite + React template
3. AI SDK agent plans and executes code generation steps
4. Files are written to sandbox, Vite hot-reloads the preview
5. Frontend streams AI progress and displays live preview

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 16, React 19, TailwindCSS, assistant-ui, shadcn/Radix UI, Monaco Editor |
| **Backend** | Bun, Express 5, AI SDK v7 |
| **AI** | Z.ai GLM-4.7 (official `@ai-sdk/zai` provider) |
| **Sandbox** | E2B cloud sandboxes with Vite + React |

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── graph.ts          # AI SDK streaming chat orchestration
│   │   ├── project-service.ts # Sandbox lifecycle and persisted generation runs
│   │   ├── store.ts          # SQLite project/message/source storage
│   │   ├── prompt.ts         # AI system prompts
│   │   └── tools.ts          # AI tool definitions
│   ├── my-app/               # Template app for sandboxes
│   ├── index.ts              # Express server entry point
│   └── e2b.Dockerfile        # Sandbox Docker image
├── frontend/
│   └── src/
│       ├── app/              # Next.js App Router pages
│       ├── components/       # React components
│       └── lib/              # Utilities and API client
└── README.md
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 24 LTS
- [Bun](https://bun.sh/) runtime
- [E2B](https://e2b.dev/) account and API key
- [Z.ai](https://z.ai/) API key (ZhipuAI GLM-4.7)

### 1. Clone and Configure

```bash
git clone <repository-url>
cd likeable
```

Create `backend/.env`:

```env
# Required
E2B_API_KEY="your-e2b-api-key"
ZAI_API_KEY="your-zai-api-key"
E2B_TEMPLATE_ID="your-accessible-template-id"
PORT=3001
```

### 2. Start Backend

```bash
cd backend
bun install
bun run dev
```

Backend runs on `http://localhost:3001`

### 3. Start Frontend

```bash
cd frontend
bun install --frozen-lockfile
bun run dev
```

Optionally set `BACKEND_URL=http://localhost:3001` in `frontend/.env.local` (this is the default).

Frontend runs on `http://localhost:3000`

### 4. E2B Template Access

Your account must have access to the template set in `E2B_TEMPLATE_ID`. The remote build command uses your E2B key and creates the `likeable-react-dev` template. To build the supplied starter, configure `E2B_API_KEY` first, then run:

```bash
cd backend
bun run template:build
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/project` | Create new project with sandbox |
| `GET` | `/project/:id` | Get project details |
| `GET` | `/projects` | List all projects |
| `POST` | `/project/chat/:id` | Send chat message (SSE streaming) |
| `GET` | `/project/:id/files` | List project files |
| `GET` | `/project/:id/file?path=` | Read file content |
| `POST` | `/project/:id/resume` | Restore/reopen a sandbox |
| `GET` | `/project/:id/export` | Download current source ZIP |

Set `E2B_TEMPLATE_ID` to the ID printed by the build command before starting the backend.

Projects are saved in `backend/.data/likeable.sqlite`. Run one backend process per database. Sandboxes expire after 15 minutes; reopen a project to restore its saved source. AI and sandbox services still require internet access. See [backend setup and behavior](backend/README.md) for details.

## Development

### Commands

| Directory | Command | Description |
|-----------|---------|-------------|
| `backend/` | `bun run dev` | Start backend (watch mode) |
| `backend/` | `bun run start` | Start backend |
| `backend/` | `bun run test` | Run automated tests |
| `backend/` | `bun run typecheck` | Check backend types |
| `frontend/` | `npm run dev` | Start frontend dev server |
| `frontend/` | `npm run build` | Production build |
| `frontend/` | `npm run lint` | Run ESLint |
| `frontend/` | `bun run test` | Test assistant-ui adapters and project creation |

### Code Style

- TypeScript strict mode
- Double quotes, semicolons, 2-space indent
- `import type` for type-only imports
- Shared API contracts are defined in `shared/types.ts`

## License

MIT
