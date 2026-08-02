import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import type { Id } from "./_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
}

function unauthorized(message = "Unauthorized. Use HTTP Basic Auth with your DoneBun email and password.") {
  return json({ error: message }, 401);
}

function parseBasicAuth(req: Request): { email: string; password: string } | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match?.[1]) return null;

  try {
    const decoded = atob(match[1].trim());
    const colon = decoded.indexOf(":");
    if (colon < 0) return null;
    const email = decoded.slice(0, colon).trim();
    const password = decoded.slice(colon + 1);
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

/**
 * Authenticate with DoneBun email/password (HTTP Basic Auth).
 * Returns the app user id for that account, or an error Response.
 */
async function requireDoneBunUser(
  ctx: GenericActionCtx<DataModel>,
  req: Request,
): Promise<{ ownerId: Id<"users">; email: string } | Response> {
  const creds = parseBasicAuth(req);
  if (!creds) return unauthorized();

  try {
    const auth = createAuth(ctx);
    const result = await auth.api.signInEmail({
      body: {
        email: creds.email,
        password: creds.password,
      },
    });

    const email = result.user.email;
    const user = await ctx.runQuery(internal.passwords.getUserByEmailInternal, {
      email,
    });
    if (!user) {
      return json(
        {
          error:
            "DoneBun profile not found for this account. Sign in to the app once to create your profile, then retry.",
        },
        403,
      );
    }

    return { ownerId: user._id, email: user.email };
  } catch {
    return unauthorized("Invalid email or password");
  }
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("Expected string field");
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value;
}

const corsOptions = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
});

/** List passwords for the authenticated DoneBun user. */
http.route({
  path: "/api/passwords",
  method: "OPTIONS",
  handler: corsOptions,
});

http.route({
  path: "/api/passwords",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const authResult = await requireDoneBunUser(ctx, req);
    if (authResult instanceof Response) return authResult;

    const passwords = await ctx.runQuery(internal.passwords.listForOwnerInternal, {
      ownerId: authResult.ownerId,
    });
    return json({ passwords });
  }),
});

/** Create a password for the authenticated DoneBun user. */
http.route({
  path: "/api/passwords",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authResult = await requireDoneBunUser(ctx, req);
    if (authResult instanceof Response) return authResult;

    try {
      const body = await readJsonBody(req);
      const id = await ctx.runMutation(internal.passwords.createForOwnerInternal, {
        ownerId: authResult.ownerId,
        name: requireString(body.name, "name"),
        password: requireString(body.password, "password"),
        username: optionalString(body.username),
        url: optionalString(body.url),
        notes: optionalString(body.notes),
      });
      const entry = await ctx.runQuery(internal.passwords.getForOwnerInternal, {
        id,
        ownerId: authResult.ownerId,
      });
      return json({ password: entry }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bad request";
      return json({ error: message }, 400);
    }
  }),
});

/** Get / update / delete a single password owned by the authenticated user. */
http.route({
  pathPrefix: "/api/passwords/",
  method: "OPTIONS",
  handler: corsOptions,
});

http.route({
  pathPrefix: "/api/passwords/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const authResult = await requireDoneBunUser(ctx, req);
    if (authResult instanceof Response) return authResult;

    const id = new URL(req.url).pathname.split("/").pop();
    if (!id) return json({ error: "Missing password id" }, 400);

    try {
      const entry = await ctx.runQuery(internal.passwords.getForOwnerInternal, {
        id: id as Id<"passwords">,
        ownerId: authResult.ownerId,
      });
      if (!entry) return json({ error: "Password not found" }, 404);
      return json({ password: entry });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bad request";
      return json({ error: message }, 400);
    }
  }),
});

http.route({
  pathPrefix: "/api/passwords/",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const authResult = await requireDoneBunUser(ctx, req);
    if (authResult instanceof Response) return authResult;

    const id = new URL(req.url).pathname.split("/").pop();
    if (!id) return json({ error: "Missing password id" }, 400);

    try {
      const body = await readJsonBody(req);
      await ctx.runMutation(internal.passwords.updateForOwnerInternal, {
        id: id as Id<"passwords">,
        ownerId: authResult.ownerId,
        name: optionalString(body.name),
        username: optionalString(body.username),
        password: optionalString(body.password),
        url: optionalString(body.url),
        notes: optionalString(body.notes),
      });
      const entry = await ctx.runQuery(internal.passwords.getForOwnerInternal, {
        id: id as Id<"passwords">,
        ownerId: authResult.ownerId,
      });
      return json({ password: entry });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bad request";
      const status = message === "Password not found" ? 404 : 400;
      return json({ error: message }, status);
    }
  }),
});

http.route({
  pathPrefix: "/api/passwords/",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const authResult = await requireDoneBunUser(ctx, req);
    if (authResult instanceof Response) return authResult;

    const id = new URL(req.url).pathname.split("/").pop();
    if (!id) return json({ error: "Missing password id" }, 400);

    try {
      await ctx.runMutation(internal.passwords.removeForOwnerInternal, {
        id: id as Id<"passwords">,
        ownerId: authResult.ownerId,
      });
      return json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bad request";
      const status = message === "Password not found" ? 404 : 400;
      return json({ error: message }, status);
    }
  }),
});

export default http;
