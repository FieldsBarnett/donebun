import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { STALE_LOOP_MS } from "./loopConstants";
import { touchLoop } from "./loopHelpers";

const loopStatus = v.union(
  v.literal("open"),
  v.literal("stuck-waiting"),
  v.literal("closed"),
);

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.subject),
    )
    .unique();

  if (!user) throw new Error("User not found");
  return user;
}

async function requireOwnedLoop(ctx: QueryCtx | MutationCtx, loopId: Id<"loops">) {
  const user = await requireUser(ctx);
  const loop = await ctx.db.get(loopId);
  if (!loop || loop.ownerId !== user._id) {
    throw new Error("Loop not found");
  }
  return { user, loop };
}

async function nextLoopOrder(ctx: QueryCtx | MutationCtx, ownerId: Id<"users">) {
  const loops = await ctx.db
    .query("loops")
    .withIndex("by_owner_status", (q) =>
      q.eq("ownerId", ownerId).eq("status", "open"),
    )
    .collect();
  const waiting = await ctx.db
    .query("loops")
    .withIndex("by_owner_status", (q) =>
      q.eq("ownerId", ownerId).eq("status", "stuck-waiting"),
    )
    .collect();
  const all = [...loops, ...waiting];
  if (all.length === 0) return 0;
  return Math.max(...all.map((l) => l.orderPosition)) + 1;
}

async function nextItemOrderInLoop(ctx: QueryCtx | MutationCtx, loopId: Id<"loops">) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_loop", (q) => q.eq("loopId", loopId))
    .collect();
  const items = await ctx.db
    .query("loopItems")
    .withIndex("by_loop", (q) => q.eq("loopId", loopId))
    .collect();
  const orders = [
    ...tasks.map((t) => t.loopOrder ?? 0),
    ...items.map((i) => i.orderPosition),
  ];
  if (orders.length === 0) return 0;
  return Math.max(...orders) + 1;
}

function isLoopActive(status: Doc<"loops">["status"]) {
  return status === "open" || status === "stuck-waiting";
}

export const listActiveLoops = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (!user) return [];

    const open = await ctx.db
      .query("loops")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "open"),
      )
      .collect();
    const waiting = await ctx.db
      .query("loops")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "stuck-waiting"),
      )
      .collect();

    const loops = [...open, ...waiting].sort(
      (a, b) => a.orderPosition - b.orderPosition,
    );

    const enriched = await Promise.all(
      loops.map(async (loop) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_loop", (q) => q.eq("loopId", loop._id))
          .collect();
        const activeTasks = tasks.filter((t) => t.status !== "deleted");
        const completed = activeTasks.filter((t) => t.status === "completed").length;
        const total = activeTasks.length;
        const staleDays = Math.floor(
          (Date.now() - loop.lastTouched) / (24 * 60 * 60 * 1000),
        );
        const isStale = Date.now() - loop.lastTouched >= STALE_LOOP_MS;
        return {
          ...loop,
          todoCompleted: completed,
          todoTotal: total,
          staleDays,
          isStale,
        };
      }),
    );

    return enriched;
  },
});

export const getLoopDetail = query({
  args: { loopId: v.id("loops") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (!user) return null;

    const loop = await ctx.db.get(args.loopId);
    if (!loop || loop.ownerId !== user._id) return null;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_loop", (q) => q.eq("loopId", args.loopId))
      .collect();
    const items = await ctx.db
      .query("loopItems")
      .withIndex("by_loop", (q) => q.eq("loopId", args.loopId))
      .collect();

    const taskRows = tasks
      .filter((t) => t.status !== "deleted")
      .map((t) => ({
        kind: "task" as const,
        order: t.loopOrder ?? 0,
        id: t._id,
        title: t.title,
        status: t.status,
        description: t.description,
      }));

    const itemRows = items.map((i) => ({
      kind: i.kind,
      order: i.orderPosition,
      id: i._id,
      text: i.text,
      url: i.url,
      linkTitle: i.linkTitle,
    }));

    const merged = [...taskRows, ...itemRows].sort((a, b) => a.order - b.order);

    return { loop, items: merged };
  },
});

export const listClosedLoops = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (!user) return [];

    let loops = await ctx.db
      .query("loops")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "closed"),
      )
      .collect();

    loops.sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

    const q = args.search?.trim().toLowerCase();
    if (q) {
      loops = loops.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.closingNote?.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q),
      );
    }

    return loops;
  },
});

export const getClosedLoopIdsForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (!user) return [];

    const closed = await ctx.db
      .query("loops")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "closed"),
      )
      .collect();
    return closed.map((l) => l._id);
  },
});

export const createLoop = mutation({
  args: {
    title: v.string(),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");

    const now = Date.now();
    const orderPosition = await nextLoopOrder(ctx, user._id);

    return await ctx.db.insert("loops", {
      ownerId: user._id,
      title,
      status: "open",
      orderPosition,
      emoji: args.emoji,
      color: args.color,
      createdAt: now,
      updatedAt: now,
      lastTouched: now,
    });
  },
});

