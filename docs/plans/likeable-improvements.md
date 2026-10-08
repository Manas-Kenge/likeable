# Likeable improvements

Approved scope: design → frontend → backend. Local single-user React app builder using Next.js, Bun/Express, Z.ai and E2B. Target workflow: generate, refine, inspect changed files, export. No deployment, accounts, manual editing, version-history UI or GitHub showcase work.

## Milestones
- [x] Design: apply shadcn preset b1VlIttI in frontend; cohesive light homepage and workspace; resizable desktop and mobile tabs; remove unwired controls.
- [x] Frontend: reliable SSE parsing, separate loading/generation/preview states, real assistant output, clickable changes, retry, history hydration and guarded file selection.
- [x] Backend: SQLite projects/messages/runs/source snapshots; sandbox reconnection/restoration; build validation; retain failed changes; confined paths; resume and ZIP export APIs.
- [x] Verify: unit/integration tests, type checks, lint/build, browser inspection and live services if credentials are available.

## Progress and decisions
- Branch feat/likeable-improvements created from main. User explicitly requested work on this branch in the current checkout; no additional worktree created.
- Preset application authorized in conversation. CLI interactive confirmation replaced with --yes.
- Conversation is the approved spec; this file preserves its scope for implementation.
- Preset applied: radix-luma, Inter, neutral theme; existing registries preserved. Homepage/workspace redesigned; legacy unsupported controls removed.
- SSE regression tests went from failing to passing. Store/path/service/graph/tool/API coverage added (28 tests passing at final verification).
- Concurrency test reproduced stale status updates overwriting generation state; status writes now reload current stored data before changing sandbox fields.
- Local persistence uses SQLite JSON records plus binary source snapshots. File writes checkpoint immediately; full snapshots follow each completed/failed generation.
- Ruling: maintain three existing registry-component lint exceptions for browser initialization and polymorphic motion; do not broadly disable application lint checks.
- Browser plugin bootstrap fails because its worker references a missing browser-service module from a different plugin version. Use an isolated headless browser for local UI verification; do not modify the browser plugin.
- UI browser checks passed using fixture-backed API responses: all project states, restored messages and Markdown, changed-file inspection, keyboard resize, streamed refinement, mobile tabs, 320px overflow and project-list retry; no page errors. Screenshots saved under /tmp/likeable-*.png.
- Production frontend build passed with network access for next/font. Backend type check passed. Frontend lint passes with 21 existing registry-component warnings.
- Additional red→green tests cover export/generation exclusion and actual E2B CommandExitError compiler diagnostics.
- Ruling: generation is single-process per SQLite database; document this local-use constraint rather than adding distributed locks.
- Live Z.ai/E2B verification deferred until actual service credentials/template access are configured; no dummy credentials or production mock mode added.

- Independent review found four defects, each reproduced before correction: canonical checkpoint paths, truncated/step-limited generation success, stale expired-sandbox status checks, and tab activation during background file refresh. All four fixed; focused re-review passed with no remaining material findings.
- Final verification: 28 tests/89 assertions passing; backend/frontend TypeScript checks passing; production build passing; lint 0 errors/21 existing warnings; git diff --check passing. Browser checks also cover Preview staying selected after completion and out-of-order file responses.
- Ruling: preserve feat/likeable-improvements in the current checkout as requested; no merge, push or deployment. Live service verification is the only credential-dependent check outstanding.

## Template follow-up
- Applied the approved b1VlIttI preset to the generated-app starter as well as the builder; locally bundled Inter, radix-luma, neutral tokens.
- Node 24 LTS image, npm ci with synchronized lockfiles, build during template publication, runtime user ownership, conditional local/E2B HMR, narrow shadcn helper lint allowances.
- Added remote SDK build command; historical e2b.toml account IDs were not used, and that configuration has since been removed. Docker daemon remains inaccessible on this machine.
- SDK upload bug reproduced: separately generated compressed archives differed by one byte, causing rejected/truncated uploads. The original standalone build wrapper buffered actual archive bytes and corrected Content-Length, bounded to 50 MB, with fetch restored afterward. Real HTTP regression failed before that fix and passed afterward. The subsequent E2B 2.51 upgrade handles archive spooling and exact upload lengths itself; the obsolete wrapper and its tests have now been removed.
- Review also corrected directory exclusion glob semantics and runtime ownership. Explicit subtree patterns prevent local dependencies/build output from entering SDK uploads.
- Template 5pdqjkf5bs9zu8szolw5 built successfully and configured in ignored backend/.env. Live E2B smoke verified provisioning, ownership, writes/reads, runtime build, preview readiness, snapshots and ZIP export; temporary sandbox shut down afterward. Live AI generation remains unverified.
- Final follow-up checks: 30 backend tests plus 2 starter HMR tests pass; backend type check, starter lint/build, fresh npm ci/build, and local browser/font rendering pass. Frontend/backend development servers remain running on ports 3000/3001.
