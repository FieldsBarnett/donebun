import { useQuery, useMutation } from "convex/react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { TaskGroupedList } from "./TaskGroupedList";
import SearchBar from "./SearchBar";
import { parseDueDate, isSameDay, toLocalISOString } from "../lib/dateUtils";
import { filterTasks, FilterMode } from "../lib/filterUtils";

export default function Dashboard({ filterMode }: { filterMode: FilterMode }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");
  
  const { end } = useMemo(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    const e = new Date();
    e.setDate(e.getDate() + 7);
    e.setHours(23, 59, 59, 999);
    return { 
      start: toLocalISOString(s, false), 
      end: e.toISOString() 
    };
  }, []);

  const tasks = useQuery(api.tasks.getTasks, { end }) || [];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);


  const today = new Date();
  const moveTasksPreference = currentUser?.preferences?.moveTasksToLogbook || "next_day";

  const filteredTasks = filterTasks(tasks, currentUser, filterMode);

  const isVisible = (t: any) => {
    if (t.status === "active") return true;
    if (t.status === "completed") {
      if (moveTasksPreference === "next_day") {
        // Show if completed today
        return t.statusSet && isSameDay(new Date(t.statusSet), today);
      }
    }
    return false;
  };

  const pastDueBehavior = currentUser?.preferences?.pastDueTasks || "today";

  const todayTasks = filteredTasks.filter(t => {
    if (!isVisible(t) || !t.dueDate) return false;
    const date = parseDueDate(t.dueDate);
    if (isSameDay(date, today)) return true;
    if (date < today && t.status === "active" && pastDueBehavior === "today") return true;
    return false;
  });
  
  const overdueTasks = filteredTasks.filter(t => {
    if (!isVisible(t) || !t.dueDate) return false;
    const date = parseDueDate(t.dueDate);
    return date < today && !isSameDay(date, today) && t.status === "active" && pastDueBehavior === "past";
  });
  const unscheduledTasks = filteredTasks.filter(t => isVisible(t) && !t.dueDate);
  const upcomingTasks = filteredTasks.filter(t => isVisible(t) && t.dueDate && !isSameDay(parseDueDate(t.dueDate), today) && parseDueDate(t.dueDate) > today);

  return (
    <div className="px-8 py-10 md:px-14 max-w-4xl mx-auto pb-24">
      {/* Fuzzy Search */}
      <div className="mb-8">
        <SearchBar />
      </div>

      {/* Star / Today Header styling like Things 3 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded bg-[var(--color-yellow)] flex items-center justify-center text-white font-bold text-lg">
          ★
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Today</h2>
      </div>
      

      <div className="space-y-12">
        {/* Today's Tasks */}
        <section>
          <TaskGroupedList 
            tasks={todayTasks} 
            isToday 
            onToggle={(task) => updateTaskStatus({ id: task._id, status: task.status === "completed" ? "active" : "completed" })}
            expandedTaskId={taskId}
            onToggleExpand={(newId) => {
              if (newId) searchParams.set("taskId", newId);
              else searchParams.delete("taskId");
              setSearchParams(searchParams);
            }}
          />
        </section>

        {overdueTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-6 bg-red-500/50 rounded-full" />
              <h3 className="text-[17px] font-bold text-red-600">Overdue</h3>
            </div>
            <TaskGroupedList 
              tasks={overdueTasks} 
              onToggle={(task) => updateTaskStatus({ id: task._id, status: task.status === "completed" ? "active" : "completed" })}
              expandedTaskId={taskId}
              onToggleExpand={(newId) => {
                if (newId) searchParams.set("taskId", newId);
                else searchParams.delete("taskId");
                setSearchParams(searchParams);
              }}
            />
          </section>
        )}
        
        {/* Unscheduled / Unsorted items */}
        {unscheduledTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-6 bg-[var(--color-muted)]/20 rounded-full" />
              <h3 className="text-[17px] font-bold">Unscheduled</h3>
            </div>
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
          </section>
        )}

        {upcomingTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-6 bg-[var(--color-primary)]/20 rounded-full" />
              <h3 className="text-[17px] font-bold">Upcoming</h3>
            </div>
            <TaskGroupedList 
              tasks={upcomingTasks} 
              onToggle={(task) => updateTaskStatus({ id: task._id, status: task.status === "completed" ? "active" : "completed" })}
              expandedTaskId={taskId}
              onToggleExpand={(newId) => {
                if (newId) searchParams.set("taskId", newId);
                else searchParams.delete("taskId");
                setSearchParams(searchParams);
              }}
            />
          </section>
        )}

      </div>
    </div>
  );
}

