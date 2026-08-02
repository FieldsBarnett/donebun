import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [
    convexClient(),
    crossDomainClient(),
  ],
});

export function refreshAuthSession(): void {
  const client = authClient as typeof authClient & {
    updateSession?: () => void;
  };
  client.updateSession?.();
}

export async function signInWithEmail(email: string, password: string) {
  const result = await authClient.signIn.email({ email, password });
  if (result.error) {
    throw new Error(result.error.message || "Sign in failed");
  }
  await authClient.getSession();
  refreshAuthSession();
  return result;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
) {
  const result = await authClient.signUp.email({ email, password, name });
  if (result.error) {
    throw new Error(result.error.message || "Sign up failed");
  }
  await authClient.getSession();
  refreshAuthSession();
  return result;
}
