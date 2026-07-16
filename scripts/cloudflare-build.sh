#!/usr/bin/env bash
set -euo pipefail

# Production: deploy Convex backend, then build the frontend with injected URLs.
if [ "${CF_PAGES_BRANCH:-}" = "main" ] && [ -n "${CONVEX_DEPLOY_KEY:-}" ]; then
  exec npx convex deploy --cmd 'npm run build'
fi

# Preview with a deploy key: create/update an isolated Convex preview deployment.
if [ -n "${CONVEX_DEPLOY_KEY:-}" ]; then
  exec npx convex deploy --cmd 'npm run build'
fi

# Preview without a deploy key: frontend-only build (uses .env.production or CF env vars).
if [ -z "${VITE_CONVEX_URL:-}" ] || [ -z "${VITE_CONVEX_SITE_URL:-}" ]; then
  echo "error: Set CONVEX_DEPLOY_KEY for full preview deploys, or provide VITE_CONVEX_URL and VITE_CONVEX_SITE_URL." >&2
  exit 1
fi

exec npm run build
