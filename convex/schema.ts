import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    tokenIdentifier: v.string(),
    familyId: v.optional(v.id("families")),
    colorCode: v.optional(v.string()), // e.g. 'orange', 'pink' corresponding to design tokens
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  families: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
  }),

  categories: defineTable({
    name: v.string(),
    familyId: v.id("families"),
  }).index("by_family", ["familyId"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed")),
    categoryId: v.optional(v.id("categories")),
    ownerId: v.id("users"),
    assigneeId: v.optional(v.id("users")), // undefined means "Family Pool"
    dueDate: v.optional(v.string()), // ISO date string
    repeatOption: v.optional(v.union(v.literal("fixed"), v.literal("completion"))),
    repeatInterval: v.optional(v.number()), // in days
    familyId: v.id("families"),
    isPrivate: v.boolean(), // Tasks placed in the special "Private 🔒" category
  })
    .index("by_family", ["familyId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_category", ["categoryId"]),

  tags: defineTable({
    name: v.string(),
    familyId: v.id("families"),
  }).index("by_family", ["familyId"]),

  taskTags: defineTable({
    taskId: v.id("tasks"),
    tagId: v.id("tags"),
  })
    .index("by_task", ["taskId"])
    .index("by_tag", ["tagId"]),

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
