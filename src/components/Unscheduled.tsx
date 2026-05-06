import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TaskRow } from "./TaskRow";
import { Inbox } from "lucide-react";

export default function Unscheduled() {
  const tasks = useQuery(api.tasks.getTasks) || [];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const unscheduledTasks = tasks.filter(t => t.status === "active" && !t.dueDate);

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

      <div className="flex flex-col">
        {unscheduledTasks.map(task => (
          <TaskRow 
            key={task._id} 
            title={task.title} 
            completed={false} 
            assigneeColor={task.assigneeColor}
            tags={task.categoryName ? [task.categoryName] : []}
            onToggle={() => updateTaskStatus({ id: task._id, status: "completed" })} 
            onOptions={() => deleteTask({ id: task._id })} 
          />
        ))}
        {unscheduledTasks.length === 0 && (
          <p className="text-sm text-[var(--color-muted)] py-4 italic">No unscheduled tasks.</p>
        )}
      </div>

    </div>
  );
}

