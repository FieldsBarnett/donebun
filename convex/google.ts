import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Internal: save/update a Google Account token ────────────────────────────

export const saveGoogleAccount = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken ?? existing.refreshToken,
        expiresAt: Date.now() + args.expiresIn * 1000,
      });
      return existing._id;
    }

    return await ctx.db.insert("googleAccounts", {
      userId: args.userId,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: Date.now() + args.expiresIn * 1000,
    });
  },
});

// ─── Internal: raw Google Account lookup ─────────────────────────────────────

export const getGoogleAccountById = internalQuery({
  args: { id: v.id("googleAccounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ─── Internal: raw calendar record lookup ────────────────────────────────────

export const getCalendarById = internalQuery({
  args: { calendarId: v.id("calendars") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.calendarId);
  },
});

// ─── Public: list connected Google Accounts (tokens redacted) ─────────────────

export const getGoogleAccounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    if (!dbUser) return [];

    const accounts = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", dbUser._id))
      .collect();

    // Omit sensitive token fields before sending to client
    return accounts.map(({ accessToken: _a, refreshToken: _r, ...safe }) => safe);
  },
});
