import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    tokenIdentifier: v.string(),
    familyId: v.optional(v.id("families")),
    colorCode: v.optional(v.string()), // e.g. 'orange', 'pink' corresponding to design tokens
    initials: v.optional(v.string()), // max 2 letters
  }).index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_family", ["familyId"]),

  families: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  }).index("by_inviteCode", ["inviteCode"]),

  categories: defineTable({
    name: v.string(),
    familyId: v.id("families"),
    icon: v.optional(v.string()),
  }).index("by_family", ["familyId"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("deleted")),
    categoryId: v.optional(v.id("categories")),
    ownerId: v.id("users"),
    assigneeId: v.optional(v.id("users")), // undefined means "Family Pool"
    dueDate: v.optional(v.string()), // ISO date string
    originalDueDate: v.optional(v.string()), // The date this occurrence was originally scheduled for (for exceptions)
    recurrence: v.optional(v.object({
      strategy: v.union(v.literal("fixed"), v.literal("completion")),
      frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
      interval: v.number(), // every N days/weeks/etc
      daysOfWeek: v.optional(v.array(v.number())), // 0-6 for weekly
      dayOfMonth: v.optional(v.number()), // 1-31 for monthly
      endDate: v.optional(v.string()), // ISO date string
      excludedDates: v.optional(v.array(v.string())), // ISO date strings to skip in virtual expansion
    })),
    parentTaskId: v.optional(v.id("tasks")),
    familyId: v.id("families"),
    isPrivate: v.boolean(), // Tasks placed in the special "Private 🔒" category
    statusSet: v.optional(v.number()), // Timestamp of when the status was last set
  })
    .index("by_family", ["familyId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_category", ["categoryId"]),


  googleAccounts: defineTable({
    userId: v.id("users"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()), // Refresh token might only be provided on first auth
    expiresAt: v.optional(v.number()), // When the access token expires
  }).index("by_user", ["userId"]),

  calendars: defineTable({
    googleAccountId: v.id("googleAccounts"),
    googleCalendarId: v.string(),
    name: v.string(),
    ownerId: v.id("users"), // The user who authorized the Google Calendar
    assigneeId: v.id("users"), // The family member this calendar "belongs" to
    familyId: v.id("families"),
    syncToken: v.optional(v.string()), // For incremental sync
    color: v.optional(v.string()), // Custom color for events from this calendar
  })
    .index("by_family", ["familyId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_owner", ["ownerId"])
    .index("by_googleAccount", ["googleAccountId"]),

  calendarEvents: defineTable({
    calendarId: v.id("calendars"),
    googleEventId: v.string(), // Google's internal event ID
    title: v.string(),
    description: v.optional(v.string()),
    start: v.string(), // ISO string for dateTime or YYYY-MM-DD for all-day
    end: v.string(),
    isAllDay: v.boolean(),
  })
    .index("by_calendar", ["calendarId"])
    .index("by_googleEventId", ["googleEventId"]),
});
