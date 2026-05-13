import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { TaskGroupedList } from "./TaskGroupedList";
import { Inbox, Repeat } from "lucide-react";
import { isSameDay } from "../lib/dateUtils";
import { filterTasks, FilterMode } from "../lib/filterUtils";

export default function Unscheduled({ filterMode }: { filterMode: FilterMode }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");
  const tasks = (useQuery(api.tasks.getTasks, {}) || []) as any[];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);

  const today = new Date();
  const moveTasksPreference = currentUser?.preferences?.moveTasksToLogbook || "next_day";

  const isVisible = (t: any) => {
    if (t.status === "active") return true;
    if (t.status === "completed") {
      if (moveTasksPreference === "next_day") {
        return t.statusSet && isSameDay(new Date(t.statusSet), today);
      }
    }
    return false;
  };

  const allFilteredTasks = filterTasks(tasks, currentUser, filterMode);

  const unscheduledTasks = allFilteredTasks.filter(
    (t) => isVisible(t) && !t.dueDate && !t.isRecurring
  );

  const recurringTasks = allFilteredTasks.filter((t) => isVisible(t) && t.isRecurring);

  const getSeriesId = (t: any) => {
    const id = t._id;
    if (typeof id === "string" && id.includes(":")) {
      return id.split(":")[0];
    }
    return t.parentTaskId || id;
  };

  const nextInSeries = new Map();
  const nowStr = new Date().toISOString();

  recurringTasks.forEach((t) => {
    const seriesId = getSeriesId(t);
    const existing = nextInSeries.get(seriesId);

    if (!existing) {
      nextInSeries.set(seriesId, t);
    } else {
      // Prioritize active tasks over completed ones
      if (t.status === "active" && existing.status === "completed") {
        nextInSeries.set(seriesId, t);
        return;
      }
      if (t.status === "completed" && existing.status === "active") {
        return;
      }

      // Both have same status, pick by date
      const tDate = t.dueDate || "";
      const eDate = existing.dueDate || "";

      if (tDate >= nowStr && eDate < nowStr) {
        nextInSeries.set(seriesId, t);
      } else if (tDate >= nowStr && eDate >= nowStr) {
        if (tDate < eDate) nextInSeries.set(seriesId, t);
      } else if (tDate < nowStr && eDate < nowStr) {
        if (tDate > eDate) nextInSeries.set(seriesId, t);
      }
    }
  });

  const finalRecurringTasks = Array.from(nextInSeries.values());

  return (
    <div className="px-8 py-10 md:px-14 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded bg-[#b2b2b2] flex items-center justify-center text-white">
          <Inbox size={20} />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Unscheduled</h2>
      </div>
      
      <p className="text-[var(--color-muted)] text-[15px] mb-8">
        Tasks with no specific date or deadline. Sort them into categories when you're ready.
      </p>

      <TaskGroupedList 
        tasks={unscheduledTasks} 
        onToggle={(task) => updateTaskStatus({ id: task._id, status: task.status === "completed" ? "active" : "completed" })}
        expandedTaskId={taskId}
        onToggleExpand={(newId) => {
          if (newId) searchParams.set("taskId", newId);
          else searchParams.delete("taskId");
          setSearchParams(searchParams);
        }}
      />

      <div className="flex items-center gap-3 mb-6 mt-16">
        <div className="w-8 h-8 rounded bg-[#b2b2b2] flex items-center justify-center text-white">
          <Repeat size={20} />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Recurring</h2>
      </div>

      <p className="text-[var(--color-muted)] text-[15px] mb-8">
        The next occurrence of each recurring task series.
      </p>

      <TaskGroupedList 
        tasks={finalRecurringTasks} 
        onToggle={(task) => updateTaskStatus({ id: task._id, status: task.status === "completed" ? "active" : "completed" })}
        expandedTaskId={taskId}
        onToggleExpand={(newId) => {
          if (newId) searchParams.set("taskId", newId);
          else searchParams.delete("taskId");
          setSearchParams(searchParams);
        }}
      />
    </div>
  );
}

