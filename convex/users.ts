import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    if (user !== null) {
      // If we've seen this identity before but the name has changed, patch the value.
      if (user.name !== identity.name || user.email !== identity.email) {
        await ctx.db.patch(user._id, {
          name: identity.name ?? "Anonymous",
          email: identity.email ?? "",
        });
      }
      return user._id;
    }

    // If it's a new identity, create a new User.
    const userId = await ctx.db.insert("users", {
      name: identity.name ?? "Anonymous",
      email: identity.email ?? "",
      tokenIdentifier: identity.subject,
    });

    // Create a default "Solo Family" for the new user
    const familyId = await ctx.db.insert("families", {
      name: `${identity.name ?? "Anonymous"}'s Planner`,
      ownerId: userId,
      inviteCode: crypto.randomUUID(),
    });

    // Assign the user to their new solo family
    await ctx.db.patch(userId, {
      familyId: familyId,
      colorCode: "blue", // Give them a default color
    });

    return userId;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();
  },
});

export const getMyFamilyMembers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    if (!user?.familyId) return [];

    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("familyId"), user.familyId))
      .collect();
  },
});

export const updateProfile = mutation({
  args: {
    colorCode: v.optional(v.string()),
    initials: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const patch: any = {};
    if (args.colorCode !== undefined) patch.colorCode = args.colorCode;
    if (args.name !== undefined) patch.name = args.name;
    if (args.initials !== undefined) {
      // Validate initials length
      patch.initials = args.initials.slice(0, 2).toUpperCase();
    }

    await ctx.db.patch(user._id, patch);
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Optional: Cascade delete tasks, etc. 
    // For now, just delete the user record.
    await ctx.db.delete(user._id);
  },
});

