# Human Setup Checklist

These are tasks that require manual setup by the developer in various external dashboards.

- [x] **Convex**: Create a Convex project in the dashboard and retrieve the deployment URL/keys. (Active)
- [x] **Better Auth & Resend**: 
    - [x] Configure Resend API key for email delivery.
    - [x] Set `BETTER_AUTH_SECRET` and `CONVEX_SITE_URL` in Convex env vars.
- [ ] **Google Calendar API**: 
    - [ ] Create a Google Cloud OAuth 2.0 Client ID (Web application type).
    - [ ] Add `http://localhost:1420/google-oauth-callback` to **Authorized Redirect URIs**.
    - [ ] Enable the **Google Calendar API** in your Google Cloud project.
    - [ ] Set `VITE_GOOGLE_CLIENT_ID` in `.env.local`.
    - [ ] Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in **Convex Dashboard** environment variables.
- [ ] **Apple Developer Program**: Setup an Apple Developer account and provision certificates if building for iOS/macOS via Tauri.
