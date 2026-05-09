import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { 
  calculateNextDueDate, 
  materializeVirtualTask, 
  excludeVirtualDate, 
  splitSeries, 
  spawnNextCompletionTask,
  removeSpawnedCompletionTask
} from "./recurrence";

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
      .filter((q) => 
        q.and(
          q.neq(q.field("status"), "deleted"),
          q.or(
            q.eq(q.field("isPrivate"), false),
            q.eq(q.field("ownerId"), user?._id),
            q.eq(q.field("assigneeId"), user?._id)
          )
        )
      )
      .collect();

    const expandedTasks: any[] = [];
    const now = new Date();
    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() + 3); // 3 months look-ahead

    for (const task of tasks) {
      expandedTasks.push({
        ...task,
        isRecurring: !!task.recurrence || !!task.parentTaskId,
        isException: !!task.parentTaskId,
      });

      // Dynamically expand FIXED recurrence tasks
      if (
        task.recurrence?.strategy === "fixed" && 
        !task.parentTaskId && // This is the source task
        task.dueDate
      ) {
        let currentDueDate = task.dueDate;
        const excludedDates = task.recurrence.excludedDates || [];

        while (true) {
          const nextDateStr = calculateNextDueDate(currentDueDate, task.recurrence, now.toISOString());
          if (!nextDateStr) break;
          
          const nextDate = new Date(nextDateStr);
          if (nextDate > limitDate) break;

          // Check if this date is explicitly excluded
          const isExcluded = excludedDates.includes(nextDateStr);

          // Check if a materialized instance (exception) already exists for this original slot
          const hasMaterialized = tasks.some(t => 
            t.parentTaskId === task._id && 
            t.originalDueDate === nextDateStr
          );

          if (!isExcluded && !hasMaterialized) {
            expandedTasks.push({
              ...task,
              _id: `${task._id}:${nextDateStr}`,
              dueDate: nextDateStr,
              status: "active",
              statusSet: task.statusSet,
              isVirtual: true,
              isRecurring: true,
            });
          }
          currentDueDate = nextDateStr;
        }
      }
    }

    return expandedTasks;
  },
});


export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    categoryId: v.optional(v.id("categories")),
    dueDate: v.optional(v.string()),
    isPrivate: v.boolean(),
    recurrence: v.optional(v.object({
      strategy: v.union(v.literal("fixed"), v.literal("completion")),
      frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
      interval: v.number(),
      daysOfWeek: v.optional(v.array(v.number())),
      dayOfMonth: v.optional(v.number()),
      endDate: v.optional(v.string()),
    })),
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
      description: args.description,
      familyId: familyId,
      ownerId: user._id,
      assigneeId: args.assigneeId,
      categoryId: args.categoryId,
      dueDate: args.dueDate,
      isPrivate: args.isPrivate,
      recurrence: args.recurrence,
      status: "active",
      statusSet: Date.now(),
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    id: v.string(), // Support virtual IDs
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("deleted")),
  },
  handler: async (ctx, args) => {
    let task: Doc<"tasks"> | null;
    let isVirtual = false;
    let virtualDate: string | undefined;

    if (args.id.includes(":")) {
      const [id, date] = args.id.split(":");
      task = await ctx.db.get(id as Id<"tasks">);
      isVirtual = true;
      virtualDate = date;
    } else {
      task = await ctx.db.get(args.id as Id<"tasks">);
    }

    if (!task) return;

    if (isVirtual && task.recurrence && virtualDate) {
      await materializeVirtualTask(ctx as any, task, virtualDate, { status: args.status });
    } else {
      const wasCompleted = task.status === "completed";
      
      await ctx.db.patch(task._id, { 
        status: args.status,
        statusSet: Date.now(),
      });

      if (args.status === "completed" && !wasCompleted) {
        await spawnNextCompletionTask(ctx as any, task);
      } else if (args.status === "active" && wasCompleted) {
        await removeSpawnedCompletionTask(ctx as any, task);
      }
    }
  },
});


