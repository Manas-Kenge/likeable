# Working on Likeable

Likeable is a local, single-user React app builder: Next.js proxies to a Bun/Express backend, which uses AI SDK tool execution through Z.ai and remote E2B sandboxes. Read `backend/README.md` when setting up credentials, changing sandbox recovery, or investigating generation failures.

## Boundaries

- `shared/types.ts` owns project, message, generation-run and stream-event contracts consumed by both apps.
- `backend/src/store.ts` owns SQLite persistence. Sandbox handles and active operations remain process-local; run one backend process per database.
- `backend/src/project-service.ts` owns provisioning, generation lifecycle, source checkpoints and ZIP export. `graph.ts` owns AI planning/tool execution and build validation.
- `frontend/src/components/chat-workspace/use-workspace.ts` coordinates project hydration, streamed activity, retries and guarded file selection. Code inspection is read-only.
- The builder's `frontend/` uses shadcn preset `b1VlIttI` (Radix Luma, Inter, neutral). The generated-app starter in `backend/my-app/` has its own design configuration.

## Behavior to preserve

- A generation succeeds only after build validation, preview readiness and source persistence. Failures retain partial source and actionable diagnostics.
- Browser disconnection does not discard backend work. Backend restart marks interrupted runs as failed and preserves saved source.
- Persist complete chat history; cap model context independently.
- Confine file APIs to `/home/user/app`, reject traversal and symlink escapes, and quote shell paths. Capture binary assets while excluding secrets, dependencies and generated output.
- Keep the existing preview visible during refinement. Desktop panels resize; below 1024px, users switch between Chat, Preview and Code.

## Checks

Run backend tests and type checks from `backend/` using its package scripts; run frontend lint and production build from `frontend/`. The HTTP integration test opens a temporary localhost server. AI/E2B transports are fixture-backed in automated tests; real-service verification requires configured keys. The checked-in E2B team/template identifiers are account-specific.

## Conventions

TypeScript strict mode; type-only imports; double quotes, semicolons and two-space indentation. React components using browser APIs or hooks need `"use client"`. Frontend `@/` resolves to `src/`. Backend API responses use `{ success, data, error }`; stream events use the shared discriminated union. Bind the local backend to loopback. Keep credentials and SQLite data out of git.
