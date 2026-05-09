import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BookOpen, Trophy, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { TaskRow } from "./TaskRow";
import { toDateKey, isSameDay } from "../lib/dateUtils";
import { filterTasks, FilterMode } from "../lib/filterUtils";

export default function Logbook({ 
  filterMode, 
  hideHeader = false 
}: { 
  filterMode: FilterMode;
  hideHeader?: boolean;
}) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const tasks = (useQuery(api.tasks.getTasks, {}) || []) as any[];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);

  if (!currentUser) return null;

  const completedTasks = filterTasks(tasks, currentUser, filterMode)
    .filter(t => t.status === "completed");

  // Stats
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  // Start of this week (Monday)
  const tempDate = new Date(now);
  const dayOfWeek = tempDate.getDay(); // 0 is Sunday
  const diff = tempDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(tempDate.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  
  const completedToday = completedTasks.filter(t => (t.statusSet || 0) >= todayStart).length;
  const completedThisWeek = completedTasks.filter(t => (t.statusSet || 0) >= weekStart.getTime()).length;
  const totalCompleted = completedTasks.length;

  // Grouping by completion date
  const groups = completedTasks.reduce((acc, task) => {
    const date = task.statusSet ? new Date(task.statusSet) : new Date();
    const key = toDateKey(date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const formatDateLabel = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";
    
    return date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className={`px-8 py-10 md:px-14 max-w-4xl mx-auto pb-24 ${hideHeader ? 'pt-4' : ''}`}>
      {!hideHeader && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded bg-[var(--color-badge-green)] flex items-center justify-center text-white font-bold text-lg">
            <BookOpen size={18} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Logbook</h2>
        </div>
      )}
      
      {!hideHeader && (
        <p className="text-[var(--color-muted)] text-[15px] mb-8">
          A record of everything you've accomplished. Great job!
        </p>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-10">
        <div className="bg-[var(--color-surface-soft)]/50 border border-[var(--color-hairline)] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <CheckCircle2 size={20} className="text-[var(--color-badge-green)] mb-2" />
          <span className="text-2xl font-bold tracking-tight">{completedToday}</span>
          <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Today</span>
        </div>
        <div className="bg-[var(--color-surface-soft)]/50 border border-[var(--color-hairline)] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <Trophy size={20} className="text-[var(--color-yellow)] mb-2" />
          <span className="text-2xl font-bold tracking-tight">{completedThisWeek}</span>
          <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">This Week</span>
        </div>
        <div className="bg-[var(--color-surface-soft)]/50 border border-[var(--color-hairline)] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <CalendarIcon size={20} className="text-[var(--color-badge-purple)] mb-2" />
          <span className="text-2xl font-bold tracking-tight">{totalCompleted}</span>
          <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Total</span>
        </div>
      </div>

      {completedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-muted)]">
            <BookOpen size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Nothing here yet</h3>
            <p className="text-sm text-[var(--color-muted)]">Completed tasks will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {sortedKeys.map(key => (
            <div key={key}>
              <h3 className="text-[13px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-4 px-1">
                {formatDateLabel(key)}
              </h3>
              <div className="space-y-[1px]">
                {groups[key].sort((a: any, b: any) => (b.statusSet || 0) - (a.statusSet || 0)).map((task: any) => (
                  <TaskRow
                    key={task._id}
                    id={task._id}
                    title={task.title}
                    description={task.description}
                    checklist={task.checklist}
                    completed={true}
                    ownerId={task.ownerId}
                    assigneeId={task.assigneeId}
                    categoryId={task.categoryId}
                    dueDate={task.dueDate}
                    isPrivate={task.isPrivate}
                    isRecurring={(task as any).isRecurring}
                    recurrenceStrategy={(task as any).recurrence?.strategy}
                    onToggle={() => updateTaskStatus({ id: task._id, status: "active" })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