export const updateTask = mutation({
  args: {
    id: v.string(), // Support virtual IDs
    updateMode: v.optional(v.union(v.literal("single"), v.literal("future"), v.literal("all"))),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
    dueDate: v.optional(v.union(v.string(), v.null())),
    isPrivate: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"), v.literal("deleted"))),
    recurrence: v.optional(v.union(v.object({
      strategy: v.union(v.literal("fixed"), v.literal("completion")),
      frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
      interval: v.number(),
      daysOfWeek: v.optional(v.array(v.number())),
      dayOfMonth: v.optional(v.number()),
      endDate: v.optional(v.string()),
      excludedDates: v.optional(v.array(v.string())),
    }), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const { id, updateMode = "single", ...updates } = args;

    const isVirtual = id.includes(":");
    const taskId = isVirtual ? id.split(":")[0] : id;
    const virtualDate = isVirtual ? id.split(":")[1] : null;

    const task = await ctx.db.get(taskId as Id<"tasks">);
    if (!task) throw new Error("Task not found");

    const rootId = task.parentTaskId || task._id;
    const rootTask = await ctx.db.get(rootId);
    if (!rootTask) throw new Error("Root task not found");

    // Mode: SINGLE - Materialize exception or update existing exception
    if (updateMode === "single") {
      if (isVirtual && virtualDate) {
        await materializeVirtualTask(ctx as any, task, virtualDate, updates);
        return;
      } else {
        // Update the real task record
        const patchData: any = {};
        if (updates.title !== undefined) patchData.title = updates.title;
        if (updates.description !== undefined) patchData.description = updates.description;
        if (updates.assigneeId !== undefined) patchData.assigneeId = updates.assigneeId === null ? undefined : updates.assigneeId;
        if (updates.categoryId !== undefined) patchData.categoryId = updates.categoryId === null ? undefined : updates.categoryId;
        if (updates.dueDate !== undefined) patchData.dueDate = updates.dueDate === null ? undefined : updates.dueDate;
        if (updates.status !== undefined) {
          patchData.status = updates.status;
          patchData.statusSet = Date.now();
        }
        if (updates.isPrivate !== undefined) patchData.isPrivate = updates.isPrivate;
        if (updates.recurrence !== undefined) patchData.recurrence = updates.recurrence === null ? undefined : updates.recurrence;

        await ctx.db.patch(task._id, patchData);
        return;
      }
    }

    // Mode: FUTURE - Split the series
    if (updateMode === "future") {
      const splitDate = virtualDate || task.dueDate || new Date().toISOString();
      await splitSeries(ctx as any, rootTask, splitDate, updates);
      return;
    }

    // Mode: ALL - Update the root task itself
    if (updateMode === "all") {
      const patchData: any = {};
      if (updates.title !== undefined) patchData.title = updates.title;
      if (updates.description !== undefined) patchData.description = updates.description;
      if (updates.assigneeId !== undefined) patchData.assigneeId = updates.assigneeId === null ? undefined : updates.assigneeId;
      if (updates.categoryId !== undefined) patchData.categoryId = updates.categoryId === null ? undefined : updates.categoryId;
      if (updates.dueDate !== undefined) patchData.dueDate = updates.dueDate === null ? undefined : updates.dueDate;
      if (updates.status !== undefined) {
        patchData.status = updates.status;
        patchData.statusSet = Date.now();
      }
      if (updates.recurrence !== undefined) patchData.recurrence = updates.recurrence === null ? undefined : updates.recurrence;
      if (updates.isPrivate !== undefined) patchData.isPrivate = updates.isPrivate;

      await ctx.db.patch(rootId, patchData);
      return;
    }
  },
});

export const deleteTask = mutation({
  args: { 
    id: v.string(), // Support virtual IDs
    updateMode: v.optional(v.union(v.literal("single"), v.literal("future"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const { id, updateMode = "single" } = args;

    const isVirtual = id.includes(":");
    const taskId = isVirtual ? id.split(":")[0] : id;
    const virtualDate = isVirtual ? id.split(":")[1] : null;

    const task = await ctx.db.get(taskId as Id<"tasks">);
    if (!task) return;
    
    const rootId = task.parentTaskId || task._id;
    const rootTask = await ctx.db.get(rootId);
    if (!rootTask) return;

    if (updateMode === "single") {
      if (isVirtual && virtualDate) {
        await excludeVirtualDate(ctx as any, rootId, virtualDate);
        return;
      }
      
      await ctx.db.patch(task._id, { 
        status: "deleted",
        statusSet: Date.now(),
      });

      if (task.recurrence?.strategy === "completion") {
         await spawnNextCompletionTask(ctx as any, task);
      }
      return;
    }

    if (updateMode === "future") {
       const splitDate = virtualDate || task.dueDate || new Date().toISOString();
       if (rootTask.recurrence) {
         const endDate = new Date(splitDate);
         endDate.setDate(endDate.getDate() - 1);
         await ctx.db.patch(rootId, {
           recurrence: { ...rootTask.recurrence, endDate: endDate.toISOString() }
         });
       }
       // We don't spawn a new series for 'future' delete, we just end the old one.
       return;
    }

    if (updateMode === "all") {
       await ctx.db.patch(rootId, { 
         status: "deleted",
         statusSet: Date.now(),
       });
       return;
    }
  },
});
