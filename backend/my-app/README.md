# Likeable generated-app starter

The React app copied into new E2B sandboxes. Uses React 19, TypeScript, Vite 7, Tailwind CSS 4 and shadcn preset `b1VlIttI` (Radix Luma, neutral, Inter). Inter is bundled locally, so the starter needs no font CDN.

## Run locally

Use Node.js 24 LTS and run these commands from `backend/my-app/`:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. Local development uses Vite's default WebSocket host/protocol. Leave `VITE_DEV_SERVER_HMR_HOST` unset locally; the builder sets it inside E2B to use the remote HTTPS/WSS proxy on port 443. The development server uses port 5173 in both environments.

## Checks and builds

| Command | Purpose |
| --- | --- |
| `npm run test` | Starter configuration checks |
| `npm run lint` | ESLint |
| `npm run build` | TypeScript checks and Vite production build |
| `npm run preview` | Serve an existing production build locally |

Both npm and Bun lockfiles are checked in. The E2B image uses `npm ci`; keep the lockfiles in sync when changing dependencies.

## Publish a sandbox template

Configure `E2B_API_KEY` in `backend/.env`, then run `bun run template:build` from `backend/`. The remote build installs locked dependencies and builds the starter before publication. Configure the reported template ID in `E2B_TEMPLATE_ID`; the backend starts the development server after creating a sandbox. Rebuild the template to apply starter changes to new sandboxes. See the [backend setup guide](../README.md).

Preserve the CSS `@theme inline` mappings when changing colors; generated components depend on these tokens. The builder's code viewer is read-only; users refine apps through chat or edit exported source locally.
