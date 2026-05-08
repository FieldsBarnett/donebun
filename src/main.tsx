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

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ConvexBetterAuthProvider>
  </React.StrictMode>
);
