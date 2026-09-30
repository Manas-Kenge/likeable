# Likeable generated-app starter

React 19, TypeScript, Vite 7, Tailwind CSS 4 and shadcn preset `b1VlIttI` (radix-luma, neutral, Inter). Inter is bundled locally so the generated app needs no font CDN.

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
```

Use Node 24 LTS. Local development uses Vite's default WebSocket host/protocol. The builder sets `VITE_DEV_SERVER_HMR_HOST` inside E2B to use its HTTPS/WSS proxy on port 443. The app listens on port 5173 in either environment.

The E2B image installs locked dependencies and builds the starter before publication. Build it from the backend directory with `bun run template:build`, then configure the returned template ID in backend `.env`. The backend starts the dev server after creating the sandbox.

Preserve the CSS `@theme inline` mappings when changing colors; generated components depend on these tokens. The code viewer in the builder is read-only; refinement happens through chat.
