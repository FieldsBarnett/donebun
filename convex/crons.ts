import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync all calendars every two hours
crons.interval(
  "sync all calendars",
  { hours: 2 },
  internal.googleActions.syncAll,
);

export default crons;
