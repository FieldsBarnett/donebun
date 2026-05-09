import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { TaskGroupedList } from "./TaskGroupedList";
import { Inbox } from "lucide-react";
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

  const unscheduledTasks = filterTasks(tasks, currentUser, filterMode)
    .filter(t => isVisible(t) && !t.dueDate);

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
        onToggle={(task) => updateTaskStatus({ id: task._id, status: "completed" })}
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

