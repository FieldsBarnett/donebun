import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    const familyId = user?.familyId;
    if (!familyId) return [];

    return await ctx.db
      .query("categories")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .collect();
  },
});

export const create = mutation({
  args: { 
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user?.familyId) throw new Error("Family not found");

    return await ctx.db.insert("categories", {
      name: args.name,
      familyId: user.familyId,
      icon: args.icon,
    });
  },
});
export const update = mutation({
  args: { 
    id: v.id("categories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Check ownership/family
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    const category = await ctx.db.get(id);
    if (!category || category.familyId !== user?.familyId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    const category = await ctx.db.get(args.id);
    if (!category || category.familyId !== user?.familyId) {
      throw new Error("Unauthorized");
    }

    // Find all tasks using this category
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_category", (q) => q.eq("categoryId", args.id))
      .collect();

    // Remove category from all tasks
    for (const task of tasks) {
      await ctx.db.patch(task._id, { categoryId: undefined });
    }

    // Delete the category
    await ctx.db.delete(args.id);
  },
});
