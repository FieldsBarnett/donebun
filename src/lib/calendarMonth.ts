import { parseDueDate, toDateKey } from "./dateUtils";
import { filterCalendarEvents, filterTasks, FilterMode } from "./filterUtils";
import { formatTaskTime, type TodayTaskSource } from "./todayTasks";

/** Snapshot written to App Group for the month calendar widget. */
export interface CalendarMonthSnapshot {
  year: number;
  /** 1–12 */
  month: number;
  /** Local YYYY-MM-DD for "today" */
  today: string;
  /** Task counts keyed by local YYYY-MM-DD */
  days: Record<string, number>;
  /** Next upcoming calendar events (large widget list). Embedded so one App Group write updates grid + list. */
  upcomingEvents?: WidgetCalendarEventItem[];
}

export interface CalendarEventSource {
  _id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  assigneeId?: string;
}

/** Upcoming calendar events for the large calendar widget list. */
export interface WidgetCalendarEventItem {
  id: string;
  title: string;
  /** Local time label, or null for all-day */
  time: string | null;
  dateKey: string;
  isAllDay: boolean;
}

/**
 * Active personal tasks per day for the given calendar month (local time).
 * Shared by the iOS month calendar widget.
 */
export function getMonthTaskCounts(
  tasks: TodayTaskSource[],
  currentUser: Parameters<typeof filterTasks>[1],
  filterMode: FilterMode,
  year: number,
  monthIndex: number
): Record<string, number> {
  if (!currentUser) return {};

  const filtered = filterTasks(tasks, currentUser, filterMode);
  const counts: Record<string, number> = {};

  for (const task of filtered) {
    if (task.status !== "active" || !task.dueDate) continue;
    const date = parseDueDate(task.dueDate);
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex) continue;
    const key = toDateKey(date);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

export function buildCalendarMonthSnapshot(
  tasks: TodayTaskSource[],
  currentUser: Parameters<typeof filterTasks>[1],
  filterMode: FilterMode = "personal",
  now: Date = new Date()
): CalendarMonthSnapshot {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  return {
    year,
    month: monthIndex + 1,
    today: toDateKey(now),
    days: getMonthTaskCounts(tasks, currentUser, filterMode, year, monthIndex),
  };
}

/**
 * Next upcoming calendar events (not limited to today) for the large calendar widget.
 */
export function getUpcomingCalendarEvents(
  events: CalendarEventSource[],
  currentUser: Parameters<typeof filterCalendarEvents>[1],
  filterMode: FilterMode = "personal",
  limit = 4,
  now: Date = new Date()
): WidgetCalendarEventItem[] {
  if (!currentUser) return [];

  const filtered = filterCalendarEvents(events, currentUser, filterMode);
  const todayKey = toDateKey(now);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  return filtered
    .filter((event) => {
      if (!event.start) return false;
      const start = parseDueDate(event.start);
      const isAllDay = event.isAllDay || !event.start.includes("T");
      if (isAllDay) {
        return toDateKey(start) >= todayKey;
      }
      // Timed: still happening, or starts later today / in the future.
      const end = event.end ? parseDueDate(event.end) : start;
      return end > now || start >= todayStart;
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit)
    .map((event) => {
      const start = parseDueDate(event.start);
      const isAllDay = event.isAllDay || !event.start.includes("T");
      return {
        id: event._id,
        title: event.title,
        time: isAllDay ? null : formatTaskTime(event.start),
        dateKey: toDateKey(start),
        isAllDay,
      };
    });
}
