import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const importFromThings3 = mutation({
  args: {
    categories: v.array(v.object({
      originalId: v.string(),
      name: v.string(),
    })),
    tasks: v.array(v.object({
      title: v.string(),
      description: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("completed"), v.literal("deleted")),
      originalAreaId: v.optional(v.string()),
      dueDate: v.optional(v.string()),
      recurrence: v.optional(v.object({
        strategy: v.union(v.literal("fixed"), v.literal("completion")),
        frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
        interval: v.number(),
        daysOfWeek: v.optional(v.array(v.number())),
        dayOfMonth: v.optional(v.number()),
        endDate: v.optional(v.string()),
      })),
      checklist: v.optional(v.array(v.object({
        text: v.string(),
        completed: v.boolean(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user || !user.familyId) throw new Error("User or family not found");

    const familyId = user.familyId;

    // 1. Create categories
    const categoryMapping = new Map<string, any>();
    for (const cat of args.categories) {
      // Check if category with same name already exists in this family
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_family", (q) => q.eq("familyId", familyId))
        .filter((q) => q.eq(q.field("name"), cat.name))
        .unique();
      
      if (existing) {
        categoryMapping.set(cat.originalId, existing._id);
      } else {
        const id = await ctx.db.insert("categories", {
          name: cat.name,
          familyId,
        });
        categoryMapping.set(cat.originalId, id);
      }
    }

    // 2. Create tasks
    let count = 0;
    for (const task of args.tasks) {
      await ctx.db.insert("tasks", {
        title: task.title,
        description: task.description,
        status: task.status,
        statusSet: Date.now(),
        categoryId: task.originalAreaId ? categoryMapping.get(task.originalAreaId) : undefined,
        ownerId: user._id,
        assigneeId: user._id, // Assign to importer as requested
        lastNotifiedAssigneeId: user._id,
        dueDate: task.dueDate,
        recurrence: task.recurrence,
        checklist: task.checklist,
        familyId,
        isPrivate: false,
      });
      count++;
    }

    return { count };
  },
});
