# AI Web App Builder

An AI-powered web application builder that generates working React apps from natural language descriptions. Describe what you want to build, and watch as the AI creates a fully functional application in real-time.

## Demo

https://github.com/user-attachments/assets/f7f36797-dd1d-4649-a69b-d97263d7a25a

## Features

- **Natural Language to Code** - Describe your app in plain English, AI generates the code
- **Real-Time Preview** - See your application update live as code is generated
- **Isolated Sandboxes** - Each project runs in its own secure E2B cloud environment
- **Streaming Responses** - Watch AI reasoning and code generation step-by-step
- **Full Code Editor** - Monaco-based editor with syntax highlighting and file explorer

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│    Frontend     │────▶│       Backend        │────▶│    E2B Sandbox      │
│   (Next.js)     │◀────│   (Bun + Express)    │◀────│   (Vite + React)    │
│   Port 3000     │ SSE │      Port 8080       │     │   Live Preview      │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
                               │
                        ┌──────────────┐
                        │  AI SDK v5   │
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
| **Frontend** | Next.js 16, React 19, TailwindCSS, Monaco Editor, Radix UI |
| **Backend** | Bun, Express 5, AI SDK v5 |
| **AI** | Z.ai / ZhipuAI GLM-4.7 (via AI SDK v5) |
| **Sandbox** | E2B cloud sandboxes with Vite + React |

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── graph.ts          # AI SDK streaming chat orchestration
│   │   ├── project-service.ts # Sandbox lifecycle management
│   │   ├── prompt.ts         # AI system prompts
│   │   └── tools.ts          # AI tool definitions
│   ├── my-app/               # Template app for sandboxes
│   ├── index.ts              # Express server entry point
│   ├── e2b.toml              # E2B template config
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

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/) runtime
- [E2B](https://e2b.dev/) account and API key
- [Z.ai](https://z.ai/) API key (ZhipuAI GLM-4.7)

### 1. Clone and Configure

```bash
git clone <repository-url>
cd lovable
```

Create `backend/.env`:

```env
# Required
E2B_API_KEY="your-e2b-api-key"
ZAI_API_KEY="your-zai-api-key"
E2B_TEMPLATE_ID="lovable-clone-dev"
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
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

### 4. Build E2B Template (Optional)

If you need to customize the sandbox environment:

```bash
cd backend
e2b template build
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

## Development

### Commands

| Directory | Command | Description |
|-----------|---------|-------------|
| `backend/` | `bun run dev` | Start backend (watch mode) |
| `backend/` | `bun run start` | Start backend (production) |
| `frontend/` | `npm run dev` | Start frontend dev server |
| `frontend/` | `npm run build` | Production build |
| `frontend/` | `npm run lint` | Run ESLint |

### Code Style

- TypeScript strict mode
- Double quotes, semicolons, 2-space indent
- `import type` for type-only imports
- See `AGENTS.md` for full conventions

## License

MIT
