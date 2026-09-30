# Likeable backend

Run commands from this directory. Requires Bun, a Z.ai API key, and an E2B account with access to a template built from `e2b.Dockerfile` and `my-app/`.

```bash
bun install --frozen-lockfile
cp .env.example .env
# Fill in E2B_API_KEY, E2B_TEMPLATE_ID, and ZAI_API_KEY.
bun run dev
```

The server listens on `http://127.0.0.1:3001`. Verify it with `curl http://localhost:3001/health`. No database service is required: SQLite stores projects, conversations, generation runs, and binary source snapshots in `.data/likeable.sqlite` by default. `DATABASE_PATH` can override this location. Run one backend process per database; generation ownership and sandbox handles are process-local.

`ZAI_MODEL` defaults to `glm-4.7`; `ZAI_BASE_URL` defaults to the standard Z.ai API endpoint. Ensure your account has model access and API credits. The backend requires all three service environment variables before startup.

## Sandbox setup

The existing `e2b.toml` contains a previous account's team/template identifiers. Use a template accessible to your account, or configure your own identifiers and build with `bunx e2b template build`. The template must contain the supplied starter at `/home/user/app`, with its dependencies installed. Do not commit your API keys.

Generated apps run remotely on E2B. The builder frontend/backend run locally. Sandboxes have a 15-minute lifetime; reopening restores saved files into a new sandbox when the old one is unavailable. Binary assets are included. Dependency folders, build output, caches, environment files and private-key files are excluded. Source snapshots have a 50 MB total limit.

## Generation behavior

Only one generation can run per project. The builder checks the generated app with `npm run build` and waits for the preview before reporting success. A passing build does not prove application behavior; inspect the preview yourself. Failed or truncated generations retain their partial changes and diagnostics. Reaching the generation step or token limit reports an incomplete run that can be continued with a smaller request. File writes checkpoint immediately, and full snapshots are collected at the end of successful or failed runs. A browser disconnect does not stop the backend generation; reopen the page to retrieve its result. Backend restarts mark interrupted runs as failed.

ZIP export contains the current saved source, including changes from failed generations. Extract it, run `npm install`, then `npm run build`. The starter's development HMR configuration targets E2B; its build/preview commands can be used locally.

## Checks

```bash
bun run test
bun run typecheck
```

Tests replace external AI/sandbox transports with controlled fixtures; they exercise real storage, orchestration, HTTP routes, ZIP archives and stream parsing. The HTTP integration test opens an ephemeral localhost port.

This is a local, single-user server, bound to loopback. Accounts, hosting and multi-user authorization are outside this pass.
