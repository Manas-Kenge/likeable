# Likeable

A local AI app builder that generates and refines React applications through conversation. Inspect generated source, preview the app in an E2B sandbox, and export it as a ZIP.

## Features

- Conversational project creation and refinement with assistant-ui.
- Streamed plans, build activity, Markdown responses, and generation results.
- Live app previews, device sizing, and a resizable chat/preview workspace.
- Read-only Monaco code viewer with a file explorer and changed-file links.
- Saved projects and conversations in SQLite, with source recovery when a sandbox expires.
- Build validation before reporting generation success; partial changes and diagnostics retained on failure.
- ZIP export of saved project source, including binary assets.
- A landing page with a project composer, compact project previews, and an interactive SVG footer.

## Architecture

```text
Browser → Next.js frontend (:3000)
             → /api/project/* proxies → Bun/Express backend (:3001)
                                          ├── SQLite project storage
                                          ├── AI SDK 7 → Z.ai GLM-4.7
                                          └── E2B → React/Vite app preview
```

The builder uses two local server processes. Open only `http://localhost:3000` in your browser; Next.js forwards API requests to the backend on loopback port 3001. Generated apps run remotely in E2B, where Vite listens on port 5173 and is exposed through an HTTPS preview URL.

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, assistant-ui, shadcn/Radix UI, Monaco |
| Backend | Bun, Express 5, AI SDK 7, official `@ai-sdk/zai` provider, SQLite |
| Generated apps | E2B sandboxes, React 19, TypeScript, Vite 7, Tailwind CSS 4 |

## Run locally

Requires Node.js 24 LTS, Bun, a Z.ai API key with model access, and an E2B account/API key. AI generation and sandbox operations require internet access.

### 1. Install and configure

```bash
git clone https://github.com/Manas-Kenge/likeable.git
cd likeable/backend
bun install --frozen-lockfile
cp .env.example .env
```

Fill in `E2B_API_KEY` and `ZAI_API_KEY` in `backend/.env`. The default model is `glm-4.7`; `ZAI_MODEL` and `ZAI_BASE_URL` can override the model and endpoint.

### 2. Prepare the E2B template

If you already have access to a template built from this repository's starter, set `E2B_TEMPLATE_ID` to its ID. Otherwise, run this from `backend/` after configuring `E2B_API_KEY`:

```bash
bun run template:build
```

Copy the printed template ID into `E2B_TEMPLATE_ID` in `backend/.env`. The build runs remotely and requires no local Docker daemon. Its default alias is `likeable-react-dev`; `E2B_TEMPLATE_NAME` can override it.

### 3. Start the backend

From `backend/`, with all three required variables configured:

```bash
bun run dev
```

The backend listens on `http://127.0.0.1:3001`. Check it with `curl http://localhost:3001/health`.

### 4. Start the frontend

In another terminal, from the repository root:

```bash
cd frontend
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

Open `http://localhost:3000`. `BACKEND_URL` defaults to `http://localhost:3001`; change it in `frontend/.env.local` if you change the backend port. Service credentials belong in `backend/.env`.

Projects are saved in `backend/.data/likeable.sqlite`, with no separate database server required. Run one backend process per database. E2B sandboxes are created with a 15-minute timeout; reopening an expired project restores its saved source into a new sandbox. See [backend setup and behavior](backend/README.md) for recovery and export details.

## Project structure

```text
backend/
  index.ts                # Local server entry point
  src/app.ts              # HTTP and streaming routes
  src/graph.ts            # AI orchestration and build validation
  src/project-service.ts  # Sandbox lifecycle, generation runs and export
  src/store.ts            # SQLite persistence
  my-app/                 # Generated-app starter
  scripts/                # Remote E2B template build
  e2b.Dockerfile           # Sandbox image definition
frontend/
  src/app/                # Landing page, workspace and API proxies
  src/components/         # assistant-ui, workspace and shared UI
  src/lib/                # API client, adapters and utilities
shared/types.ts           # API and stream contracts used by both apps
```

## Development

Run these commands from the indicated directory:

| Directory | Command | Purpose |
| --- | --- | --- |
| `backend/` | `bun run test` | Storage, generation, HTTP, export and stream tests |
| `backend/` | `bun run typecheck` | TypeScript checks |
| `frontend/` | `bun run test` | Chat rendering, adapters, project creation and preview tests |
| `frontend/` | `bun run lint` | ESLint |
| `frontend/` | `bun x tsc --noEmit` | TypeScript checks |
| `frontend/` | `bun run build` | Next.js production build |
| `frontend/` | `bun run start` | Serve a completed production build |
| `backend/my-app/` | `npm ci` | Install the starter's locked dependencies |
| `backend/my-app/` | `npm run test` | Starter configuration checks |
| `backend/my-app/` | `npm run lint` | Starter ESLint |
| `backend/my-app/` | `npm run build` | Starter TypeScript and Vite build |

Automated tests use fixtures for AI and E2B transports. Live generation requires your configured accounts. The backend is a local, single-user server; authentication and multi-user hosting are not implemented.

See the [frontend guide](frontend/README.md), [backend guide](backend/README.md), and [starter guide](backend/my-app/README.md) for details.
