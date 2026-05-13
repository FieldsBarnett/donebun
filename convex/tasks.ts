// Recurring task expansion and performance-optimized fetching
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
  args: {
    start: v.optional(v.string()), // ISO string
    end: v.optional(v.string()),   // ISO string
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    const familyId = user?.familyId;
    if (!familyId) return [];

    let tasks;
    if (args.start || args.end) {
      // Fetch scheduled tasks in range PLUS unscheduled tasks
      // In Convex, range queries must be built in a single chain.
      const scheduledInRange = await ctx.db
        .query("tasks")
        .withIndex("by_family_dueDate", (q) => {
          const base = q.eq("familyId", familyId);
          if (args.start && args.end) {
            return base.gte("dueDate", args.start).lte("dueDate", args.end);
          }
          if (args.start) {
            return base.gte("dueDate", args.start);
          }
          if (args.end) {
            return base.lte("dueDate", args.end);
          }
          return base;
        })
        .collect();

      // For unscheduled, we fetch where dueDate is undefined.
      // We use the same index but eq to undefined.
      const unscheduled = await ctx.db
        .query("tasks")
        .withIndex("by_family_dueDate", (q) => q.eq("familyId", familyId).eq("dueDate", undefined as any))
        .collect();

      tasks = [...scheduledInRange, ...unscheduled];
    } else {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_family", (q) => q.eq("familyId", familyId))
        .collect();
    }

    // Filter for privacy and deletion
    tasks = tasks.filter((t) => 
      t.status !== "deleted" &&
      (!t.isPrivate || t.ownerId === user?._id || t.assigneeId === user?._id)
    );

    const expandedTasks: any[] = [];
    const now = new Date();
    
    // Determine the limit for virtual expansion
    let limitDate = new Date();
    if (args.end) {
      limitDate = new Date(args.end);
    } else {
      limitDate.setMonth(limitDate.getMonth() + 3); // Default 3 months look-ahead
    }

    // Expansion start date
    const expansionStart = args.start ? new Date(args.start) : now;

    for (const task of tasks) {
      // Skip if this root task is explicitly excluded (to hide it while keeping the series alive)
      const isRoot = !task.parentTaskId;
      const isExcluded = isRoot && task.recurrence?.excludedDates?.includes(task.dueDate || "");
      if (isExcluded) continue;

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
          const nextDateStr = calculateNextDueDate(currentDueDate, task.recurrence, expansionStart.toISOString());
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
    checklist: v.optional(v.array(v.object({
      text: v.string(),
      completed: v.boolean(),
    }))),
    attachments: v.optional(v.array(v.object({
      storageId: v.string(),
      name: v.string(),
      type: v.string(),
    }))),
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

    // Auto-acknowledge: if the creator is assigning to themselves (or no one),
    // pre-fill lastNotifiedAssigneeId so no popup fires for their own tasks.
    const effectiveAssigneeId = args.assigneeId;
    const lastNotifiedAssigneeId =
      !effectiveAssigneeId || effectiveAssigneeId === user._id
        ? user._id
        : undefined;

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
      checklist: args.checklist,
      attachments: args.attachments,
      status: "active",
      statusSet: Date.now(),
      lastNotifiedAssigneeId,
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
    checklist: v.optional(v.array(v.object({
      text: v.string(),
      completed: v.boolean(),
    }))),
    attachments: v.optional(v.array(v.object({
      storageId: v.string(),
      name: v.string(),
      type: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const { id, updateMode = "single", ...updatesObj } = args;
    const updates: any = updatesObj;

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
        if (updates.checklist !== undefined) patchData.checklist = updates.checklist === null ? undefined : updates.checklist;
        if (updates.attachments !== undefined) {
          const oldAttachments = task.attachments || [];
          const newAttachments = updates.attachments || [];
          const removed = oldAttachments.filter(oa => !newAttachments.some((na: any) => na.storageId === oa.storageId));
          for (const att of removed) {
            const isUsedByRoot = rootTask.attachments?.some(ra => ra.storageId === att.storageId);
            if (!isUsedByRoot || rootId === task._id) {
              await ctx.storage.delete(att.storageId as any);
            }
          }
          patchData.attachments = updates.attachments === null ? undefined : updates.attachments;
        }

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
      if (updates.checklist !== undefined) patchData.checklist = updates.checklist === null ? undefined : updates.checklist;
      if (updates.attachments !== undefined) {
        const oldAttachments = rootTask.attachments || [];
        const newAttachments = updates.attachments || [];
        const removed = oldAttachments.filter(oa => !newAttachments.some((na: any) => na.storageId === oa.storageId));
        for (const att of removed) {
          await ctx.storage.delete(att.storageId as any);
        }
        patchData.attachments = updates.attachments === null ? undefined : updates.attachments;
      }

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
      
      // If it's the root of a recurring series, don't delete it.
      // Instead, exclude its date and (if completion strategy) spawn next.
      if (task._id === rootId && task.recurrence) {
        await excludeVirtualDate(ctx as any, rootId, task.dueDate || "");
        if (task.recurrence.strategy === "completion") {
          await spawnNextCompletionTask(ctx as any, task);
        }
        return;
      }

      // Delete attachments from storage
      const attachments = task.attachments || [];
      for (const att of attachments) {
        // Only delete from storage if this file isn't used by the root task 
        // (to avoid breaking the series if they share files)
        const isUsedByRoot = rootTask.attachments?.some(ra => ra.storageId === att.storageId);
        if (!isUsedByRoot || rootId === task._id) {
           await ctx.storage.delete(att.storageId as any);
        }
      }

      if (task.recurrence?.strategy === "completion") {
         await spawnNextCompletionTask(ctx as any, task);
      }
      
      await ctx.db.delete(task._id);
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
       return;
    }

    if (updateMode === "all") {
       // Find all materialized instances to delete them too
       const exceptions = await ctx.db
         .query("tasks")
         .withIndex("by_parent", (q) => q.eq("parentTaskId", rootId))
         .collect();

       for (const ex of exceptions) {
         const atts = ex.attachments || [];
         for (const att of atts) {
           // We'll delete these storage files when we delete the root to be safe,
           // but we can check if they are unique to the exception here.
           const isUniqueToEx = !rootTask.attachments?.some(ra => ra.storageId === att.storageId);
           if (isUniqueToEx) {
             await ctx.storage.delete(att.storageId as any);
           }
         }
         await ctx.db.delete(ex._id);
       }

       // Delete root task attachments
       const rootAtts = rootTask.attachments || [];
       for (const att of rootAtts) {
         await ctx.storage.delete(att.storageId as any);
       }

       await ctx.db.delete(rootId);
       return;
    }
  },
});

/**
 * Returns tasks assigned to the current user that they haven't been
 * notified about yet (lastNotifiedAssigneeId !== assigneeId).
 * Only returns active tasks.
 */
export const getUnseenAssignments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) return [];

    const assigned = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", user._id))
      .collect();

    return assigned.filter(
      (t) =>
        t.status === "active" &&
        t.lastNotifiedAssigneeId !== user._id
    );
  },
});

/**
 * Marks a list of tasks as "seen" for the current user by setting
 * lastNotifiedAssigneeId to the current user's ID.
 */
export const acknowledgeAssignments = mutation({
  args: { taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) throw new Error("User not found");

    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      // Only acknowledge if the task is still assigned to the current user
      if (task && task.assigneeId === user._id) {
        await ctx.db.patch(taskId, { lastNotifiedAssigneeId: user._id });
      }
    }
  },
});
