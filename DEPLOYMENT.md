# Cloudflare Pages & Convex Deployment Guide

To ensure DoneBun runs correctly on Cloudflare Pages, follow these steps to configure your environment variables and build settings.

## 1. Cloudflare Pages Configuration

In the Cloudflare Pages dashboard for your project:

### Build Settings
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`
- **Node.js Version**: `20` or higher

### Environment Variables (Production)
Set these in **Settings > Environment variables**:

| Variable | Description |
| :--- | :--- |
| `VITE_CONVEX_URL` | Your production Convex deployment URL (e.g., `https://happy-animal-123.convex.cloud`) |
| `VITE_CONVEX_SITE_URL` | Your production Convex Site URL (e.g., `https://happy-animal-123.convex.site`) |

---

## 2. Convex Backend Configuration

In the [Convex Dashboard](https://dashboard.convex.dev), go to **Settings > Environment Variables** for your production deployment and set the following:

| Variable | Description |
| :--- | :--- |
| `SITE_URL` | Your Cloudflare Pages URL (e.g., `https://donebun.pages.dev` or `https://donebun.app`) |
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
