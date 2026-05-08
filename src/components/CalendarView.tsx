import { useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { parseDueDate, isSameDay } from "../lib/dateUtils";
import { filterTasks, filterCalendarEvents, FilterMode } from "../lib/filterUtils";

type ViewMode = "week" | "month";

export default function CalendarView({ filterMode }: { filterMode: FilterMode }) {
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const currentUser = useQuery(api.users.getCurrentUser);
  const allCalendarEvents = useQuery(api.calendars.getEventsByFamily) || [];
  const allTasks = useQuery(api.tasks.getTasks) || [];
  const familyMembers = useQuery(api.users.getMyFamilyMembers) || [];

  const calendarEvents = filterCalendarEvents(allCalendarEvents as any[], currentUser, filterMode);

  const tasks = filterTasks(allTasks, currentUser, filterMode);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }).map((_, i) => {
    if (i === 0) return "12 AM";
    if (i < 12) return `${i} AM`;
    if (i === 12) return "12 PM";
    return `${i - 12} PM`;
  });

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === "month") newDate.setMonth(newDate.getMonth() - 1);
    if (view === "week") newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") newDate.setMonth(newDate.getMonth() + 1);
    if (view === "week") newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const formatHeader = () => {
    if (view === "month") {
      return currentDate.toLocaleString("default", { month: "long", year: "numeric" });
    }
    if (view === "week") {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startMonth = start.toLocaleString("default", { month: "short" });
      const endMonth = end.toLocaleString("default", { month: "short" });

      if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
      } else {
        return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
      }
    }
  };

  // Helper to check if a date is today

  // Deep link: navigate to /timeline?date=YYYY-MM-DD
  const navigateToDay = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    navigate(`/timeline?date=${y}-${m}-${d}`);
  };

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    const dayEvents = calendarEvents.filter((e) => isSameDay(parseDueDate(e.start), date));
    const dayTasks = tasks.filter((t) => t.dueDate && isSameDay(parseDueDate(t.dueDate), date));
    return { events: dayEvents, tasks: dayTasks };
  };

  // Generate Month Days (6 rows to handle edge months)
  const getMonthDays = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDay = new Date(firstDay);
    startDay.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }).map((_, i) => {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      return d;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-canvas)]">
      {/* Calendar Header / Controls */}
      <div className="flex flex-wrap items-center justify-between p-4 md:px-8 gap-3 border-b border-[var(--color-hairline)] bg-white shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-2 md:gap-4 overflow-hidden w-full sm:w-auto">
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <button
              onClick={handleToday}
              className="px-3 md:px-4 py-1.5 text-sm font-medium border border-[var(--color-hairline)] rounded-md hover:bg-black/5 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 border border-[var(--color-hairline)] rounded-md hover:bg-black/5"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 border border-[var(--color-hairline)] rounded-md hover:bg-black/5"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <h2 className="text-lg md:text-xl font-medium tracking-tight truncate min-w-0 sm:ml-2">
            {formatHeader()}
          </h2>
        </div>

        <div className="flex bg-[var(--color-surface-soft)] p-1 rounded-lg border border-[var(--color-hairline)] shrink-0 mx-auto sm:mx-0">
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${view === "week" ? "bg-white shadow-sm text-black" : "text-[var(--color-muted)] hover:text-black"}`}
          >
            Week
          </button>
          <button
            onClick={() => setView("month")}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${view === "month" ? "bg-white shadow-sm text-black" : "text-[var(--color-muted)] hover:text-black"}`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {view === "month" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[var(--color-hairline)] shrink-0 bg-white">
              {days.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-1 divide-x divide-y divide-[var(--color-hairline)] overflow-y-auto">
              {getMonthDays().map((date, i) => {
                const isToday = isSameDay(date, new Date());
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                const { events, tasks: dayTasks } = getItemsForDate(date);

                return (
                  <div
                    key={i}
                    onClick={() => navigateToDay(date)}
                    className={`min-h-[100px] p-1.5 flex flex-col relative cursor-pointer transition-colors hover:bg-[var(--color-primary)]/5 ${
                      !isCurrentMonth ? "bg-[var(--color-surface-soft)]" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 px-1">
                      <span
                        className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-[var(--color-primary)] text-white"
                            : isCurrentMonth
                            ? "text-black hover:bg-black/10"
                            : "text-[var(--color-muted)]"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {(events.length > 0 || dayTasks.length > 0) && (
                        <span className="text-[9px] font-semibold text-[var(--color-muted)] mt-1">
                          {events.length + dayTasks.length}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1 pb-1 scrollbar-hide">
                      {events.slice(0, 3).map((e) => (
                        <div
                          key={e._id}
                          className="text-[10px] px-1.5 py-0.5 rounded text-white truncate shadow-sm"
                          style={{ backgroundColor: e.color || 'var(--color-badge-blue)' }}
                          title={e.title}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayTasks.slice(0, 3 - Math.min(events.length, 3)).map((t) => {
                        const assignee = familyMembers.find(m => m._id === t.assigneeId);
                        const color = assignee?.colorCode?.startsWith("#") ? assignee.colorCode : `var(--color-${assignee?.colorCode || 'badge-pink'})`;
                        return (
                          <div
                            key={t._id}
                            className="text-[10px] px-1.5 py-0.5 rounded text-white truncate shadow-sm flex items-center gap-1"
                            style={{ 
                              backgroundColor: color,
                              opacity: t.status === 'completed' ? 0.6 : 1
                            }}
                            title={t.title}
                          >
                            {assignee?.initials ? (
                              <span className="text-[7px] font-black bg-black/20 px-0.5 rounded-[2px] shrink-0 uppercase">{assignee.initials}</span>
                            ) : (
                              <Users size={8} className="shrink-0" />
                            )}
                            <span className="truncate">{t.title}</span>
                          </div>
                        );
                      })}
                      {events.length + dayTasks.length > 3 && (
                        <div className="text-[9px] text-[var(--color-muted)] pl-1">
                          +{events.length + dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "week" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex border-b border-[var(--color-hairline)] shrink-0 pr-4">
              <div className="w-16 shrink-0 border-r border-[var(--color-hairline)]" />
              <div className="flex-1 grid grid-cols-7 divide-x divide-[var(--color-hairline)]">
                {days.map((d, i) => {
                  const date = new Date(currentDate);
                  date.setDate(currentDate.getDate() - currentDate.getDay() + i);
                  const isToday = isSameDay(date, new Date());
                  return (
                    <div
                      key={d}
                      onClick={() => navigateToDay(date)}
                      className="py-3 flex flex-col items-center justify-center bg-white cursor-pointer hover:bg-[var(--color-primary)]/5 transition-colors"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        {d}
                      </span>
                      <span
                        className={`text-xl font-medium mt-1 w-10 h-10 flex items-center justify-center rounded-full ${
                          isToday ? "bg-[var(--color-primary)] text-white" : "text-black"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex">
              <div className="w-16 shrink-0 flex flex-col border-r border-[var(--color-hairline)] bg-white relative">
                {hours.map((h, i) => (
                  <div key={h} className="h-14 relative flex justify-end pr-2">
                    <span className="text-[10px] text-[var(--color-muted)] absolute -top-2 bg-white px-1 leading-none">
                      {i !== 0 ? h : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-7 divide-x divide-[var(--color-hairline)] relative bg-white">
                <div className="absolute inset-0 pointer-events-none flex flex-col divide-y divide-[var(--color-hairline)]">
                  {hours.map((_, i) => (
                    <div key={i} className="h-14 w-full" />
                  ))}
                </div>

                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const date = new Date(currentDate);
                  date.setDate(currentDate.getDate() - currentDate.getDay() + dayIdx);
                  const { events, tasks: dayTasks } = getItemsForDate(date);

                  return (
                    <div key={dayIdx} className="relative z-0 min-h-[1344px]">
                      {events.map((e) => {
                        const start = parseDueDate(e.start);
                        const top = start.getHours() * 56 + (start.getMinutes() / 60) * 56;
                        return (
                          <div
                            key={e._id}
                            className="absolute left-1 right-1 rounded-md shadow-sm p-1.5 text-white overflow-hidden text-[10px] leading-tight"
                            style={{ 
                              top: `${top}px`, 
                              height: "40px",
                              backgroundColor: e.color || 'var(--color-badge-blue)',
                              border: `1px solid rgba(0,0,0,0.1)`
                            }}
                          >
                            <p className="font-bold truncate">{e.title}</p>
                          </div>
                        );
                      })}
                      {dayTasks.map((t, idx) => {
                        const assignee = familyMembers.find(m => m._id === t.assigneeId);
                        const color = assignee?.colorCode?.startsWith("#") ? assignee.colorCode : `var(--color-${assignee?.colorCode || 'badge-pink'})`;
                        const top = 100 + idx * 50;
                        return (
                          <div
                            key={t._id}
                            className="absolute left-1 right-1 rounded-md shadow-sm p-1.5 text-white overflow-hidden text-[10px] leading-tight"
                            style={{ 
                              top: `${top}px`, 
                              height: "40px",
                              backgroundColor: color,
                              border: `1px solid rgba(0,0,0,0.1)`,
                              opacity: t.status === 'completed' ? 0.6 : 1
                            }}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              {assignee?.initials ? (
                                <span className="text-[8px] font-black bg-black/20 px-0.5 rounded-[2px] shrink-0 uppercase">{assignee.initials}</span>
                              ) : (
                                <Users size={10} className="shrink-0" />
                              )}
                              <p className="font-bold truncate">{t.title}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
