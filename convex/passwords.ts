import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const passwordFields = {
  name: v.string(),
  username: v.optional(v.string()),
  password: v.string(),
  url: v.optional(v.string()),
  notes: v.optional(v.string()),
};

const passwordDoc = v.object({
  _id: v.id("passwords"),
  _creationTime: v.number(),
  name: v.string(),
  username: v.optional(v.string()),
  password: v.string(),
  url: v.optional(v.string()),
  notes: v.optional(v.string()),
  ownerId: v.optional(v.id("users")),
  updatedAt: v.number(),
});

const userSummary = v.object({
  _id: v.id("users"),
  email: v.string(),
  name: v.string(),
});

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.subject),
    )
    .unique();

  if (!user) throw new Error("User not found");
  return user;
}

function buildPatch(args: {
  name?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
}) {
  const patch: {
    name?: string;
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
    updatedAt: number;
  } = { updatedAt: Date.now() };

  if (args.name !== undefined) {
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    patch.name = name;
  }
  if (args.username !== undefined) {
    patch.username = args.username.trim() || undefined;
  }
  if (args.password !== undefined) {
    if (!args.password) throw new Error("Password is required");
    patch.password = args.password;
  }
  if (args.url !== undefined) {
    patch.url = args.url.trim() || undefined;
  }
  if (args.notes !== undefined) {
    patch.notes = args.notes.trim() || undefined;
  }

  return patch;
}

/** List passwords owned by the signed-in user. */
export const list = query({
  args: {},
  returns: v.array(passwordDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("passwords")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
  },
});

/** Create a password entry for the signed-in user. */
export const create = mutation({
  args: passwordFields,
  returns: v.id("passwords"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    if (!args.password) throw new Error("Password is required");

    return await ctx.db.insert("passwords", {
      name,
      username: args.username?.trim() || undefined,
      password: args.password,
      url: args.url?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      ownerId: user._id,
      updatedAt: Date.now(),
    });
  },
});

/** Update a password entry owned by the signed-in user. */
export const update = mutation({
  args: {
    id: v.id("passwords"),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Password not found");
    if (existing.ownerId !== user._id) throw new Error("Unauthorized");

    const { id, ...fields } = args;
    await ctx.db.patch(id, buildPatch(fields));
    return null;
  },
});

/** Delete a password entry owned by the signed-in user. */
export const remove = mutation({
  args: { id: v.id("passwords") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Password not found");
    if (existing.ownerId !== user._id) throw new Error("Unauthorized");
    await ctx.db.delete(args.id);
    return null;
  },
});

// --- Internal helpers for user-password HTTP API ---

export const getUserByEmailInternal = internalQuery({
  args: { email: v.string() },
  returns: v.union(userSummary, v.null()),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) {
      // Email casing may differ from signup; fall back once.
      const all = await ctx.db.query("users").collect();
      const match = all.find((u) => u.email.toLowerCase() === email);
      if (!match) return null;
      return { _id: match._id, email: match.email, name: match.name };
    }
    return { _id: user._id, email: user.email, name: user.name };
  },
});

export const listForOwnerInternal = internalQuery({
  args: { ownerId: v.id("users") },
  returns: v.array(passwordDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("passwords")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
  },
});

export const getForOwnerInternal = internalQuery({
  args: {
    id: v.id("passwords"),
    ownerId: v.id("users"),
  },
  returns: v.union(passwordDoc, v.null()),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.ownerId !== args.ownerId) return null;
    return entry;
  },
});

export const createForOwnerInternal = internalMutation({
  args: {
    ...passwordFields,
    ownerId: v.id("users"),
  },
  returns: v.id("passwords"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    if (!args.password) throw new Error("Password is required");

    return await ctx.db.insert("passwords", {
      name,
      username: args.username?.trim() || undefined,
      password: args.password,
      url: args.url?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      ownerId: args.ownerId,
      updatedAt: Date.now(),
    });
  },
});

export const updateForOwnerInternal = internalMutation({
  args: {
    id: v.id("passwords"),
    ownerId: v.id("users"),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.ownerId !== args.ownerId) {
      throw new Error("Password not found");
    }

    const { id, ownerId: _ownerId, ...fields } = args;
    await ctx.db.patch(id, buildPatch(fields));
    return null;
  },
});

export const removeForOwnerInternal = internalMutation({
  args: {
    id: v.id("passwords"),
    ownerId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.ownerId !== args.ownerId) {
      throw new Error("Password not found");
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