export const updateLoop = mutation({
  args: {
    loopId: v.id("loops"),
    title: v.optional(v.string()),
    nextStep: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(loopStatus),
    emoji: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { loop } = await requireOwnedLoop(ctx, args.loopId);
    if (loop.status === "closed") throw new Error("Cannot edit a closed loop");

    const patch: Partial<Doc<"loops">> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Title is required");
      patch.title = t;
    }
    if (args.nextStep !== undefined) {
      patch.nextStep = args.nextStep === null ? undefined : args.nextStep;
    }
    if (args.description !== undefined) {
      patch.description = args.description === null ? undefined : args.description;
    }
    if (args.status !== undefined) {
      if (args.status === "closed") throw new Error("Use closeLoop to archive");
      patch.status = args.status;
    }
    if (args.emoji !== undefined) {
      patch.emoji = args.emoji === null ? undefined : args.emoji;
    }
    if (args.color !== undefined) {
      patch.color = args.color === null ? undefined : args.color;
    }

    const now = Date.now();
    patch.updatedAt = now;
    patch.lastTouched = now;

    await ctx.db.patch(args.loopId, patch);
  },
});

export const addContextLogEntry = mutation({
  args: {
    loopId: v.id("loops"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { loop } = await requireOwnedLoop(ctx, args.loopId);
    if (loop.status === "closed") throw new Error("Loop is closed");

    const text = args.text.trim();
    if (!text) throw new Error("Entry cannot be empty");

    const entry = { text, createdAt: Date.now() };
    const log = [...(loop.contextLog ?? []), entry];
    const now = Date.now();
    await ctx.db.patch(args.loopId, {
      contextLog: log,
      updatedAt: now,
      lastTouched: now,
    });
  },
});

export const touchLoopStillOnIt = mutation({
  args: { loopId: v.id("loops") },
  handler: async (ctx, args) => {
    await requireOwnedLoop(ctx, args.loopId);
    await touchLoop(ctx, args.loopId);
  },
});

export const reorderLoops = mutation({
  args: {
    orderedLoopIds: v.array(v.id("loops")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    for (let i = 0; i < args.orderedLoopIds.length; i++) {
      const loop = await ctx.db.get(args.orderedLoopIds[i]);
      if (!loop || loop.ownerId !== user._id) continue;
      if (!isLoopActive(loop.status)) continue;
      await ctx.db.patch(args.orderedLoopIds[i], { orderPosition: i });
    }
  },
});

export const reorderLoopContents = mutation({
  args: {
    loopId: v.id("loops"),
    orderedEntries: v.array(
      v.object({
        kind: v.union(v.literal("task"), v.literal("note"), v.literal("link")),
        id: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireOwnedLoop(ctx, args.loopId);
    for (let i = 0; i < args.orderedEntries.length; i++) {
      const entry = args.orderedEntries[i];
      if (entry.kind === "task") {
        const task = await ctx.db.get(entry.id as Id<"tasks">);
        if (task?.loopId === args.loopId) {
          await ctx.db.patch(task._id, { loopOrder: i });
        }
      } else {
        const item = await ctx.db.get(entry.id as Id<"loopItems">);
        if (item?.loopId === args.loopId) {
          await ctx.db.patch(item._id, { orderPosition: i });
        }
      }
    }
    await touchLoop(ctx, args.loopId);
  },
});

export const createLoopTask = mutation({
  args: {
    loopId: v.id("loops"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, loop } = await requireOwnedLoop(ctx, args.loopId);
    if (loop.status === "closed") throw new Error("Loop is closed");
    if (!user.familyId) throw new Error("Family not found");

    const title = args.title.trim();
    if (!title) throw new Error("Title is required");

    const loopOrder = await nextItemOrderInLoop(ctx, args.loopId);
    const now = Date.now();

    const taskId = await ctx.db.insert("tasks", {
      title,
      familyId: user.familyId,
      ownerId: user._id,
      isPrivate: true,
      status: "active",
      statusSet: now,
      loopId: args.loopId,
      loopOrder,
      lastNotifiedAssigneeId: user._id,
    });

    await touchLoop(ctx, args.loopId);
    return taskId;
  },
});

export const createLoopItem = mutation({
  args: {
    loopId: v.id("loops"),
    kind: v.union(v.literal("note"), v.literal("link")),
    text: v.optional(v.string()),
    url: v.optional(v.string()),
    linkTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { loop } = await requireOwnedLoop(ctx, args.loopId);
    if (loop.status === "closed") throw new Error("Loop is closed");

    if (args.kind === "note" && !args.text?.trim()) {
      throw new Error("Note text is required");
    }
    if (args.kind === "link" && !args.url?.trim()) {
      throw new Error("URL is required");
    }

    const now = Date.now();
    const orderPosition = await nextItemOrderInLoop(ctx, args.loopId);

    const id = await ctx.db.insert("loopItems", {
      loopId: args.loopId,
      ownerId: loop.ownerId,
      kind: args.kind,
      text: args.text?.trim(),
      url: args.url?.trim(),
      linkTitle: args.linkTitle?.trim(),
      orderPosition,
      createdAt: now,
      updatedAt: now,
    });

    await touchLoop(ctx, args.loopId);
    return id;
  },
});

export const updateLoopItem = mutation({
  args: {
    itemId: v.id("loopItems"),
    text: v.optional(v.string()),
    url: v.optional(v.string()),
    linkTitle: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.ownerId !== user._id) throw new Error("Item not found");

    const patch: Partial<Doc<"loopItems">> = { updatedAt: Date.now() };
    if (args.text !== undefined) patch.text = args.text.trim();
    if (args.url !== undefined) patch.url = args.url.trim();
    if (args.linkTitle !== undefined) {
      patch.linkTitle = args.linkTitle === null ? undefined : args.linkTitle;
    }

    await ctx.db.patch(args.itemId, patch);
    await touchLoop(ctx, item.loopId);
  },
});

export const deleteLoopItem = mutation({
  args: { itemId: v.id("loopItems") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.ownerId !== user._id) throw new Error("Item not found");
    await ctx.db.delete(args.itemId);
    await touchLoop(ctx, item.loopId);
  },
});

export const moveLoopTask = mutation({
  args: {
    taskId: v.id("tasks"),
    targetLoopId: v.optional(v.id("loops")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task || task.ownerId !== user._id) throw new Error("Task not found");

    const previousLoopId = task.loopId;

    if (args.targetLoopId) {
      const { loop } = await requireOwnedLoop(ctx, args.targetLoopId);
      if (loop.status === "closed") throw new Error("Target loop is closed");
      const loopOrder = await nextItemOrderInLoop(ctx, args.targetLoopId);
      await ctx.db.patch(args.taskId, {
        loopId: args.targetLoopId,
        loopOrder,
      });
      await touchLoop(ctx, args.targetLoopId);
    } else {
      await ctx.db.patch(args.taskId, {
        loopId: undefined,
        loopOrder: undefined,
      });
    }

    if (previousLoopId && previousLoopId !== args.targetLoopId) {
      await touchLoop(ctx, previousLoopId);
    }
  },
});

export const getOpenTasksForClose = query({
  args: { loopId: v.id("loops") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (!user) return [];

    const loop = await ctx.db.get(args.loopId);
    if (!loop || loop.ownerId !== user._id) return [];

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_loop", (q) => q.eq("loopId", args.loopId))
      .collect();

    return tasks.filter((t) => t.status === "active");
  },
});

export const closeLoop = mutation({
  args: {
    loopId: v.id("loops"),
    closingNote: v.optional(v.string()),
    openTasksAction: v.union(
      v.literal("complete"),
      v.literal("delete"),
      v.literal("detach"),
    ),
  },
  handler: async (ctx, args) => {
    const { loop } = await requireOwnedLoop(ctx, args.loopId);
    if (loop.status === "closed") return;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_loop", (q) => q.eq("loopId", args.loopId))
      .collect();

    const openTasks = tasks.filter((t) => t.status === "active");

    if (openTasks.length > 0) {
      const now = Date.now();
      for (const task of openTasks) {
        if (args.openTasksAction === "complete") {
          await ctx.db.patch(task._id, {
            status: "completed",
            statusSet: now,
          });
        } else if (args.openTasksAction === "delete") {
          await ctx.db.patch(task._id, { status: "deleted", statusSet: now });
        } else {
          await ctx.db.patch(task._id, {
            loopId: undefined,
            loopOrder: undefined,
          });
        }
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.loopId, {
      status: "closed",
      closedAt: now,
      updatedAt: now,
      lastTouched: now,
      closingNote: args.closingNote?.trim() || undefined,
    });
  },
});

export const reopenLoop = mutation({
  args: { loopId: v.id("loops") },
  handler: async (ctx, args) => {
    const { user, loop } = await requireOwnedLoop(ctx, args.loopId);
    if (loop.status !== "closed") return;

    const orderPosition = await nextLoopOrder(ctx, user._id);
    const now = Date.now();
    await ctx.db.patch(args.loopId, {
      status: "open",
      orderPosition,
      closedAt: undefined,
      closingNote: undefined,
      updatedAt: now,
      lastTouched: now,
    });
  },
});

export const moveLoopByKeyboard = mutation({
  args: {
    loopId: v.id("loops"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const open = await ctx.db
      .query("loops")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "open"),
      )
      .collect();
    const waiting = await ctx.db
      .query("loops")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "stuck-waiting"),
      )
      .collect();
    const loops = [...open, ...waiting].sort(
      (a, b) => a.orderPosition - b.orderPosition,
    );
    const idx = loops.findIndex((l) => l._id === args.loopId);
    if (idx < 0) return;

    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= loops.length) return;

    const a = loops[idx];
    const b = loops[swapIdx];
    await ctx.db.patch(a._id, { orderPosition: b.orderPosition });
    await ctx.db.patch(b._id, { orderPosition: a.orderPosition });
  },
});
