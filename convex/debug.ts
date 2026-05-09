import { v } from "convex/values";
import { query } from "./_generated/server";

export const getTaskById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id as any);
  },
});
