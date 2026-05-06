import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync all calendars every 15 minutes
crons.interval(
  "sync all calendars",
  { minutes: 15 },
  internal.googleActions.syncAll,
);

export default crons;
