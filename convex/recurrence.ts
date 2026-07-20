import { MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Virtual recurring task IDs encode a root task id and occurrence date as
 * `${taskId}:${isoDueDate}`. ISO datetimes contain colons, so never split on
 * every colon — only the first separator.
 */
export function parseVirtualTaskId(id: string): {
  taskId: string;
  virtualDate: string | null;
  isVirtual: boolean;
} {
  const colonIndex = id.indexOf(":");
  if (colonIndex === -1) {
    return { taskId: id, virtualDate: null, isVirtual: false };
  }

  return {
    taskId: id.slice(0, colonIndex),
    virtualDate: id.slice(colonIndex + 1),
    isVirtual: true,
  };
}

export function formatVirtualTaskId(
  taskId: Id<"tasks"> | string,
  virtualDate: string,
): string {
  return `${taskId}:${virtualDate}`;
}

export function toLocalISOString(date: Date, includeTime: boolean): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePart = `${year}-${month}-${day}`;
  
  if (!includeTime) return datePart;
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${datePart}T${hours}:${minutes}:${seconds}`;
}

export function calculateNextDueDate(currentDueDate: string | undefined, recurrence: any, completionDate: string): string | null {
  let referenceDateStr = completionDate;
  let originalHasTime = true;

  if (recurrence.strategy === "fixed" && currentDueDate) {
    referenceDateStr = currentDueDate;
    originalHasTime = currentDueDate.includes("T");
  } else if (recurrence.strategy === "completion") {
    // For completion strategy, we use completionDate but try to preserve the time from currentDueDate
    if (currentDueDate) {
      originalHasTime = currentDueDate.includes("T");
      if (originalHasTime) {
        const timePart = currentDueDate.split("T")[1];
        const datePart = completionDate.split("T")[0];
        referenceDateStr = `${datePart}T${timePart}`;
      } else {
        referenceDateStr = completionDate.split("T")[0];
      }
    } else {
      // No currentDueDate, default to completionDate (which has time)
      originalHasTime = true;
    }
  }

  // Parse carefully: if it has no 'T', it's YYYY-MM-DD, treat as local midnight
  // If it has 'T', it might or might not have 'Z'. new Date() handles 'Z' as UTC, and no 'Z' as LOCAL.
  const nextDate = new Date(referenceDateStr);

  switch (recurrence.frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + recurrence.interval);
      break;
    case "weekly":
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        const currentDay = nextDate.getDay();
        const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b);
        const nextDay = sortedDays.find((d) => d > currentDay);
        
        if (nextDay !== undefined) {
          nextDate.setDate(nextDate.getDate() + (nextDay - currentDay));
        } else {
          const firstDay = sortedDays[0];
          nextDate.setDate(nextDate.getDate() + (7 - currentDay + firstDay) + (recurrence.interval - 1) * 7);
        }
      } else {
        nextDate.setDate(nextDate.getDate() + recurrence.interval * 7);
      }
      break;
    case "monthly":
      if (recurrence.dayOfMonth) {
        nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
        // Handle edge cases where the next month has fewer days
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(recurrence.dayOfMonth, lastDayOfMonth));
      } else {
        nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
      }
      break;
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + recurrence.interval);
      break;
  }

  if (recurrence.endDate && nextDate > new Date(recurrence.endDate)) {
    return null;
  }

  return toLocalISOString(nextDate, originalHasTime);
}

export async function excludeVirtualDate(ctx: MutationCtx, rootId: Id<"tasks">, virtualDate: string) {
  const rootTask = await ctx.db.get(rootId);
  if (rootTask && rootTask.recurrence) {
    const excludedDates = rootTask.recurrence.excludedDates || [];
    if (!excludedDates.includes(virtualDate)) {
      await ctx.db.patch(rootId, {
        recurrence: {
          ...rootTask.recurrence,
          excludedDates: [...excludedDates, virtualDate],
        }
      });
    }
  }
}

export async function materializeVirtualTask(
  ctx: MutationCtx, 
  task: Doc<"tasks">, 
  virtualDate: string, 
  updates: Record<string, any>
) {
  const rootId = task.parentTaskId || task._id;
  
  if (task.recurrence?.strategy === "fixed") {
    await excludeVirtualDate(ctx, rootId, virtualDate);
  }

  return await ctx.db.insert("tasks", {
    title: updates.title !== undefined ? updates.title : task.title,
    description: updates.description !== undefined ? updates.description : task.description,
    status: updates.status !== undefined ? updates.status : task.status,
    statusSet: updates.statusSet !== undefined ? updates.statusSet : Date.now(),
    categoryId: updates.categoryId === null ? undefined : (updates.categoryId !== undefined ? updates.categoryId : task.categoryId),
    ownerId: task.ownerId,
    assigneeId: updates.assigneeId === null ? undefined : (updates.assigneeId !== undefined ? updates.assigneeId : task.assigneeId),
    lastNotifiedAssigneeId: task.lastNotifiedAssigneeId,
    dueDate: updates.dueDate === null ? undefined : (updates.dueDate !== undefined ? updates.dueDate : virtualDate),
    originalDueDate: virtualDate,
    recurrence: task.recurrence,
    familyId: task.familyId,
    isPrivate: updates.isPrivate !== undefined ? updates.isPrivate : task.isPrivate,
    checklist: updates.checklist !== undefined ? updates.checklist : task.checklist,
    attachments: updates.attachments !== undefined ? updates.attachments : task.attachments,
    parentTaskId: rootId,
  });
}

export async function endFixedSeriesBefore(
  ctx: MutationCtx,
  rootId: Id<"tasks">,
  rootTask: Doc<"tasks">,
  splitDate: string,
) {
  if (!rootTask.recurrence) return;

  const endDate = new Date(splitDate);
  endDate.setDate(endDate.getDate() - 1);
  await ctx.db.patch(rootId, {
    recurrence: {
      ...rootTask.recurrence,
      endDate: toLocalISOString(endDate, splitDate.includes("T")),
    },
  });

  if (rootTask.recurrence.strategy === "fixed") {
    await excludeVirtualDate(ctx, rootId, splitDate);
  }
}

export async function splitSeries(
  ctx: MutationCtx,
  rootTask: Doc<"tasks">,
  splitDate: string,
  updates: Record<string, any>
) {
  // 1. End the old series before splitDate and hide the split occurrence on it
  await endFixedSeriesBefore(ctx, rootTask._id, rootTask, splitDate);

  // 2. Create new root starting at splitDate with updates
  return await ctx.db.insert("tasks", {
    title: updates.title !== undefined ? updates.title : rootTask.title,
    description: updates.description !== undefined ? updates.description : rootTask.description,
    status: updates.status !== undefined ? updates.status : "active",
    statusSet: updates.statusSet !== undefined ? updates.statusSet : Date.now(),
    categoryId: updates.categoryId === null ? undefined : (updates.categoryId !== undefined ? updates.categoryId : rootTask.categoryId),
    ownerId: rootTask.ownerId,
    assigneeId: updates.assigneeId === null ? undefined : (updates.assigneeId !== undefined ? updates.assigneeId : rootTask.assigneeId),
    lastNotifiedAssigneeId: rootTask.lastNotifiedAssigneeId,
    dueDate: updates.dueDate === null ? undefined : (updates.dueDate !== undefined ? updates.dueDate : splitDate),
    recurrence: updates.recurrence === null ? undefined : (updates.recurrence !== undefined ? updates.recurrence : rootTask.recurrence),
    familyId: rootTask.familyId,
    isPrivate: updates.isPrivate !== undefined ? updates.isPrivate : rootTask.isPrivate,
    checklist: updates.checklist !== undefined ? updates.checklist : rootTask.checklist,
    attachments: updates.attachments !== undefined ? updates.attachments : rootTask.attachments,
  });
}

export async function spawnNextCompletionTask(ctx: MutationCtx, task: Doc<"tasks">) {
  if (task.recurrence?.strategy !== "completion") return null;
  
  const now = new Date();
  const nextDueDate = calculateNextDueDate(task.dueDate, task.recurrence, toLocalISOString(now, true));
  if (nextDueDate) {
    return await ctx.db.insert("tasks", {
      title: task.title,
      description: task.description,
      status: "active",
      statusSet: Date.now(),
      categoryId: task.categoryId,
      ownerId: task.ownerId,
      assigneeId: task.assigneeId,
      lastNotifiedAssigneeId: task.lastNotifiedAssigneeId,
      dueDate: nextDueDate,
      recurrence: task.recurrence,
      familyId: task.familyId,
      isPrivate: task.isPrivate,
      checklist: task.checklist,
      attachments: task.attachments,
      parentTaskId: task.parentTaskId || task._id,
    });
  }
  return null;
}

export async function removeSpawnedCompletionTask(ctx: MutationCtx, task: Doc<"tasks">) {
  if (task.recurrence?.strategy !== "completion") return;

  const rootId = task.parentTaskId || task._id;
  
  // Find any active task that belongs to this chain
  const tasksInFamily = await ctx.db
    .query("tasks")
    .withIndex("by_family", (q) => q.eq("familyId", task.familyId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  const spawnedTask = tasksInFamily.find(t => 
    t._id !== task._id && 
    (t.parentTaskId === rootId || t._id === rootId)
  );

  if (spawnedTask) {
    await ctx.db.delete(spawnedTask._id);
  }
}
