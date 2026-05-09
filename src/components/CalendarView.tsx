import { useState, useMemo, useRef, useEffect } from "react";
import { Users } from "lucide-react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { parseDueDate, isSameDay } from "../lib/dateUtils";
import { filterTasks, filterCalendarEvents, FilterMode } from "../lib/filterUtils";

type ViewMode = "week" | "month";

const HOUR_HEIGHT = 44;

export default function CalendarView({ filterMode }: { filterMode: FilterMode }) {
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const monthScrollRef = useRef<HTMLDivElement>(null);
  const weekScrollRef = useRef<HTMLDivElement>(null);

  // Generate a continuous range of days (e.g., 3 months past to 6 months future)
  const { allDays, startISO, endISO } = useMemo(() => {
    const today = new Date();
    const startMonth = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const start = new Date(startMonth);
    start.setDate(startMonth.getDate() - startMonth.getDay()); // Snap to Sunday

    const endMonth = new Date(today.getFullYear(), today.getMonth() + 6, 0);
    const end = new Date(endMonth);
    end.setDate(endMonth.getDate() + (6 - endMonth.getDay())); // Snap to Saturday

    const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysArr = Array.from({ length: totalDays }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });

    return { 
      allDays: daysArr,
      startISO: startMonth.toISOString(),
      endISO: endMonth.toISOString()
    };
  }, []);

  const currentUser = useQuery(api.users.getCurrentUser);
  const allCalendarEvents = useQuery(api.calendars.getEventsByFamily, { start: startISO, end: endISO }) || [];
  const allTasksFetched = useQuery(api.tasks.getTasks, { start: startISO, end: endISO }) || [];
  const familyMembers = useQuery(api.users.getMyFamilyMembers) || [];

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const moveTasksPreference = currentUser?.preferences?.moveTasksToLogbook || "next_day";

  const calendarEvents = useMemo(() => filterCalendarEvents(allCalendarEvents as any[], currentUser, filterMode), [allCalendarEvents, currentUser, filterMode]);

  const tasks = useMemo(() => {
    const filteredByPrivacy = filterTasks(allTasksFetched as any[], currentUser, filterMode);
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


  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }).map((_, i) => {
    if (i === 0) return "12 AM";
    if (i < 12) return `${i} AM`;
    if (i === 12) return "12 PM";
    return `${i - 12} PM`;
  });

  const scrollToToday = (instant = false) => {
    const todayStr = new Date().toDateString();
    
    if (view === "month" && monthScrollRef.current) {
      const todayEl = monthScrollRef.current.querySelector(`[data-date="${todayStr}"]`);
      if (todayEl) {
        todayEl.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center' });
      }
    } else if (view === "week" && weekScrollRef.current) {
      const todayEl = weekScrollRef.current.querySelector(`[data-date="${todayStr}"]`);
      if (todayEl) {
        // Find left position of today relative to scroll container, account for sticky header
        const container = weekScrollRef.current;
        const rect = todayEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft + (rect.left - containerRect.left) - 80; // offset for sticky time column
        container.scrollTo({ left: scrollLeft, behavior: instant ? 'auto' : 'smooth' });
      }
    }
  };

  useEffect(() => {
    // Scroll to today on initial mount and when switching views
    const timer = setTimeout(() => {
      scrollToToday(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [view]);

  const handleToday = () => {
    setCurrentDate(new Date());
    scrollToToday(true);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 3;
    
    const elements = document.elementsFromPoint(x, y);
    const cell = elements.find(el => el.getAttribute('data-date'));
    if (cell) {
      const dateStr = cell.getAttribute('data-date');
      if (dateStr) {
        const d = new Date(dateStr);
        if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
          setCurrentDate(d);
        }
      }
    }
  };

  const formatHeader = () => {
    return currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  };

  const navigateToDay = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    navigate(`/timeline?date=${y}-${m}-${d}`);
  };

  const getItemsForDate = (date: Date) => {
    const dayEvents = calendarEvents.filter((e) => isSameDay(parseDueDate(e.start), date));
    const dayTasks = tasks.filter((t) => t.dueDate && isSameDay(parseDueDate(t.dueDate), date));
    return { events: dayEvents, tasks: dayTasks };
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-canvas)] overflow-hidden">
      {/* Calendar Header / Controls */}
      <div className="flex flex-wrap items-center justify-between p-2.5 md:px-6 gap-2 border-b border-[var(--color-hairline)] bg-white shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-2 md:gap-4 overflow-hidden w-full sm:w-auto">
          <button
            onClick={handleToday}
            className="px-2.5 md:px-3 py-1 text-sm font-medium border border-[var(--color-hairline)] rounded-md hover:bg-black/5 transition-colors shrink-0"
          >
            Today
          </button>
          <h2 className="text-base md:text-lg font-medium tracking-tight truncate min-w-0 sm:ml-2">
            {formatHeader()}
          </h2>
        </div>

        <div className="flex bg-[var(--color-surface-soft)] p-1 rounded-lg border border-[var(--color-hairline)] shrink-0 mx-auto sm:mx-0">
          <button
            onClick={() => setView("week")}
            className={`px-2.5 py-0.5 text-sm font-medium rounded-md transition-all ${view === "week" ? "bg-white shadow-sm text-black" : "text-[var(--color-muted)] hover:text-black"}`}
          >
            Week
          </button>
          <button
            onClick={() => setView("month")}
            className={`px-2.5 py-0.5 text-sm font-medium rounded-md transition-all ${view === "month" ? "bg-white shadow-sm text-black" : "text-[var(--color-muted)] hover:text-black"}`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {view === "month" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-[var(--color-hairline)] shrink-0 bg-white z-10 shadow-sm relative">
              {days.map((d) => (
                <div
                  key={d}
                  className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]"
                >
                  {d}
                </div>
              ))}
            </div>
            
            {/* Scrollable Month Grid */}
            <div 
              ref={monthScrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto"
            >
              <div className="grid grid-cols-7 border-l border-t border-[var(--color-hairline)]">
                {allDays.map((date, i) => {
                  const isToday = isSameDay(date, new Date());
                  const isFirstOfMonth = date.getDate() === 1;
                  const { events, tasks: dayTasks } = getItemsForDate(date);

                  return (
                    <div
                      key={i}
                      data-date={date.toDateString()}
                      onClick={() => navigateToDay(date)}
                      className={`min-h-[120px] p-1.5 flex flex-col relative cursor-pointer border-r border-b border-[var(--color-hairline)] transition-colors hover:bg-[var(--color-primary)]/5 ${
                        isFirstOfMonth ? "!border-l-[3px] !border-l-black/20" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1 px-1">
                        <span
                          className={`text-sm font-medium h-7 flex items-center justify-center rounded-full px-1.5 ${
                            isToday
                              ? "bg-[var(--color-primary)] text-white min-w-[28px]"
                              : isFirstOfMonth
                              ? "font-bold text-black"
                              : "text-black hover:bg-black/10 min-w-[28px]"
                          }`}
                        >
                          {isFirstOfMonth ? date.toLocaleString("default", { month: "short", day: "numeric" }) : date.getDate()}
                        </span>
                        {(events.length > 0 || dayTasks.length > 0) && (
                          <span className="text-[9px] font-semibold text-[var(--color-muted)] mt-1">
                            {events.length + dayTasks.length}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 pb-1 scrollbar-hide">
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
                              className="text-[9px] px-0.5 py-0.5 flex items-center gap-1.5 min-w-0"
                              style={{ opacity: t.status === 'completed' ? 0.5 : 1 }}
                              title={t.title}
                            >
                              <div 
                                className="w-1.5 h-1.5 rounded-full shrink-0 border-[1px]"
                                style={{ 
                                  borderColor: color, 
                                  backgroundColor: t.status === 'completed' ? color : 'transparent' 
                                }}
                              />
                              <span className={`truncate ${t.status === 'completed' ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-ink)]'}`}>
                                {t.title}
                              </span>
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
          </div>
        )}

        {view === "week" && (
          <div 
            ref={weekScrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto bg-white relative"
          >
            <div className="flex flex-col min-w-max">
              {/* Sticky Top Header (Days) */}
              <div className="flex sticky top-0 z-30 bg-white shadow-sm border-b border-[var(--color-hairline)]">
                {/* Top Left Corner (Empty, Sticky) */}
                <div className="w-16 shrink-0 border-r border-[var(--color-hairline)] bg-white sticky left-0 z-40" />
                
                {/* Day Columns Headers */}
                <div className="flex divide-x divide-[var(--color-hairline)] bg-white">
                  {allDays.map((date, i) => {
                    const isToday = isSameDay(date, new Date());
                    const dName = days[date.getDay()];
                    return (
                      <div
                        key={i}
                        onClick={() => navigateToDay(date)}
                        className="w-[120px] md:w-[150px] shrink-0 py-1.5 flex flex-col items-center justify-center bg-white cursor-pointer hover:bg-[var(--color-primary)]/5 transition-colors"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                          {dName}
                        </span>
                        <span
                          className={`text-sm font-medium mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${
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

              {/* Main Body */}
              <div className="flex relative bg-white">
                {/* Sticky Left Column (Hours) */}
                <div className="w-16 shrink-0 flex flex-col border-r border-[var(--color-hairline)] bg-white sticky left-0 z-20">
                  {hours.map((h, i) => (
                    <div key={h} className="relative flex justify-end pr-2 bg-white" style={{ height: `${HOUR_HEIGHT}px` }}>
                      <span className="text-[10px] text-[var(--color-muted)] absolute -top-2 bg-white px-1 leading-none z-10">
                        {i !== 0 ? h : ""}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day Columns Body */}
                <div className="flex relative z-10">
                  {/* Absolute horizontal lines spanning across all days */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col divide-y divide-[var(--color-hairline)] z-0">
                    {hours.map((_, i) => (
                      <div key={i} className="w-full" style={{ height: `${HOUR_HEIGHT}px` }} />
                    ))}
                  </div>

                  {allDays.map((date, dayIdx) => {
                    const { events, tasks: dayTasks } = getItemsForDate(date);
                    const untimedTasks = dayTasks.filter(t => !t.dueDate?.includes("T"));
                    const timedTasks = dayTasks.filter(t => t.dueDate?.includes("T"));
                    
                    const untimedOffset = untimedTasks.length * 18; // Each untimed task takes approx 18px

                    return (
                      <div 
                        key={dayIdx} 
                        data-date={date.toDateString()}
                        className="w-[120px] md:w-[150px] shrink-0 border-r border-[var(--color-hairline)] relative"
                        style={{ minHeight: `${24 * HOUR_HEIGHT}px` }}
                      >
                        {/* Untimed tasks at the top */}
                        <div className="flex flex-col">
                          {untimedTasks.map((t) => {
                            const assignee = familyMembers.find(m => m._id === t.assigneeId);
                            const color = assignee?.colorCode?.startsWith("#") ? assignee.colorCode : `var(--color-${assignee?.colorCode || 'badge-pink'})`;
                            return (
                              <div
                                key={t._id}
                                className="flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] leading-tight"
                                style={{ height: "18px", opacity: t.status === 'completed' ? 0.5 : 1 }}
                              >
                                <div 
                                  className="w-1.5 h-1.5 rounded-full shrink-0 border-[1px]"
                                  style={{ 
                                    borderColor: color, 
                                    backgroundColor: t.status === 'completed' ? color : 'transparent' 
                                  }}
                                />
                                <span className={`truncate ${t.status === 'completed' ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-ink)]'}`}>
                                  {t.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Events and timed tasks shifted by the offset */}
                        {events.map((e) => {
                          const start = parseDueDate(e.start);
                          const top = untimedOffset + start.getHours() * HOUR_HEIGHT + (start.getMinutes() / 60) * HOUR_HEIGHT;
                          return (
                            <div
                              key={e._id}
                              className="absolute left-1 right-1 rounded-md shadow-sm p-1.5 text-white overflow-hidden text-[10px] leading-tight z-10"
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
                        {timedTasks.map((t) => {
                          const assignee = familyMembers.find(m => m._id === t.assigneeId);
                          const color = assignee?.colorCode?.startsWith("#") ? assignee.colorCode : `var(--color-${assignee?.colorCode || 'badge-pink'})`;
                          
                          const d = parseDueDate(t.dueDate!);
                          const top = untimedOffset + d.getHours() * HOUR_HEIGHT + (d.getMinutes() / 60) * HOUR_HEIGHT;

                          return (
                            <div
                              key={t._id}
                              className="absolute left-1 right-1 flex items-center gap-2 px-1.5 py-0 text-[11px] leading-tight z-10"
                              style={{ 
                                top: `${top}px`, 
                                height: "24px",
                                opacity: t.status === 'completed' ? 0.5 : 1,
                              }}
                            >
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0 border-[1.5px]"
                                style={{ 
                                  borderColor: color,
                                  backgroundColor: t.status === 'completed' ? color : 'transparent'
                                }} 
                              />
                              <p className={`font-medium truncate flex-1 ${t.status === 'completed' ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-ink)]'}`}>
                                {t.title}
                              </p>
                              {assignee?.initials && (
                                <span className="text-[8px] font-bold text-[var(--color-muted)]/40 uppercase shrink-0">
                                  {assignee.initials}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
