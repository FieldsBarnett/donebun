import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TaskGroupedList } from "./TaskGroupedList";
import { Inbox } from "lucide-react";
import { filterTasks, FilterMode } from "../lib/filterUtils";

export default function Unscheduled({ filterMode }: { filterMode: FilterMode }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const tasks = (useQuery(api.tasks.getTasks) || []) as any[];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);


  const unscheduledTasks = filterTasks(tasks, currentUser, filterMode)
    .filter(t => t.status === "active" && !t.dueDate);

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
      />
    </div>
  );
}

