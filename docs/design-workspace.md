# Builder workspace design

The builder uses the requested `b1VlIttI` shadcn preset: Radix Luma, Inter, neutral. The redesign keeps that foundation and applies the selected direction: **light, polished workspace with restrained color**. The generated application has its own interface; its preview is content inside this workspace, not part of the builder's design system.

## Product surfaces

The home page has two jobs: start a project and return to a saved project. Both desktop and mobile use a single content column with the brand in the top header; there is no landing-page sidebar. The prompt leads, with compact suggestions that populate the actual prompt. Project cards show stored names and update dates; the status label and dot are hidden. Active sessions have scaled live app previews; paused or unavailable sessions have explicit fallback text. Counts come from the project list and disappear during loading and failure.

The project page is a working environment. The header groups project identity, session recovery, and export. A compact shared toolbar sits above a full-height conversation column and an edge-to-edge preview, following the supplied Lovable layout. The desktop conversation starts at 30% width, can be resized or collapsed into a visible 56 px chat rail, and keeps its composer pinned below the scrolling messages. The header divider tracks the conversation width in both states. assistant-ui renders the conversation, Markdown, copy actions, and composer. Build cards appear above assistant responses; Details expands actual activity and changed-file links, and Preview opens the current app. Preview and Code retain distinct active states. The app preview remains mounted during refinement. On smaller screens Chat, Preview, and Code switch in the same place above the panel.

## Rules for further changes

- Keep shared palette and font tokens in `frontend/src/app/globals.css`; use the existing semantic roles in product components. The landing page overrides those roles within `page.module.css` for its Billow-inspired palette. Running and failure indicators use the existing status accents and have text labels.
- Use the installed shadcn primitives and their variants. Keep raw product controls native when their behavior is simple, such as file selection. Build details use the existing shadcn Collapsible.
- Product-level cards use modest rounding and light borders. Primary actions use dark fill in the builder and blue on the landing page; muted backgrounds group supporting content.
- A new action must perform real work. Do not add fake account controls, history menus, deployment controls, screenshot previews, or project metrics.
- Keep all errors recoverable near their action. Preserve the prompt after failed project creation, retry failed requests, and offer reopening for saved or expired projects.
- Preserve keyboard panel resizing, file selection, focus visibility, accessible icon-button names, and a touch input size of at least 16 px. Code inspection remains read only.
- Add motion only when it helps explain a state change. assistant-ui supplies its standard message transitions. Existing loading indicators respect the global reduced-motion rule.

## Verification

Fixture-backed browser checks intercept project APIs and the generated preview. They verify UI behavior without creating sandboxes or spending model credits. The original regression script passes after this redesign: project states, persisted Markdown, changed-file inspection, stale file response protection, keyboard resizing, refinement without switching away from Preview, mobile tabs, 320 px overflow, list retry, and no page errors.

Before and after captures cover both routes at 1440 px and 390 px, with home populated/empty/loading/error and workspace running/stopped/error/missing/loading/code states. Captures and browser harnesses are temporary artifacts under `/tmp/likeable-redesign` and `/tmp/likeable-ui-check`; they are not product fixtures.

Final accessibility probes found no axe WCAG 2/2.1 A/AA violations on either route at 1440 px, 1024 px, 390 px, or 320 px. Generated iframe content is outside this check. Both phone textareas compute to 16 px. Long names and conversations fit without document overflow. A pending creation retains the prompt on failure, disables duplicate submission, and keeps the button width stable. Touch-emulated mobile captures were checked separately; physical-device keyboard behavior and screen-reader testing remain follow-up coverage.

The final regression was rerun on the upgraded Next server. A separate code-viewer check waits for Monaco to load, asserts real file contents, and captures the loaded editor at desktop and phone widths.

The Code panel uses a compact, scrollable Files region above the full-width editor below 640 px; wider screens keep the file sidebar. This fixes the fragmented code column seen at 320 px. The final code check asserts `export default function` and `Hello` in Monaco's rendered view and confirms no document overflow at 1440 px,390 px,320 px. Final loaded captures are `/tmp/likeable-redesign/after/workspace-code-loaded-1440.png`, `workspace-code-loaded-390.png`, and `workspace-code-loaded-320.png` in the same directory. The fixture-backed regression passes again after this layout change.

## assistant-ui and reference layout

Installed the official assistant-ui Thread registry with `@assistant-ui/react` 0.15.22 and `@assistant-ui/react-markdown` 0.14.17. ExternalStoreRuntime adapts the existing workspace hook; the backend still owns generation and saved history. No AI SDK transport rewrite is required. The checked-in Thread has a small slot for build cards. Unsupported voice, attachments, editing, feedback, cancellation, regeneration, branching, and generic tool/reasoning renderers have been removed from the registry code. Copy and Markdown export remain supported locally.

The supplied Lovable screenshot guides the workspace structure while the existing light shadcn palette and font remain. Project navigation, refresh, and export are available in the title menu. Reopen sits directly in the header beside export; the separate reopening banner is removed. Preview/Code, preview address, reload, device sizing, open in a new tab, and ZIP export share one 48 px desktop toolbar. Mobile keeps a compact project header and Chat/Preview/Code switcher. The preview fills its panel; phone mode adds a centered frame. Build cards expose actual activity and files, with a current-preview action. The assistant-ui composer sits outside the scroll viewport at the bottom of the chat column.

Four adapter tests pass, including the real assistant-ui converter, streaming/error status, prompt text, and retry selection. Typecheck passes and lint has zero errors (26 copied-component warnings). Browser testing was stopped at the user's request; the earlier browser regression predates the final reference-layout changes. The final layout has not been browser-tested.

## Landing-page composer

