import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getTasks = query({
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

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .collect();

    return await Promise.all(
      tasks.map(async (task) => {
        let assignee = null;
        if (task.assigneeId) {
          assignee = await ctx.db.get(task.assigneeId);
        }
        
        let category = null;
        if (task.categoryId) {
          category = await ctx.db.get(task.categoryId);
        }

        return {
          ...task,
          assigneeName: assignee?.name,
          assigneeColor: assignee?.colorCode,
          categoryName: category?.name,
        };
      })
    );
  },
});


export const createTask = mutation({
  args: {
    title: v.string(),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    const familyId = user?.familyId;
    if (!user || !familyId) throw new Error("User or family not found");

    return await ctx.db.insert("tasks", {
      title: args.title,
      familyId: familyId,
      ownerId: user._id,
      assigneeId: args.assigneeId,
      dueDate: args.dueDate,
      isPrivate: args.isPrivate,
      status: "active",
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("active"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
