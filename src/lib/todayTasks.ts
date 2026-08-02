import { parseDueDate, isSameDay, toDateKey } from "./dateUtils";
import { filterTasks, FilterMode } from "./filterUtils";

export interface TodayTaskItem {
  id: string;
  title: string;
  dueDate?: string;
  /** Local YYYY-MM-DD for opening Timeline / deep links */
  dateKey: string;
  isOverdue: boolean;
  completed: boolean;
}

export interface TodayTaskSource {
  _id: string;
  title: string;
  status: "active" | "completed" | "deleted";
  dueDate?: string;
  statusSet?: number;
  isPrivate: boolean;
  ownerId: string;
  assigneeId?: string;
}

function getSortTime(iso: string | undefined): number {
  if (!iso) return Infinity;
  if (!iso.includes("T")) return Infinity;
  return new Date(iso).getTime();
}

export function formatTaskTime(dueDate: string): string | null {
  if (!dueDate.includes("T")) return null;
  const date = parseDueDate(dueDate);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isTaskVisible(
  task: TodayTaskSource,
  today: Date,
  moveTasksPreference: string
): boolean {
  if (task.status === "active") return true;
  if (task.status === "completed" && moveTasksPreference === "next_day") {
    return Boolean(task.statusSet && isSameDay(new Date(task.statusSet), today));
  }
  return false;
}

/** Tasks shown in Dashboard "Today" — shared with the iOS widget snapshot. */
export function getTodayTasks<T extends TodayTaskSource>(
  tasks: T[],
  currentUser: Parameters<typeof filterTasks>[1],
  filterMode: FilterMode,
  today: Date = new Date()
): T[] {
  if (!currentUser) return [];

  const moveTasksPreference = currentUser.preferences?.moveTasksToLogbook || "next_day";
  const pastDueBehavior = currentUser.preferences?.pastDueTasks || "today";
  const filteredTasks = filterTasks(tasks, currentUser, filterMode);

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  return filteredTasks
    .filter((task) => {
      if (!isTaskVisible(task, today, moveTasksPreference) || !task.dueDate) return false;
      const date = parseDueDate(task.dueDate);
      if (isSameDay(date, today)) return true;
      return date < todayStart && task.status === "active" && pastDueBehavior === "today";
    })
    .sort((a, b) => {
      // Active tasks before completed (when next_day keeps completed visible)
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      const timeA = getSortTime(a.dueDate);
      const timeB = getSortTime(b.dueDate);
      if (timeA !== timeB) return timeA - timeB;
      return a.title.localeCompare(b.title);
    });
}

/**
 * Tasks for iOS task-list widgets — not limited to today.
 * Sorted by day, then active before completed within the same day, then time.
 */
export function getWidgetTasks<T extends TodayTaskSource>(
  tasks: T[],
  currentUser: Parameters<typeof filterTasks>[1],
  filterMode: FilterMode,
  today: Date = new Date()
): T[] {
  if (!currentUser) return [];

  const moveTasksPreference = currentUser.preferences?.moveTasksToLogbook || "next_day";
  const pastDueBehavior = currentUser.preferences?.pastDueTasks || "today";
  const filteredTasks = filterTasks(tasks, currentUser, filterMode);

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  return filteredTasks
    .filter((task) => {
      if (!isTaskVisible(task, today, moveTasksPreference) || !task.dueDate) return false;
      const date = parseDueDate(task.dueDate);
      if (date >= todayStart || isSameDay(date, today)) return true;
      return task.status === "active" && pastDueBehavior === "today";
    })
    .sort((a, b) => {
      const dayA = toDateKey(parseDueDate(a.dueDate!));
      const dayB = toDateKey(parseDueDate(b.dueDate!));
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      const timeA = getSortTime(a.dueDate);
      const timeB = getSortTime(b.dueDate);
      if (timeA !== timeB) return timeA - timeB;
      return a.title.localeCompare(b.title);
    });
}

export function toTodayTaskItems(
  tasks: TodayTaskSource[],
  today: Date = new Date()
): TodayTaskItem[] {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  return tasks.map((task) => {
    const date = task.dueDate ? parseDueDate(task.dueDate) : today;
    const isOverdue =
      Boolean(task.dueDate) &&
      date < todayStart &&
      !isSameDay(date, today) &&
      task.status === "active";

    return {
      id: task._id,
      title: task.title,
      dueDate: task.dueDate,
      dateKey: toDateKey(date),
      isOverdue,
      completed: task.status === "completed",
    };
  });
}
