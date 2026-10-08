# Dependency upgrade review

Reviewed 2026-09-30 on `feat/likeable-improvements`. This pass keeps the existing shadcn preset, local SQLite storage, SSE client, and generated-app architecture.

## Applied updates

| Dependency | Before | After |
| --- | --- | --- |
| AI SDK (backend and frontend type imports) | 5.0.108 | 7.0.123 |
| ZAI provider | community zhipu-ai-provider 0.2.2 | official @ai-sdk/zai 3.0.22 |
| Next.js / eslint-config-next | 16.0.3 | 16.3.7 |
| React / React DOM (builder and starter) | 19.2.0 | 19.3.0 |
| Tailwind and its PostCSS/Vite integrations | 4.1.17 | 4.3.3 |
| E2B SDK | 2.8.4 | 2.51.0 |
| E2B CLI | 2.4.2 | 2.20.0 |
| Starter Vite | 7.2.4 | 7.3.6 |
| Zod (backend and starter) | 4.1.13 | 4.6.5 |
| ESLint | 9.39.1 | 9.39.5 |

Radix controls, React Hook Form/resolvers, Motion 12, Shiki 3, React Icons 5, Streamdown 1, Sonner, tailwind-merge, Bun types, and compatible transitives were also updated within their existing ranges. Frontend Node types now target Node 24, matching the documented runtime. Lockfiles record exact resolutions. Starter npm and Bun manifests agree on direct versions; npm transitive entries were updated separately and checked with a clean install.

Unused frontend dependencies `@ai-sdk/react`, `ai-elements` (registry CLI), and `v0-sdk` were removed. The app keeps its own typed SSE hook. The chat pane now adapts that hook to assistant-ui; the retired AI Elements files have now been removed. Removed the community backend ZAI provider and obsolete UUID type stub.

## AI SDK migration

The upgrade is worthwhile here because the official ZAI provider supports the current SDK interface and tool calling. Existing orchestration remains small; no new agent framework is needed.

Read both official guides: [5 to 6](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0), [6 to 7](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0), and [ZAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/zai).

- Use `instructions`, `isStepCount`, and `result.stream` in place of older names. Read `finalStep.text` explicitly when persisting the final answer.
- Use native v4 model fixtures and the current tool execution context.
- Keep the configured model and base URL; credentials stay server-side.
- Keep build validation, failed-write recovery, twenty-step limits, and source checkpoints.
- A provider-level SSE regression exercises real request serialization, streamed tool arguments, file writes, checkpoints, and sending tool results back. A live ZAI verification completed a two-step tool round trip.

Next development now requires explicitly allowing `127.0.0.1` for its dev resources. Without that setting the HMR connection was blocked and client effects never ran through that address. The setting only adds the loopback host. E2B template builds now use the current named-template overload. React Icons renamed the CSS icon export; the copied file-tree import was adjusted. The updated Next lint preset required replacing two synchronous effect-based prop resets in the copied preview component.

## Deferred upgrades

TypeScript 7, ESLint 10, Vite 8/plugin-react 6, Motion 13, Shiki 4, Streamdown 2, nanoid 6, UUID 14, dotenv 18, and Lucide 1 are deferred. They are separate major migrations or have a wider compatibility surface; they are unnecessary for this redesign and SDK migration. Monaco remains on 0.55 because a 0.x minor can change its integration behavior.

## Design tooling

Installed the requested skills with `npx skills add arla6ka/skills --agent codex --yes`. Applied design-system-boss and ui-review to the two builder routes, preserving the existing palette and Inter font. `skills-lock.json` records the sources; installed skill files and temporary review output are local tooling and ignored. Design decisions and verification are recorded in [design-workspace.md](design-workspace.md).

## Verification results

- Backend: 32 tests pass; typecheck passes.
- Frontend: production build and typecheck pass; lint has zero errors and 21 existing copied-registry warnings.
- Starter: clean npm install, 2 HMR tests, lint, and production build pass; npm reports zero vulnerabilities.
- Browser: desktop/mobile behavior regression passes; state-confirmed captures, pending feedback, error/retry, long-content overflow and WCAG A/AA scans checked. See the design record for scope and limits.
- Live ZAI: official provider authenticated and completed a two-step tool round trip.
- Live E2B: rebuilt template provisions, source/dependencies are user-owned, file write/read, runtime build, preview readiness, source capture and ZIP export pass. Temporary sandbox was killed.
- Local backend health and frontend API proxy respond successfully.

These are upgrade and workspace checks, not a claim that the app is ready for a public multi-user production deployment.

## assistant-ui adoption

Added `@assistant-ui/react` 0.15.22 and `@assistant-ui/react-markdown` 0.14.17 using the official Thread registry, with its required Markdown, shimmer, and state dependencies. Existing shadcn controls were preserved. The new Markdown renderer uses ordinary memoization to satisfy React lint rules. The subsequent cleanup removes the old AI Elements files and unsupported assistant-ui registry branches. Four frontend adapter tests, TypeScript, and lint pass. Final layout browser checks were skipped at the user's request.

## Global skill availability

All six `arla6ka/skills` are also installed globally with `npx --yes skills add arla6ka/skills --global --agent codex claude-code opencode --skill build-design-system component-docs design-system-boss migrate-design-system token-mapping ui-review --yes`. Codex and OpenCode discover the shared `~/.agents/skills/` directories; Claude Code has matching symlinks in `~/.claude/skills/`. Verified all six global registry entries and Claude links. Running OpenCode's native `debug skill` from `/tmp` confirms all six resolve to the global directory independently of this project.

## Cleanup after the UI rework

Removed the retired AI Elements implementation, unused frontend UI primitives and assets, and unsupported assistant-ui registry components. The Thread now retains text/Markdown messages, streaming indicators, error rendering, copy/Markdown export, scrolling, the composer, and the app-owned build-card slot. With the reasoning/attachment/tool scaffolding removed, `tw-shimmer` and the direct `zustand` dependency are unnecessary as well. Removed 29 frontend dependency declarations and moved `ts-prune` to devDependencies. Monaco's peer package, the shadcn CSS import, and animation CSS remain. Old AI Elements/Magic UI registry entries were removed from components.json.

Removed backend CORS/UUID/E2B CLI dependency declarations, the unused shared-type barrel, historical E2B CLI configuration, and the legacy upload wrapper and its tests. E2B 2.51 spools one archive and supplies its actual size; template:build calls the SDK directly. Removed seven redundant starter dependency declarations, unused App.css and the React logo. Generated-app UI/form/theme scaffolding and both starter lockfiles remain because generation and npm ci rely on them.

Cleanup verification: frontend production build, strict TypeScript with unused-local checks, lint with zero warnings, and 15 tests pass. Backend strict TypeScript and 30 tests pass; the two removed tests exercised only the retired fetch patch. Starter production build, lint, and its Vite configuration test pass. npm lockfile dependency groups match the starter manifest. A frontend import-reachability scan finds no unused source files; the remaining Monaco/React DOM declarations are required peers (React DOM also powers the rendering tests). No browser tests or remote E2B template publication were performed. Existing published templates are unchanged; the starter cleanup applies when the template is next built.
