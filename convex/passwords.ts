import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const passwordFields = {
  name: v.string(),
  username: v.optional(v.string()),
  password: v.string(),
  url: v.optional(v.string()),
  notes: v.optional(v.string()),
  isPrivate: v.optional(v.boolean()),
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
  familyId: v.optional(v.id("families")),
  isPrivate: v.optional(v.boolean()),
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
  isPrivate?: boolean;
}) {
  const patch: {
    name?: string;
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
    isPrivate?: boolean;
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
  if (args.isPrivate !== undefined) {
    patch.isPrivate = args.isPrivate;
  }

  return patch;
}

async function listVisibleForUser(ctx: QueryCtx, user: Doc<"users">) {
  const byId = new Map<Id<"passwords">, Doc<"passwords">>();

  if (user.familyId) {
    const familyPasswords = await ctx.db
      .query("passwords")
      .withIndex("by_family", (q) => q.eq("familyId", user.familyId))
      .collect();
    for (const entry of familyPasswords) {
      byId.set(entry._id, entry);
    }
  }

  const owned = await ctx.db
    .query("passwords")
    .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
    .collect();
  for (const entry of owned) {
    byId.set(entry._id, entry);
  }

  return [...byId.values()].filter(
    (entry) => !(entry.isPrivate ?? false) || entry.ownerId === user._id,
  );
}

/** List passwords visible to the signed-in user (family + privacy rules). */
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

    return await listVisibleForUser(ctx, user);
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
      familyId: user.familyId,
      isPrivate: args.isPrivate ?? false,
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
    isPrivate: v.optional(v.boolean()),
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
    const user = await ctx.db.get(args.ownerId);
    if (!user) return [];

    return await listVisibleForUser(ctx, user);
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
    if (!entry) return null;
    if (entry.ownerId !== args.ownerId) return null;
    if ((entry.isPrivate ?? false) && entry.ownerId !== args.ownerId) {
      return null;
    }
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

    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error("User not found");

    return await ctx.db.insert("passwords", {
      name,
      username: args.username?.trim() || undefined,
      password: args.password,
      url: args.url?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      ownerId: args.ownerId,
      familyId: owner.familyId,
      isPrivate: args.isPrivate ?? false,
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
    isPrivate: v.optional(v.boolean()),
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
