import { MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Turn a recurring series into a single non-recurring task.
 * Removes active materialized occurrences; keeps completed ones in the logbook
 * as standalone tasks without recurrence.
 */
export async function demoteRecurringSeriesToSingleTask(
  ctx: MutationCtx,
  rootTask: Doc<"tasks">,
  updates: Record<string, unknown>,
) {
  const rootId = rootTask._id;

  const exceptions = await ctx.db
    .query("tasks")
    .withIndex("by_parent", (q) => q.eq("parentTaskId", rootId))
    .collect();

  for (const ex of exceptions) {
    if (ex.status === "active") {
      await ctx.db.delete(ex._id);
    } else {
      await ctx.db.patch(ex._id, {
        recurrence: undefined,
        parentTaskId: undefined,
      });
    }
  }

  const patchData: Record<string, unknown> = {
    recurrence: undefined,
  };

  if (updates.title !== undefined) patchData.title = updates.title;
  if (updates.description !== undefined) patchData.description = updates.description;
  if (updates.assigneeId !== undefined) {
    patchData.assigneeId = updates.assigneeId === null ? undefined : updates.assigneeId;
  }
  if (updates.categoryId !== undefined) {
    patchData.categoryId = updates.categoryId === null ? undefined : updates.categoryId;
  }
  if (updates.dueDate !== undefined) {
    patchData.dueDate = updates.dueDate === null ? undefined : updates.dueDate;
  }
  if (updates.isPrivate !== undefined) patchData.isPrivate = updates.isPrivate;
  if (updates.checklist !== undefined) {
    patchData.checklist = updates.checklist === null ? undefined : updates.checklist;
  }
  if (updates.attachments !== undefined) {
    patchData.attachments = updates.attachments === null ? undefined : updates.attachments;
  }
  if (updates.status !== undefined) {
    patchData.status = updates.status;
    patchData.statusSet = Date.now();
  }

  await ctx.db.patch(rootId, patchData);
}

/**
 * Idempotent repairs for bad data from the recurrence-removal bug.
 */
export async function repairRecurrenceDataForFamily(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<{ strippedExceptionRecurrence: number; fixedExcludedRoots: number; deletedDuplicateActive: number }> {
  let strippedExceptionRecurrence = 0;
  let fixedExcludedRoots = 0;
  let deletedDuplicateActive = 0;

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();

  for (const task of tasks) {
    if (task.parentTaskId && task.recurrence) {
      await ctx.db.patch(task._id, { recurrence: undefined });
      strippedExceptionRecurrence++;
    }
  }

  for (const task of tasks) {
    if (task.parentTaskId || !task.recurrence?.excludedDates?.length || !task.dueDate) {
      continue;
    }
    const excluded = task.recurrence.excludedDates;
    if (!excluded.includes(task.dueDate)) continue;

    const hasMaterialized = tasks.some(
      (t) =>
        t.parentTaskId === task._id &&
        (t.originalDueDate === task.dueDate || t.dueDate === task.dueDate),
    );

    if (!hasMaterialized) {
      const nextExcluded = excluded.filter((d) => d !== task.dueDate);
      await ctx.db.patch(task._id, {
        recurrence: {
          ...task.recurrence,
          excludedDates: nextExcluded.length > 0 ? nextExcluded : undefined,
        },
      });
      fixedExcludedRoots++;
    }
  }

  const byParent = new Map<string, Doc<"tasks">[]>();
  for (const task of tasks) {
    if (!task.parentTaskId || task.status !== "active") continue;
    const list = byParent.get(task.parentTaskId) ?? [];
    list.push(task);
    byParent.set(task.parentTaskId, list);
  }

  for (const [, group] of byParent) {
    const byOriginal = new Map<string, Doc<"tasks">[]>();
    for (const t of group) {
      const key = t.originalDueDate ?? t.dueDate ?? "";
      const list = byOriginal.get(key) ?? [];
      list.push(t);
      byOriginal.set(key, list);
    }
    for (const [, dupes] of byOriginal) {
      if (dupes.length <= 1) continue;
      dupes.sort((a, b) => a._creationTime - b._creationTime);
      for (const extra of dupes.slice(1)) {
        await ctx.db.delete(extra._id);
        deletedDuplicateActive++;
      }
    }
  }

  return { strippedExceptionRecurrence, fixedExcludedRoots, deletedDuplicateActive };
}
