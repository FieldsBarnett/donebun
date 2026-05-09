import { useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { TaskRow } from "./TaskRow";
import { CalendarDays, Calendar, Clock } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseDueDate, isSameDay, toDateKey } from "../lib/dateUtils";
import { filterTasks, filterCalendarEvents, FilterMode } from "../lib/filterUtils";

// --- Types ---
type Task = {
  _id: string;
  title: string;
  description?: string;
  checklist?: { text: string; completed: boolean }[];
  status: "active" | "completed";
  dueDate?: string;
  ownerId: string;
  assigneeId?: string;
  categoryId?: string;
  isPrivate: boolean;
  recurrence?: any;
};

type CalendarEvent = {
  _id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  assigneeName?: string;
  assigneeColor?: string;
};

type DayItem =
  | { kind: "task"; task: Task; timeMs: number | null }
  | { kind: "event"; event: CalendarEvent; timeMs: number | null };

// --- Helpers ---
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTime(iso: string): string {
  const d = parseDueDate(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayHeader(dateKey: string): { day: string; date: string; isToday: boolean; isYesterday: boolean } {
  const d = parseDateKey(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isToday = isSameDay(d, today);
  const isYesterday = isSameDay(d, yesterday);

  const day = isToday
    ? "Today"
    : isYesterday
    ? "Yesterday"
    : d.toLocaleDateString("default", { weekday: "long" });

  const date = d.toLocaleDateString("default", { month: "long", day: "numeric", year: "numeric" });

  return { day, date, isToday, isYesterday };
}

// Extract time in ms for sorting (null = all-day / no time)
function getTimeMs(iso: string | undefined): number | null {
  if (!iso) return null;
  // All-day events: YYYY-MM-DD format (no "T")
  if (!iso.includes("T")) return null;
  return parseDueDate(iso).getTime();
}

// --- Event row component ---
function EventRow({ event }: { event: CalendarEvent & { assigneeId?: string, color?: string } }) {
  const familyMembers = useQuery(api.users.getMyFamilyMembers) || [];
  const assignee = familyMembers.find(m => m._id === event.assigneeId);
  
  const color = event.color?.startsWith("#")
    ? event.color
    : assignee?.colorCode?.startsWith("#")
      ? assignee.colorCode
      : `var(--color-${event.color ?? assignee?.colorCode ?? "badge-blue"})`;

  const assigneeName = assignee?.name ?? "Unknown";

  return (
    <div className="flex items-center gap-3 py-[10px] bg-[var(--color-canvas)] group">
      {/* Color dot instead of checkbox */}
      <div
        className="flex-shrink-0 w-[22px] h-[22px] rounded-md flex items-center justify-center"
        style={{ backgroundColor: color, opacity: 0.85 }}
      >
        <Calendar size={12} className="text-white" />
      </div>

      {/* Title */}
      <div className="flex-1 text-[15px] text-[var(--color-ink)]">{event.title}</div>

      {/* Time */}
      {!event.isAllDay && (
        <div className="flex items-center gap-1 text-[12px] text-[var(--color-muted)] shrink-0">
          <Clock size={11} />
          <span>{formatTime(event.start)}</span>
          {event.end && <span>–{formatTime(event.end)}</span>}
        </div>
      )}

      {/* Assignee color dot */}
      {event.assigneeColor && (
        <div
          className="w-5 h-5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          title={assigneeName}
        />
      )}
    </div>
  );
}

// --- Main component ---
export default function Timeline({ filterMode }: { filterMode: FilterMode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");

  // Define a stable window for the timeline (e.g. -2 months to +1 year)
  // We normalize to the start of the day to ensure the query arguments are stable
  // across tab switches, preventing redundant re-fetches.
  const { queryStart, queryEnd } = useMemo(() => {
    const s = new Date();
    s.setMonth(s.getMonth() - 2);
    s.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const e = new Date();
    e.setFullYear(e.getFullYear() + 1);
    e.setHours(23, 59, 59, 999); // Normalize to end of day
    
    return { queryStart: s.toISOString(), queryEnd: e.toISOString() };
  }, []);

  const currentUser = useQuery(api.users.getCurrentUser);
  const allTasksFetched = (useQuery(api.tasks.getTasks, { start: queryStart, end: queryEnd }) || []) as Task[];
  const allCalendarEvents = (useQuery(api.calendars.getEventsByFamily, { start: queryStart, end: queryEnd }) || []) as (CalendarEvent & { assigneeId?: string })[];
  const categories = useQuery(api.categories.list) || [];
  const updateStatus = useMutation(api.tasks.updateTaskStatus);

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const moveTasksPreference = currentUser?.preferences?.moveTasksToLogbook || "next_day";

  // Filter items
  const tasks = useMemo(() => {
    const filteredByPrivacy = filterTasks(allTasksFetched, currentUser, filterMode);
    return filteredByPrivacy.filter(t => {
      if (t.status === "active") return true;
      if (t.status === "completed") {
        // Rule: Tasks from the past should still be shown no matter what
        if (t.dueDate) {
          const due = parseDueDate(t.dueDate).getTime();
          if (due < startOfToday) return true;
        }

        // Rule: Show if completed today and preference is next_day
        if (moveTasksPreference === "next_day" && (t as any).statusSet && isSameDay(new Date((t as any).statusSet), today)) {
          return true;
        }
      }
      return false;
    });
  }, [allTasksFetched, currentUser, filterMode, moveTasksPreference, startOfToday]);
  const calendarEvents = useMemo(() => filterCalendarEvents(allCalendarEvents, currentUser, filterMode), [allCalendarEvents, currentUser, filterMode]);

  // Build a map: dateKey -> DayItem[]
  const dayMap = useMemo(() => {
    const map = new Map<string, DayItem[]>();

    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = toDateKey(parseDueDate(task.dueDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        kind: "task",
        task,
        timeMs: getTimeMs(task.dueDate),
      });
    }

    for (const event of calendarEvents) {
      const key = toDateKey(parseDueDate(event.start));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        kind: "event",
        event,
        timeMs: getTimeMs(event.start),
      });
    }

    // Sort items within each day: no-time items first (tasks without specific time at top),
    // then timed items chronologically
    for (const [key, items] of map) {
      map.set(
        key,
        items.sort((a, b) => {
          // All-day / no-time tasks go first
          if (a.timeMs === null && b.timeMs !== null) return -1;
          if (a.timeMs !== null && b.timeMs === null) return 1;
          if (a.timeMs === null && b.timeMs === null) {
            // tasks before events among untimed
            if (a.kind === "task" && b.kind === "event") return -1;
            if (a.kind === "event" && b.kind === "task") return 1;
            return 0;
          }
          return (a.timeMs ?? 0) - (b.timeMs ?? 0);
        })
      );
    }
    return map;
  }, [tasks, calendarEvents]);

  // Sorted list of date keys that have content
  const todayKey = toDateKey(today);

  const allKeys = Array.from(dayMap.keys()).sort();

  // Ensure today is always visible (even if empty)
  if (!dayMap.has(todayKey)) {
    dayMap.set(todayKey, []);
    allKeys.push(todayKey);
    allKeys.sort();
  }

  // Target date from ?date= query param
  const targetDateKey = searchParams.get("date") ?? todayKey;

  // Refs for scrolling to the correct section
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const setSectionRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(key, el);
    else sectionRefs.current.delete(key);
  }, []);

  // Scroll to target date on mount or when target changes
  useEffect(() => {
    // Wait for layout
    const timer = setTimeout(() => {
      const el = sectionRefs.current.get(targetDateKey);
      if (el && containerRef.current) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [targetDateKey, allKeys.join(",")]);

  const handleToggleTask = async (taskId: string, currentStatus: "active" | "completed") => {
    await updateStatus({
      id: taskId as any,
      status: currentStatus === "completed" ? "active" : "completed",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-10 pb-4 md:px-14 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded bg-[var(--color-yellow)] flex items-center justify-center text-white">
          <CalendarDays size={20} />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Timeline</h2>
      </div>

      {/* Scrollable agenda */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-8 md:px-14 pb-24"
        style={{ scrollBehavior: "auto" }}
      >
        <div className="max-w-4xl mx-auto space-y-12">
          {allKeys.map((key) => {
            const items = dayMap.get(key) || [];
            const { day, date, isToday, isYesterday } = formatDayHeader(key);
            const isTarget = key === targetDateKey;

            return (
              <section
                key={key}
                ref={(el) => setSectionRef(key, el)}
                id={`day-${key}`}
                className="scroll-mt-4"
              >
                {/* Day header */}
                <div
                  className={`sticky top-0 z-10 flex items-baseline gap-3 py-3 bg-[var(--color-canvas)] border-b-2 ${
                    isToday
                      ? "border-[var(--color-primary)]"
                      : isYesterday
                      ? "border-[var(--color-muted)]"
                      : "border-[var(--color-hairline)]"
                  }`}
                >
                  <span
                    className={`text-[17px] font-bold leading-none ${
                      isToday
                        ? "text-[var(--color-primary)]"
                        : isYesterday
                        ? "text-[var(--color-muted)]"
                        : "text-[var(--color-ink)]"
                    }`}
                  >
                    {day}
                  </span>
                  <span className="text-[13px] text-[var(--color-muted)] font-normal">{date}</span>
                  {isTarget && !isToday && (
                    <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white font-semibold tracking-wide">
                      Selected
                    </span>
                  )}
                </div>

                {/* Day items */}
                <div className="flex flex-col gap-6 pt-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted)] py-4 italic px-1">
                      Nothing scheduled.
                    </p>
                  ) : (() => {
                    // Group day items
                    const groups: Record<string, DayItem[]> = {};
                    items.forEach(item => {
                      let groupName = "No Category";
                      if (item.kind === "task") {
                        const category = categories.find(c => c._id === item.task.categoryId);
                        groupName = category?.name || "No Category";
                      } else {
                        groupName = "Events";
                      }
                      if (!groups[groupName]) groups[groupName] = [];
                      groups[groupName].push(item);
                    });

                    const sortedGroups = Object.keys(groups).sort((a, b) => {
                      if (a === "Events") return -1; 
                      if (b === "Events") return 1;
                      if (a === "No Category") return -1;
                      if (b === "No Category") return 1;
                      return a.localeCompare(b);
                    });

                    return sortedGroups.map(groupName => (
                      <div key={groupName} className="flex flex-col">
                        {groupName !== "No Category" && (
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <h4 className="text-[12px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                              {groupName}
                            </h4>
                            <div className="flex-1 h-[1px] bg-[var(--color-hairline)]" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          {groups[groupName].map((item, i) => {
                            if (item.kind === "task") {
                              return (
                                <div key={item.task._id + i} className="relative">
                                  {item.timeMs !== null && (
                                    <div className="flex items-center gap-1 pt-2 pb-0.5 text-[11px] text-[var(--color-muted)]">
                                      <Clock size={10} />
                                      <span>{formatTime(item.task.dueDate!)}</span>
                                    </div>
                                  )}
                                  <TaskRow
                                    id={item.task._id as any}
                                    title={item.task.title}
                                    description={item.task.description}
                                    checklist={item.task.checklist}
                                    completed={item.task.status === "completed"}
                                    ownerId={item.task.ownerId as any}
                                    assigneeId={item.task.assigneeId as any}
                                    categoryId={item.task.categoryId as any}
                                    dueDate={item.task.dueDate}
                                    recurrence={item.task.recurrence}
                                    isPrivate={item.task.isPrivate}
                                    isRecurring={(item.task as any).isRecurring}
                                    recurrenceStrategy={(item.task as any).recurrence?.strategy}
                                    isToday={isToday}
                                    onToggle={() => handleToggleTask(item.task._id, item.task.status)}
                                    isExpanded={taskId === item.task._id}
                                    onToggleExpand={() => {
                                      if (taskId === item.task._id) {
                                        searchParams.delete("taskId");
                                        setSearchParams(searchParams);
                                      } else {
                                        searchParams.set("taskId", item.task._id);
                                        setSearchParams(searchParams);
                                      }
                                    }}
                                  />
                                </div>
                              );
                            } else {
                              return <EventRow key={item.event._id + i} event={item.event} />;
                            }
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </section>
            );
          })}

          {allKeys.length === 0 && (
            <div className="py-20 text-center text-[var(--color-muted)]">
              <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No scheduled items yet.</p>
              <p className="text-sm mt-1">Add tasks with due dates to see them here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
