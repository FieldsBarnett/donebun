import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a family and assign the current user as the owner
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    
    if (!user) throw new Error("User not found in app database");

    const familyId = await ctx.db.insert("families", {
      name: `${user.name}'s Family`,
      ownerId: user._id,
      inviteCode: crypto.randomUUID(),
    });

    // Update user to belong to this family and give a default color
    await ctx.db.patch(user._id, {
      familyId: familyId,
      colorCode: "blue", // default color for the owner
    });

    return familyId;
  },
});

// Join an existing family by invite code
export const join = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
      
    if (!user) throw new Error("User not found in app database");

    const newFamily = await ctx.db
      .query("families")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!newFamily) throw new Error("Family not found");
    if (user.familyId === newFamily._id) throw new Error("You are already in this family");

    const oldFamilyId = user.familyId;
    if (oldFamilyId) {
      // Check if they are the only member of their current family (Solo Family)
      const currentMembers = await ctx.db
        .query("users")
        .withIndex("by_family", (q) => q.eq("familyId", oldFamilyId))
        .collect();

      if (currentMembers.length > 1) {
        throw new Error("You must leave your current shared family before joining a new one.");
      }

      // It's a Solo Family. Migrate their tasks to the new family.
      const soloTasks = await ctx.db
        .query("tasks")
        .withIndex("by_family", (q) => q.eq("familyId", oldFamilyId))
        .collect();

      for (const task of soloTasks) {
        await ctx.db.patch(task._id, {
          familyId: newFamily._id,
          // Categories don't migrate well, so clear them
          categoryId: undefined, 
        });
      }

      // Delete old solo categories
      const oldCategories = await ctx.db
        .query("categories")
        .withIndex("by_family", (q) => q.eq("familyId", oldFamilyId))
        .collect();
      for (const cat of oldCategories) {
        await ctx.db.delete(cat._id);
      }

      // Delete the old Solo Family
      await ctx.db.delete(oldFamilyId);
    }

    await ctx.db.patch(user._id, {
      familyId: newFamily._id,
      colorCode: "purple", // default color for invited member
    });

    return newFamily._id;
  },
});

// Leave the current family
export const leave = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
      
    if (!user) throw new Error("User not found in app database");
    if (!user.familyId) throw new Error("You are not in a family");

    const oldFamilyId = user.familyId;
    const oldFamily = await ctx.db.get(oldFamilyId);
    if (!oldFamily) throw new Error("Family not found");

    // 1. Determine fallback owner for the old family
    let newFamilyOwnerId = oldFamily.ownerId;
    const otherMembers = await ctx.db
      .query("users")
      .withIndex("by_family", (q) => q.eq("familyId", oldFamilyId))
      .filter((q) => q.neq(q.field("_id"), user._id))
      .collect();

    if (otherMembers.length === 0) {
      throw new Error("You are the only member of this family. You cannot leave a Solo Family.");
    }

    if (oldFamily.ownerId === user._id) {
      // Transfer family ownership to the first available other member
      newFamilyOwnerId = otherMembers[0]._id;
      await ctx.db.patch(oldFamilyId, { ownerId: newFamilyOwnerId });
    }

    // 2. Create the new Solo Family
    const newFamilyId = await ctx.db.insert("families", {
      name: `${user.name}'s Planner`,
      ownerId: user._id,
      inviteCode: crypto.randomUUID(),
    });

    // 3. Process all tasks in the old family
    const allFamilyTasks = await ctx.db
      .query("tasks")
      .withIndex("by_family", (q) => q.eq("familyId", oldFamilyId))
      .collect();

    for (const task of allFamilyTasks) {
      const isOwnedByLeaving = task.ownerId === user._id;
      const isAssignedToLeaving = task.assigneeId === user._id;
      
      // Rule 1: Personal/Private Tasks -> goes to Solo Family
      if (task.isPrivate || isAssignedToLeaving) {
        await ctx.db.patch(task._id, {
          familyId: newFamilyId,
          categoryId: undefined, // Clear category since it belongs to old family
          ownerId: user._id, // Ensure they own it
        });
      } 
      // Rule 2: Delegated Tasks -> stays in old family, ownership to assignee
      else if (isOwnedByLeaving && task.assigneeId !== undefined && task.assigneeId !== user._id) {
        await ctx.db.patch(task._id, {
          ownerId: task.assigneeId,
        });
      }
      // Rule 3: Family Pool Tasks -> stays in old family, ownership to family owner
      else if (isOwnedByLeaving && task.assigneeId === undefined) {
        await ctx.db.patch(task._id, {
          ownerId: newFamilyOwnerId,
        });
      }
    }

    // 4. Update the user
    await ctx.db.patch(user._id, {
      familyId: newFamilyId,
      colorCode: "blue", // default color for the owner
    });

    return true;
  },
});

// Get family info by invite code
export const getByInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("families")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();
  },
});

// Get the current user's family details
export const getMyFamily = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    
    if (!user || !user.familyId) return null;

    return await ctx.db.get(user.familyId);
  },
});

export const getMembers = query({
  args: { familyId: v.id("families") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const members = await ctx.db
      .query("users")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    return members;
  },
});
