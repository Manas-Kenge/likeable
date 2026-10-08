# Likeable backend

A local Bun/Express server using AI SDK 7, the official Z.ai provider, E2B sandboxes, and SQLite. Run commands from `backend/`.

## Setup

Requires Bun, Node.js 24 LTS for template builds, a Z.ai API key, and an E2B account/API key.

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Configure `E2B_API_KEY` and `ZAI_API_KEY`. Set `E2B_TEMPLATE_ID` to an accessible template built from `e2b.Dockerfile` and `my-app/`. To create one, run:

```bash
bun run template:build
```

This command needs `E2B_API_KEY` and builds remotely without a local Docker daemon. Copy its reported ID into `E2B_TEMPLATE_ID` in `.env`. `E2B_TEMPLATE_NAME` overrides the default alias `likeable-react-dev`. The image installs dependencies and validates the starter with `npm run build`, placing it at `/home/user/app`. Dependency/build directories and environment files are excluded from uploads.

With all three required variables configured:

```bash
bun run dev
```

The server listens on loopback at `http://127.0.0.1:3001`. `PORT` can override the port. Verify it with `curl http://localhost:3001/health`, then start the [frontend](../frontend/README.md).

| Setting | Default / requirement |
| --- | --- |
| `E2B_API_KEY` | Required for sandbox and template operations |
| `E2B_TEMPLATE_ID` | Required; must be accessible to your account |
| `ZAI_API_KEY` | Required; account needs model access and API credits |
| `ZAI_MODEL` | `glm-4.7` |
| `ZAI_BASE_URL` | `https://api.z.ai/api/paas/v4` |
| `PORT` | `3001` |
| `DATABASE_PATH` | `.data/likeable.sqlite`, relative to the working directory |

## Persistence and recovery

SQLite stores projects, conversations, generation runs, and binary source snapshots. No separate database service is required. Run one backend process per database; generation ownership and sandbox handles are process-local. Credentials and local database files are ignored by Git.

Generated apps run remotely in E2B. Sandboxes are created with a 15-minute timeout; reopening restores saved files into a new sandbox when the old one is unavailable. Binary assets are included. Dependency folders, build output, caches, environment files and private-key files are excluded. Source snapshots have a 50 MB total limit.

Only one generation can run per project. The backend checks the generated app with `npm run build` and waits for the preview before reporting success. Failed or truncated generations retain partial changes and diagnostics. Reaching the generation step or token limit reports an incomplete run that can be continued with a smaller request. File writes checkpoint immediately, and full snapshots are collected at the end of successful or failed runs. A browser disconnect does not stop backend generation; reopen the page to retrieve its result. Backend restarts mark interrupted runs as failed.

ZIP export contains saved source, including changes from failed generations. Extract it, run `npm install`, then `npm run dev` to develop locally or `npm run build` to validate/build it. Leave `VITE_DEV_SERVER_HMR_HOST` unset locally; the backend sets it only for E2B's HTTPS preview proxy.

## API

These routes are on the backend port. Browser requests use the frontend's `/api/project` proxies, which map listing to `/projects` and chat to `/project/chat/:id`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/project` | Create a project and sandbox |
| `GET` | `/projects` | List saved projects |
| `GET` | `/project/:id` | Project details, messages and runs |
| `POST` | `/project/chat/:id` | Start generation and stream SSE events |
| `GET` | `/project/:id/files` | List source files |
| `GET` | `/project/:id/file?path=...` | Read a source file |
| `POST` | `/project/:id/resume` | Reopen or restore the sandbox |
| `GET` | `/project/:id/export` | Download source as a ZIP |

Project JSON responses use `{ success, data, error }`; SSE events follow the contracts in `../shared/types.ts`.

## Checks

```bash
bun run test
bun run typecheck
```

Tests replace external AI/sandbox transports with controlled fixtures and exercise storage, orchestration, HTTP routes, ZIP archives and stream parsing. The HTTP integration test opens an ephemeral localhost port. Passing checks do not validate live account access or every generated application's behavior.

Use `bun run start` to run without watch mode. This server is designed for local, single-user use; authentication and multi-user hosting are not implemented.
