import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a family and assign the current user as the owner
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    
    if (!user) throw new Error("User not found in app database");

    const familyId = await ctx.db.insert("families", {
      name: `${user.name}'s Family`,
      ownerId: user._id,
      inviteCode: crypto.randomUUID(),
    });

    // Update user to belong to this family and give a default color
    await ctx.db.patch(user._id, {
      familyId: familyId,
      colorCode: "blue", // default color for the owner
    });

    return familyId;
  },
});

// Join an existing family by invite code
export const join = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
      
    if (!user) throw new Error("User not found in app database");
    if (user.familyId) throw new Error("You must leave your current family before joining a new one.");

    const family = await ctx.db
      .query("families")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!family) throw new Error("Family not found");

    await ctx.db.patch(user._id, {
      familyId: family._id,
      colorCode: "purple", // default color for invited member
    });

    return family._id;
  },
});

// Leave the current family
export const leave = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
      
    if (!user) throw new Error("User not found in app database");
    if (!user.familyId) throw new Error("You are not in a family");

    await ctx.db.patch(user._id, {
      familyId: undefined,
      colorCode: undefined,
    });

    return true;
  },
});

// Get family info by invite code
export const getByInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("families")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();
  },
});

// Get the current user's family details
export const getMyFamily = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    
    if (!user || !user.familyId) return null;

    return await ctx.db.get(user.familyId);
  },
});

export const getMembers = query({
  args: { familyId: v.id("families") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const members = await ctx.db
      .query("users")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    return members;
  },
});
