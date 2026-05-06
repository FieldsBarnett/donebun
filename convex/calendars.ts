import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Internal: save synced calendars from a Google account
export const upsertCalendar = internalMutation({
  args: {
    googleAccountId: v.id("googleAccounts"),
    googleCalendarId: v.string(),
    name: v.string(),
    ownerId: v.id("users"),
    familyId: v.id("families"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("calendars")
      .withIndex("by_googleAccount", (q) =>
        q.eq("googleAccountId", args.googleAccountId)
      )
      .filter((q) => q.eq(q.field("googleCalendarId"), args.googleCalendarId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name });
      return existing._id;
    }

    return await ctx.db.insert("calendars", {
      googleAccountId: args.googleAccountId,
      googleCalendarId: args.googleCalendarId,
      name: args.name,
      ownerId: args.ownerId,
      familyId: args.familyId,
      assigneeId: args.assigneeId,
    });
  },
});

// List all calendars for the current user's family
export const listByFamily = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    if (!user?.familyId) return [];

    const calendars = await ctx.db
      .query("calendars")
      .withIndex("by_family", (q) => q.eq("familyId", user.familyId!))
      .collect();

    // Enrich with owner and assignee user info
    const enriched = await Promise.all(
      calendars.map(async (cal) => {
        const owner = await ctx.db.get(cal.ownerId);
        const assignee = await ctx.db.get(cal.assigneeId);
        return { ...cal, ownerName: owner?.name ?? "Unknown", assigneeName: assignee?.name ?? "Unknown" };
      })
    );

    return enriched;
  },
});

// Update the assignee of a calendar — only the owner can do this
export const updateAssignee = mutation({
  args: {
    calendarId: v.id("calendars"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    const calendar = await ctx.db.get(args.calendarId);
    if (!calendar) throw new Error("Calendar not found");

    // Only the owner can reassign
    if (calendar.ownerId !== user?._id) {
      throw new Error("Only the owner can reassign this calendar");
    }

    await ctx.db.patch(args.calendarId, { assigneeId: args.assigneeId });
  },
});

// Delete a calendar sync — only the owner can do this
export const deleteCalendar = mutation({
  args: { calendarId: v.id("calendars") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.subject)
      )
      .unique();

    const calendar = await ctx.db.get(args.calendarId);
    if (!calendar) throw new Error("Calendar not found");

    if (calendar.ownerId !== user?._id) {
      throw new Error("Only the owner can remove this calendar");
    }

    await ctx.db.delete(args.calendarId);
  },
});

// Update the sync token for a calendar
export const updateSyncToken = internalMutation({
  args: { calendarId: v.id("calendars"), syncToken: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.calendarId, { syncToken: args.syncToken });
  },
});

// Upsert a calendar event from Google
export const upsertCalendarEvent = internalMutation({
  args: {
    calendarId: v.id("calendars"),
    googleEventId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    start: v.string(),
    end: v.string(),
    isAllDay: v.boolean(),
    status: v.optional(v.string()), // Google returns "cancelled" for deleted events
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("calendarEvents")
      .withIndex("by_googleEventId", (q) => q.eq("googleEventId", args.googleEventId))
      .filter((q) => q.eq(q.field("calendarId"), args.calendarId))
      .first();

    if (args.status === "cancelled") {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }

    const eventData = {
      calendarId: args.calendarId,
      googleEventId: args.googleEventId,
      title: args.title,
      description: args.description,
      start: args.start,
      end: args.end,
      isAllDay: args.isAllDay,
    };

    if (existing) {
      await ctx.db.patch(existing._id, eventData);
    } else {
      await ctx.db.insert("calendarEvents", eventData);
    }
  },
});

// Get all persisted events for a specific calendar
export const getEventsByCalendar = query({
  args: { calendarId: v.id("calendars") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendarEvents")
      .withIndex("by_calendar", (q) => q.eq("calendarId", args.calendarId))
      .collect();
  },
});

// Internal: Get all calendars for background sync
export const getAllCalendars = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("calendars").collect();
  },
});

// Get all persisted events for all calendars in a family
export const getEventsByFamily = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user?.familyId) return [];

    const calendars = await ctx.db
      .query("calendars")
      .withIndex("by_family", (q) => q.eq("familyId", user.familyId!))
      .collect();

    const allEvents = [];
    for (const cal of calendars) {
      const events = await ctx.db
        .query("calendarEvents")
        .withIndex("by_calendar", (q) => q.eq("calendarId", cal._id))
        .collect();
      
      const assignee = await ctx.db.get(cal.assigneeId);
      
      for (const event of events) {
        allEvents.push({
          ...event,
          assigneeName: assignee?.name ?? "Unknown",
          assigneeColor: assignee?.colorCode ?? "blue",
        });
      }
    }

    return allEvents;
  },
});