The landing prompt now uses assistant-ui's ComposerPrimitive.Root, Input, and Send under ExternalStoreRuntime. ThreadPrimitive.Suggestion populates the composer without submitting. The Create Project API remains the submit action, and successful creation navigates to `/chat/:id`. A synchronous pending guard prevents duplicate creation; the composer is disabled while creating. Failed creation rejects with MessageNotSentError so assistant-ui restores the submitted draft, and an inline alert explains the failure. Touch Enter inserts a newline; desktop Enter submits and Shift+Enter inserts a newline. The project list and page shell retain the existing shadcn components.

Eight frontend tests pass: four chat-adapter tests and four project-creation tests covering prompt normalization, API errors, thrown failures, incomplete responses, and empty input. Typecheck passes; lint has zero errors and 26 existing copied-component warnings. No browser tests were run for this change, as requested.

## Billow-inspired landing hero

The first section follows the composition of [Billow's homepage](https://www.billow.so/): a two-line navy serif headline, highlighted supporting copy, and a blue/cyan glow behind a product panel. The headline is slightly smaller, with an 88 px desktop maximum and sizing that accounts for viewport height. The header contains only the Likeable wordmark and a local blue SVG logo matching the footer's shutter A at rest. The header logo uses the wordmark font's cap height and aligns to its baseline, with an em-based fallback, so the visible mark and letters share a height. The separate Start building actions and their caption are removed; the composer contains the primary Build app action. The Your next app starts here and A workspace for your next idea badges are removed. The panel is Likeable's working assistant-ui project composer rather than a static product screenshot. Suggestions use soft blue secondary pills that match the landing palette. Suggestions, loading, creation errors, draft restoration, and project navigation keep their existing behavior.

Instrument Serif is bundled locally with its OFL license under `frontend/public/fonts`; Inter remains the body and builder font. Landing colors and custom hero styles live in a scoped CSS module, leaving the chat workspace's neutral preset intact. Hero spacing and typography account for viewport height to bring the composer into the initial screen; shorter desktop windows use a more compact layout. The composer starts directly with its three-row input, without the New project/Describe it title row, and grows as the user writes. The decorative note disappears on small screens and shorter desktop windows. The enlarged glow is static, with reduced opacity and softer desktop blur. Saved projects remain below the hero without a sidebar.

Verification: TypeScript and lint on the changed React files pass; all eight existing frontend tests pass. No local browser tests were run, as requested.

## Saved-project previews

Project cards follow the supplied Lovable reference: compact 16:9 preview tiles with a project initial, name, and edited date beneath. The grid has four columns on desktop, three on medium screens, two on small screens, and one on phones. The outer card has no heavy border or fill; the preview itself has a rounded border. Each preview is a scaled, non-interactive 1280 × 720 live app frame. A near-viewport visibility observer loads each preview, and a resize observer keeps it scaled to the card. Offscreen frames are removed; re-entry checks the session again. The existing project API verifies the current sandbox and refreshes the card's status before embedding its URL. Session checks and frame loads have timeout fallbacks. Opening the landing page does not provision new sandboxes.

Only valid HTTPS preview URLs without embedded credentials are accepted. Sandboxed frames are inert and cannot capture the card click or keyboard focus. Each card remains a single link to its workspace. Stopped, creating, unavailable, and loading states have explicit text; there are no stored screenshots for offline sessions. Four new tests cover current-session URL selection, expired sessions, URL validation, and API failures. All twelve frontend tests, TypeScript, and changed-file lint pass. No browser tests were run.

## Shutter glyph footer

The landing page ends with the supplied geometric SVG footer, adapted to the existing theme: a pale blue background, navy LIKEABLE wordmark, and blue shutter replacing the A. The footer shares the projects section's centered width and 75 rem maximum. Its background fades to transparent at both sides, blending into the page without fading the wordmark or links. The top row contains product copy, a working saved-projects link, copyright, and the project's GitHub link. The Build an app and Back to top links are removed. Newsletter signup and placeholder social/legal links are replaced by this content because those services and pages are not configured. The hero's top spacing increases by 24 px on regular desktop windows and 16 px on mobile and shorter windows, moving the title, composer, and projects down together.

Letters split on hover and flip on click; the shutter follows the pointer and rotates a quarter turn on click. Links briefly scramble their visible monospace labels while retaining stable accessible names. SVG controls also work with Enter and Space and have visible keyboard focus. Motion preferences are read through an SSR-safe external store; reduced-motion users receive a static wordmark without tracking, scrambling, flipping, or moving reveals. The initial server render remains visible without JavaScript. The shutter updates only its three polygons, stops once settled, and suspends offscreen or in a hidden browser tab. Existing fonts and React are reused; there are no new packages, font requests, or external services.

TypeScript, changed-file lint, and all twelve existing frontend tests pass. No browser tests were run; live motion and visual appearance have not been browser-verified.

## Cleanup verification

Removed the old AI Elements components, unused UI primitives and assets, and unsupported assistant-ui registry files. The text-only Thread is reduced from 815 to 279 lines while retaining the existing layout, composer, scroll controls, streaming indicator, message errors, copy/Markdown export, and build-card slot. Three server-rendering regression tests check saved Markdown and build details, failed-build retry, and ongoing activity before assistant text arrives. All 15 frontend tests, strict TypeScript checks, and the production build pass. Frontend lint now reports zero errors and zero warnings. Import reachability from Next entrypoints finds no unused frontend source files. No browser tests were run.

A subsequent read-only HTTP smoke check returns 200 for the landing page, a saved workspace page, the project-list API, and the header SVG. The project list returns the expected success envelope. All 45 frontend/backend tests pass again; these HTTP checks do not exercise browser interactions.
