import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export async function touchLoop(ctx: MutationCtx, loopId: Id<"loops">) {
  const now = Date.now();
  await ctx.db.patch(loopId, { lastTouched: now, updatedAt: now });
}
