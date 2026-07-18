# Cloudflare Pages & Convex Deployment Guide

To ensure DoneBun runs correctly on Cloudflare Pages, follow these steps to configure your environment variables and build settings.

## 1. Cloudflare Pages Configuration

In the Cloudflare Pages dashboard for your project:

### Build Settings
- **Framework Preset**: `Vite`
- **Build Command**: `npx convex deploy --cmd 'npm run build'` (production) — preview PR builds also work via the postinstall Convex CLI shim when `CONVEX_DEPLOY_KEY` is not set in the Preview environment (see below).
- **Build Output Directory**: `dist`
- **Node.js Version**: `20` or higher

Alternatively, you can set the build command to `npm run build:cloudflare` for explicit branch-aware behavior.

### Preview pull request builds

Cloudflare Pages preview environments often do not have `CONVEX_DEPLOY_KEY` configured. Without it, `npx convex deploy` fails before the frontend build runs.

This repo handles that in two ways:

1. **Automatic shim (default):** `postinstall` patches the local `convex` CLI so that on Cloudflare preview builds without `CONVEX_DEPLOY_KEY`, it skips backend deploy and runs the `--cmd` build step only. Public production Convex URLs are provided via `.env.production`.
2. **Optional full preview deploys:** Add a Convex **Preview Deploy Key** as `CONVEX_DEPLOY_KEY` in Cloudflare **Preview** environment variables (Settings → Environment variables). Then preview branches deploy to isolated Convex preview backends.

For frontend-only preview builds, you can also set `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` in the Cloudflare Preview environment instead of relying on `.env.production`.

### Environment Variables (Production)
Set these in **Settings > Environment variables** on Cloudflare. **IMPORTANT**: For `CONVEX_DEPLOY_KEY`, ensure you set it for both **Build** and **Preview** environments if needed.

| Variable | Description |
| :--- | :--- |
| `CONVEX_DEPLOY_KEY` | **Required.** Your Convex deploy key (get this from the Convex Dashboard under Settings > Deploy Key). |
| `VITE_CONVEX_URL` | Your production Convex deployment URL. |
| `VITE_CONVEX_SITE_URL` | Your production Convex Site URL. |

---

## 2. Convex Backend Configuration

In the [Convex Dashboard](https://dashboard.convex.dev), go to **Settings > Environment Variables** for your production deployment and set the following:

| Variable | Description |
| :--- | :--- |
| `SITE_URL` | Your canonical production URL (e.g., `https://donebun.app`). |
| `CONVEX_SITE_URL` | The Site URL of this Convex deployment. |
| `BETTER_AUTH_SECRET` | A long, random string for auth security. |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID. |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret. |
| `RESEND_API_KEY` | Your Resend API Key. |

---

## 3. Redirects for SPA Routing

I have already added a `public/_redirects` file to your project. This ensures that Cloudflare Pages redirects all sub-routes to `index.html`.

```
/* /index.html 200
```

---

## 4. Build Stability
I have fixed several TypeScript and recursion errors that were preventing `npm run build` from completing. The project now builds successfully with type checking enabled.
