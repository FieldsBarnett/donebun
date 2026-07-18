<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Cursor Cloud specific instructions

**Product:** DoneBun — a React 19 + Vite + Convex task-management PWA (also packaged with Tauri). Package manager is npm.

**Two services must run for end-to-end testing** (start each in its own tmux session; both are long-running):

1. **Convex backend** — `CONVEX_AGENT_MODE=anonymous npx convex dev`
   - The `CONVEX_AGENT_MODE=anonymous` prefix is required: it provisions an isolated local Convex deployment (no cloud login) and writes `VITE_CONVEX_URL` (`http://127.0.0.1:3210`) and `VITE_CONVEX_SITE_URL` (`http://127.0.0.1:3211`) to `.env.local`. Keep it running to hot-reload backend functions.
2. **Frontend** — `npm run dev` (Vite, fixed port 1420, `strictPort`). Open `http://localhost:1420/`.

**Required deployment env vars (non-obvious gotcha):** The first `convex dev` push FAILS until these are set on the local deployment, because `convex/auth.ts` calls `new Resend(process.env.RESEND_API_KEY)` at module load, which throws on an empty key. After the backend is up, set them (they live inside the local deployment; re-set them if the deployment is provisioned fresh), then `convex dev` re-pushes automatically:
```
CONVEX_AGENT_MODE=anonymous npx convex env set RESEND_API_KEY "re_dev_placeholder_key"
CONVEX_AGENT_MODE=anonymous npx convex env set BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
CONVEX_AGENT_MODE=anonymous npx convex env set SITE_URL "http://localhost:1420"
```
- `RESEND_API_KEY` only needs to be non-empty for dev (real email/verification is optional). `SITE_URL` must match the frontend origin so Better Auth trusts it. `CONVEX_SITE_URL` is auto-populated by the local backend.
- Optional feature keys (unnecessary for core flows): `GROQ_API_KEY` (voice capture), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Google Calendar).

**Auth:** The whole app is gated behind Better Auth (email/password). Use the "Need an account? Sign up" flow to create a user; no email verification is required in dev.

**Checks:** No lint script exists. Type-check with `npx tsc --noEmit`; full build is `npm run build` (`tsc && vite build`).

**Cloudflare Pages PR builds:** Preview environments often lack `CONVEX_DEPLOY_KEY`. A postinstall shim (`scripts/patch-convex-bin.mjs`) makes `npx convex deploy --cmd 'npm run build'` fall back to frontend-only builds on preview; production URLs live in `.env.production`. For full-stack preview deploys, add a Convex Preview Deploy Key to Cloudflare Preview env vars. See `DEPLOYMENT.md`.
