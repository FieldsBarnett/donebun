import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a family and assign the current user as the owner
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    
    if (!user) throw new Error("User not found in app database");

    const familyId = await ctx.db.insert("families", {
      name: args.name,
      ownerId: user._id,
    });

    // Update user to belong to this family and give a default color
    await ctx.db.patch(user._id, {
      familyId: familyId,
      colorCode: "blue", // default color for the owner
    });

    // Create the "Private 🔒" category automatically for this family
    await ctx.db.insert("categories", {
      name: "Private 🔒",
      familyId: familyId,
    });

    return familyId;
  },
});

// Join an existing family (e.g. by passing the family ID)
// For MVP, we use the family ID as an invite code.
export const join = mutation({
  args: { familyId: v.id("families") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
      
    if (!user) throw new Error("User not found in app database");

    const family = await ctx.db.get(args.familyId);
    if (!family) throw new Error("Family not found");

    await ctx.db.patch(user._id, {
      familyId: args.familyId,
      colorCode: "purple", // default color for invited member, could be randomized
    });

    return args.familyId;
  },
});

export const getMembers = query({
  args: { familyId: v.id("families") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const members = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("familyId"), args.familyId))
      .collect();

    return members;
  },
});
