import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "./lib/auth-client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;

function ConfigError({ message }: { message: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-canvas,#fff)] font-system p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">DoneBun</h1>
        <p className="text-[var(--color-muted,#666)] text-sm">{message}</p>
      </div>
    </div>
  );
}

const root = document.getElementById("root") as HTMLElement;

if (!convexUrl || !convexSiteUrl) {
  ReactDOM.createRoot(root).render(
    <ConfigError message="Missing VITE_CONVEX_URL or VITE_CONVEX_SITE_URL. Add them to .env.development (or .env.local from npx convex dev) and restart the dev server." />
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  const queryClient = new QueryClient();

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ConvexBetterAuthProvider>
    </React.StrictMode>
  );
}
